---
description: Interview me about my harness and write the specs the build prompts read
argument-hint: "[module] (harness|system-prompt|tools|memory|messaging|guardrails|skills|reflection|deployment)"
---

Interview me about the harness I want to build, and write the resulting specs
into `spec/`.

If `spec/harness.md` does not exist and no harness has been scaffolded here yet,
say so first: `/harness:init` asks three questions and gets them a running harness,
where this command asks 55 and gets them specs. Recommend it, and only continue
here if they say they want the full interview anyway.

Module requested: $ARGUMENTS (if empty, run all of them in order).

How to do this:

1. Read `interview/README.md`, then the interview file for the module. The
   mapping is by number: `00-harness`, `01-system-prompt`, `02-tools`,
   `03-memory`, `04-messaging`, `05-guardrails`, `06-skills`, `07-reflection`,
   `08-deployment`.
2. Every interview except `00-harness` depends on `spec/harness.md`. If it does
   not exist yet, run `interview/00-harness.md` first and say that you are doing so.
3. Read the module's source before asking anything. Do not ask me what the code
   already answers.
4. Follow the interview file's conduct rules: one question at a time, use
   `AskUserQuestion` with concrete options where it fits, push back once on a
   vague answer, stop as soon as you can write the spec.
5. Write the spec file in the exact skeleton the interview gives. Fill in every
   section. Where I could not answer, write it under Open questions rather than
   guessing - the implementer must ask, not assume.
6. When the spec is written, show me the sections that will most change the
   implementation, and tell me which `/build-*` command to run next.

Do not write any implementation code during the interview. Specs only.
