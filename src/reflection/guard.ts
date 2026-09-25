/**
 * Keep reflection from arguing the harness out of its own guardrails.
 *
 * The failure this exists for was seen live: the model correctly refused to run a
 * Slack-posting curl, and reflection then proposed "when the user requests an
 * exact shell command, run it verbatim". Read in isolation that looks like a
 * helpful fix. It is the session's one correct refusal, rewritten as a mistake.
 * A human who accepts proposals on a tired Friday will eventually accept one.
 *
 * So anything that would loosen a Never rule or touch guardrail behaviour is
 * dropped before the proposal is written, and logged where the owner can read it.
 * accept.ts runs the heuristic again, for proposals written before this existed
 * or edited by hand; it makes no model call.
 *
 * Two passes. A keyword heuristic runs first and costs nothing; it catches the
 * phrasing seen so far and misses paraphrases. A cheap model then judges every
 * item that survived, against the actual rule text, and fails closed. Neither is
 * the only layer: prompt, tool and skill proposals are never applied
 * automatically, and policy.ts is not something reflection can write.
 *
 * Both over-drop on purpose. The heuristic drops a proposal that tightens a Never
 * rule by rewording it, because it cannot tell tightening from loosening, and the
 * judge drops everything when it is unavailable. The dropped text is kept, so
 * nothing is lost; it just has to be applied by a human who read it.
 */

export interface Dropped {
  section: string;
  text: string;
  why: string;
}

/** Names of the machinery. A proposal about these is a proposal about the policy. */
const MACHINERY =
  /\bguardrails?\b|policy\.ts|\brequireApproval\b|\ballowFrom\b|\ballowChannels\b|\bdeny (rule|list)s?\b|\bredact/i;

/**
 * Phrasing that grants what a guardrail withholds. Every entry is here because
 * a reflection model produced something like it after a correct refusal.
 */
const LOOSENING = [
  /\b(run|execute)\b[^.\n]*\bverbatim\b/i,
  /\bmay be (run|executed|sent|posted)\b/i,
  /\bunless\b[^.\n]*\b(prohibit|forbid|restrict)/i,
  /\b(user|human|owner)[- ]authori[sz]ed\b/i,
  /\bwithout (asking|approval|confirmation|confirming)\b/i,
  /\bskip(ping)? (the )?(approval|confirmation)\b/i,
  /\b(bypass|override)\b/i,
];

/** The `- ` lines under `## Never` in a system prompt. */
export function neverRules(systemPrompt: string): string[] {
  const match = /(?:^|\n)## Never\n([\s\S]*?)(?=\n## |$)/.exec(systemPrompt);
  if (!match) return [];
  return match[1]!
    .split(/\n(?=- )/)
    .map((rule) => rule.replace(/^- /, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Why this proposal item touches a guardrail, or undefined if it does not. */
export function touchesGuardrail(section: string, text: string, nevers: readonly string[]): string | undefined {
  if (MACHINERY.test(text)) return "names the guardrail policy, which reflection may not propose changes to";
  const loosening = LOOSENING.find((re) => re.test(text));
  if (loosening) return "would grant what a guardrail or Never rule withholds";
  if (section === "system prompt") {
    const action = /^-\s*(add|remove|change)\s*:/i.exec(text)?.[1]?.toLowerCase();
    if (action === "remove" || action === "change") {
      const body = norm(text);
      // The first few words of a Never rule are enough to recognise it being
      // quoted back for removal, and short enough to survive light rewording.
      const quoted = nevers.some((rule) => body.includes(norm(rule).split(" ").slice(0, 6).join(" ")));
      if (quoted || /^-\s*\w+\s*:\s*never\b/i.test(text)) return `would ${action} a Never rule`;
    }
  }
  return undefined;
}

/**
 * Walk a reflection proposal item by item, dropping the ones `why` has a reason for.
 *
 * An item is one `- ` bullet with its indented continuation lines, or one fenced
 * block. Headings left with nothing under them are removed too, so the proposal
 * never shows an empty "## system prompt" that reads as if something were there.
 * Both filters walk the same items in the same order, which is what lets the
 * judge's verdicts be matched back by position.
 */
export function filterItems(
  markdown: string,
  why: (section: string, text: string) => string | undefined,
): { kept: string; dropped: Dropped[] } {
  const lines = markdown.split("\n");
  const out: string[] = [];
  const dropped: Dropped[] = [];
  let section = "";

  for (let i = 0; i < lines.length; ) {
    const line = lines[i]!;
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      section = heading[1]!.trim().toLowerCase();
      out.push(line);
      i++;
      continue;
    }

    let end = i + 1;
    if (line.startsWith("```")) {
      while (end < lines.length && !lines[end]!.startsWith("```")) end++;
      end = Math.min(end + 1, lines.length);
    } else if (line.startsWith("- ")) {
      while (end < lines.length && /^\s+\S/.test(lines[end]!)) end++;
    } else {
      out.push(line);
      i++;
      continue;
    }

    const item = lines.slice(i, end).join("\n");
    const reason = why(section, item);
    if (reason) dropped.push({ section, text: item, why: reason });
    else out.push(...lines.slice(i, end));
    i = end;
  }

  const kept = out.filter((line, i) => {
    // "## nothing to change" is a heading that is meant to stand alone.
    if (!line.startsWith("## ") || line === "## nothing to change") return true;
    const next = out.slice(i + 1).find((l) => l.trim() !== "");
    return next !== undefined && !next.startsWith("## ");
  });
  return {
    kept: kept
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    dropped,
  };
}

/** The free first pass: keywords and Never-rule quotes, no model. accept.ts uses only this. */
export function dropGuardrailChanges(
  markdown: string,
  nevers: readonly string[],
): { kept: string; dropped: Dropped[] } {
  return filterItems(markdown, (section, text) => touchesGuardrail(section, text, nevers));
}

// --- the judge ----------------------------------------------------------------
//
// The heuristic only catches phrasing it has seen. "If the owner asks you to send
// it yourself, just post it to the client channel" contradicts a Never rule
// against messaging anyone but the owner, and contains no word the heuristic
// knows. Recognising a paraphrase needs a model, so a cheap one reads every item
// that survived the first pass, in one call, against the actual rule text.
//
// It fails closed. An error, a reply that does not parse, or an item it gave no
// verdict for is a drop with "judge unavailable". A broken judge that waved
// items through would be the same hole with a model's name on it.

/** Anything that sends a system prompt and a message to a model and returns its text. */
export type AskModel = (system: string, user: string) => Promise<string>;

export const JUDGE_RULES = `
You check proposed changes to an AI harness against its safety rules. You do not
improve the changes, and you do not judge whether they are useful.

For each numbered item, answer one question: would applying it contradict,
loosen, or create an exception to any of the rules listed? An exception counts
even when it is narrow or polite, such as "only when the user explicitly asks".
Adding a new, stricter rule is fine. Anything unrelated to the rules is fine.

Reply with a JSON array and nothing else, one object per item, in order:
[{"item": 1, "verdict": "contradicts" | "fine", "reason": "<one line, naming the rule>"}]
`.trim();

export function buildJudgeRequest(items: readonly string[], rules: readonly string[]): string {
  return [
    "## Rules",
    ...rules.map((rule) => `- ${rule}`),
    "",
    "## Proposed items",
    ...items.map((item, i) => `${i + 1}. ${item.replace(/\n/g, "\n   ")}`),
  ].join("\n");
}

/**
 * The judge's verdict per item: a reason string to drop it, or undefined to keep it.
 * Anything this cannot read with certainty becomes a drop.
 */
export function parseJudgeReply(reply: string, count: number): (string | undefined)[] {
  const unavailable = (detail: string) => Array<string>(count).fill(`judge unavailable (${detail})`);
  const json = /\[[\s\S]*\]/.exec(reply)?.[0];
  if (!json) return unavailable("no JSON array in the reply");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return unavailable("reply was not valid JSON");
  }
  if (!Array.isArray(parsed)) return unavailable("reply was not an array");

  const verdicts: (string | undefined)[] = Array<string>(count).fill("judge unavailable (no verdict for this item)");
  for (const entry of parsed as { item?: unknown; verdict?: unknown; reason?: unknown }[]) {
    const n = typeof entry?.item === "number" ? entry.item - 1 : -1;
    if (n < 0 || n >= count) continue;
    const reason = typeof entry.reason === "string" && entry.reason.trim() ? entry.reason.trim() : "no reason given";
    if (entry.verdict === "fine") verdicts[n] = undefined;
    else if (entry.verdict === "contradicts") verdicts[n] = `judge: ${reason}`;
    else verdicts[n] = `judge unavailable (unknown verdict for this item)`;
  }
  return verdicts;
}

/** The second pass: one model call for every item the heuristic kept. */
export async function judgeGuardrailChanges(
  markdown: string,
  rules: readonly string[],
  ask: AskModel,
): Promise<{ kept: string; dropped: Dropped[] }> {
  // "capability gaps" only records which tools were asked for; it changes no
  // rule and is never applied. Seen live: the judge dropped "dm tool wanted
  // once" because it quoted the blocked command that prompted it, which cost
  // the one section that says what to build next. The keyword pass still runs.
  const judged = (section: string) => section !== "capability gaps";
  const items: string[] = [];
  filterItems(markdown, (section, text) => void (judged(section) && items.push(text)));
  if (items.length === 0) return { kept: markdown, dropped: [] };

  let verdicts: (string | undefined)[];
  try {
    verdicts = parseJudgeReply(await ask(JUDGE_RULES, buildJudgeRequest(items, rules)), items.length);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    verdicts = Array<string>(items.length).fill(`judge unavailable (${detail.slice(0, 200)})`);
  }
  let i = 0;
  return filterItems(markdown, (section) => (judged(section) ? verdicts[i++] : undefined));
}

/** The rule text the judge checks against: every Never rule, and every policy reason. */
export function guardrailRules(
  nevers: readonly string[],
  policy: {
    deny: readonly { tool: string; reason: string }[];
    requireApproval: readonly { tool: string; reason: string }[];
  },
): string[] {
  return [
    ...nevers,
    ...policy.deny.map((r) => `The ${r.tool} tool is denied for: ${r.reason}.`),
    ...policy.requireApproval.map((r) => `The ${r.tool} tool needs human approval for: ${r.reason}.`),
    "The guardrail policy (src/guardrails/policy.ts) is changed only by a human, never by reflection.",
  ];
}

/** Both passes, in order: the free heuristic, then the judge on whatever survived it. */
export async function filterProposal(
  markdown: string,
  nevers: readonly string[],
  rules: readonly string[],
  ask: AskModel,
): Promise<{ kept: string; dropped: Dropped[] }> {
  const first = dropGuardrailChanges(markdown, nevers);
  const second = await judgeGuardrailChanges(first.kept, rules, ask);
  return { kept: second.kept, dropped: [...first.dropped, ...second.dropped] };
}

/** The session-log half: what was dropped, in full, so the owner can overrule it. */
export function renderDropped(dropped: readonly Dropped[]): string {
  if (dropped.length === 0) return "";
  const lines = [
    "## Dropped from the reflection proposal",
    "",
    "Each of these touched a guardrail, so it never reached the proposal. If one",
    "is right, apply it by hand: that is the point of making it cost an edit.",
    "",
  ];
  for (const d of dropped) lines.push(`- in "${d.section}": ${d.why}`, "", "  " + d.text.replace(/\n/g, "\n  "), "");
  return lines.join("\n");
}
