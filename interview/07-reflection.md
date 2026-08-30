---
module: reflection
writes: spec/reflection.md
depends_on: [spec/harness.md]
---

# Interview: self reflection

Read `src/reflection/index.ts` first. It already works: at the end of a session
it writes a proposal to `reflection/proposals/`, and a human accepts it with
`npm run reflect:accept <id>`. This interview is about what it should look at and
what it is allowed to touch.

Start by asking whether they want it at all. A harness that runs twice a week
does not accumulate enough sessions for reflection to say anything true, and the
proposals become noise the operator learns to ignore. That is worse than nothing.

## Questions

**1. What would you want to know after a bad session?**
Their answer is what reflection should look for. "Which rule was missing" and
"what did it not know" produce completely different modules.

**2. What may it change without asking?**
The default is: nothing. It proposes, a human accepts. If they want memory
writes automatic, ask what happens when it records something false - because it
will, and a wrong fact in memory is repeated confidently forever after.

**3. What must it never propose?**
Widening a guardrail is the obvious one. Ask for two more.

**4. When does it run?**
End of every session, on a schedule, only when asked. End of session is the
default here, and it costs a model call per session - make sure they know.

**5. Who reads the proposals, and when?**
A proposal nobody reads is a file that grows. If there is no answer to this
question, the honest move is to not enable the module.

**6. How do you know reflection is helping?**
Ask for one observable. "Proposals I accept" versus "proposals I ignore" is a
real ratio and worth tracking from the first week.

## The rule this module exists to respect

An agent that edits its own system prompt unattended has no stable definition of
correct: each run grades itself against rules it wrote on the previous run. The
human on the accept step is not bureaucracy - it is what makes the loop converge
instead of drift. If they want to remove it, make sure they can say why their
case is different, and write that reason into the spec.

## Write the spec

Write `spec/reflection.md`:

```markdown
# Reflection spec

## Runs
<when>

## Looks for
- <what it should notice>

## May change without asking
<default: nothing>

## Must never propose
- <rule>

## Reviewed by
<who, and how often>

## Working means
<the observable>
```
