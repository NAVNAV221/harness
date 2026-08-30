/** OpenAI adapter. Tool calls are a separate field; tool results are their own role. */
import type { ChatResponse, Msg, Provider, StopReason, ToolSpec } from "./types.ts";

export function openai(model = "gpt-4.1"): Provider {
  return {
    name: `openai:${model}`,
    async chat({ system, messages, tools }) {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error("OPENAI_API_KEY is not set");

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: system }, ...toOpenAI(messages)],
          tools: tools.map((t) => ({
            type: "function",
            function: { name: t.name, description: t.description, parameters: t.schema },
          })),
        }),
      });

      if (!response.ok) {
        return { text: await response.text(), toolCalls: [], stopReason: "error", usage: { input: 0, output: 0 } };
      }

      const body = (await response.json()) as any;
      const choice = body.choices[0];
      const toolCalls = (choice.message.tool_calls ?? []).map((c: any) => ({
        id: c.id,
        name: c.function.name,
        args: JSON.parse(c.function.arguments || "{}"),
      }));

      const stopReason: StopReason =
        choice.finish_reason === "tool_calls" ? "tool_use" : choice.finish_reason === "length" ? "max_tokens" : "done";

      return {
        text: choice.message.content ?? "",
        toolCalls,
        stopReason,
        // Note the different field names. Same numbers, different spelling.
        usage: { input: body.usage?.prompt_tokens ?? 0, output: body.usage?.completion_tokens ?? 0 },
      };
    },
  };
}

function toOpenAI(messages: Msg[]): unknown[] {
  return messages.map((m) => {
    if (m.role === "user") return { role: "user", content: m.text };
    if (m.role === "assistant") {
      return {
        role: "assistant",
        content: m.text || null,
        tool_calls: m.toolCalls.length
          ? m.toolCalls.map((c) => ({
              id: c.id,
              type: "function",
              function: { name: c.name, arguments: JSON.stringify(c.args) },
            }))
          : undefined,
      };
    }
    return { role: "tool", tool_call_id: m.callId, content: m.text };
  });
}
