# Build prompt: skills

Read `spec/skills.md`. If it is not there, run `/harness:interview skills` first.

Read `skills/team-digest/SKILL.md` for the shape. Then create
`skills/<name>/SKILL.md` for each skill in the spec.

How skills load, which is why the description matters more than the body: pi
scans every skill at startup and puts only `name` and `description` in the system
prompt. The model reads the full file only when it decides the situation matches.
So the description is a routing decision, and the body is free to be long.

Constraints:
- The `description` describes the **situation**, not the skill. "Use when someone
  asks what they missed in a channel" routes. "Summarises channels" does not.
- Under 1024 characters, lowercase-hyphenated `name` matching the folder.
- The body is a procedure with steps in an order, and rules for the mistakes
  people actually make. A skill that only restates the system prompt is dead
  weight in every session that opens it.
- Specify the output format. Skills that do not produce a different shape each
  time.
- Never reference a tool that does not exist. That is a very convincing way to
  make a model hallucinate a capability.
- Put helper scripts in `scripts/` and long reference material in `references/`
  inside the skill folder, so the model can open them only when it needs them.

Then run the adversarial pass across all skill descriptions, including the ones
that already existed: what request would make the model open the wrong one? Show
me the collisions and the fixes.
