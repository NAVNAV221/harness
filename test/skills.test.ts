/**
 * Skills: every committed skill loads in pi and passes validation, and the
 * skills block survives the per-turn prompt rebuild.
 *
 * The last one is the test that matters. The rebuild in src/harness.ts returns
 * a whole new system prompt, which replaces pi's, which is where pi puts the
 * skills list. A harness built on this skeleton ran for weeks with no skill ever
 * reaching the model, and nothing failed. So the hook is exercised here through
 * a real pi session, not only as a pure function. No model call is made.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSkillsFromDir, type AgentSession } from "@earendil-works/pi-coding-agent";
import { listSkills, referencedTools, validateSkill } from "../src/skills/validate.ts";
import { withSkills } from "../src/system-prompt/index.ts";
import { loadConfig } from "../src/config.ts";
import { Memory, parseFrontmatter } from "../src/memory/index.ts";
import { Harness, type Conversation } from "../src/harness.ts";
import type { IncomingMessage, MessagingAdapter } from "../src/messaging/types.ts";

const ROOT = join(import.meta.dirname, "..");
const config = loadConfig(ROOT);

describe("committed skills", () => {
  test("pi loads every one with no diagnostics", () => {
    const loaded = loadSkillsFromDir({ dir: config.skillsDir, source: "path" });
    assert.deepEqual(loaded.diagnostics, []);
    assert.deepEqual(
      loaded.skills.map((s) => s.name).sort(),
      listSkills(config.skillsDir).map((s) => s.folder),
    );
  });

  test("pi reads the same description the file says (YAML did not cut it short)", () => {
    const loaded = new Map(loadSkillsFromDir({ dir: config.skillsDir, source: "path" }).skills.map((s) => [s.name, s]));
    for (const s of listSkills(config.skillsDir)) {
      const raw = parseFrontmatter(s.content).fields.description?.trim().replace(/^(["'])(.*)\1$/, "$2");
      assert.equal(loaded.get(s.folder)?.description, raw, s.folder);
    }
  });

  test("each passes validation against the tools this harness enables", () => {
    for (const s of listSkills(config.skillsDir)) assert.deepEqual(validateSkill(s.folder, s.content, config.tools), [], s.folder);
  });
});

describe("validateSkill", () => {
  const ok = "---\nname: demo\ndescription: Use when someone asks for a demo.\n---\n\n1. Call `memory_search`.\n";
  const tools = ["read", "memory_search"];

  test("accepts a well-formed skill", () => {
    assert.deepEqual(validateSkill("demo", ok, tools), []);
  });

  test("a tool that does not exist is an error; argument names and plain words are not tools", () => {
    assert.deepEqual(referencedTools("`memory_read(path)` then `entities/people/`, op `stop`"), ["memory_read"]);
    assert.deepEqual(validateSkill("demo", ok.replace("memory_search", "send_email"), tools), [
      "names a tool that does not exist: send_email",
    ]);
  });

  test("name must match the folder and be lowercase-hyphenated", () => {
    assert.ok(validateSkill("other", ok, tools).some((e) => e.includes("does not match its folder")));
    const bad = ok.replace("name: demo", "name: Demo_X");
    assert.ok(validateSkill("Demo_X", bad, tools).some((e) => e.includes("lowercase-hyphenated")));
  });

  test("a description over 1024 characters, or no frontmatter, is an error", () => {
    const long = ok.replace("Use when someone asks for a demo.", "x".repeat(1025));
    assert.ok(validateSkill("demo", long, tools).some((e) => e.includes("over 1024")));
    assert.deepEqual(validateSkill("demo", "no frontmatter", tools), ["no frontmatter (--- name/description ---)"]);
    const hash = ok.replace("asks for a demo.", "asks what happened in #ops.");
    assert.ok(validateSkill("demo", hash, tools).some((e) => e.includes("YAML reads as a comment")));
  });
});

describe("withSkills", () => {
  const skills = loadSkillsFromDir({ dir: config.skillsDir, source: "path" }).skills;

  test("appends pi's skills block to a rebuilt prompt", () => {
    const prompt = withSkills("RULES", skills, ["read"]);
    assert.ok(prompt.startsWith("RULES"));
    assert.ok(prompt.includes("<name>team-digest</name>"));
    assert.ok(prompt.includes("SKILL.md</location>"));
  });

  test("leaves the prompt alone with no skills, or no read tool to open them", () => {
    assert.equal(withSkills("RULES", [], ["read"]), "RULES");
    assert.equal(withSkills("RULES", skills, ["grep"]), "RULES");
  });
});

describe("the per-turn prompt rebuild", () => {
  const adapter: MessagingAdapter = {
    name: "fake",
    start: async () => {},
    send: async () => {},
    requestApproval: async () => false,
    stop: async () => {},
  };

  test("keeps every skill visible to the model", async () => {
    const harness = new Harness(config, new Memory(mkdtempSync(join(tmpdir(), "mem-"))), adapter);
    const message: IncomingMessage = { channel: "c", sender: { id: "u", display: "u" }, text: "hi", ts: "1" };
    // getConversation is private; the session it builds is the real one.
    const conversation = await (harness as unknown as { getConversation(m: IncomingMessage): Promise<Conversation> })
      .getConversation(message);
    const session: AgentSession = conversation.session;
    try {
      // pi's own options for this session, the ones it hands the hook each turn.
      const options = (session as unknown as { _baseSystemPromptOptions: unknown })._baseSystemPromptOptions;
      assert.ok(options, "pi no longer keeps _baseSystemPromptOptions: rewrite this test against its replacement");
      const result = await session.extensionRunner!.emitBeforeAgentStart("hi", undefined, session.systemPrompt, options as never);
      const rebuilt = result?.systemPrompt ?? "";
      assert.ok(rebuilt.includes("## Memory index"), "the hook replaced the prompt with ours");
      for (const s of listSkills(config.skillsDir)) assert.ok(rebuilt.includes(`<name>${s.folder}</name>`), s.folder);
    } finally {
      await harness.dispose();
    }
  });
});
