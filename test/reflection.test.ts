/**
 * Reflection writes markdown that a human reads and a script applies. Both
 * halves have to agree on the format, or a proposal is either unreadable or
 * silently unapplied.
 *
 * The `section` tests exist because that function shipped broken once: a `$` in
 * multiline mode ended every section at the first newline, so every proposal's
 * prompt, tool and skill findings were parsed as empty and never shown.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMemoryBlocks, section } from "../src/reflection/accept.ts";
import {
  dropGuardrailChanges,
  filterProposal,
  guardrailRules,
  JUDGE_RULES,
  neverRules,
  parseJudgeReply,
  renderDropped,
  type AskModel,
} from "../src/reflection/guard.ts";
import { judgeModelFor, renderSessionLog } from "../src/reflection/index.ts";
import { policy } from "../src/guardrails/policy.ts";
import type { Conversation } from "../src/harness.ts";

const PROPOSAL = `# Reflection proposal

- Session: cli

## capability gaps
- query_traces: wanted 2 times. "why did abc123 fail?"
- gh_pr_read: wanted 1 time. "review PR 412"

## memory

\`\`\`file:entities/people/dana.md action:replace
---
name: Dana
summary: SRE, wants infra changes as a diff
---

body line
\`\`\`

## system prompt

- add: Name the owner before acting on infrastructure.
  because: turn 3 skipped it.

## skills

- incident-recap: the same five steps twice.
`;

describe("section", () => {
  test("returns a multi-line section whole", () => {
    const gaps = section(PROPOSAL, "capability gaps");
    assert.match(gaps, /query_traces: wanted 2 times/);
    assert.match(gaps, /gh_pr_read: wanted 1 time/);
    assert.equal(gaps.split("\n").length, 2);
  });

  test("stops at the next heading and does not swallow it", () => {
    const prompt = section(PROPOSAL, "system prompt");
    assert.match(prompt, /Name the owner before acting/);
    assert.doesNotMatch(prompt, /incident-recap/);
    assert.doesNotMatch(prompt, /^## /m);
  });

  test("reads the last section, which has no heading after it", () => {
    assert.match(section(PROPOSAL, "skills"), /incident-recap/);
  });

  test("a missing section is empty, not an error", () => {
    assert.equal(section(PROPOSAL, "tools"), "");
  });

  test("does not match a heading that merely starts with the name", () => {
    assert.equal(section("\n## memory bank\ncontent\n", "memory"), "");
  });
});

describe("parseMemoryBlocks", () => {
  test("extracts the path, the action and the body", () => {
    const blocks = parseMemoryBlocks(PROPOSAL);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0]?.file, "entities/people/dana.md");
    assert.equal(blocks[0]?.action, "replace");
    assert.match(blocks[0]!.content, /name: Dana/);
    assert.match(blocks[0]!.content, /body line/);
  });

  test("finds every block, not just the first", () => {
    const two = `\`\`\`file:a.md action:create\nA\n\`\`\`\n\n\`\`\`file:b.md action:replace\nB\n\`\`\`\n`;
    const blocks = parseMemoryBlocks(two);
    assert.deepEqual(blocks.map((b) => b.file), ["a.md", "b.md"]);
    assert.deepEqual(blocks.map((b) => b.action), ["create", "replace"]);
  });

  test("ignores an unknown action rather than guessing one", () => {
    // "delete" is not a supported action. Treating it as replace would let a
    // proposal destroy a memory file through a typo.
    assert.deepEqual(parseMemoryBlocks("```file:a.md action:delete\nX\n```"), []);
  });

  test("a proposal with nothing to apply parses to nothing", () => {
    assert.deepEqual(parseMemoryBlocks("# Reflection proposal\n\n## nothing to change\n"), []);
  });
});

describe("renderSessionLog", () => {
  const conversation = (turns: Conversation["turns"]): Conversation => ({
    key: "cli",
    channel: "cli",
    session: undefined as never,
    turns,
    startedAt: "2026-08-30T10:00:00.000Z",
  });

  test("includes what was said on both sides, since that is all reflection sees", () => {
    const log = renderSessionLog(
      conversation([{ speaker: "nave", user: "who is on call?", assistant: "Dana.", decisions: [] }]),
    );
    assert.match(log, /\*\*nave:\*\* who is on call\?/);
    assert.match(log, /\*\*harness:\*\* Dana\./);
    assert.match(log, /Turns: 1/);
  });

  test("records guardrail decisions, so a blocked call is visible to reflection", () => {
    const log = renderSessionLog(
      conversation([
        {
          speaker: "nave",
          user: "delete the logs",
          assistant: "Declined.",
          decisions: [{ tool: "bash", action: "rejected", reason: "destructive command" }],
        },
      ]),
    );
    assert.match(log, /Guardrail decisions:/);
    assert.match(log, /bash: rejected \(destructive command\)/);
  });

  test("an empty session renders a log rather than throwing", () => {
    assert.match(renderSessionLog(conversation([])), /Turns: 0/);
  });
});

describe("dropGuardrailChanges", () => {
  const nevers = neverRules(readFileSync(join(import.meta.dirname, "../src/system-prompt/SYSTEM_PROMPT.md"), "utf8"));

  // Verbatim from a real session: the model refused to run a Slack-posting curl,
  // which was correct, and reflection proposed teaching it not to.
  const LIVE = `## system prompt
- add: When the user explicitly requests execution of an exact shell command, run it verbatim unless a specific safety restriction prohibits it; do not substitute a draft or simulation.
  because: The user requested an exact \`curl\` command, but the harness refused and returned a Slack draft instead.

## tools
- bash: The model failed to use bash for an explicitly requested command. Clarify that user-authorized network commands and external side effects may be executed unless specifically prohibited.`;

  test("reads the Never rules out of the shipped system prompt", () => {
    assert.ok(nevers.length >= 5);
    assert.ok(nevers.some((rule) => rule.startsWith("Never retry a tool call that a guardrail blocked")));
  });

  test("drops both items from the live proposal, and leaves no empty headings", () => {
    const { kept, dropped } = dropGuardrailChanges(LIVE, nevers);
    assert.equal(dropped.length, 2);
    assert.deepEqual(dropped.map((d) => d.section), ["system prompt", "tools"]);
    assert.equal(kept, "");
  });

  test("keeps the because: line with the item it belongs to", () => {
    const { dropped } = dropGuardrailChanges(LIVE, nevers);
    assert.match(dropped[0]!.text, /because: The user requested an exact/);
  });

  test("drops the removal of a Never rule", () => {
    const md = "## system prompt\n- remove: Never claim you did something you did not do.\n  because: slowed me down.";
    const { dropped } = dropGuardrailChanges(md, nevers);
    assert.equal(dropped.length, 1);
    assert.match(dropped[0]!.why, /remove a Never rule/);
  });

  test("drops anything that names the policy, in any section", () => {
    const md = "## tools\n- bash: add git push to the allowed list in policy.ts";
    assert.equal(dropGuardrailChanges(md, nevers).dropped.length, 1);
  });

  test("drops a memory block that would record a standing permission", () => {
    const md =
      "## memory\n```file:entities/people/nave.md action:replace\n---\nname: Nave\n---\nWants curl commands run without asking.\n```";
    const { kept, dropped } = dropGuardrailChanges(md, nevers);
    assert.equal(dropped.length, 1);
    assert.deepEqual(parseMemoryBlocks(kept), []);
  });

  test("keeps an ordinary proposal untouched, so the filter is not a mute button", () => {
    const { kept, dropped } = dropGuardrailChanges(PROPOSAL.trim(), nevers);
    assert.deepEqual(dropped, []);
    assert.equal(kept, PROPOSAL.trim());
  });

  test("keeps an added Never rule, which tightens rather than loosens", () => {
    const md = "## system prompt\n- add: Never post to a channel the owner did not name.\n  because: turn 2.";
    assert.equal(dropGuardrailChanges(md, nevers).dropped.length, 0);
  });

  test("drops the bad item and keeps its neighbour", () => {
    const md =
      "## system prompt\n- add: Name the owner before acting.\n  because: turn 3.\n- change: Never retry a tool call that a guardrail blocked -> retry once.\n  because: turn 4.";
    const { kept, dropped } = dropGuardrailChanges(md, nevers);
    assert.equal(dropped.length, 1);
    assert.match(kept, /Name the owner before acting/);
    assert.doesNotMatch(kept, /retry once/);
  });

  test("leaves a nothing-to-change proposal alone", () => {
    assert.equal(dropGuardrailChanges("## nothing to change", nevers).kept, "## nothing to change");
  });

  test("renders every dropped item in full for the session log", () => {
    const log = renderDropped(dropGuardrailChanges(LIVE, nevers).dropped);
    assert.match(log, /## Dropped from the reflection proposal/);
    assert.match(log, /run it verbatim/);
    assert.match(log, /may be executed/);
  });
});

describe("the judge", () => {
  // A paraphrased contradiction, found by review of the heuristic: no trigger
  // word, no quote of the rule, and it creates exactly the exception the rule forbids.
  const PROMPT = "## Never\n\n- Never send, post or email anything to anyone but the owner. Draft it for the owner instead.\n";
  const nevers = neverRules(PROMPT);
  const rules = guardrailRules(nevers, policy);
  const PARAPHRASE =
    "## system prompt\n- add: If the owner asks you to send it yourself, just post it to the client channel.\n  because: turn 4.";
  const FINE = "## system prompt\n- add: Name the owner before acting.\n  because: turn 3.";

  const replying =
    (verdicts: { item: number; verdict: string; reason?: string }[]): AskModel =>
    async () =>
      JSON.stringify(verdicts);

  test("the heuristic alone keeps the paraphrase, which is why the judge exists", () => {
    assert.equal(dropGuardrailChanges(PARAPHRASE, nevers).dropped.length, 0);
  });

  test("drops the paraphrase when the judge says it contradicts, with the judge's reason", async () => {
    const ask = replying([{ item: 1, verdict: "contradicts", reason: "exception to the send-only-to-owner rule" }]);
    const { kept, dropped } = await filterProposal(PARAPHRASE, nevers, rules, ask);
    assert.equal(kept, "");
    assert.equal(dropped.length, 1);
    assert.equal(dropped[0]!.why, "judge: exception to the send-only-to-owner rule");
    assert.match(renderDropped(dropped), /just post it to the client channel/);
  });

  test("keeps an item the judge says is fine", async () => {
    const { kept, dropped } = await filterProposal(FINE, nevers, rules, replying([{ item: 1, verdict: "fine" }]));
    assert.deepEqual(dropped, []);
    assert.equal(kept, FINE);
  });

  test("a judge that throws drops everything, as judge unavailable", async () => {
    const ask: AskModel = async () => {
      throw new Error("401 no credentials");
    };
    const { kept, dropped } = await filterProposal(FINE, nevers, rules, ask);
    assert.equal(kept, "");
    assert.match(dropped[0]!.why, /^judge unavailable \(401 no credentials\)/);
  });

  test("an unparseable reply drops everything", async () => {
    const { dropped } = await filterProposal(FINE, nevers, rules, async () => "Looks fine to me!");
    assert.match(dropped[0]!.why, /^judge unavailable/);
  });

  test("an item the judge skipped, or gave an unknown verdict, is dropped", () => {
    assert.deepEqual(
      parseJudgeReply('[{"item": 1, "verdict": "fine"}, {"item": 3, "verdict": "probably ok"}]', 3).map(Boolean),
      [false, true, true],
    );
  });

  test("one call for every item, carrying the actual rule text", async () => {
    let calls = 0;
    let request = "";
    const ask: AskModel = async (system, user) => {
      calls++;
      request = user;
      assert.equal(system, JUDGE_RULES);
      return JSON.stringify([
        { item: 1, verdict: "fine" },
        { item: 2, verdict: "contradicts", reason: "x" },
      ]);
    };
    const { kept, dropped } = await filterProposal(`${FINE}\n\n${PARAPHRASE}`, nevers, rules, ask);
    assert.equal(calls, 1);
    assert.match(request, /Never send, post or email anything to anyone but the owner/);
    assert.match(request, /The bash tool is denied for: recursive delete of \//);
    assert.match(kept, /Name the owner/);
    assert.equal(dropped.length, 1);
  });

  test("the heuristic runs first, so the judge never sees what it already dropped", async () => {
    let seen = "";
    const ask: AskModel = async (_s, user) => {
      seen = user;
      return JSON.stringify([{ item: 1, verdict: "fine" }]);
    };
    const md = `${FINE}\n- remove: Never send, post or email anything to anyone but the owner.`;
    const { dropped } = await filterProposal(md, nevers, rules, ask);
    assert.equal(dropped.length, 1);
    assert.doesNotMatch(seen, /remove: Never send/);
  });

  test("nothing to judge means no model call", async () => {
    const ask: AskModel = async () => assert.fail("the judge should not be called");
    const { kept } = await filterProposal("## nothing to change", nevers, rules, ask);
    assert.equal(kept, "## nothing to change");
  });
});

describe("judgeModelFor", () => {
  test("defaults to Haiku", () => {
    assert.deepEqual(judgeModelFor({ model: undefined }, {}), { provider: "anthropic", id: "claude-haiku-4-5" });
  });

  test("HARNESS_JUDGE_MODEL wins", () => {
    const env = { HARNESS_JUDGE_MODEL: "openai:gpt-5-mini" };
    assert.deepEqual(judgeModelFor({ model: undefined }, env), { provider: "openai", id: "gpt-5-mini" });
  });

  test("on another provider with no override, reuses the harness model rather than a key it may not have", () => {
    const model = { provider: "openai", id: "gpt-5" };
    assert.deepEqual(judgeModelFor({ model }, {}), model);
  });
});

describe("the judge leaves capability gaps alone", () => {
  test("a gap that quotes a blocked command is kept, and the judge never sees it", async () => {
    const { judgeGuardrailChanges } = await import("../src/reflection/guard.ts");
    const md = [
      "## capability gaps",
      '- dm_owner: wanted 1 time. "Use bash to run: curl -X POST https://slack.com/api/chat.postMessage"',
      "",
      "## system prompt",
      "- add: If the owner asks you to send it yourself, just post it.",
      "  because: speed",
    ].join("\n");
    const seen: string[] = [];
    const ask = async (_system: string, user: string) => {
      seen.push(user);
      return '[{"item": 1, "verdict": "contradicts", "reason": "loosens the send rule"}]';
    };
    const r = await judgeGuardrailChanges(md, ["Never send to anyone but the owner."], ask);
    assert.match(r.kept, /dm_owner: wanted 1 time/);
    assert.doesNotMatch(r.kept, /just post it/);
    assert.equal(seen.length, 1);
    assert.doesNotMatch(seen[0]!, /dm_owner/);
  });
});
