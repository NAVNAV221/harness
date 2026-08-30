# The five parts, mapped to this repo

From [How can I build a Harness?](https://navnav221.github.io/learn/harness/).
An agent is a model, a harness, and an environment it can act on. The model is
not yours to build. The environment is where the effects happen. The harness is
the part you own.

## 1. System prompt

Instructions injected on every single turn. First-day instructions for a new
hire, not documentation.

- Static rules: `src/system-prompt/SYSTEM_PROMPT.md`
- Per-turn assembly: `buildSystemPrompt()` in `src/system-prompt/index.ts`
- Refreshed before every agent run by the `before_agent_start` hook in
  `src/harness.ts`, so the memory index is never stale mid-conversation.
- Interview: `interview/01-system-prompt.md`. Build prompt: `src/system-prompt/PROMPT.md`.

The split between the two files is the point. Anything identical every turn goes
in the markdown and stays cacheable. Anything that changes goes in the builder.

## 2. Tools

What the model can actually do. The harness describes the tool; the model decides
when to use it by reading that description.

- `src/tools/memory-tools.ts`, three tools written to be told apart
- Registered in `src/tools/index.ts`, enabled in `config.ts`
- Interview: `interview/02-tools.md`. Build prompt: `src/tools/PROMPT.md`.

The adversarial pass in the build prompt is the part worth keeping: for every
pair of tools, find the question that routes to the wrong one, and fix the
description until you cannot.

## 3. Agentic loop

Model picks an action, you execute it, you feed the result back, repeat until
done.

- **pi owns this.** `session.prompt()` in `src/harness.ts` is the entry point.
- Build it yourself once: `learn/loop.ts`, with all six exit conditions named.

## 4. Translation layer

The seam that lets the same harness run on Anthropic, OpenAI, or a local model.

- **pi owns this.** `@earendil-works/pi-ai`. Switching provider is
  `HARNESS_MODEL=openai:gpt-4.1` in `.env`, not a code change.
- Build it yourself once: `learn/providers/`, two adapters behind one interface.

## 5. Memory, which is really context management

Two jobs share this name:

**What is stored** - `src/memory/`. Markdown files: entities, sessions,
transcripts. Diffable, greppable, reviewable by a human before a reflection
proposal is accepted.

**What the model sees** - the more important half:

- `Memory.renderIndex()` puts names and one-line summaries in every turn, not
  file contents. The model opens a file when it decides it needs one.
- `clip()` truncates with a note saying how to get the rest. A truncation the
  model cannot recover from is a lie.
- `MAX_SEARCH_HITS` caps search results. Ranking beats volume.

Interview: `interview/03-memory.md`. Build prompt: `src/memory/PROMPT.md`.

## Beyond the five

These are not in the article. They are what a harness needs the moment it stops
being a demo.

**Messaging** (`src/messaging/`) - the seam between a harness and the place your
team already is. One interface, one working CLI implementation, a prompt for
everything else.

**Guardrails** (`src/guardrails/`) - one policy file, one enforcement point, on
every tool call and every outbound message. In the article's pentest flow, this
is the box between the model and the sandbox: the exploit only fires after a
human approves it and the guardrail confirms it is in scope.

**Skills** (`skills/`) - procedures the model follows when it recognises a
situation, loaded on demand. pi puts only the description in context until the
model opens the file.

**Reflection** (`src/reflection/`) - the harness reading its own session and
proposing improvements, which a human accepts.

## Reading order

1. `src/index.ts` - the whole control flow, top to bottom
2. `src/harness.ts` - the five parts wired to each other
3. `learn/loop.ts` - what pi is doing for you
4. `src/guardrails/policy.ts` - what this harness will refuse to do
