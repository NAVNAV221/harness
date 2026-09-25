---
module: derive
writes: spec/derive.md
depends_on: [spec/harness.md, spec/eventlog.md]
---

# Interview: derived memory

Read `spec/harness.md` and `spec/eventlog.md` first, then `src/memory/index.ts`
and `src/tools/memory-tools.ts`. This module needs the event log: it is an ETL
from the log to memory entities, and a harness with no log has nothing to
derive from.

This module is optional. Start by asking whether they want it. It earns its
place when the owner asks questions that keyword search over the log cannot
answer: "what did I promise anyone this week" is almost never phrased with the
word "promise". Commitments, decisions, open questions and people's
preferences are the usual first entity types. If a `log_search` answers what
they need, say so and stop.

## The shape, before any question

State it once, so the questions are about choices and not about the format:

```
log --select--> new candidate events (a done set or watermark)      no model
    --window--> per conversation, new events + earlier ones as
                context only                                        no model
    --extract-> one model call per batch of windows, JSON only      model
    --verify--> the cited event is extractable in this batch, and
                the quote is in it verbatim                         no model
    --resolve-> derived ids, merge restatements, apply closings     no model
    --store---> append-only transitions -> fold -> rendered memory
                entities that cite their events                     no model
```

The model detects; plain code decides. A result from the model is a claim to
be checked, never a write.

## Questions

**1. Which entity type first?**
One. Commitments, decisions, open questions, preferences, people. A pipeline
that extracts four types at once is judged on none of them. Record the rest
under `Later`.

**2. What counts?**
Get a rule a person could apply to one message: "a promise with a concrete
deliverable or a date; not 'let me check'". This becomes a **policy file** in
memory, seeded from the repo and read into every extraction call, so it can be
corrected without a code change. Ask for two examples of each side.

**3. What are its types or directions?**
For commitments: owner promised, owed to owner. For decisions: made, reversed.
Whatever the entity is, what distinguishes one instance from another.

**4. Which model?**
Recommend measuring before choosing: run a cheap and a strong model on the same
sample, have the owner label about twenty results, write the numbers into the
spec. A cheaper model that drops the specific facts that matter costs more than
it saves. If they choose without measuring, record that under Open questions.

**5. How does an entity end?**
Closing (a later message fulfils it: automatic or suggested?), staleness (quiet
for how long, or past a due date by how much?), and correction by the owner.
Staleness is a transition, never a delete: new evidence brings it back.

**6. What does memory show?**
The memory index is in the system prompt on every turn. Only entities a turn can
act on belong there (open ones, ones closed recently); the rest stay in the
derived store. Get the rule.

**7. How does the owner correct it?**
Usually by telling the harness in chat, which records a transition through a
dedicated tool that can label but never create. A "wrong" is appended to the
policy file as an example the next run reads: machines propose, the owner
arbitrates. Changes to the rules themselves are proposed, never applied.

**8. What does it cost, at most?**
A daily cap in money, and what happens when it is hit (stop, resume next run).

## Non-negotiables for the implementation

The spec must repeat these:

- The extractor never reads the harness's own replies or tool events. A
  pipeline that mines its own output feeds on itself.
- Every result cites an extractable event of its batch, with a quote that is in
  that event verbatim. A paraphrase is dropped and counted.
- Ids are derived from the entity, and a restatement keeps the old id, so the
  owner's corrections survive a rewording.
- An entity the owner flagged wrong is never re-created from new evidence.
- The store is append-only transitions; memory files are rendered from their
  fold and may be deleted and rebuilt.
- Events are marked done only after their transitions are on disk. A batch that
  fails to parse twice is poisoned with its reason, not retried forever; a
  system failure (auth, quota, network) stops the run without marking anything.
- One extractor at a time: a lock whose holder is dead is taken over.
- Re-running over the same log adds no transitions.

## Write the spec

Write `spec/derive.md`:

```markdown
# Derive spec

## Entity
<the one type, and what Later holds>

## What counts
<the rule, and the examples on each side - this seeds the policy file>

## Types
<directions or kinds>

## Model
<which, and the measurement or "not measured">

## Ending
- closing: <automatic | suggested>
- stale: <rule>
- correction: <how>

## Memory shows
<the rule>

## Cost
<daily cap, and what happens at it>

## Open questions
<anything the owner could not answer - the implementer must ask, not assume>
```
