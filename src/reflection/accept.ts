/**
 * The human half of the reflection loop.
 *
 *   npm run reflect:accept <id>          show what would change
 *   npm run reflect:accept <id> --apply  apply the memory blocks
 *
 * Only ## memory blocks are applied automatically, and only under the memory
 * directory. System prompt and skill proposals are printed for you to act on,
 * because those change how the harness behaves everywhere, forever, and that
 * should cost you a deliberate edit.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { loadConfig } from "../config.ts";
import { Memory } from "../memory/index.ts";

interface Block {
  file: string;
  action: string;
  content: string;
}

export function parseMemoryBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const re = /```file:([^\s`]+)\s+action:(create|replace)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown))) {
    blocks.push({ file: match[1]!, action: match[2]!, content: match[3]! });
  }
  return blocks;
}

export function section(markdown: string, name: string): string {
  const heading = `\n## ${name}\n`;
  const start = markdown.indexOf(heading);
  if (start === -1) return "";
  const from = start + heading.length;
  const next = markdown.indexOf("\n## ", from);
  return markdown.slice(from, next === -1 ? undefined : next).trim();
}

function main(): void {
  const [id, ...flags] = process.argv.slice(2);
  const apply = flags.includes("--apply");
  if (!id) {
    console.error("usage: npm run reflect:accept <proposal-id> [--apply]");
    process.exit(1);
  }

  const config = loadConfig();
  const path = join(config.proposalsDir, `${id}.md`);
  if (!existsSync(path)) {
    console.error(`No proposal at ${path}`);
    process.exit(1);
  }

  const markdown = readFileSync(path, "utf8");
  const memory = new Memory(config.memoryDir);
  const blocks = parseMemoryBlocks(markdown);

  console.log(`\nProposal ${id}\n`);

  if (blocks.length === 0) {
    console.log("  memory: nothing proposed");
  }
  for (const block of blocks) {
    const abs = resolve(config.memoryDir, block.file);
    if (abs !== config.memoryDir && !abs.startsWith(config.memoryDir + sep)) {
      console.log(`  memory: SKIPPED ${block.file} (escapes the memory directory)`);
      continue;
    }
    const exists = existsSync(abs);
    if (block.action === "create" && exists) {
      console.log(`  memory: SKIPPED ${block.file} (create, but it already exists - review by hand)`);
      continue;
    }
    if (!apply) {
      console.log(`  memory: would ${block.action} ${block.file} (${block.content.split("\n").length} lines)`);
      continue;
    }
    memory.write(block.file, block.content);
    console.log(`  memory: ${block.action}d ${block.file}`);
  }

  for (const name of ["capability gaps", "system prompt", "tools", "skills"]) {
    const body = section(markdown, name);
    if (!body) continue;
    console.log(`\n  ${name} (yours to apply by hand):`);
    for (const line of body.split("\n")) console.log(`    ${line}`);
  }

  if (!apply && blocks.length > 0) {
    console.log(`\nRe-run with --apply to write the memory changes.`);
  }
  console.log();
}

// Only run as a script, never on import from a test.
if (process.argv[1]?.endsWith("accept.ts")) main();
