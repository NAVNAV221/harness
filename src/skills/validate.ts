/**
 * What a skill file must be. pi loads every SKILL.md at startup and puts only
 * its name and description in the prompt, so a bad one fails quietly: pi skips
 * it with a diagnostic nobody reads, or loads it and the model follows a step
 * that calls a tool that does not exist.
 *
 * test/skills.test.ts runs this over every skill in skills/. If you later let
 * anything write skills at runtime (an approved self-improvement proposal, say),
 * run the same function before writing, so an approved skill is never looser
 * than a committed one.
 *
 * Deliberately not here: judging whether a description routes well. That is the
 * adversarial pass in skills/PROMPT.md, and it needs a reader, not a regex.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "../memory/index.ts";

/** pi's limits (the Agent Skills spec): a-z, 0-9 and single hyphens, 64 characters. */
export const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_NAME = 64;
export const MAX_DESCRIPTION = 1024;

/**
 * Tool names a skill refers to: the leading snake_case identifier of every
 * `backticked` span. `memory_search` and `memory_read(path)` are references;
 * `entities/people/` and `stop` are not, having no underscore. Name your tools
 * in snake_case and this catches a skill that names one you never built.
 */
export function referencedTools(content: string): string[] {
  const out = new Set<string>();
  for (const m of content.matchAll(/`([^`\n]+)`/g)) {
    const id = /^([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/.exec(m[1]!)?.[1];
    if (id) out.add(id);
  }
  return [...out];
}

/** Every problem with one skill file; empty when it is fine. */
export function validateSkill(folder: string, content: string, tools: readonly string[]): string[] {
  if (!/^---\n[\s\S]*?\n---/.test(content)) return ["no frontmatter (--- name/description ---)"];
  const errors: string[] = [];
  const { fields, body } = parseFrontmatter(content);
  const name = fields.name?.trim() ?? "";
  const description = fields.description?.trim() ?? "";
  if (!name) errors.push("name is missing");
  else {
    if (name !== folder) errors.push(`name "${name}" does not match its folder "${folder}"`);
    if (name.length > MAX_NAME || !SKILL_NAME.test(name)) {
      errors.push(`name "${name}" is not lowercase-hyphenated, at most ${MAX_NAME} characters`);
    }
  }
  if (!description) errors.push("description is missing");
  else if (description.length > MAX_DESCRIPTION) {
    errors.push(`description is ${description.length} characters, over ${MAX_DESCRIPTION}`);
  } else if (/\s#/.test(description) && !/^["']/.test(description)) {
    // pi parses frontmatter as YAML, where " #" starts a comment: an unquoted
    // "what happened in #ops" reached the model as "what happened in".
    errors.push('description has an unquoted " #", which YAML reads as a comment and cuts off');
  }
  if (!body.trim()) errors.push("the body is empty");
  const known = new Set(tools);
  for (const tool of referencedTools(content)) {
    if (!known.has(tool)) errors.push(`names a tool that does not exist: ${tool}`);
  }
  return errors;
}

/** Every SKILL.md directly under a skills directory, by folder name. */
export function listSkills(dir: string): { folder: string; content: string }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => statSync(join(dir, n)).isDirectory() && existsSync(join(dir, n, "SKILL.md")))
    .sort()
    .map((folder) => ({ folder, content: readFileSync(join(dir, folder, "SKILL.md"), "utf8") }));
}
