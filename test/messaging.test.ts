/**
 * The messaging seam's optional parts: progress rows and harness-initiated
 * conversations. No model and no platform: the routing is what is under test.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Harness, summarizeArgs } from "../src/harness.ts";
import { CliAdapter } from "../src/messaging/cli.ts";
import { loadConfig } from "../src/config.ts";
import { Memory } from "../src/memory/index.ts";
import type { IncomingMessage, MessagingAdapter } from "../src/messaging/types.ts";

describe("summarizeArgs", () => {
  test("picks the field that says what the call is about", () => {
    assert.equal(summarizeArgs({ command: "git   log\n-3" }), "git log -3");
    assert.equal(summarizeArgs({ path: "memory/INDEX.md" }), "memory/INDEX.md");
  });
  test("a tool with no arguments has no summary, not {}", () => {
    assert.equal(summarizeArgs({}), "");
    assert.equal(summarizeArgs(undefined), "");
  });
  test("is capped", () => {
    assert.ok(summarizeArgs({ blob: "y".repeat(500) }).length <= 200);
  });
});

describe("CliAdapter", () => {
  function capture(fn: () => Promise<unknown>): Promise<string> {
    const original = process.stdout.write.bind(process.stdout);
    let out = "";
    process.stdout.write = ((chunk: string) => ((out += chunk), true)) as typeof process.stdout.write;
    return fn().then(
      () => ((process.stdout.write = original), out),
      (e) => {
        process.stdout.write = original;
        throw e;
      },
    );
  }

  test("progress prints a start and its outcome", async () => {
    const cli = new CliAdapter();
    const out = await capture(async () => {
      await cli.progress("cli", undefined, { kind: "tool_start", toolCallId: "1", toolName: "read", summary: "a.md" });
      const end = { kind: "tool_end", toolCallId: "1", toolName: "read", summary: "", ok: false } as const;
      await cli.progress("cli", undefined, end);
    });
    assert.match(out, /· read: a\.md {2}\.\.\. failed/);
  });

  test("post returns a conversation to reply into", async () => {
    const where = await capture(() => new CliAdapter().post("Morning brief"));
    assert.match(where, /Morning brief/);
  });
});

describe("Harness.initiate", () => {
  class Recording extends Harness {
    calls: { message: IncomingMessage; internal?: boolean }[] = [];
    override async handleMessage(message: IncomingMessage, opts: { internal?: boolean } = {}): Promise<void> {
      this.calls.push({ message, internal: opts.internal });
    }
  }
  const adapter = (post?: MessagingAdapter["post"]): MessagingAdapter => ({
    name: "fake",
    start: async () => {},
    send: async () => {},
    requestApproval: async () => false,
    stop: async () => {},
    ...(post ? { post } : {}),
  });

  test("posts the header and runs the turn in its thread, as the internal scheduler", async () => {
    const post = async () => ({ channel: "D1", threadId: "9.9" });
    const h = new Recording(loadConfig(), new Memory(mkdtempSync(join(tmpdir(), "mem-"))), adapter(post));
    await h.initiate("Morning brief", "run the brief");
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0]!.internal, true);
    assert.equal(h.calls[0]!.message.threadId, "9.9");
    assert.equal(h.calls[0]!.message.sender.id, "scheduler");
  });

  test("an adapter that cannot post says so instead of replying somewhere else", async () => {
    const h = new Recording(loadConfig(), new Memory(mkdtempSync(join(tmpdir(), "mem-"))), adapter());
    await assert.rejects(h.initiate("x", "y"), /cannot start a conversation/);
  });
});
