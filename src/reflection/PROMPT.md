# Build prompt: reflection

Read `spec/reflection.md`. If it is not there, run `interview/07-reflection.md`
first - and be willing to conclude they should not enable this module at all. A
harness that runs twice a week does not produce enough sessions for reflection to
say anything true, and proposals nobody reads are a directory that grows.

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
- Never let it propose widening a guardrail. If the spec asks for that anyway,
  tell me why that is a bad idea before you build it.
- Automatic application stays limited to paths under `memory/`, and never to
  `src/`, `spec/` or `skills/`. If the spec wants more, make me say it twice.
- The accept script must stay able to show a diff without applying it. The
  default path is read, then decide.

Then run one session, generate a real proposal, and show me both the proposal and
what `npm run reflect:accept <id>` would do with it.
