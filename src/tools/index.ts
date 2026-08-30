/**
 * The tool registry. Every tool the model can call is assembled here.
 *
 * Keep this file boring. The interesting decisions - which tools exist, and how
 * their descriptions keep the model from confusing them - live in the tool
 * modules themselves and in PROMPT.md next to this file.
 */
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { Memory } from "../memory/index.ts";
import { createMemoryTools } from "./memory-tools.ts";

export function createTools(memory: Memory): ToolDefinition[] {
  return [
    ...createMemoryTools(memory),
    // Add yours here. Run /build-tools to generate one from spec/tools.md.
  ];
}
