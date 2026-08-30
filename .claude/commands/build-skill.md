---
description: Write a new skill for the harness
argument-hint: "[skill name or the situation it handles]"
---

Read `skills/PROMPT.md` and follow it exactly.

Skill requested: $ARGUMENTS

If `spec/skills.md` exists, build what it specifies. If it does not, you may
interview me for this one skill only, using the questions in
`interview/06-skills.md`, and then write both the spec section and the skill.

Before writing the file, show me the `description` line alone and tell me which
requests it will and will not fire on. That line is the whole routing decision.
