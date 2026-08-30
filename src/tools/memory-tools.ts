/**
 * Three tools, not ten.
 *
 * The harness describes a tool. It does not decide when the tool gets used - the
 * model decides that by reading the description. So the descriptions below are
 * written to be told apart from each other, not to sound complete. If you add a
 * fourth tool, re-read all four and ask: what question would make the model pick
 * the wrong one?
 */
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { Memory } from "../memory/index.ts";

export function createMemoryTools(memory: Memory): ToolDefinition[] {
  const search = defineTool({
    name: "memory_search",
    label: "Search memory",
    description:
      "Find WHICH memory file mentions a term, when you do not already know the path. " +
      "Returns file paths with matching lines, never full files. Use this first; " +
      "then use memory_read on the path it returns.",
    promptSnippet: "memory_search - locate memory files by keyword",
    parameters: Type.Object({
      query: Type.String({ description: "Literal substring to look for, case-insensitive." }),
    }),
    async execute(_id, params) {
      const hits = memory.search(params.query);
      const text = hits.length
        ? hits.map((h) => `${h.path}:${h.line}: ${h.text}`).join("\n")
        : `No memory file mentions "${params.query}".`;
      return { content: [{ type: "text", text }], details: { hits: hits.length } };
    },
  });

  const read = defineTool({
    name: "memory_read",
    label: "Read memory",
    description:
      "Read one memory file whose exact path you already have, from the memory index or from " +
      "memory_search. Large files are clipped and the result says so. Not for finding files.",
    promptSnippet: "memory_read - open one memory file by path",
    parameters: Type.Object({
      path: Type.String({ description: 'Path relative to the memory dir, e.g. "entities/people/dana.md".' }),
      offset: Type.Optional(Type.Number({ description: "Line to start from when continuing a clipped read." })),
    }),
    async execute(_id, params) {
      const result = memory.read(params.path);
      let text = result.text;
      if (params.offset && params.offset > 1) {
        text = text.split("\n").slice(params.offset - 1).join("\n");
      }
      return {
        content: [{ type: "text", text }],
        details: { truncated: result.truncated, bytes: result.originalBytes },
      };
    },
  });

  const write = defineTool({
    name: "memory_write",
    label: "Write memory",
    description:
      "Record something that should still be true next session: a fact about a person, a project, " +
      "a standing decision. Overwrites the whole file, so read it first if it exists. " +
      "Do not use this for the answer to the current question - that is not memory, that is a reply.",
    promptSnippet: "memory_write - record a durable fact",
    promptGuidelines: [
      "Write to memory only what would matter in a session a month from now.",
      "One subject per file. Give every file a `summary:` line - it is all the model sees by default.",
    ],
    parameters: Type.Object({
      path: Type.String({ description: 'Relative path, e.g. "entities/people/dana.md".' }),
      content: Type.String({ description: "Full new file contents, including YAML frontmatter." }),
      reason: Type.String({ description: "One line: why this is worth remembering." }),
    }),
    async execute(_id, params) {
      const written = memory.write(params.path, params.content);
      return {
        content: [{ type: "text", text: `Wrote ${written} (${params.reason})` }],
        details: { path: written },
      };
    },
  });

  return [search, read, write];
}
