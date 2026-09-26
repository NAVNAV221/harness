---
module: dream
writes: spec/dream.md
depends_on: [spec/harness.md, spec/memory.md]
---

# Interview: dreaming (memory consolidation)

Read `spec/harness.md`, `spec/memory.md`, `src/memory/index.ts` and, if they
exist, `spec/eventlog.md` and `spec/derive.md` first.

Memory written a turn at a time drifts: two files about the same person, a fact
that stopped being true, a summary line that no longer says what the file holds.
Dreaming is a job that runs while nobody is talking to the harness, reads the
memory store and the recent traffic, and **proposes** a consolidated store. The
idea follows sleep-time compute and Anthropic's Dreams for managed agents:
model-judged, non-destructive, human-gated. This module adds what those lack: an
automated check that every change is backed by a quote found verbatim in what the
run read.

This module is optional. Start by asking whether they want it. It earns its
place once memory has more than a few dozen entity files and the harness writes
to it most days. A fresh harness has nothing to consolidate; say so and stop.

## The shape, before any question

```
read ----> entity files, session logs and the window's traffic  no model
dream ---> one model call: a list of changes, each citing
           evidence with a verbatim quote                        model
verify --> every cited id was read by this run, every quote is
           in it, paths are legal, merges whole                  no model
propose -> a dated proposal on disk, never in memory             no model
decide --> the owner applies or discards, in code                a person
apply ---> snapshot memory, write only files unchanged since     no model
```

## Questions

**1. Which operations?**
Recommend these five and let them drop some: `merge` (two files become one),
`contradiction` (the newer evidenced fact wins, citing both), `prune` (a fact a
later event shows stopped being true; age alone never prunes), `promote`
(something seen twice or more becomes a fact), `index` (a vague or wrong
`summary:` line, which is what the memory index shows every turn).

**2. What is off limits?**
Entities another pipeline owns (derived commitments, say) are read-only here.
The committed `memory/INDEX.md` is left alone if the deployed repo must stay
pullable. Anything else?

**3. What does it read?**
Entity files, session logs, and the window's traffic from the transcripts or
the event log. Get the window (24 hours) and a size budget (the newest first,
capped per event).

**4. When does it run?**
Nightly, in the owner's timezone, as its own process with no source or
messaging credentials. Which date a run is "for" matters when it runs after
midnight: the date 12 hours earlier is the day it consolidates.

**5. How does the owner decide?**
One card for the proposal (changes by kind, how many were dropped by the check,
the cost) with Apply and Discard, and each change with its evidence and diff in
the card's thread. A proposal not decided within a few days expires. Ask whether
all-or-nothing is acceptable for a first version.

**6. Model and cost?**
A strong model; the call is long, so it streams. Get a daily cap and a limit on
changes per run (12).

## Write the spec

Write `spec/dream.md`:

```markdown
# Dream spec

## Operations
<which, with the rule for each>

## Off limits
<read-only entity types and files>

## Input
<sources, window, size budget>

## Schedule
<time and timezone, process, credentials it holds (none but the model's)>

## Decision
<card and thread; all or nothing | per change; expiry>

## Model and cost
<model, daily cap, max changes per run>

## Open questions
<anything the owner could not answer - the implementer must ask, not assume>
```
