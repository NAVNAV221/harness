/**
 * The memory store. Plain markdown files, no database.
 *
 * Why files: the forker can read them, git can diff them, the reflection module
 * can propose changes as text, and a human can veto a change by reading it.
 * Swap this for a vector store when you can say what the vector store buys you.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, appendFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { Clipped, Entity, TranscriptEntry } from "./types.ts";

/** How much of a single memory file reaches the model before we clip it. */
const MAX_READ_BYTES = 8_000;
/** How many search hits reach the model. Ranking beats volume. */
const MAX_SEARCH_HITS = 12;

export class Memory {
  readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
    for (const sub of ["entities", "sessions", "transcripts"]) {
      mkdirSync(join(dir, sub), { recursive: true });
    }
  }

  /** Reject anything that would escape the memory dir. Tools take paths from the model. */
  private safePath(relPath: string): string {
    const abs = resolve(this.dir, relPath);
    if (abs !== this.dir && !abs.startsWith(this.dir + sep)) {
      throw new Error(`path escapes the memory directory: ${relPath}`);
    }
    return abs;
  }

  // --- entities -----------------------------------------------------------

  listEntities(): Entity[] {
    const root = join(this.dir, "entities");
    if (!existsSync(root)) return [];
    const out: Entity[] = [];
    for (const type of readdirSync(root)) {
      const typeDir = join(root, type);
      if (!statSync(typeDir).isDirectory()) continue;
      for (const file of readdirSync(typeDir)) {
        if (!file.endsWith(".md")) continue;
        const abs = join(typeDir, file);
        const { fields } = parseFrontmatter(readFileSync(abs, "utf8"));
        const id = file.slice(0, -3);
        out.push({
          type,
          id,
          path: relative(this.dir, abs),
          name: fields.name ?? id,
          summary: fields.summary ?? "",
          fields,
        });
      }
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * What the model sees about memory on every single turn.
   *
   * Names and one-line summaries only. The model calls memory_read to open one.
   * This is progressive disclosure: the index is cheap, the file is not.
   */
  renderIndex(): string {
    const entities = this.listEntities();
    if (entities.length === 0) {
      return "Memory is empty. Use memory_write to record something worth keeping.";
    }
    const byType = new Map<string, Entity[]>();
    for (const e of entities) {
      const list = byType.get(e.type) ?? [];
      list.push(e);
      byType.set(e.type, list);
    }
    const lines: string[] = [];
    for (const [type, list] of [...byType].sort()) {
      lines.push(`${type}:`);
      for (const e of list) {
        lines.push(`  ${e.path} - ${e.name}${e.summary ? `: ${e.summary}` : ""}`);
      }
    }
    const notes = join(this.dir, "INDEX.md");
    if (existsSync(notes)) {
      lines.push("", "Operator notes (memory/INDEX.md):", readFileSync(notes, "utf8").trim());
    }
    return lines.join("\n");
  }

  /** Read one memory file. Clips loudly rather than silently. */
  read(relPath: string): Clipped {
    const abs = this.safePath(relPath);
    if (!existsSync(abs)) {
      return { text: `No such memory file: ${relPath}`, truncated: false, originalBytes: 0 };
    }
    const raw = readFileSync(abs, "utf8");
    return clip(raw, `memory_read("${relPath}", offset: <line>)`);
  }

  write(relPath: string, content: string): string {
    const abs = this.safePath(relPath);
    if (!abs.endsWith(".md")) throw new Error("memory files must end in .md");
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content.endsWith("\n") ? content : content + "\n", "utf8");
    return relative(this.dir, abs);
  }

  /** Substring search across every memory file. Replace with something better when it stops being enough. */
  search(query: string): { path: string; line: number; text: string }[] {
    const needle = query.toLowerCase();
    const hits: { path: string; line: number; text: string }[] = [];
    for (const abs of walk(this.dir)) {
      if (!abs.endsWith(".md") && !abs.endsWith(".jsonl")) continue;
      const lines = readFileSync(abs, "utf8").split("\n");
      for (const [i, line] of lines.entries()) {
        if (line.toLowerCase().includes(needle)) {
          hits.push({ path: relative(this.dir, abs), line: i + 1, text: line.trim().slice(0, 200) });
          if (hits.length >= MAX_SEARCH_HITS) return hits;
        }
      }
    }
    return hits;
  }

  // --- transcripts and sessions -------------------------------------------

  appendTranscript(entry: TranscriptEntry): void {
    const safe = entry.channel.replace(/[^a-zA-Z0-9._-]/g, "_");
    appendFileSync(join(this.dir, "transcripts", `${safe}.jsonl`), JSON.stringify(entry) + "\n", "utf8");
  }

  writeSessionLog(id: string, body: string): string {
    const abs = join(this.dir, "sessions", `${id}.md`);
    writeFileSync(abs, body, "utf8");
    return relative(this.dir, abs);
  }
}

/** Clip text to a byte budget and say so. Never truncate in silence. */
export function clip(raw: string, howToGetTheRest: string, maxBytes = MAX_READ_BYTES): Clipped {
  const bytes = Buffer.byteLength(raw, "utf8");
  if (bytes <= maxBytes) return { text: raw, truncated: false, originalBytes: bytes };
  const kept = Buffer.from(raw, "utf8").subarray(0, maxBytes).toString("utf8");
  const note = `[truncated: showed ${maxBytes} of ${bytes} bytes. Get the rest with ${howToGetTheRest}]`;
  return { text: `${kept}\n\n${note}`, truncated: true, note, originalBytes: bytes };
}

export function parseFrontmatter(raw: string): { fields: Record<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  if (!match) return { fields: {}, body: raw };
  const fields: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  }
  return { fields, body: raw.slice(match[0].length) };
}

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) yield* walk(abs);
    else yield abs;
  }
}
