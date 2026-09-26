# Build prompt: event log

Read `spec/eventlog.md`. If it is not there, run `/harness:interview eventlog`
first. This module is optional; do not build it for a harness whose spec does not
ask for it.

**Instance data stays out of tracked files.** Owner and user ids, workspace
names, people's names, real messages, internal hosts and deploy notes go in
gitignored config (`.env`, `~/.config/<harness>/`) read at run time; specs name
the variable, not the value, and tests use synthetic fixtures. When a value is
dynamic or specific to this owner, say so and ask where it lives rather than
writing it in. `npm run privacy:check` before you commit.

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
  `no such module: fts5`, while 22.13+ and 25 have it. Run
  `CREATE VIRTUAL TABLE t USING fts5(x)` on the Node you deploy on, not the one
  on your laptop: they are often different builds. If it fails, use `better-sqlite3`, which bundles FTS5, and say in
  the commit that adds it that it replaces `node:sqlite`, and why.
- **Search stays FTS5 unless the data says otherwise.** A heavier engine
  (Tantivy, a vector store) is added only after a spike on their real log shows
  it clearly beats FTS5 on queries they actually run. Write the spike's result
  into the spec either way. Note that the porter stemmer is English-only.
- **Retention is one job, and it is the only thing that deletes.** Build it only
  if the spec names a window.

## Things a real ingest hit

Found by building this against Slack, Jira, Google Calendar and Gmail. Each one
either lost data silently or failed every five minutes until fixed.

- **Serialize with a fixed key order.** `JSON.stringify` follows insertion
  order; a mapper that builds the object differently changes the bytes without
  changing the event, and the byte-identical test fails for the wrong reason.
- **Catch the index up from the JSONL before every search**, by per-file byte
  offset. Two processes write the log (the agent's `self` stream, ingest's
  `ingested` stream); an index updated only by the writer that owns it is stale
  for the other. Never index half a line.
- **A cursor advances only on a complete read.** History APIs usually page
  newest-first: take the first page and move the cursor to its newest item, and
  everything between the pages is skipped forever. Read down to the cursor, or
  do not move it; ids make the re-read free.
- **Budget every run.** A five-minute timer and a first backfill of hundreds of
  conversations do not fit in one run; spread it, per source, under the
  platform's rate limit.
- **Quota is not failure.** A rate-limit or quota error stops that source for
  this run without moving its cursor, quietly. Anything else is reported.
- **Remember dead resources.** A conversation the API says no longer exists
  (`channel_not_found`) is recorded in the cursor and skipped, or it errors on
  every run for ever.
- **Scoped API tokens may need a gateway.** Atlassian's scoped tokens return 401
  on the site URL and work only through `api.atlassian.com/ex/jira/<cloudId>`.
  When a token that should work does not, check the platform's gateway before
  the token.
- **Never let an extractor read the harness's own replies.** If anything mines
  the log (see the `derive` module), the `self` stream's outbound messages and
  tool events are not candidates: a pipeline that reads its own output feeds on
  itself.
- **One process and one unit per credential set.** Ingest loads only its env
  file; the agent never does. A systemd timer uses `OnCalendar=`: an
  `OnUnitInactiveSec=` timer counts only from runs it started itself, so enabled
  after a manual run it never fires.

Add the log directory to `.env.example` as `HARNESS_LOG_DIR`, defaulting next to
memory, and to `.gitignore` if it could ever land inside the repo.

Then run `npm run typecheck` and `npm test`, show me ten events from a real
session, and one `log_search` call with its output.
