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
import { parseMemoryBlocks, section } from "../src/reflection/accept.ts";
import { renderSessionLog } from "../src/reflection/index.ts";
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
