/**
 * One layer every tool call and every outbound message passes through.
 *
 * Three enforcement points, all of them here:
 *   1. before a tool runs   - deny outright, or hold for human approval
 *   2. after a tool returns - redact secrets before the model ever sees them
 *   3. around the inbox     - who may talk, in which channel, how often
 *
 * Enforcement lives in the harness, not in the system prompt. A rule you only
 * wrote in the prompt is a request. A rule here is a rule.
 */
import type { InlineExtension } from "@earendil-works/pi-coding-agent";
import type { GuardrailPolicy } from "./policy.ts";
import type { MessagingAdapter, Sender } from "../messaging/types.ts";

export type { GuardrailPolicy } from "./policy.ts";
export { policy } from "./policy.ts";

export interface Verdict {
  ok: boolean;
  reason?: string;
}

/** Inbox-side checks. Shared across every conversation in the process. */
export class Gatekeeper {
  private hits = new Map<string, number[]>();

  constructor(private policy: GuardrailPolicy) {}

  admit(sender: Sender, channel: string): Verdict {
    const { allowFrom, allowChannels, rateLimit } = this.policy;
    if (!allowFrom.includes("*") && !allowFrom.includes(sender.id)) {
      return { ok: false, reason: `sender ${sender.display} is not on allowFrom` };
    }
    if (!allowChannels.includes("*") && !allowChannels.includes(channel)) {
      return { ok: false, reason: `channel ${channel} is not on allowChannels` };
    }
    const now = Date.now();
    const window = rateLimit.perSeconds * 1000;
    const recent = (this.hits.get(sender.id) ?? []).filter((t) => now - t < window);
    if (recent.length >= rateLimit.messages) {
      return { ok: false, reason: `rate limit: ${rateLimit.messages} messages per ${rateLimit.perSeconds}s` };
    }
    recent.push(now);
    this.hits.set(sender.id, recent);
    return { ok: true };
  }

  redact(text: string): string {
    let out = text;
    for (const rule of this.policy.redact) out = out.replace(rule.pattern, rule.replacement);
    return out;
  }
}

/**
 * The tool-side half, as a pi extension.
 *
 * Built once per conversation and closed over that conversation, so an approval
 * prompt always lands in the channel the tool call came from - even when several
 * channels are mid-turn at the same time.
 */
export function createGuardrailExtension(opts: {
  policy: GuardrailPolicy;
  gatekeeper: Gatekeeper;
  adapter: MessagingAdapter;
  channel: string;
  threadId?: string;
  /** Called for every decision, so the session log can show what was stopped. */
  onDecision?: (decision: { tool: string; action: "allowed" | "denied" | "approved" | "rejected"; reason?: string }) => void;
}): InlineExtension {
  const { policy, gatekeeper, adapter, channel, threadId, onDecision } = opts;

  return {
    name: "guardrails",
    factory: (pi) => {
      pi.on("tool_call", async (event) => {
        const rendered = gatekeeper.redact(JSON.stringify(event.input));

        const denied = policy.deny.find(
          (r) => r.tool === event.toolName && (!r.match || r.match.test(rendered)),
        );
        if (denied) {
          onDecision?.({ tool: event.toolName, action: "denied", reason: denied.reason });
          return {
            block: true,
            reason: `Blocked by guardrail policy: ${denied.reason}. Do not retry this call; find another way or ask the human.`,
          };
        }

        const needsApproval = policy.requireApproval.find(
          (r) => r.tool === event.toolName && (!r.match || r.match.test(rendered)),
        );
        if (needsApproval) {
          // Any failure to get a clear yes is a no. A broken approval path must
          // never become an approval: that is the difference between a guardrail
          // and a formality.
          const approved = await adapter
            .requestApproval({
              channel,
              threadId,
              toolName: event.toolName,
              detail: rendered.slice(0, 500),
              reason: `${needsApproval.reason} - approval required`,
            })
            .catch(() => false);
          onDecision?.({
            tool: event.toolName,
            action: approved ? "approved" : "rejected",
            reason: needsApproval.reason,
          });
          if (!approved) {
            return { block: true, reason: `A human declined this call (${needsApproval.reason}).` };
          }
          return;
        }

        onDecision?.({ tool: event.toolName, action: "allowed" });
      });

      // Redact on the way back in, so a leaked secret never enters the context
      // window - not just the channel.
      pi.on("tool_result", async (event) => ({
        content: event.content.map((part) =>
          part.type === "text" ? { ...part, text: gatekeeper.redact(part.text) } : part,
        ),
      }));
    },
  };
}
