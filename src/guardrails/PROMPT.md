# Build prompt: guardrails

Read `spec/guardrails.md`. If it is not there, run `/harness:interview guardrails`
first.

Then rewrite `src/guardrails/policy.ts` to match the spec exactly.

The rule that makes this module worth anything: **a rule in the system prompt is
a request; a rule here is a rule.** When you find a rule in
`src/system-prompt/SYSTEM_PROMPT.md` that could be enforced here, move it here
and delete it there. Tell me each one you moved.

Constraints:
- Delete every default rule the spec does not mention. Rules nobody chose are
  worse than no rules, because they read as if someone decided.
- Every regex gets tested against one string that must match and one that must
  not. Show me both. A redaction regex that does not fire is the most expensive
  kind of bug in this file, because nothing looks wrong until a key is in a
  channel.
- `deny` is for what must never happen even if a human asks. `requireApproval` is
  for what a human may authorize. If you are unsure which list a rule belongs in,
  ask me - the difference is the whole design.
- The block message tells the model why it was blocked and that it must not
  retry. A model that does not know why will try again differently, which is
  worse than trying again identically.
- Do not add a way for the harness to edit this file. A harness that can widen
  its own guardrails does not have guardrails.

If the spec asks for enforcement that does not fit the current shape - per-user
policies, time windows, escalation to a second approver - change
`src/guardrails/index.ts` too, and keep every enforcement point in these two
files. The moment guardrail logic is spread across the codebase, nobody can audit
it.

Then run `npm run typecheck` and show me the full policy, rule by rule, in
plain English.
