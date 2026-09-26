# Build prompt: system prompt

Read `spec/system-prompt.md`. If it is not there, run `/harness:interview system-prompt`
first - do not write a system prompt from your own assumptions about what this
harness is for.

**Instance data stays out of tracked files.** Owner and user ids, workspace
names, people's names, real messages, internal hosts and deploy notes go in
gitignored config (`.env`, `~/.config/<harness>/`) read at run time; specs name
the variable, not the value, and tests use synthetic fixtures. When a value is
dynamic or specific to this owner, say so and ask where it lives rather than
writing it in. `npm run privacy:check` before you commit.

Then rewrite `src/system-prompt/SYSTEM_PROMPT.md` from that spec.

Constraints:
- Rules, not prose. Every line must be something the model can obey or violate.
- No motivation, no tone-setting, no "you are a helpful assistant".
- Never-rules before Always-rules. State what it must never do first.
- Nothing dynamic in this file. Anything that changes per turn belongs in
  `buildSystemPrompt` in `index.ts`, which composes this file with the memory
  index and the speaker.
- Any rule that can be enforced in `src/guardrails/policy.ts` should be enforced
  there and deleted from here.

Procedures for one kind of request belong in skills, not here: this file is
read every turn and a skill only when it is opened. Leave a one-paragraph routing
note that names the skills and says the rules here win. See `skills/PROMPT.md`.
If you change how the prompt is rebuilt per turn in `src/harness.ts`, keep the
`withSkills` call: without it the model never sees a skill.

When you are done, show me which lines would still matter if the model only read
the first half of the file, and move anything else below them.

Then read the assembled prompt back to me in full - the file plus what
`buildSystemPrompt` injects - and tell me the token cost of the whole thing.
