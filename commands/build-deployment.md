---
description: Package the harness for deployment from spec/deployment.md
argument-hint: "[target] e.g. compose, kubernetes, fly, ecs"
---

Read `deploy/PROMPT.md` and follow it exactly.

Target: $ARGUMENTS

If `spec/deployment.md` does not exist, stop and tell me to run
`/harness:interview deployment` first.

Before writing anything, check `src/messaging/index.ts`. If the CLI adapter is
still the only one registered, tell me this harness is not deployable yet and
why, and ask whether I want the container for local sandboxing instead.
