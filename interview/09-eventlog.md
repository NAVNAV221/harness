---
module: eventlog
writes: spec/eventlog.md
depends_on: [spec/harness.md]
---

# Interview: the event log

Read `spec/harness.md` first, then `src/harness.ts` and `src/memory/index.ts`.
The harness already writes two partial records: `memory/transcripts/` holds what
was said per channel, and the session log holds guardrail decisions. Neither
holds what a tool was called with, and neither can be searched as one history.

This module is optional, like messaging. Start by asking whether they want it.
It earns its place when either of these is true:

- **They need to debug the harness like a codebase.** "Why did it say that on
  Tuesday?" needs every tool call, guardrail decision and reply in one place,
  in order, with the same shape.
- **Memory is derived from outside sources.** A harness that briefs someone from
  Slack, mail and a tracker needs a record of what it read, so every conclusion
  in memory can point at the event it came from, and a wrong conclusion can be
  fixed by re-deriving it rather than by editing it by hand.

If neither is true, say so and stop. The transcripts are enough, and a log
nobody reads is a directory that grows.

## The shape, before any question

State it once, so the questions are about choices and not about the format:

- Append-only JSONL, one file per day: `log/YYYY/MM/DD.jsonl`.
- One normalized event per line:
  `{id, ts, stream, source, kind, actor, from, to, channel, ref, text, raw_ref}`.
- `stream` is `self` (the harness's own tool calls, guardrail decisions and
  replies) or `ingested` (external sources, polled by plain code).
- `id` is stable and derived from the source, like `slack:C0123/1727251200.0001`,
  so ingesting the same thing twice writes nothing new.
- The model never writes the log. Ingest is deterministic code, so the log is
  never wrong because of the model.
- Derived memory cites event ids. An entity with no event behind it is a guess.
- Search is SQLite FTS5 over the log. A heavier engine is added only if a spike
  on their real data shows it clearly wins.

## Questions

**1. Which streams?**
`self` only, or `self` and `ingested`. Use `AskUserQuestion`. `self` is cheap and
is the one that answers "why did it do that". `ingested` is a second process
with its own credentials, and its own interview-sized decisions per source.

**2. For `ingested`: which sources, and who holds their credentials?**
Name each source and what it is read with: a token, an API key, a CLI login. Ask
whether that credential lives only in the ingest process. It should: ingest reads,
so its credentials can often do more than read, and the agent should never be one
`env` call away from them. If `spec/harness.md` has a `Credentials` section, read
it and confirm rather than ask again.

**3. What is in scope?**
Everything the harness can see is almost never the answer. Ask for the rule:
"everything I send and everything addressed to me", "these three channels",
"only tool calls, not replies". Get something a line of code can decide.

**4. Full text, or metadata only?**
Full text makes the log searchable and makes it the most sensitive file on the
machine. Metadata keeps it safe and makes search nearly useless. Ask which, per
stream if needed. If `self` logs tool inputs, say that they are redacted by the
guardrail layer first, and ask whether that is enough.

**5. Where is it stored, and what backs it up?**
On the same disk as memory, usually, and outside the repo whenever it holds text
about a real person. Get a path and a backup answer. A log is only the source of
truth if it survives the disk it is on; "nothing" is an answer, said out loud.

**6. How long is it kept?**
Forever, a fixed window, or per source. Retention decides whether re-deriving
memory from the log is possible later: an event you deleted cannot be re-read.
If they pick a window, ask what happens to memory that cites an expired event.

## Non-negotiables for the implementation

The spec must repeat these:

- Append-only. Nothing rewrites or deletes a line except the retention job the
  spec names.
- No tool the model can call writes the log. `self` events are written by the
  harness around the model, not by it.
- Ids are derived from the source, never random, so re-ingest is idempotent.
- The FTS5 index is derived. Deleting it and rebuilding from the JSONL must give
  the same answers.
- Search results are clipped with a note saying how to get the rest, like every
  other read in this harness.

## Write the spec

Write `spec/eventlog.md`:

```markdown
# Event log spec

## Streams
<self | self + ingested>

## Sources
- <source> | read with: <credential> | held by: <ingest process, never the agent>

## Scope
<the rule that decides what is logged, per stream>

## Detail
<full text | metadata only, per stream, and whether self logs tool inputs>

## Storage
- Path: <outside the repo if it holds a person's data>
- Backed up by: <what, how often, or "nothing" said out loud>

## Retention
<forever | window, and what happens to memory citing an expired event>

## Search
SQLite FTS5 over the log. <anything the spec already knows, e.g. languages the
stemmer will not handle>

## Open questions
<anything the user could not answer - the implementer must ask, not assume>
```
