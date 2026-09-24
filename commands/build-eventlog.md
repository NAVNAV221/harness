---
description: Build the optional event log module from spec/eventlog.md
---

Read `src/eventlog/PROMPT.md` and follow it exactly.

If `spec/eventlog.md` does not exist, stop and tell me to run
`/harness:interview eventlog` first. The module is optional, and the interview
starts by asking whether this harness needs it at all.

Before you write code, tell me which streams the spec asks for, where the log
will live, and which process will hold each source's credentials.
