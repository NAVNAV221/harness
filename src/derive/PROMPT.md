# Build prompt: derived memory

Read `spec/derive.md`. If it is not there, run `/harness:interview derive` first.
This module needs the event log (`spec/eventlog.md`); build that first.

**Instance data stays out of tracked files.** Owner and user ids, workspace
names, people's names, real messages, internal hosts and deploy notes go in
gitignored config (`.env`, `~/.config/<harness>/`) read at run time; specs name
the variable, not the value, and tests use synthetic fixtures. When a value is
dynamic or specific to this owner, say so and ask where it lives rather than
writing it in. `npm run privacy:check` before you commit.

The skeleton ships no derive code on purpose, like the event log: which entity,
what counts, and how it ends are the whole design.

## What to build

Everything except the model call is a pure function with no I/O, so the whole
pipeline is testable without a model.

1. **`src/derive/<entity>.ts`, the pure half:**
   - `isCandidate(event)`: external messages, and what the owner says to the
     harness. Never the harness's own replies or tool events.
   - `conversationOf(event)`: top-level messages of one channel are ONE
     conversation ("can you review it?" and "sure, tomorrow" are usually two
     top-level messages, and the second means nothing without the first); a
     thread reply belongs to its thread.
   - `buildWindows`: per conversation, the new events (citable) plus up to a
     handful of earlier ones as context (never citable). A thread's window opens
     with its root.
   - `batchWindows`: many small windows per call, never splitting one; every
     call has a fixed cost floor.
   - `buildPrompt`: the output contract (fixed, in code) plus the owner's policy
     file (read at run time), plus the open entities of the people in the batch,
     so the model can say "this closes X" or "this restates X" instead of
     inventing a duplicate. Each event carries its timestamp, so "Thursday"
     resolves against when it was said.
   - `parseOutput`: first `{` to last `}`, strict about the shape.
   - `verify`: the cited event is extractable in this batch; the quote is in it
     verbatim (whitespace normalised); fields are well-formed. Count and log
     every drop with its reason.
   - `resolve`: derived ids; a restatement (same type and counterparty,
     token-overlap >= 0.5) is evidence for the existing entity and keeps its id;
     closings apply only to open entities; a flagged-wrong entity is never
     re-created; an event already cited adds nothing.
   - `fold(transitions)`, `staleTransitions(state, now)`, `inMemory(entity, now)`,
     `render(entity)` with an `events:` frontmatter field.
2. **`src/derive/store.ts`:** the append-only transitions file under the log
   directory, the policy file in memory (copied from a seed in the repo on first
   run, never overwritten after), appending an owner's correction to the policy
   as an example, rendering memory from the fold (and removing rendered files
   that no longer belong), and a pid lock.
3. **`src/derive/run.ts`:** its own process, started after each successful
   ingest (systemd `OnSuccess=`, or whatever the deployment spec uses). It holds
   no source credentials. Order per batch: call, parse (retry once), verify,
   resolve, append transitions, and only then mark the batch's events done.
   Staleness runs once at the end over the whole fold. A per-call cost ledger
   and a daily cap.
4. **A correction tool** for the agent (e.g. `<entity>_update`): wrong, reopen,
   done, on an existing id only. It never creates. A "wrong" is appended to the
   policy file as an example with the owner's reason.
5. **Tests** for every non-negotiable in the spec, with a fake model.

## Constraints

- **Run a small sample on real data before the backfill.** Three batches are
  enough to see whether the policy is too loose. Seen on the first real run:
  old "let me check" micro-promises that nothing would ever close, and a
  counterparty who was the person a promise was about rather than to. Both were
  fixed in the policy before paying for the rest.
- **One extractor at a time.** A timer-triggered run and a manual backfill ran
  together and raced on the same state: a pid lock, taken over when its holder
  is dead.
- **Staleness at the end of a backfill.** Old events create old entities; the
  end-of-run staleness pass is what keeps a fresh backfill from burying the
  owner in last quarter's open promises.
- **Only actionable entities in memory.** The memory index is in every prompt.

Then run `npm run typecheck` and `npm test`, run three batches on real data,
and show me what they produced before running the rest.
