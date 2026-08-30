---
description: Build a messaging adapter for a specific platform from spec/messaging.md
argument-hint: "[platform] e.g. slack, mattermost, discord"
---

Read `src/messaging/PROMPT.md` and follow it exactly.

Platform: $ARGUMENTS

If `spec/messaging.md` does not exist, stop and tell me to run
`/harness:interview messaging` first. If it exists but names a different platform
than the one above, ask me which one wins before writing anything.

Before you write code, tell me the three things about this platform that will
differ most from `src/messaging/cli.ts`, and how you plan to handle each.
