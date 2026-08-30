---
module: harness
writes: spec/harness.md
depends_on: []
---

# Interview: what is this harness for

You are interviewing the person who is forking this repo. Your job is to end up
with `spec/harness.md`: a short, concrete description of the harness they want,
specific enough that every later interview can read it and stop asking obvious
questions.

## How to conduct this interview

- Ask **one question at a time**. Wait for the answer. Let it change the next question.
- If your harness has a structured question tool (Claude Code has `AskUserQuestion`),
  use it, and offer concrete options rather than an open box.
- Push back on vague answers exactly once. "An assistant for my team" is not an
  answer; "answers questions about our runbooks in #ops so people stop asking me"
  is. Ask for the second kind, then move on.
- Do not ask anything the repo can already tell you. Read the code first.
- Stop as soon as you can write the spec. Six good answers beat twelve.

## Questions

**1. What is the one job?**
Finish this sentence with them: "Without this harness, someone on my team has to
______ by hand." That sentence is the harness. Everything else is scope creep
until it earns its place.

**2. Who talks to it, and where?**
A person in a terminal, a team in a channel, a webhook, a cron job. This decides
the messaging module and whether authorization matters at all.

**3. What can it touch?**
The environment is where effects actually happen. A repo? A cloud account? A
ticketing system? Read-only, or does it change things? Get specific: "our staging
k8s cluster" not "infrastructure".

**4. What is the worst thing it could do by accident?**
Ask it plainly. The answer becomes the deny list in `spec/guardrails.md`, and it
is usually the most valuable sentence in the whole interview.

**5. What does it need to know that is not in the request?**
Facts about people, systems, past decisions, conventions. This is the memory
module. If the answer is "nothing", say so in the spec - a harness with no
memory is a legitimate design, and knowing that early saves them a module.

**6. How will they know it is working?**
One observable thing. "Fewer interruptions in my DMs." "The digest arrives at 9."
Vague success criteria produce harnesses nobody can tell are broken.

**7. What is out of scope, deliberately?**
Ask for two things it should refuse to do even though it technically could.

## Write the spec

Write `spec/harness.md`:

```markdown
# Harness spec

## The job
<the one-sentence version from Q1>

## Users and surface
<who talks to it, where, in what tone>

## Environment
<what it can touch, and whether it can change things>

## Knows about
<the kinds of facts it needs, or "nothing persistent">

## Never
<from Q4 and Q7, as rules, one per line>

## Working means
<the observable from Q6>

## Decided against
<anything they considered and rejected, with the reason - this stops the next
session from re-proposing it>
```

Then tell them which interviews to run next, and which ones their answers made
unnecessary.
