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
 * accept.ts runs the same check again, for proposals written before this existed
 * or edited by hand.
 *
 * This is a heuristic over the model's structured output, and it will miss a
 * clever paraphrase. That is acceptable because it is not the only layer: prompt,
 * tool and skill proposals are never applied automatically, and policy.ts is not
 * something reflection can write. What this removes is the easy route, the one a
 * tired reviewer would wave through.
 *
 * It deliberately over-drops. A proposal that tightens a Never rule by rewording
 * it is dropped too, because telling a tightening from a loosening needs judgement
 * this cannot have. The dropped text is kept, so nothing is lost; it just has to
 * be applied by a human who read it.
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
 * Remove every item that touches a guardrail from a reflection proposal.
 *
 * An item is one `- ` bullet with its indented continuation lines, or one fenced
 * block. Headings left with nothing under them are removed too, so the proposal
 * never shows an empty "## system prompt" that reads as if something were there.
 */
export function dropGuardrailChanges(
  markdown: string,
  nevers: readonly string[],
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
    const why = touchesGuardrail(section, item, nevers);
    if (why) dropped.push({ section, text: item, why });
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
