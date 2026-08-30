# Build prompt: tools

Read `spec/tools.md`. If it is not there, run `interview/02-tools.md` first.

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
  in `requireApproval` in `src/guardrails/policy.ts` in the same change.
- Errors are returned as content, not thrown. A thrown error ends the turn; a
  returned one lets the model recover.

Then run the adversarial pass: for every pair of tools now registered, show me
the question that would make the model pick the wrong one, and the description
change that fixes it. Repeat until you cannot construct one. Show me the pairs
you checked, including the ones that were fine.

Finally run `npm run typecheck`.
