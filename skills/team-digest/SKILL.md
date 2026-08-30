---
name: team-digest
description: Summarise what happened in a channel over a period, grouped by person and decision. Use when someone asks what they missed, what was decided, or for a catch-up on a channel or date range.
---

# Team digest

A worked example of a skill. Read it, then delete it and write yours.

A skill is not a tool. A tool is something the model can *do*. A skill is a
procedure the model *follows* when it recognises the situation - and it costs
nothing until then, because only the description above is in context until the
model decides to open this file.

## Procedure

1. Establish the window. If the request did not name one, ask. Do not assume "today".
2. `memory_search` the channel name to find its transcript file.
3. `memory_read` that transcript. If it comes back truncated, say so in the
   digest rather than presenting a partial window as complete.
4. Group what you find into three buckets, in this order:
   - **Decisions** - something is now true that was not true before.
   - **Open threads** - a question nobody answered.
   - **Noise** - everything else. Do not list it, just count it.
5. Attribute every decision to a person and a timestamp.
6. Check each named person against `entities/people/`. If someone appears
   repeatedly and has no entity, say so at the end and offer to create one.

## Output

    ## <channel>, <window>
    Decisions
    - <what changed> (<who>, <when>)
    Open
    - <question> (<who asked>)
    <n> other messages.

## Rules

- A digest with no decisions says "no decisions". It does not invent one.
- Never include a secret, token or key, even if it appeared in the transcript.
