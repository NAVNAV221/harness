/** Anthropic adapter. Tool calls arrive as content blocks; stop reason is "tool_use". */
import type { ChatResponse, Msg, Provider, StopReason, ToolSpec } from "./types.ts";

export function anthropic(model = "claude-opus-5"): Provider {
  return {
    name: `anthropic:${model}`,
    async chat({ system, messages, tools }) {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          system,
          tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.schema })),
          messages: toAnthropic(messages),
        }),
      });

      if (!response.ok) {
        return { text: await response.text(), toolCalls: [], stopReason: "error", usage: { input: 0, output: 0 } };
      }

      const body = (await response.json()) as any;
      const text = body.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
      const toolCalls = body.content
        .filter((b: any) => b.type === "tool_use")
        .map((b: any) => ({ id: b.id, name: b.name, args: b.input ?? {} }));

      const stopReason: StopReason =
        body.stop_reason === "tool_use" ? "tool_use" : body.stop_reason === "max_tokens" ? "max_tokens" : "done";

      return {
        text,
        toolCalls,
        stopReason,
        usage: { input: body.usage?.input_tokens ?? 0, output: body.usage?.output_tokens ?? 0 },
      };
    },
  };
}

function toAnthropic(messages: Msg[]): unknown[] {
  const out: any[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: [{ type: "text", text: m.text }] });
    } else if (m.role === "assistant") {
      const content: any[] = [];
      if (m.text) content.push({ type: "text", text: m.text });
      for (const c of m.toolCalls) content.push({ type: "tool_use", id: c.id, name: c.name, input: c.args });
      out.push({ role: "assistant", content });
    } else {
      // Tool results are user-role content blocks here. In OpenAI they are their
      // own role. This one difference is why the translation layer exists.
      const last = out.at(-1);
      const block = { type: "tool_result", tool_use_id: m.callId, content: m.text, is_error: m.isError };
      if (last?.role === "user" && Array.isArray(last.content) && last.content[0]?.type === "tool_result") {
        last.content.push(block);
      } else {
        out.push({ role: "user", content: [block] });
      }
    }
  }
  return out;
}
