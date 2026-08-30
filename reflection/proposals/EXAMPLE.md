# Reflection proposal

- Session: cli
- Generated: 2026-08-30T14:32:11.204Z
- Accept with: `npm run reflect:accept 2026-08-30T14-32-11`

This is a committed example so you can see the format before you have run a
session. Real proposals land next to it and are gitignored.

## memory

```file:entities/people/dana.md action:replace
---
name: Dana
summary: SRE, on-call for the platform; wants infra changes as a diff, never applied
role: sre
handles: cli:dana
timezone: UTC
---

Standing preferences:
- Wants infra changes proposed as a diff, never applied directly.
- Asked twice this session to be tagged on anything touching the ingress config.
```

## system prompt

- add: When a request touches infrastructure, name the person who owns it before acting.
  because: The harness proposed an ingress change in turn 3 without mentioning Dana owns it, and the human had to redirect it.

## tools

- memory_search: the model called it with a full sentence and got nothing, then gave up. The description should say the query is a literal substring, not a question.

## skills

- incident-recap: the same five steps were walked by hand twice in this session.
