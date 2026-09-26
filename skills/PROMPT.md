# Build prompt: skills

Read `spec/skills.md`. If it is not there, run `/harness:interview skills` first.

**Instance data stays out of tracked files.** Owner and user ids, workspace
names, people's names, real messages, internal hosts and deploy notes go in
gitignored config (`.env`, `~/.config/<harness>/`) read at run time; specs name
the variable, not the value, and tests use synthetic fixtures. When a value is
dynamic or specific to this owner, say so and ask where it lives rather than
writing it in. `npm run privacy:check` before you commit.

Read `skills/team-digest/SKILL.md` for the shape. Then create
`skills/<name>/SKILL.md` for each skill in the spec.

How skills load, which is why the description matters more than the body: pi
scans every skill at startup and puts only `name` and `description` in the system
prompt. The model reads the full file only when it decides the situation matches.
So the description is a routing decision, and the body is free to be long.

Constraints:
- The `description` describes the **situation**, not the skill. "Use when someone
  asks what they missed in a channel" routes. "Summarises channels" does not.
  Lead with "Use when", list the phrasings people actually use, and end with
  what it is **not** for and which skill is: "Not for a single lookup (find)".
  The "not for" half is what stops two skills with a shared word from colliding.
- Under 1024 characters, lowercase-hyphenated `name` matching the folder.
  `npm test` checks both, and that every backticked snake_case tool the skill
  names is enabled in `src/config.ts` (`src/skills/validate.ts`). pi reads the
  frontmatter as YAML, so an unquoted ` #` starts a comment and silently cuts the
  description there; quote it or leave the `#` out.
- The body is a procedure with steps in an order, and rules for the mistakes
  people actually make. A skill that only restates the system prompt is dead
  weight in every session that opens it.
- Specify the output format. Skills that do not produce a different shape each
  time.
- Never reference a tool that does not exist. That is a very convincing way to
  make a model hallucinate a capability.
- Put helper scripts in `scripts/` and long reference material in `references/`
  inside the skill folder, so the model can open them only when it needs them.

## A skill is optional reading

pi loads a skill's body only when the model decides to open it. Anything that
must hold every time - an output format, a count, "end with agree?" - does not
belong only in a skill. Put it in the result of the tool the skill starts with,
where it cannot be skipped. Seen live: a brief skill that asked for exactly three
actions was never opened, and the model listed eight raw ids; the same rules
returned by the brief's gather tool were followed on the next turn. Keep the
skill for judgement (how to rank, what to leave out); keep the contract in the
tool.

## Procedures leave the system prompt

The system prompt is read every turn; a skill costs nothing until it is opened.
When the prompt holds a procedure for one kind of request, move it into a skill
and leave the rules. Keep one short routing note in `SYSTEM_PROMPT.md`: the
skills exist, open the matching one with `read` before any other tool call, and
the prompt's rules win over any skill. Map every section you remove to the skill
it went to, so nothing is dropped on the way.

A scheduled or harness-initiated message should name its skill ("Morning brief.
Follow the brief skill: ...") and use the words its description uses, so the
routing does not depend on the model guessing.

## Check that the model can see them

pi lists skills at the end of its own system prompt. `src/harness.ts` replaces
that prompt every turn and appends the list again with `withSkills`. A harness
built on this skeleton lost that line once and ran for weeks with no skill ever
opened, and nothing failed. If you change the per-turn hook, keep
`test/skills.test.ts` passing. If you run an event log, "no `read` of any
SKILL.md in a week" is the symptom to look for.

## The adversarial pass

Run it across all skill descriptions, including the ones that already existed:
what request would make the model open the wrong one? Write it into
`spec/skills.md` as a table, so the next skill is checked against it:

| request | risk | fix |
|---|---|---|
| "remind me Sunday to draft the reply" | the draft skill, instead of the scheduling tool | draft skill: "not for setting up a reminder" |

Collisions seen live, worth checking for in yours: a reminder to do X opening the
skill for X; two skills sharing a word ("prep" a meeting vs "hold time to prep");
"this week" opening a weekly review when the person asked about a topic; a bare
reply ("b", "2 is first") to a skill's own question. Tool names collide the same
way: name a group so its prefix is not a word another tool uses (`todo_*`, not
`task_*` next to `schedule_task`).

Show me the collisions and the fixes.
