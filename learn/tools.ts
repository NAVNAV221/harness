/** Two tools, so the loop has something to call. Nothing clever on purpose. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { ToolSpec } from "./providers/types.ts";

export const tools: ToolSpec[] = [
  {
    name: "list_dir",
    description: "List the files in a directory. Use when you do not know what exists yet.",
    schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
  {
    name: "read_file",
    description: "Read one file whose path you already know. Not for discovering files.",
    schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
];

export function execute(name: string, args: Record<string, unknown>): { text: string; isError: boolean } {
  try {
    const path = resolve(process.cwd(), String(args.path ?? "."));
    if (name === "list_dir") {
      const entries = readdirSync(path).map((e) => (statSync(resolve(path, e)).isDirectory() ? `${e}/` : e));
      return { text: entries.join("\n") || "(empty)", isError: false };
    }
    if (name === "read_file") {
      // Part 5 in miniature: a tool result is a decision, not a dump.
      const raw = readFileSync(path, "utf8");
      if (raw.length > 4000) {
        return { text: `${raw.slice(0, 4000)}\n\n[truncated: ${raw.length} chars total]`, isError: false };
      }
      return { text: raw, isError: false };
    }
    return { text: `No such tool: ${name}`, isError: true };
  } catch (error) {
    return { text: error instanceof Error ? error.message : String(error), isError: true };
  }
}
