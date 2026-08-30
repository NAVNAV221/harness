---
module: memory
writes: spec/memory.md
depends_on: [spec/harness.md]
---

# Interview: memory, which is really context management

Read `spec/harness.md` first. If its "Knows about" section says nothing
persistent, say so and skip this interview - you have just saved them a module.

Two different jobs share this name, and conflating them is how you end up with a
harness that stores everything and recalls nothing:

1. What the harness **knows**: entities, sessions, transcripts on disk.
2. What the model **sees**: the index injected each turn, and what happens when
   a result is too big to pass through.

Ask about both. Job 2 is the one people skip.

## Questions, job 1: what is stored

**1. What kinds of things does it need to remember?**
People, services, customers, incidents, runbooks, decisions. Each kind becomes a
folder under `memory/entities/`. There is no fixed schema - resist inventing one
beyond what they name.

**2. For each kind: what is the one line a future session needs?**
That line is the `summary:` field, and it is all the model sees by default. If
they cannot compress an entity to one line, the entity type is too broad.

**3. Where does the content come from?**
Typed in by hand, written by the harness during a session, imported from
somewhere. Imported memory needs an importer, and that is a tool - send it back
to `spec/tools.md`.

**4. What must never be written to memory?**
Secrets, customer data, anything under a retention policy. This becomes a
guardrail, not a good intention.

**5. What expires?**
A fact with no expiry is a fact that will be wrong eventually and still
confidently repeated. Ask per entity type.

## Questions, job 2: what reaches the model

**6. What does the model see about memory on a turn where it needs none of it?**
The default here is the index: names and one-line summaries. Ask whether that is
right for them, and what it costs at their scale. A hundred entities is fine. Ten
thousand is a retrieval problem, and they need to know that now.

**7. When a memory read is too big, what happens?**
Truncate with a note saying how to get the rest, summarise, or refuse and force a
narrower query. Get a byte budget out of them, not an adjective.

**8. When memory and the request disagree, which wins?**
The user says Dana is on-call, memory says Sam. What should the harness do? Say
so and ask? Prefer the human? Prefer the file? There is no default that is right
for everyone, and an unanswered version of this question shows up later as the
harness confidently contradicting a person.

**9. Who may read it?**
If the harness answers in a shared channel, memory contents can reach anyone in
that channel. Ask whether that is acceptable for every entity type.

## Write the spec

Write `spec/memory.md`:

```markdown
# Memory spec

## Entity types
### <type>
- Summary line contains: <what>
- Written by: <human | harness | importer>
- Expires: <when, or never>
- Readable by: <who>

## Never stored
- <rule>

## What the model sees each turn
<index shape, and the budget>

## Oversized reads
<policy and byte budget>

## Conflicts
<what wins when memory and a human disagree>
```
