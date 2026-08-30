# Build prompt: memory

Read `spec/memory.md`. If it is not there, run `interview/03-memory.md` first.

Memory here is markdown files on disk, deliberately. Before you replace that with
a database or a vector store, say out loud what it buys: files are diffable,
greppable, reviewable by a human, and a reflection proposal can be read before it
is accepted. Give up those properties on purpose or not at all.

What to change, in order:

1. **Entity types.** Create the folders under `memory/entities/` that the spec
   names, with one real example file in each. Delete the seed types that the spec
   does not mention - `people`, `projects` and `conventions` are examples, not a
   schema.
2. **The index.** `Memory.renderIndex()` decides what the model sees about memory
   on every turn. If the spec calls for something other than names and summaries,
   change it here, and tell me what it costs per turn in tokens at their scale.
3. **Read budget.** `MAX_READ_BYTES` and the `clip()` note. The note must say how
   to get the rest. A truncation the model cannot recover from is a lie.
4. **Retention.** If the spec says facts expire, add the expiry field to the
   frontmatter and enforce it in `listEntities` - an expired fact must not appear
   in the index. A fact with no expiry is one that will be wrong eventually and
   still repeated confidently.
5. **Never-stored.** Anything the spec forbids goes in `src/guardrails/policy.ts`
   as a `deny` rule on `memory_write`, not as a note in the system prompt.

Then show me, for a realistic session, the token cost of the memory context
before and after your changes.

Finally run `npm run typecheck`.
