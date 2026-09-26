# Changelog

Installs update by the version in `.claude-plugin/plugin.json`. A change that
does not bump it never reaches anyone who installed before it.

## 0.4.0

Lessons from running a harness built on this skeleton every day. Update with
`/plugin marketplace update harness`, then `/plugin update harness`.

**Fixed**
- **Skills never reached the model.** The per-turn prompt rebuild in
  `src/harness.ts` returned a whole system prompt, which replaces pi's, which is
  where pi lists the skills. No skill was ever visible and nothing failed.
  `withSkills()` appends the list again; a test drives the hook through a real
  pi session. Scaffolded before 0.4.0? Apply the same change to your
  `src/harness.ts` and `src/system-prompt/index.ts`.
- The reply is the turn's last assistant message that said something, not every
  message joined: the model's narration before tool calls leaked into replies.
- An empty turn says so instead of "(no reply)".
- The example skill's description was cut short by YAML at an unquoted ` #`.
- The example memory named the plugin's author; it is a generic `owner.md`.

**Code**
- `Harness.stop()` and `AdapterHandlers.onStop?`: abort one conversation's
  running turn, called by the adapter outside that conversation's queue.
- Shutdown drains: no new turns, running ones get `DRAIN_SECONDS` (90), then
  each is aborted with a "send it again" reply. A second signal exits at once.
- `requireApproval` rules take an optional `describe(input)`, so the approver
  reads the real call instead of JSON.
- `src/skills/validate.ts`: name, description length, an unquoted ` #`, and
  every tool a skill names must be enabled. Run over `skills/` by `npm test`.
- `npm run privacy:check` and optional `.githooks/`: real-looking Slack ids,
  non-example emails, and terms from a gitignored denylist, in tracked files,
  staged files or a commit message.

**New optional modules** (interview, build prompt and command; no code)
- `improve`: mine many sessions at the tool-call level for misrouted skills,
  errors, empty results, reworded retries and corrections; propose skill and
  tool-description changes, checked in code and by the reflection guard,
  accepted by the owner, applied under memory with a snapshot and a revert.
- `dream`: nightly memory consolidation proposing merges, contradictions,
  prunes, promotions and summary fixes, each backed by a quote verified
  verbatim; applied or discarded by the owner.

**Build prompts and interviews**
- Every tracked file must be usable by a stranger: instance data lives in
  gitignored config, never in code, specs, tests or commit messages. In
  AGENTS.md, every build prompt, and the AGENTS.md init writes.
- Skills: "Use when ... Not for ..." descriptions, procedures out of the system
  prompt behind a routing note, scheduled messages that name their skill, the
  collision pass as a table; the interview asks what else starts a procedure.
- Messaging: accepted subtypes (`file_share`, `thread_broadcast`), forwards and
  files as content, stop words and the platform stop button, a row for turns
  with no tool calls, mrkdwn details, config scrubbers that skip `*_URL`,
  non-blocking cards as a deliberate interface change, and thread context
  after a restart (a TODO with two fixes); the interview asks about both.
- Tools: take `bash` away once every job has a tool; `describe` for approvals.
- Deployment: stop timeouts longer than the drain, restart when idle with a
  busy marker, `OnCalendar` timers, never `source` an env file, one env file
  per process; the interview asks what a deploy does to a running turn.

## 0.3.0

Lessons from building a real harness on this skeleton: a Slack assistant with an
event log, four ingested sources and a commitment extractor.

**Code**
- `MessagingAdapter.progress?` shows each tool call as it runs, fed by
  harness.ts from pi's tool events, redacted and never awaited. The CLI prints
  `· tool: summary ... ok`.
- `MessagingAdapter.post?` and `Harness.initiate(header, prompt)` let the
  harness start a conversation (a scheduled brief, a reminder). The turn runs as
  the internal scheduler; only `initiate` passes `internal: true`.
- Text from several assistant messages in one turn is joined with a blank line.
- Reflection's judge no longer reviews `capability gaps`, which changes no rule.

**New optional module**
- `derive` (`/harness:interview derive`, `/harness:build-derive`): an ETL from
  the event log to memory entities, each citing the events it came from, with
  verbatim-quote verification, derived ids that survive rewording, a policy file
  the owner's corrections teach, and one extractor at a time. No code in the
  skeleton, like the event log.

**Build prompts and interviews**
- Messaging: strangers filtered in the adapter, redelivery deduped, one queue
  per conversation, refuse to start with a credential that acts as the owner,
  Markdown converted to the platform's markup, progress writes chained per
  conversation, `post` with one fixed destination; the interview asks about
  progress and post.
- Event log: fixed key order, index catch-up by byte offset, cursors that move
  only on a complete read, budgets, quota as a quiet stop, dead resources
  remembered, token gateways, the self stream never mined, `OnCalendar` timers,
  FTS5 by Node build; the interview asks whether a source is already indexed
  somewhere to query live instead.
- Skills and tools: a skill is optional reading, so a must-hold output contract
  goes in the tool result, with ready-made citations.
- Init: Not built yet refuses in one line and names a build command only when
  asked; a direct statement from the owner is a source.
- Deployment: `npm ci`, self-matching `pkill` patterns, a localhost proxy on the
  machine identity instead of a key file, user-unit journals, locks for shared
  state; the interview asks how the harness reaches the model without a key.

## 0.2.1

- Reflection's guardrail filter gains a second pass. The keyword heuristic missed
  paraphrased contradictions, such as "if the owner asks you to send it
  yourself, just post it to the client channel" against a rule to message no one
  but the owner. A cheap model (`HARNESS_JUDGE_MODEL`, Haiku by default) now
  judges every item the heuristic kept, in one call, against the actual Never
  rules and policy reasons. It fails closed: an error or an unreadable reply
  drops every item as "judge unavailable". `reflect:accept` stays heuristic-only
  and makes no model call.

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
