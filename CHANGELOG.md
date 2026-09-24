# Changelog

Installs update by the version in `.claude-plugin/plugin.json`. A change that
does not bump it never reaches anyone who installed before it.

## 0.2.0

Everything on master since 0.1.0, which is what `/plugin update` never
delivered, plus the fixes found by scaffolding a real harness from 0.1.0.

**Setup**
- `/harness:init` asks five questions. Question 3 has a mandatory follow-up on
  which credential could do the worst thing and whether the agent process can go
  without it, and question 5 asks where it runs and whether memory is private.
- The init draft marks inferred sections. The operator can correct it once or be
  interrogated section by section; unconfirmed sections land as `(default)`.
- Private memory: init points `HARNESS_MEMORY_DIR` outside the repo and adds a
  `.gitignore` that commits only the shape of memory.
- Shipped as a Claude Code plugin with `/harness:init`, `/harness:status` and
  per-module `/harness:interview` and `/harness:build-*` commands.

**Guardrails**
- Fixed: the flagship `rm -rf /` deny rule never fired, because rules match
  `JSON.stringify(input)` and the pattern expected whitespace after the slash.
- `npm run guardrail:demo` runs tool calls through the policy without a model,
  including a Slack curl the regex cannot catch.
- `decide()` holds the deny-then-approval order, shared by the extension and
  the demo. `policy.ts` says when a regex is the backstop and not the defence.

**Reflection**
- Proposals that loosen a Never rule or touch the guardrail policy are dropped
  before the proposal is written, counted in a `## dropped` section, and logged
  in full in the session log. `reflect:accept` refuses them again.
- Capability gaps: a request the harness could not fulfil is reported, not
  summarised as "nothing to change".

**Memory**
- A memory directory outside the repo falls back to the committed
  `memory/INDEX.md`, instead of silently losing the operator notes.
- The index shows operator notes and empty type folders on a fresh harness, and
  keeps `TEMPLATE.md` out of context.

**Modules**
- Deployment: `interview/08-deployment.md`, `deploy/PROMPT.md`, and a verified
  Dockerfile and compose file. The harness warns at boot when it finds no model
  credential, with advice that works in a container.
- Event log, optional: `interview/09-eventlog.md`, `/harness:build-eventlog` and
  `src/eventlog/PROMPT.md`. No implementation ships; the interview decides it.

**Other**
- Tests on `node:test`: guardrails, memory, configuration, reflection.
- `package-lock.json` regenerated: it still carried the old package name and
  listed `tsx` as a dev dependency after it moved to `dependencies`. npm
  recomputed that on install, so nothing broke, but the lockfile said otherwise.

## 0.1.0

The initial skeleton: five parts on pi, with an interview and a build prompt for
each part a forker is meant to replace.
