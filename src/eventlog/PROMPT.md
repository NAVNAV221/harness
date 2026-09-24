# Build prompt: event log

Read `spec/eventlog.md`. If it is not there, run `/harness:interview eventlog`
first. This module is optional; do not build it for a harness whose spec does not
ask for it.

The skeleton ships no event log code on purpose. What gets logged, at what
detail, and from which sources is the whole design, and a default would be a
record nobody chose of data nobody agreed to keep.

## What to build

1. **`src/eventlog/index.ts`** - an `EventLog` with `append(event)` and
   `search(query, opts)`. `append` writes one JSON line to
   `<dir>/log/YYYY/MM/DD.jsonl`, dated by the event's `ts`, and skips an `id` it
   has already written. The event type is the spec's shape exactly:
   `{id, ts, stream, source, kind, actor, from, to, channel, ref, text, raw_ref}`.
   Put the type in `src/eventlog/types.ts`, the way messaging and memory do.
2. **The `self` stream**, if the spec asks for it. Write events from the harness,
   never from a tool: the inbound message and the reply where
   `src/harness.ts` calls `appendTranscript`, and every guardrail decision
   through `onDecision`. If the spec wants tool inputs, pass the rendered input
   through `onDecision` - it is already redacted by then, which is the point.
   Say whether the log replaces `memory/transcripts/` or runs beside it, and if
   beside, why two records of the same message are worth it.
3. **The `ingested` stream**, if the spec asks for it, as a separate entry point:
   `src/eventlog/ingest.ts`, one small function per source, run on a schedule by
   whatever the deployment spec uses (cron, a systemd timer, a compose service).
   It is plain code with no model in it. Each source maps its native record to an
   event with an id derived from the source's own id, and keeps a cursor so a run
   reads only what is new.
4. **Search.** An FTS5 table over `text` plus the fields the spec filters on, in
   `<dir>/index.sqlite`, rebuilt from the JSONL by `npm run eventlog:reindex`.
   One tool, `log_search`, returns event ids, timestamps, sources and snippets,
   clipped with `clip()` from `src/memory/index.ts`. Register it in
   `src/tools/index.ts` and add it to `tools` in `src/config.ts`.

## Constraints

- **The model never writes the log.** No tool appends to it. Add a `deny` rule
  on `bash` for the log path in `src/guardrails/policy.ts`, and write above it
  that it is the backstop: the defence is that the directory is not writable by
  the agent's user, when the deployment allows it.
- **Credentials for sources live in the ingest process only.** Read the spec's
  source table. If ingest and the agent would run as one process with one
  environment, stop and tell me: that puts every source token one `env` away
  from the model, which is the thing the split exists to prevent.
- **Ids are derived, never random.** Re-running ingest over the same day must
  leave the files byte-identical. Test that.
- **The index is derived.** Delete `index.sqlite`, reindex, and the same query
  must return the same ids. Test that too.
- **Derived memory cites events.** If memory entities are built from the log, add
  an `events:` field to their frontmatter listing the ids, and have
  `memory_write` refuse an entity of those types without one.
- **Check FTS5 before you depend on it.** `node:sqlite` is built into recent Node,
  but not every build includes the FTS5 module: Node 23.10 fails with
  `no such module: fts5`. Run `CREATE VIRTUAL TABLE t USING fts5(x)` on the Node
  you deploy on. If it fails, use `better-sqlite3`, which bundles FTS5, and say in
  the commit that adds it that it replaces `node:sqlite`, and why.
- **Search stays FTS5 unless the data says otherwise.** A heavier engine
  (Tantivy, a vector store) is added only after a spike on their real log shows
  it clearly beats FTS5 on queries they actually run. Write the spike's result
  into the spec either way. Note that the porter stemmer is English-only.
- **Retention is one job, and it is the only thing that deletes.** Build it only
  if the spec names a window.

Add the log directory to `.env.example` as `HARNESS_LOG_DIR`, defaulting next to
memory, and to `.gitignore` if it could ever land inside the repo.

Then run `npm run typecheck` and `npm test`, show me ten events from a real
session, and one `log_search` call with its output.
