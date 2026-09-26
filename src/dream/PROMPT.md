# Build prompt: dreaming

Read `spec/dream.md`. If it is not there, run `/harness:interview dream` first.
Read `src/memory/index.ts`: a dream proposes files in exactly the shape memory
already reads.

The skeleton ships no dream code on purpose, like the event log: which
operations, what is off limits and how the owner decides are the design.

## What to build

1. **`src/dream/consolidate.ts`, pure:** `gather` (what the run reads, each with
   an id: `memory:<path>`, `session:<file>`, an event or transcript id),
   `buildPrompt` (the operations and the output contract fixed in code, the
   inputs after), `parseOutput` (first `{` to last `}`, strict), and `verify`,
   which drops a change, and records why, when:
   - a cited id is not one this run read, or its quote is not in it verbatim
     (whitespace and case aside), or the quote is under 5 characters;
   - a create, promote or contradiction cites only memory: it needs traffic or
     a session behind it;
   - the path is outside the entity folders, is off limits, creates a file that
     exists or replaces one that does not;
   - the new file lacks the frontmatter memory needs (`summary:`, and `name:`
     on a create);
   - it is a second change to one file, or over the per-run limit.
   A merge is all or nothing: one member dropped drops its group.
2. **`src/dream/run.ts`:** its own process. A pid lock, taken over when the
   holder is dead. A per-call cost ledger and a daily cap. Writes
   `<dreams dir>/<date>/proposal.json` (each change with its evidence, the
   target file's sha256 when proposed, a line diff), `rationale.md` (readable,
   with the dropped list and reasons), and an append-only `state.jsonl`
   (`ready`, `empty`, `posted`, `applied`, `discarded`, `expired`). `--dry-run`
   writes a separate directory that is never posted; `--force` redoes a date.
   It never writes the memory directory.
3. **The gate, in the agent process:** find `ready` proposals, post one card
   through the adapter's existing card or `post` path to the owner's one
   destination, each change in its thread. **Apply** (owner click only, code,
   no model): snapshot the entity folders and any file it touches to an archive
   directory, then write each change whose file still has the sha it had when
   proposed; a file changed since is skipped and named on the card, never
   overwritten. **Discard** records it. Applied and discarded are terminal: a
   second click does nothing.
4. **The schedule:** a systemd timer with `OnCalendar=` and the owner's
   timezone, or the deployment spec's equivalent. The unit gets only the model
   credential.
5. **Tests** with a fake model: every drop reason in `verify`, merge
   all-or-nothing, apply skipping a file that changed, a second apply doing
   nothing, the dry run never posted.

## Things a real run hit

- **Stream the model call.** The Anthropic SDK refuses a non-streaming request
  whose `max_tokens` could run past ten minutes; the first dry run failed on
  that.
- **Require `name:` only on a create.** Requiring it on every change dropped a
  valid summary fix to a file that never had one. Check the rule against the
  files memory actually holds, not the template.
- **Copy ids exactly.** A promotion cited an id with part of it missing and was
  (rightly) dropped. Say in the prompt that ids are copied character for
  character, and show them in the form `verify` compares.
- **Say what is off limits in the prompt, not only in `verify`.** Told only by
  the check, the model spent a run proposing changes to read-only entities, all
  dropped.
- **A rerun records itself under its own id.** A `--force` rerun that reused the
  first run's id was deduplicated away, so the record showed one run.

## Constraints

- Non-destructive: the job writes proposals, never memory.
- Human-gated: no tool reaches any of this. The model cannot post, apply or
  discard a dream.
- A change that fails the check is counted and listed with its reason. It is
  never shown to the owner as advice.

Then run `npm run typecheck` and `npm test`, run one `--dry-run` on real memory,
and show me `rationale.md`, including what was dropped and why.
