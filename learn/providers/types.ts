/**
 * Part 4: the translation layer, as one interface.
 *
 * This is the whole seam. Everything above it (the loop) speaks only these
 * types. Everything below it (an adapter per vendor) turns them into whatever
 * that vendor's HTTP API wants.
 *
 * The four things that actually differ between vendors, and that therefore have
 * to be normalised here:
 *   1. tool call format   - Anthropic returns content blocks, OpenAI returns tool_calls
 *   2. streaming events   - not modelled here; see pi-ai for the real version
 *   3. stop reasons       - "end_turn"/"tool_use" vs "stop"/"tool_calls"/"length"
 *   4. token accounting   - different field names, different inclusion rules
 */

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the arguments. */
  schema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolCalls: ToolCall[] }
  | { role: "tool"; callId: string; name: string; text: string; isError: boolean };

/** Normalised across vendors. The loop branches on this and nothing else. */
export type StopReason = "done" | "tool_use" | "max_tokens" | "error";

export interface ChatResponse {
  text: string;
  toolCalls: ToolCall[];
  stopReason: StopReason;
  usage: { input: number; output: number };
}

export interface Provider {
  readonly name: string;
  chat(request: { system: string; messages: Msg[]; tools: ToolSpec[] }): Promise<ChatResponse>;
}
