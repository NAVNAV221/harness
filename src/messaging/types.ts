/**
 * The messaging seam.
 *
 * A harness that only talks to a terminal is a tool. A harness that talks to the
 * place your team already is becomes a teammate. This interface is the whole
 * contract between the two. Implement it once per platform and nothing else in
 * the harness changes.
 *
 * The CLI adapter in ./cli.ts implements every method in about 60 lines. Read it
 * before you write yours.
 */

export interface Sender {
  /** Stable platform id, e.g. a Slack user id. Used for authorization. */
  id: string;
  /** What a human calls them. Used in prompts and transcripts. */
  display: string;
}

export interface IncomingMessage {
  /** Where this came from: a channel, a DM, a room. Used as the session key. */
  channel: string;
  /** Thread id when the platform has threads. Threads get their own session. */
  threadId?: string;
  sender: Sender;
  text: string;
  ts: string;
}

export interface OutgoingMessage {
  channel: string;
  threadId?: string;
  text: string;
}

/** Asked by the guardrail layer before a flagged tool runs. */
export interface ApprovalRequest {
  channel: string;
  threadId?: string;
  toolName: string;
  /** Rendered arguments, already redacted. Safe to show in a channel. */
  detail: string;
  reason: string;
}

/**
 * One tool call, as the harness sees it happen. Sent so a human can watch a long
 * turn work instead of staring at silence.
 *
 * `summary` has already been through the redact list, like every outbound text.
 * `toolCallId` pairs a start with its end: two calls to the same tool can be in
 * flight at once, so the tool name alone cannot.
 */
export interface ProgressEvent {
  kind: "tool_start" | "tool_end";
  toolCallId: string;
  toolName: string;
  summary: string;
  /** Set on tool_end: false when the tool reported an error. */
  ok?: boolean;
}

export interface AdapterHandlers {
  onMessage(message: IncomingMessage): Promise<void>;
  /** Called when the adapter shuts down cleanly, so the harness can reflect. */
  onShutdown(): Promise<void>;
  /**
   * Stop the turn running in this conversation ("stop" in the thread, or the
   * platform's own stop button). Call it the moment the request arrives, never
   * through the conversation's queue: queued, it waits for the very turn it is
   * meant to stop. Resolves true if a turn was running. The CLI adapter does not
   * call it, because it reads the next line only after the turn ends.
   */
  onStop?(channel: string, threadId?: string): Promise<boolean>;
}

export interface MessagingAdapter {
  readonly name: string;
  /** Connect and start delivering messages. Resolves when the adapter is live. */
  start(handlers: AdapterHandlers): Promise<void>;
  /** Send one message. The harness has already redacted the text. */
  send(message: OutgoingMessage): Promise<void>;
  /**
   * Ask a human to approve a tool call, and block until they answer.
   *
   * Return false on timeout. Never return true by default: a guardrail that
   * fails open is decoration.
   */
  requestApproval(request: ApprovalRequest): Promise<boolean>;
  /** Optional: stream partial assistant text. No-op is fine. */
  typing?(channel: string, threadId?: string): Promise<void>;
  /**
   * Optional: show a tool call starting or finishing, in the conversation it
   * belongs to. Best effort by contract: the harness never waits on it, and an
   * adapter must never let a failure here break the turn. The turn's final text
   * still arrives through send().
   */
  progress?(channel: string, threadId: string | undefined, event: ProgressEvent): Promise<void>;
  /**
   * Optional: START a conversation, for a harness that speaks first (a
   * scheduled brief, a reminder). Posts `text` as a new top-level message and
   * returns where it landed, so the harness can reply in its thread. The only
   * outbound path that is not a reply: an adapter must post it only where the
   * harness is allowed to talk, never to an arbitrary channel.
   */
  post?(text: string): Promise<{ channel: string; threadId: string }>;
  stop(): Promise<void>;
}
