---
module: improve
writes: spec/improve.md
depends_on: [spec/harness.md, spec/skills.md, spec/reflection.md]
---

# Interview: self-improvement from sessions

Read `spec/harness.md`, `spec/skills.md`, `src/reflection/index.ts` and
`src/reflection/guard.ts` first. If `spec/eventlog.md` exists, read it too.

Reflection reads one conversation's text and proposes lessons. This module reads
**many sessions at the tool-call level** and proposes changes to the parts the
model routes by: skill descriptions and steps, new skills, tool descriptions,
and one-line rules. A person accepts or rejects each one; code applies it.

This module is optional. Start by asking whether they want it. It earns its
place when the harness has more than a handful of tools and skills and runs
every day: that is when the model picking the wrong skill, or calling a tool
three times with reworded arguments, happens often enough to count. A harness
with three tools, or one used twice a week, has nothing to mine; say so and stop.

## The shape, before any question

```
record --> every turn: the message, each tool call with its arguments,
           ok or error, the head of its result, the reply        no model
mine ----> per turn: the skill that should have opened, the ones
           that did, errors, empty results, reworded loops, the
           person's correction in the next message, stops         no model
aggregate> over N days, ranked, each finding with its turn ids    no model
propose -> a model turns findings into at most a few proposals    model
check ---> ids real, skills valid, no "never" lost, one open
           proposal per target; then the reflection guard         no model + judge
decide --> the owner, per proposal, in code                        a person
apply ---> under the memory directory, snapshot first, revertible  no model
```

The model proposes; code checks, a person decides, code applies.

## Questions

**1. Where is the record of what the harness did?**
The miner needs every tool call with its arguments and the first couple of
hundred characters of its result, per turn. The event log's self stream is that
record if it exists. If not, the harness must start writing one (a JSONL per day
from `src/harness.ts`'s tool events), and nothing can be mined until it has run
for a week or two. Get the path and how long it is kept.

**2. What does "this went wrong" look like for these people?**
The signals are mostly fixed (errors, empty results, the same tool reworded 3+
times in a turn, stops, empty replies, turns over two minutes or ten tool calls,
replies that say "I can't"). The one that varies is the correction: the words
they use when the answer was wrong, in every language they write in. Get the
list.

**3. How does the miner know which skill should have opened?**
A routes table: example phrasings per skill, mirroring the descriptions. Say out
loud that it drifts when a description changes, and ask who keeps it in step.
Scheduled messages that name their skill need no route.

**4. Which kinds of proposal?**
Recommend all five and let them drop some: `skill_edit` (steps or description),
`skill_new` (the same request handled ad hoc in two or more separate turns),
`tool_description`, `rule` (one line), and `gap` (a note for the developer:
code is needed, nothing is applied).

**5. Where does an accepted change live?**
Never in `src/`, `skills/` or `spec/`. The default: approved skills in
`$HARNESS_MEMORY_DIR/skills/`, loaded before `skills/` so they win by name; tool
descriptions in a JSON file under the memory directory that `createTools`
applies; rules in a file the system prompt reads. Ask whether the deployed repo
must stay pullable (if it is a git clone on a server, it must).

**6. How does the owner decide, and how do they undo?**
A card per proposal with Accept and Reject, or a reply like "accept 2", parsed
in code before the model sees the message. The model gets no tool that accepts.
Undo is a snapshot taken before each apply and a revert command; ask whether
that is enough.

**7. When does it run, and at what cost?**
Daily after the day's reflection, on demand ("reflect on your sessions"), and a
read-only shell command that prints the findings. One model call per run, plus
the judge. Get a window (14 days is a good default) and a cap on proposals per
run (6).

## Write the spec

Write `spec/improve.md`:

```markdown
# Improve spec

## Record
<where tool calls are recorded, the result head length, retention>

## Signals
- corrections: <words, per language>
- long turn: <minutes> or <tool calls>

## Routes
<skill -> example phrasings; who keeps this in step with the descriptions>

## Proposal kinds
<which of skill_edit, skill_new, tool_description, rule, gap>

## Where accepted changes live
- skills: <path>
- tool descriptions: <path>
- rules: <path>

## Decision and undo
<card | reply, owner only; snapshot path; revert command>

## Schedule and cost
<when, window in days, max proposals per run>

## Open questions
<anything the owner could not answer - the implementer must ask, not assume>
```
