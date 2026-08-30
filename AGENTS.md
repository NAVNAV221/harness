# Working in this repo

This is a harness skeleton. People fork it and replace most of it. Optimise
every change for the person reading it in order to replace it.

## What this repo is

A working harness built on pi, where each part a forker is meant to own ships as
a small reference implementation next to an interview that produces a spec and a
build prompt that reads it.

pi owns the agentic loop and the translation layer. This repo owns the system
prompt, tools, memory, messaging, guardrails, skills and reflection.

## Rules

- **Keep reference implementations small.** If a module grows past what someone
  will read before replacing it, it has stopped teaching. `src/messaging/cli.ts`
  at 60 lines is the target shape.
- **Every extension point has three files**: `interview/NN-<module>.md` produces
  `spec/<module>.md`, and `src/<module>/PROMPT.md` reads that spec. Add a module
  and you add all three.
- **Prompts are agent-agnostic.** They are instructions in markdown. The
  `.claude/commands/` files are thin wrappers that read them. Never put content
  in a slash command that is not in the prompt file it points at.
- **Guardrails are code.** Anything enforceable belongs in
  `src/guardrails/policy.ts`, not in `SYSTEM_PROMPT.md`.
- **No em dashes** in prose. Regular hyphens.
- **Comments explain the decision**, not the syntax. Every module header says
  what the module is for and what it deliberately does not do.
- `npm run typecheck` must pass before any commit.

## What not to do

- Do not add a framework. The point is that this is readable.
- Do not implement a second messaging adapter. The forker does that from the
  prompt; shipping one makes the interface look like it has favourites.
- Do not make reflection apply changes outside `memory/`.
- Do not add dependencies without saying what they replace.
