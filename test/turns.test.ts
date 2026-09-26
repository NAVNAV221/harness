/**
 * What a turn sends back, and what happens to it when someone says stop or the
 * process restarts. A fake session stands in for pi, so no model is called: the
 * harness's own bookkeeping is what is under test.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import {
  Harness,
  conversationKey,
  messageText,
  DRAINING_TEXT,
  EMPTY_TEXT,
  RESTARTED_TEXT,
  type Conversation,
} from "../src/harness.ts";
import { loadConfig } from "../src/config.ts";
import { Memory } from "../src/memory/index.ts";
import type { IncomingMessage, MessagingAdapter, OutgoingMessage } from "../src/messaging/types.ts";

type Emit = (text: string) => void;

/** A session whose turn runs `script`. `aborted` resolves when abort() is called. */
function fakeSession(script: (emit: Emit, aborted: Promise<void>) => Promise<void>): AgentSession {
  let listener: ((event: unknown) => void) | undefined;
  let abort: () => void = () => {};
  const aborted = new Promise<void>((resolve) => (abort = resolve));
  const emit: Emit = (text) =>
    listener?.({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text }] } });
  return {
    subscribe: (l: (event: unknown) => void) => ((listener = l), () => (listener = undefined)),
    prompt: () => script(emit, aborted),
    abort: async () => abort(),
    dispose: () => {},
  } as unknown as AgentSession;
}

class FakeHarness extends Harness {
  sent: OutgoingMessage[] = [];
  constructor(private script: (emit: Emit, aborted: Promise<void>) => Promise<void>) {
    const adapter: MessagingAdapter = {
      name: "fake",
      start: async () => {},
      send: async (m) => void this.sent.push(m),
      requestApproval: async () => false,
      stop: async () => {},
    };
    super(loadConfig(), new Memory(mkdtempSync(join(tmpdir(), "mem-"))), adapter);
  }
  private made = new Map<string, Conversation>();
  protected override async getConversation(message: IncomingMessage): Promise<Conversation> {
    const key = conversationKey(message.channel, message.threadId);
    let c = this.made.get(key);
    if (!c) {
      c = { key, channel: message.channel, threadId: message.threadId, turns: [], startedAt: "", session: fakeSession(this.script) };
      this.made.set(key, c);
      // stop() and interrupt() look conversations up here, as they would a real one.
      (this as unknown as { conversations: Map<string, Conversation> }).conversations.set(key, c);
    }
    return c;
  }
}

const msg = (text: string, threadId = "t1"): IncomingMessage => ({
  channel: "c",
  threadId,
  sender: { id: "u", display: "u" },
  text,
  ts: new Date().toISOString(),
});
const tick = () => new Promise((r) => setTimeout(r, 5));

describe("the reply", () => {
  test("is the last assistant message that said something, not the narration before it", async () => {
    const h = new FakeHarness(async (emit) => {
      emit("Now let me check memory first...");
      emit("The answer is 42.");
      emit("   ");
    });
    await h.handleMessage(msg("q"));
    assert.deepEqual(h.sent.map((m) => m.text), ["The answer is 42."]);
  });

  test("an empty turn says so instead of sending nothing useful", async () => {
    const h = new FakeHarness(async () => {});
    await h.handleMessage(msg("q"));
    assert.equal(h.sent[0]!.text, EMPTY_TEXT);
  });

  test("messageText joins the text parts of one message and skips the rest", () => {
    assert.equal(messageText([{ type: "text", text: "a" }, { type: "toolCall" }, { type: "text", text: " b " }]), "a\n\nb");
    assert.equal(messageText(undefined), "");
  });
});

describe("stop", () => {
  test("aborts the running turn in that conversation and keeps what it had", async () => {
    const h = new FakeHarness(async (emit, aborted) => {
      emit("Half an answer.");
      await aborted;
    });
    const turn = h.handleMessage(msg("q"));
    await tick();
    assert.equal(await h.stop("c", "other"), false, "another thread has nothing running");
    assert.equal(await h.stop("c", "t1"), true);
    await turn;
    assert.equal(h.sent[0]!.text, "Stopped. What I had so far:\n\nHalf an answer.");
  });

  test("with nothing running it reports false", async () => {
    assert.equal(await new FakeHarness(async () => {}).stop("c", "t1"), false);
  });
});

describe("drain", () => {
  test("waits for the running turn, and a message during the drain is told to resend", async () => {
    let finish: () => void = () => {};
    const h = new FakeHarness(async (emit) => {
      await new Promise<void>((r) => (finish = r));
      emit("done");
    });
    const turn = h.handleMessage(msg("q"));
    await tick();
    assert.equal(h.busy, 1);
    const drained = h.drain(1_000);
    await h.handleMessage(msg("another", "t2"));
    assert.equal(h.sent[0]!.text, DRAINING_TEXT);
    finish();
    assert.equal(await drained, true);
    await turn;
    assert.equal(h.sent[1]!.text, "done");
    await assert.rejects(h.initiate("x", "y"), /shutting down/);
  });

  test("a drain that runs out interrupts the turn, which says it was cut off", async () => {
    const h = new FakeHarness(async (emit, aborted) => {
      emit("partial");
      await aborted;
    });
    const turn = h.handleMessage(msg("q"));
    await tick();
    assert.equal(await h.drain(10), false);
    await h.interrupt(1_000);
    await turn;
    assert.equal(h.sent[0]!.text, RESTARTED_TEXT);
    assert.equal(h.busy, 0);
  });

  test("an idle harness drains at once", async () => {
    assert.equal(await new FakeHarness(async () => {}).drain(10_000), true);
  });
});
