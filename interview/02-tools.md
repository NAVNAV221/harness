---
module: tools
writes: spec/tools.md
depends_on: [spec/harness.md]
---

# Interview: tools

Read `spec/harness.md` first.

The harness describes a tool. It does not decide when the tool gets used - the
model decides that, by reading your description. So the descriptions are the
whole game. A vague description is a broken router.

## Questions

**1. What are the three verbs?**
Start with three tools, not ten. Ask for the three things the harness must be
able to *do*. If they list eight, ask which three make the other five unnecessary
for the first version.

**2. For each tool: what is the one sentence a model reads to choose it?**
Get it in their words. Then read it back and ask: "if the model only had this
sentence and one other tool, could it pick wrong?"

**3. For each tool: what are the arguments, and what is required?**
Push for the smallest set. Every optional argument is a decision the model has
to make and can make badly.

**4. What does each tool return when there is nothing to return?**
Empty result, error, or a suggestion of what to try instead. The empty case is
where models get stuck, and nobody specifies it.

**5. What does each return when the result is enormous?**
50,000 lines of output is a context management decision wearing a tool's
clothes. Truncate with a note? Summarise? Refuse and suggest a narrower call?
Decide it here, per tool, or the model will drown on a call nobody tested.

**6. Which of these needs a human to approve it?**
Anything that writes, deletes, spends money, or is visible outside the team.
Carry the answer into `spec/guardrails.md`.

## Adversarial pass, before you write the spec

For every pair of tools in the list, construct the question that would make the
model pick the wrong one. Show the user each collision you find and the
description change that fixes it. Repeat until you cannot construct one.

This is not optional. It is the only part of tool design that reliably finds bugs
before runtime.

## Write the spec

Write `spec/tools.md`:

```markdown
# Tools spec

## <tool_name>
- Description (what the model reads): <one or two sentences>
- Arguments: <name: type - meaning, required or optional>
- Returns: <shape>
- Empty case: <exact behaviour>
- Oversized case: <truncate / summarise / refuse, and the budget>
- Approval required: <yes/no, and when>
- Distinguished from <other tool> by: <the sentence that keeps them apart>

## Collisions found and fixed
- <question that used to route wrong> -> <the fix>
```
