# Build prompt: tools

Read `spec/tools.md`. If it is not there, run `/harness:interview tools` first.

**Instance data stays out of tracked files.** Owner and user ids, workspace
names, people's names, real messages, internal hosts and deploy notes go in
gitignored config (`.env`, `~/.config/<harness>/`) read at run time; specs name
the variable, not the value, and tests use synthetic fixtures. When a value is
dynamic or specific to this owner, say so and ask where it lives rather than
writing it in. `npm run privacy:check` before you commit.

Then add each tool to `src/tools/`, one file per coherent group, and register it
in `src/tools/index.ts`. Follow `memory-tools.ts` exactly: `defineTool` from
`@earendil-works/pi-coding-agent`, TypeBox schemas, a `promptSnippet` for the
system prompt's tool list, `promptGuidelines` for anything the model gets wrong
about when to use it.

Constraints:
- Start with three tools. Not ten.
- Every argument gets a `description`. The model reads those.
- Handle the empty case and the oversized case that the spec names. An oversized
  result must be clipped with a note saying how to get the rest - see `clip()` in
  `src/memory/index.ts`. Never truncate silently.
- Never trust a path that came from the model. See `safePath` in
  `src/memory/index.ts` for the pattern.
- A tool that writes, deletes, spends money or is visible outside the team goes
  in `requireApproval` in `src/guardrails/policy.ts` in the same change, with a
  `describe(input)` that renders what will actually happen from the real
  fields ("invite Dana and Sam to Sync, Tue 10:00, Google emails both"). People
  approve JSON without reading it.
- Errors are returned as content, not thrown. A thrown error ends the turn; a
  returned one lets the model recover.

A tool result is the one text the model is guaranteed to read. When a tool's
output feeds something with a fixed shape (a brief, a report), return the shape's
rules with the data, and hand back ready-made citations (a link with its label)
rather than ids and URLs the model has to assemble: left to assemble them, it
pasted raw ids.

Once every job the harness does has its own tool, take `bash` out of
`tools` in `src/config.ts`. With the shell available the model uses it instead of
the tools you built (seen live: `grep` over the data directory and `find /` over
the whole disk instead of the search tool). Keep the bash deny rules as a
backstop. The same goes for any general tool that shadows a specific one.

Then run the adversarial pass: for every pair of tools now registered, show me
the question that would make the model pick the wrong one, and the description
change that fixes it. Repeat until you cannot construct one. Show me the pairs
you checked, including the ones that were fine.

Finally run `npm run typecheck`.
