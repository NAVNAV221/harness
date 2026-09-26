# Build prompt: reflection

Read `spec/reflection.md`. If it is not there, run `/harness:interview reflection`
first - and be willing to conclude they should not enable this module at all. A
harness that runs twice a week does not produce enough sessions for reflection to
say anything true, and proposals nobody reads are a directory that grows.

**Instance data stays out of tracked files.** Owner and user ids, workspace
names, people's names, real messages, internal hosts and deploy notes go in
gitignored config (`.env`, `~/.config/<harness>/`) read at run time; specs name
the variable, not the value, and tests use synthetic fixtures. When a value is
dynamic or specific to this owner, say so and ask where it lives rather than
writing it in. `npm run privacy:check` before you commit.

The module already works: end of session, it writes a proposal to
`reflection/proposals/`, a human accepts with `npm run reflect:accept <id>`.
What you are changing is what it looks for and what it may touch.

To change what it notices: edit `REFLECTION_RULES` in `src/reflection/index.ts`.
Keep the fenced `file:` block format - `accept.ts` parses it, and a proposal in a
format the accept script cannot read is a proposal nobody will apply.

To change when it runs: edit the shutdown path in `src/index.ts`.

Constraints:
- Proposals cite the session. A proposal with no moment behind it is noise, and
  noise trains the operator to stop reading proposals at all.
- "Nothing to change" must stay a valid and common outcome. If reflection finds
  something every time, it is inventing.
- Never let it propose widening a guardrail. `src/reflection/guard.ts` drops any
  proposal that loosens a Never rule or names the policy, before it is written:
  a keyword pass first, then a cheap model judging what survived against the
  actual rule text, failing closed. `accept.ts` runs the keyword pass again. If you add a Never rule format
  or a new kind of proposal, keep both layers able to see it. If the spec asks
  for reflection to widen guardrails anyway, tell me why that is a bad idea
  before you build it.
- Automatic application stays limited to paths under `memory/`, and never to
  `src/`, `spec/` or `skills/`. If the spec wants more, make me say it twice.
- The accept script must stay able to show a diff without applying it. The
  default path is read, then decide.

Reflection reads one conversation's text. If the owner wants the harness to
improve its skills and tool descriptions from how it is actually used, across
many sessions and at the tool-call level, that is the optional `improve` module
(`/harness:interview improve`), which reuses this guard. Do not grow this module
into it.

Then run one session, generate a real proposal, and show me both the proposal and
what `npm run reflect:accept <id>` would do with it.
