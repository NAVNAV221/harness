/**
 * Memory is part 5, and part 5 is where harnesses quietly go wrong: a read that
 * was truncated without saying so, an index that hides what it knows, a path
 * from the model that escapes the directory.
 *
 * These tests are about those three properties, not about coverage.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Memory, clip, parseFrontmatter } from "../src/memory/index.ts";
import { findCredentialSource } from "../src/config.ts";

let root: string;
before(() => {
  root = mkdtempSync(join(tmpdir(), "harness-memory-"));
});
after(() => {
  rmSync(root, { recursive: true, force: true });
});

function fresh(name: string): Memory {
  const dir = join(root, name);
  return new Memory(dir);
}

function entity(memory: Memory, type: string, id: string, summary: string) {
  mkdirSync(join(memory.dir, "entities", type), { recursive: true });
  writeFileSync(
    join(memory.dir, "entities", type, `${id}.md`),
    `---\nname: ${id}\nsummary: ${summary}\n---\n\nbody\n`,
    "utf8",
  );
}

describe("clip", () => {
  test("passes short text through untouched and says it was not truncated", () => {
    const result = clip("short", "retry()");
    assert.equal(result.text, "short");
    assert.equal(result.truncated, false);
    assert.equal(result.note, undefined);
  });

  test("never truncates silently: the note says so and says how to get the rest", () => {
    const result = clip("x".repeat(200), 'memory_read("a.md", offset: <line>)', 50);
    assert.equal(result.truncated, true);
    assert.match(result.text, /\[truncated: showed 50 of 200 bytes/);
    assert.match(result.text, /memory_read\("a\.md", offset: <line>\)/);
    assert.equal(result.originalBytes, 200);
  });

  test("reports the true original size, not the clipped size", () => {
    // A harness that reports the size it kept teaches the model that the file is
    // small, and the model stops asking for the rest.
    const result = clip("y".repeat(9000), "retry()", 100);
    assert.equal(result.originalBytes, 9000);
  });

  test("counts bytes, not characters, so multi-byte text is not over-clipped", () => {
    const emoji = "🔒".repeat(10); // 4 bytes each
    assert.equal(clip(emoji, "retry()", 100).truncated, false);
    assert.equal(clip(emoji, "retry()", 20).truncated, true);
  });
});

describe("parseFrontmatter", () => {
  test("reads fields and returns the body without them", () => {
    const { fields, body } = parseFrontmatter("---\nname: Dana\nrole: sre\n---\nthe body\n");
    assert.equal(fields.name, "Dana");
    assert.equal(fields.role, "sre");
    assert.equal(body.trim(), "the body");
  });

  test("strips surrounding quotes so a quoted summary is not double-quoted downstream", () => {
    const { fields } = parseFrontmatter('---\nsummary: "on call"\n---\n');
    assert.equal(fields.summary, "on call");
  });

  test("a file with no frontmatter is content, not an error", () => {
    const { fields, body } = parseFrontmatter("just text");
    assert.deepEqual(fields, {});
    assert.equal(body, "just text");
  });

  test("keeps colons in the value, so a URL survives", () => {
    const { fields } = parseFrontmatter("---\nrepo: https://example.com/a\n---\n");
    assert.equal(fields.repo, "https://example.com/a");
  });
});

describe("path safety", () => {
  test("rejects a traversal out of the memory directory", () => {
    // The model supplies this path. That makes it untrusted input.
    const memory = fresh("traversal");
    assert.throws(() => memory.write("../escaped.md", "x"), /escapes the memory directory/);
    assert.throws(() => memory.write("entities/../../escaped.md", "x"), /escapes the memory directory/);
  });

  test("rejects an absolute path outside the directory", () => {
    const memory = fresh("absolute");
    assert.throws(() => memory.write("/etc/passwd.md", "x"), /escapes the memory directory/);
  });

  test("refuses to write anything that is not markdown", () => {
    const memory = fresh("extension");
    assert.throws(() => memory.write("entities/a.sh", "rm -rf /"), /must end in \.md/);
  });

  test("allows a legitimate nested path", () => {
    const memory = fresh("nested");
    const written = memory.write("entities/people/dana.md", "---\nname: Dana\n---\n");
    assert.equal(written, "entities/people/dana.md");
  });
});

describe("renderIndex", () => {
  test("on a fresh harness it still shows the operator's notes", () => {
    // The regression this locks down: the notes explaining what memory is FOR
    // were skipped exactly when memory was empty, which is when they matter most.
    const memory = fresh("empty-with-notes");
    writeFileSync(join(memory.dir, "INDEX.md"), "services/ and incidents/ go here.", "utf8");
    const index = memory.renderIndex();
    assert.match(index, /No entities recorded yet/);
    assert.match(index, /services\/ and incidents\/ go here\./);
  });

  test("shows type folders that exist but are empty, so the model knows the shape", () => {
    const memory = fresh("empty-types");
    mkdirSync(join(memory.dir, "entities", "services"), { recursive: true });
    mkdirSync(join(memory.dir, "entities", "incidents"), { recursive: true });
    assert.match(memory.renderIndex(), /Types already carved out, still empty: incidents, services/);
  });

  test("lists entities with their summary, which is all the model sees by default", () => {
    const memory = fresh("listing");
    entity(memory, "services", "graph", "the API, owned by platform");
    const index = memory.renderIndex();
    assert.match(index, /entities\/services\/graph\.md - graph: the API, owned by platform/);
  });

  test("marks a type that has a folder but no entities", () => {
    const memory = fresh("mixed");
    entity(memory, "services", "graph", "the API");
    mkdirSync(join(memory.dir, "entities", "runbooks"), { recursive: true });
    assert.match(memory.renderIndex(), /runbooks: \(empty\)/);
  });

  test("keeps TEMPLATE.md out of the index", () => {
    // A template's placeholder summary would otherwise cost context on every
    // single turn while telling the model nothing.
    const memory = fresh("templates");
    mkdirSync(join(memory.dir, "entities", "services"), { recursive: true });
    writeFileSync(
      join(memory.dir, "entities", "services", "TEMPLATE.md"),
      "---\nname: <name>\nsummary: <one line>\n---\n",
      "utf8",
    );
    const index = memory.renderIndex();
    assert.doesNotMatch(index, /<one line>/);
    assert.match(index, /No entities recorded yet/);
    assert.equal(memory.listEntities().length, 0);
  });
});

describe("read and search", () => {
  test("a missing file is an answer, not a crash", () => {
    const memory = fresh("missing");
    const result = memory.read("entities/nope.md");
    assert.match(result.text, /No such memory file/);
    assert.equal(result.truncated, false);
  });

  test("a large file comes back marked truncated", () => {
    const memory = fresh("big");
    memory.write("entities/big.md", "z".repeat(20_000));
    const result = memory.read("entities/big.md");
    assert.equal(result.truncated, true);
    assert.match(result.text, /\[truncated:/);
  });

  test("search finds the file and line, case-insensitively", () => {
    const memory = fresh("search");
    entity(memory, "services", "graph", "the API");
    const hits = memory.search("THE api");
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.path, "entities/services/graph.md");
    assert.ok(hits[0]!.line > 0);
  });

  test("search caps its results, because ranking beats volume", () => {
    const memory = fresh("search-cap");
    for (let i = 0; i < 40; i++) entity(memory, "services", `svc${i}`, "needle here");
    assert.ok(memory.search("needle").length <= 12);
  });

  test("no match returns nothing rather than a misleading partial", () => {
    const memory = fresh("search-empty");
    entity(memory, "services", "graph", "the API");
    assert.deepEqual(memory.search("kubernetes"), []);
  });
});

describe("findCredentialSource", () => {
  test("names the environment variable it found", () => {
    assert.equal(findCredentialSource({ ANTHROPIC_API_KEY: "sk-ant-x" }, "/nope"), "ANTHROPIC_API_KEY");
  });

  test("ignores an empty or whitespace-only key", () => {
    // An unset secret often arrives as "" rather than absent. Treating that as
    // credentials means the warning never fires for the people who need it.
    assert.equal(findCredentialSource({ ANTHROPIC_API_KEY: "" }, "/nope"), undefined);
    assert.equal(findCredentialSource({ OPENAI_API_KEY: "   " }, "/nope"), undefined);
  });

  test("falls back to pi's auth file", () => {
    assert.equal(findCredentialSource({}, "/agent", (p) => p === "/agent/auth.json"), "/agent/auth.json");
  });

  test("returns nothing when there is nothing, which is what triggers the warning", () => {
    assert.equal(findCredentialSource({}, "/agent", () => false), undefined);
  });
});
