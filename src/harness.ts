/**
 * The harness. This is where the five parts are wired to each other.
 *
 *   1. system prompt   built per turn in ./system-prompt, refreshed by a hook
 *   2. tools           registered from ./tools
 *   3. agentic loop    pi's. See learn/loop.ts for the version you write yourself.
 *   4. translation     pi's. Swapping provider is a config change, not a code change.
 *   5. memory/context  ./memory decides what is stored; the hook below decides
 *                      what the model sees each turn.
 *
 * Plus the parts pi does not have an opinion about: messaging and guardrails.
 *
 * One AgentSession per conversation. A channel is a conversation; a thread is its
 * own conversation. That is a real design decision - change it here if your
 * platform's idea of a conversation is different.
 */
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  resolveCliModel,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type InlineExtension,
} from "@earendil-works/pi-coding-agent";
import type { HarnessConfig } from "./config.ts";
import { Memory } from "./memory/index.ts";
import { createTools } from "./tools/index.ts";
import { buildSystemPrompt } from "./system-prompt/index.ts";
import { createGuardrailExtension, Gatekeeper, policy } from "./guardrails/index.ts";
import type { IncomingMessage, MessagingAdapter } from "./messaging/types.ts";

export interface Turn {
  speaker: string;
  user: string;
  assistant: string;
  decisions: { tool: string; action: string; reason?: string }[];
}

export interface Conversation {
  key: string;
  channel: string;
  threadId?: string;
  session: AgentSession;
  turns: Turn[];
  startedAt: string;
  /** Guardrail decisions for the turn currently in flight. */
  pendingDecisions?: Turn["decisions"];
}

/**
 * One line a human can read for a tool call's arguments: the field that says
 * what the call is about, when there is one, otherwise the arguments as JSON.
 * Capped, because it is a progress row and not a log. A tool with no arguments
 * gets nothing: "{}" on a progress row is noise.
 */
export function summarizeArgs(args: unknown, max = 200): string {
  const a = (args ?? {}) as Record<string, unknown>;
  const pick = a.command ?? a.path ?? a.file_path ?? a.pattern ?? a.query;
  if (pick === undefined && Object.keys(a).length === 0) return "";
  const text = typeof pick === "string" ? pick : JSON.stringify(args ?? {});
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export class Harness {
  private conversations = new Map<string, Conversation>();
  private gatekeeper = new Gatekeeper(policy);
  private modelRuntime: ModelRuntime | undefined;

  constructor(
    private config: HarnessConfig,
    private memory: Memory,
    private adapter: MessagingAdapter,
  ) {}

  get openConversations(): Conversation[] {
    return [...this.conversations.values()];
  }

  /**
   * Start a conversation: post `header` as a new top-level message, then run a
   * turn on `prompt` whose reply lands in that message's thread. For a harness
   * that speaks first - a scheduled brief, a reminder.
   *
   * The sender is the internal "scheduler". It is not a platform user and
   * cannot be claimed by one, because adapters take the sender id from the
   * platform. This is the only caller of `internal: true`: keep it that way, or
   * the inbox guardrail has a side door.
   */
  async initiate(header: string, prompt: string): Promise<{ channel: string; threadId: string }> {
    if (!this.adapter.post) throw new Error(`the ${this.adapter.name} adapter cannot start a conversation`);
    const where = await this.adapter.post(header);
    await this.handleMessage(
      {
        channel: where.channel,
        threadId: where.threadId,
        sender: { id: "scheduler", display: "scheduler" },
        text: prompt,
        ts: new Date().toISOString(),
      },
      { internal: true },
    );
    return where;
  }

  async handleMessage(message: IncomingMessage, opts: { internal?: boolean } = {}): Promise<void> {
    // Guardrail, inbox side. Before a single token is spent. An internal turn
    // never came through the inbox, so there is nothing to admit; everything
    // from a platform still goes through here.
    const admitted = opts.internal
      ? { ok: true as const, reason: undefined }
      : this.gatekeeper.admit(message.sender, message.channel);
    if (!admitted.ok) {
      await this.adapter.send({
        channel: message.channel,
        threadId: message.threadId,
        text: `Ignored: ${admitted.reason}`,
      });
      return;
    }

    this.memory.appendTranscript({
      ts: message.ts,
      channel: message.channel,
      sender: message.sender.display,
      text: message.text,
    });

    const conversation = await this.getConversation(message);
    const decisions: Turn["decisions"] = [];
    conversation.pendingDecisions = decisions;

    let assistantText = "";
    const unsubscribe = conversation.session.subscribe((event) => {
      // Progress is fire-and-forget: the turn never waits on it and never fails
      // because of it. The summary goes through the same redact list as a reply.
      if (event.type === "tool_execution_start" || event.type === "tool_execution_end") {
        const started = event.type === "tool_execution_start";
        void this.adapter
          .progress?.(message.channel, message.threadId, {
            kind: started ? "tool_start" : "tool_end",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            summary: started ? this.gatekeeper.redact(summarizeArgs(event.args)) : "",
            ok: started ? undefined : !event.isError,
          })
          ?.catch(() => {});
        return;
      }
      if (event.type !== "message_end") return;
      const ended = event.message as { role?: string; content?: unknown };
      if (ended.role !== "assistant" || !Array.isArray(ended.content)) return;
      for (const part of ended.content as { type: string; text?: string }[]) {
        // One turn can end several assistant messages (text, tool call, more
        // text). Keep them apart, or "...10:00).Saved:" runs two thoughts together.
        if (part.type === "text" && part.text) assistantText += (assistantText ? "\n\n" : "") + part.text;
      }
    });

    try {
      await conversation.session.prompt(message.text);
    } catch (error) {
      assistantText = `The model call failed: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      unsubscribe();
    }

    const reply = this.gatekeeper.redact(assistantText.trim() || "(no reply)");
    await this.adapter.send({ channel: message.channel, threadId: message.threadId, text: reply });

    this.memory.appendTranscript({
      ts: new Date().toISOString(),
      channel: message.channel,
      sender: "harness",
      text: reply,
    });

    conversation.turns.push({
      speaker: message.sender.display,
      user: message.text,
      assistant: reply,
      decisions,
    });
  }

  private async getConversation(message: IncomingMessage): Promise<Conversation> {
    const key = message.threadId ? `${message.channel}#${message.threadId}` : message.channel;
    const existing = this.conversations.get(key);
    if (existing) return existing;

    const conversation: Conversation = {
      key,
      channel: message.channel,
      threadId: message.threadId,
      turns: [],
      startedAt: new Date().toISOString(),
      session: undefined as unknown as AgentSession,
    };

    const guardrails = createGuardrailExtension({
      policy,
      gatekeeper: this.gatekeeper,
      adapter: this.adapter,
      channel: message.channel,
      threadId: message.threadId,
      onDecision: (decision) => conversation.pendingDecisions?.push(decision),
    });

    // Part 5, the live half. The system prompt is rebuilt before every agent run
    // so the memory index reflects anything written since the last turn.
    const freshContext: InlineExtension = {
      name: "context-refresh",
      factory: (pi) => {
        pi.on("before_agent_start", async () => ({
          systemPrompt: buildSystemPrompt(this.memory, {
            channel: message.channel,
            speaker: message.sender.display,
            platform: this.adapter.name,
          }),
        }));
      },
    };

    const agentDir = getAgentDir();
    // This repo is the operator's own. Trusting it lets pi load the skills and
    // extensions we pass in below. We still set noContextFiles, so nothing from
    // the repo reaches the system prompt without going through ./system-prompt.
    const settingsManager = SettingsManager.create(this.config.root, agentDir, { projectTrusted: true });
    const loader = new DefaultResourceLoader({
      cwd: this.config.root,
      agentDir,
      settingsManager,
      // We own the system prompt. Do not let pi's coding-agent default or the
      // repo's AGENTS.md leak into it.
      systemPrompt: buildSystemPrompt(this.memory, {
        channel: message.channel,
        speaker: message.sender.display,
        platform: this.adapter.name,
      }),
      noContextFiles: true,
      additionalSkillPaths: [this.config.skillsDir],
      extensionFactories: [guardrails, freshContext],
    });
    await loader.reload();

    this.modelRuntime ??= await ModelRuntime.create();
    const resolved = this.config.model
      ? resolveCliModel({
          cliProvider: this.config.model.provider,
          cliModel: this.config.model.id,
          modelRuntime: this.modelRuntime,
        })
      : undefined;
    if (resolved?.error) throw new Error(`HARNESS_MODEL: ${resolved.error}`);

    const { session } = await createAgentSession({
      cwd: this.config.root,
      agentDir,
      modelRuntime: this.modelRuntime,
      model: resolved?.model,
      resourceLoader: loader,
      settingsManager,
      sessionManager: SessionManager.inMemory(),
      customTools: createTools(this.memory),
      tools: this.config.tools,
    });

    conversation.session = session;
    this.conversations.set(key, conversation);
    return conversation;
  }

  async dispose(): Promise<void> {
    for (const conversation of this.conversations.values()) conversation.session.dispose();
    this.conversations.clear();
  }
}
