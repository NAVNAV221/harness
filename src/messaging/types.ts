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

export interface AdapterHandlers {
  onMessage(message: IncomingMessage): Promise<void>;
  /** Called when the adapter shuts down cleanly, so the harness can reflect. */
  onShutdown(): Promise<void>;
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
  stop(): Promise<void>;
}
