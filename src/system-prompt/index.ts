/**
 * Part 1: the system prompt, assembled.
 *
 * Two pieces, and the split matters:
 *   - SYSTEM_PROMPT.md is static rules, identical every turn. Cacheable.
 *   - The memory index is dynamic and rebuilt per turn. This is where part 1
 *     and part 5 meet: the rules say "answer from the index", the index is what
 *     makes that possible.
 *
 * Order is deliberate. Rules first, then who is talking, then what is known.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Memory } from "../memory/index.ts";

export interface PromptContext {
  /** Where the conversation is happening, in the operator's own words. */
  channel: string;
  /** Who is talking. */
  speaker: string;
  /** Which adapter delivered it, so the model can match its tone to the medium. */
  platform: string;
}

export function buildSystemPrompt(memory: Memory, ctx: PromptContext, dir = import.meta.dirname): string {
  const rules = readFileSync(join(dir, "SYSTEM_PROMPT.md"), "utf8").trim();

  return [
    rules,
    "",
    "## This conversation",
    "",
    `- Platform: ${ctx.platform}`,
    `- Channel: ${ctx.channel}`,
    `- Speaking to you: ${ctx.speaker}`,
    `- Now: ${new Date().toISOString()}`,
    "",
    "## Memory index",
    "",
    "Names and one-line summaries only. Call memory_read with a path to open one.",
    "",
    memory.renderIndex(),
  ].join("\n");
}
