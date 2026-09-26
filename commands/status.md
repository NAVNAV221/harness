---
description: Report which parts of the harness are specified, built, or still default
---

Give me an honest status of this harness, part by part. No encouragement.

For each of: system prompt, tools, agentic loop, translation layer, memory,
messaging, guardrails, skills, reflection - report:

- **Specified**: does `spec/<module>.md` exist, and does it have real answers or
  placeholder text?
- **Built**: is the code still the shipped default, or has it been changed for
  this harness? Check the actual files, do not guess from the folder listing.
- **Wired**: is it reachable at runtime? A tool not registered in
  `src/tools/index.ts`, or an adapter not in `src/messaging/index.ts`, is not wired.

Then the optional modules, deployment (`spec/deployment.md`, `deploy/`), event
log (`spec/eventlog.md`, `src/eventlog/`), derive (`spec/derive.md`,
`src/derive/`), improve (`spec/improve.md`, `src/improve/`) and dream
(`spec/dream.md`, `src/dream/`). For each, one line: not chosen, specified, or
built. Not chosen is not a gap. It becomes one only when `spec/harness.md`
implies the module - it names a VM or a container, or says memory is derived
from sources (event log, and then derive), or asks to debug what the harness
did, or to have it improve its own skills from use (improve) or keep a large
memory tidy (dream) - and then name the interview that starts it.

Then, in order of what would improve this harness most:

1. The single biggest gap, and the command that closes it.
2. Anything still carrying a default from the skeleton that contradicts
   `spec/harness.md` - defaults nobody chose are the most common failure here.
3. Anything built but unspecified, which means it will drift.

Read the files. Do not report status from file names alone.
