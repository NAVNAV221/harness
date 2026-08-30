---
module: system-prompt
writes: spec/system-prompt.md
depends_on: [spec/harness.md]
---

# Interview: system prompt

Read `spec/harness.md` first. Do not ask anything it already answers.

The system prompt is injected on every single turn. It is first-day instructions
for a new hire, not documentation. Most people write an essay here. The model
does not need a philosophy; it needs rules it can obey when it is halfway
through a task and running low on room.

## Questions

**1. What must it never do?**
Take everything from the harness spec's Never section, then push for two more.
Never-rules go first in the prompt, because they are the ones that still matter
when the model has read half of it.

**2. What does "done" look like?**
When may it stop and reply? A model with no stopping rule either stops too early
or loops.

**3. What should it do when it does not know?**
Ask, guess, say nothing, escalate to a person by name. This single rule prevents
more bad output than any other.

**4. What tone, in one line?**
Not a paragraph about voice. One line, obeyable. "Short, no preamble, no
apologies" is obeyable. "Friendly and professional" is not.

**5. Which rules survive truncation?**
Ask them to pick the three rules they would keep if the model only read the
first three lines. Those go at the top.

**6. What is currently in `src/system-prompt/SYSTEM_PROMPT.md` that does not apply?**
Read the default aloud to them. Every rule they do not want is one they have to
actively delete - defaults left in place are how a harness ends up governed by
rules nobody chose.

## Write the spec

Write `spec/system-prompt.md`:

```markdown
# System prompt spec

## Never (in priority order)
- <rule>

## Always
- <rule>

## Stopping
<when the model may stop and answer>

## When unsure
<the single fallback behaviour>

## Tone
<one line>

## Survives truncation
<the three rules that must appear first>

## Dynamic sections
<what gets injected per turn: memory index, speaker, channel, time, anything else>
```

## Rules for whoever writes the prompt from this spec

- Rules, not prose. Every line must be something the model can obey or violate.
- No motivation, no tone-setting paragraphs, no "you are a helpful assistant".
- Never before Always.
- If a rule can be enforced in code, enforce it in code and delete it from here.
  A rule in the prompt is a request. A rule in `src/guardrails/` is a rule.
