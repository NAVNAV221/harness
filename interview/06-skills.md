---
module: skills
writes: spec/skills.md
depends_on: [spec/harness.md, spec/tools.md]
---

# Interview: skills

Read `spec/harness.md` and `skills/team-digest/SKILL.md` first.

A tool is something the model can *do*. A skill is a procedure it *follows* when
it recognises a situation. Skills cost nothing until they are used: pi puts only
the name and description in context, and the model opens the file when it
decides the situation matches. That is progressive disclosure, and it is why a
skill can be long where a system prompt cannot.

## Questions

**1. What multi-step procedure do you explain to people more than once?**
That is the first skill. Not a capability - a procedure with steps, in an order,
with a right way to do it.

**2. When should the model reach for it?**
This becomes the `description` field, and it is the only part that is always in
context. If the description does not describe the *situation*, the skill never
fires and nobody notices, because nothing fails - the model just does it worse.

**3. What does the finished output look like?**
Skills that specify a format produce consistent results. Skills that do not
produce a different shape every time.

**4. Where does it go wrong when a person does it?**
The mistakes go in the skill as rules. This is the highest-value question here
and the one people skip.

**5. Does it need a tool that does not exist yet?**
Send them back to `spec/tools.md`. A skill that describes calling a tool that
was never built is a very convincing way to make a model hallucinate.

**6. Which existing skill does this overlap with?**
Two skills with overlapping descriptions means the model picks by coin flip. Same
adversarial pass as tools: what request would make it open the wrong one?

## Write the spec

Write `spec/skills.md` with one section per skill:

```markdown
# Skills spec

## <skill-name>
- Fires when: <the situation, in the words the description will use>
- Steps: <the procedure, in order>
- Output format: <exact shape>
- Rules: <the mistakes to prevent, one per line>
- Needs tools: <names, and whether they exist yet>
- Distinguished from <other skill> by: <one line>
```

Then create `skills/<name>/SKILL.md` with frontmatter (`name`, `description`) and
the procedure. Keep the description under 1024 characters and make it describe
the situation, not the skill.
