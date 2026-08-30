---
module: guardrails
writes: spec/guardrails.md
depends_on: [spec/harness.md, spec/tools.md, spec/messaging.md]
---

# Interview: guardrails

Read `spec/harness.md`, `spec/tools.md` and `spec/messaging.md` first. Most of
this interview is collecting answers that already exist in those three files and
turning them into enforceable rules.

The rule that decides whether this module is worth anything: **a rule that lives
only in the system prompt is a request. A rule in `src/guardrails/policy.ts` is a
rule.** Every answer below has to end up in code.

## Questions

**1. What must never happen, even if a human asks for it?**
These become `deny`. Not "should not" - never. If a human could legitimately
authorize it, it belongs in the next question instead.

**2. What needs a human to say yes first?**
These become `requireApproval`. Ask for the trigger precisely: which tool, and
which argument pattern. "Destructive bash commands" is not implementable;
`/\brm\b|\bgit push\b/` is.

**3. What patterns must never appear in output?**
API keys, tokens, private keys, customer identifiers, internal hostnames. Ask for
real examples of the formats they use, then write the regexes. Test them against
a string that should match and one that should not.

**4. How many messages per person per minute is too many?**
Any number is better than no number. The failure this prevents is a loop
somewhere else discovering your harness.

**5. What happens when a guardrail fires?**
Silently block, tell the model why, tell the channel, page someone. The default
in this repo tells the model why and instructs it not to retry - which matters,
because a model that does not know why it was blocked will try again differently.

**6. Who can change the policy?**
If the answer is "the harness itself", stop and make sure they mean it. A harness
that can widen its own guardrails does not have guardrails.

## Write the spec

Write `spec/guardrails.md`:

```markdown
# Guardrails spec

## Deny outright
- tool: <name> | pattern: <regex> | reason: <one line>

## Require approval
- tool: <name> | pattern: <regex> | reason: <one line>

## Redact
- <what it is> | pattern: <regex> | replacement: <token>

## Inbox
- allowFrom: <...>
- allowChannels: <...>
- rateLimit: <n> per <seconds>

## On block
<what the model is told, what the channel is told, who else is notified>

## Policy ownership
<who may edit policy.ts, and how that is enforced>
```

Then update `src/guardrails/policy.ts` to match the spec exactly, and delete
every default rule the spec does not mention. A policy file containing rules
nobody chose is worse than an empty one, because it reads as if someone decided.
