# Build prompt: system prompt

Read `spec/system-prompt.md`. If it is not there, run `/harness:interview system-prompt`
first - do not write a system prompt from your own assumptions about what this
harness is for.

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

When you are done, show me which lines would still matter if the model only read
the first half of the file, and move anything else below them.

Then read the assembled prompt back to me in full - the file plus what
`buildSystemPrompt` injects - and tell me the token cost of the whole thing.
