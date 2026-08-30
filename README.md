# harness-skeleton

A harness is the software your model runs inside. Not the model, not the
framework wrapped around it. The thing that decides what the model sees, what it
can do, and when it stops.

This repo is a working one, small enough to read in an afternoon, with an
interview and a build prompt behind every part you are meant to replace.

Companion to [How can I build a Harness?](https://navnav221.github.io/learn/harness/).

## Run it first

```bash
git clone <your fork> && cd harness-skeleton
npm install
cp .env.example .env      # add an ANTHROPIC_API_KEY, or run `pi` once to log in
npm start
```

```
harness ready (adapter: cli). Type a message, or /exit.

you> who is on the team?

harness> Based on memory, two people are on record:
         - Dana, on-call for the platform, reviews infra changes
         - Nave, operator of this harness
         That is the full list memory has.

you> use bash to run: rm -rf /tmp/scratch

  ! guardrail: destructive or outward-facing shell command - approval required
    bash: {"command":"rm -rf /tmp/scratch"}
    approve? [y/N] n

harness> That command was declined - it wasn't run.

you> /exit

  reflection proposal written -> reflection/proposals/2026-08-30T19-44-29.md
```

That is a real transcript. Four subsystems fired in it:

- **memory**, answering the first question from the index without opening a file
- **tools and the loop**, deciding to call bash at all
- **guardrails**, stopping the call in code and telling the model why, so it does
  not retry
- **reflection**, reading the session on the way out and writing a proposal

Each of them is about thirty lines, and each is meant to be replaced.

## The five parts, and who owns them

| Part | Owner | Where |
|---|---|---|
| 1. System prompt | you | `src/system-prompt/` |
| 2. Tools | you | `src/tools/` |
| 3. Agentic loop | pi | `learn/loop.ts` builds it by hand once |
| 4. Translation layer | pi | `learn/providers/` builds it by hand once |
| 5. Memory and context | both | `src/memory/`, plus the per-turn hook in `src/harness.ts` |

Parts 3 and 4 are pi's, and you should still build them yourself once. That is
what `learn/` is for:

```bash
npm run learn:loop "what does this harness do?"
npm run learn:loop -- --openai "same question, other vendor"
```

Forty lines of loop with every exit condition named, and one interface with two
adapters behind it. Swap the provider, watch the loop not change. Then read
`learn/README.md` for which pi API replaces each piece.

Beyond the five parts, this repo also ships the three things a harness needs the
moment it stops being a demo: a messaging seam, a guardrail layer, and a
reflection loop.

## How you customise it

A prompt that says "build a messaging adapter" produces an adapter nobody wanted.
So the prompts here are not generic: they read a spec you produced by being
interviewed.

```
interview/04-messaging.md    questions your agent asks you
        |
        v
spec/messaging.md            your answers, as a contract
        |
        v
src/messaging/PROMPT.md      the build prompt, which reads the spec
        |
        v
working code
```

In Claude Code:

```
/harness-interview            all modules, in order
/harness-interview messaging  just one
/build-messaging slack        implement from the spec
/harness-status               what is specified, built, and still default
```

In anything else: paste `interview/04-messaging.md` into your agent, let it
interview you, then paste `src/messaging/PROMPT.md`. The files are instructions
to an agent, not a tool-specific format. Nothing here is locked to Claude Code.

Start with `/harness-interview` and nothing else. What your harness is for
decides everything downstream, and it is the one question no prompt can answer
for you.

## What is in here

```
src/
  system-prompt/  SYSTEM_PROMPT.md is rules only; index.ts adds what changes per turn
  tools/          three memory tools, written to be told apart from each other
  memory/         markdown on disk: entities, sessions, transcripts, and a clip() that never lies
  messaging/      MessagingAdapter, one working CLI implementation, a registry
  guardrails/     policy.ts is the entire policy; index.ts is the only enforcement point
  reflection/     end of session, proposes; a human accepts
  harness.ts      where the five parts are wired to each other
  index.ts        the whole control flow, top to bottom

interview/        questions that produce specs
spec/             your answers (example/ shows the target)
skills/           SKILL.md procedures, loaded on demand by pi
memory/           seed entities; delete them before pointing this at a real team
learn/            the loop and the translation layer, built by hand
docs/             which part is which, and what pi already does for you
```

## Two things worth knowing before you fork

**Guardrails run in code, not in the prompt.** A rule in
`SYSTEM_PROMPT.md` is a request. A rule in `src/guardrails/policy.ts` runs on
every tool call whether the model cooperates or not. When you can move a rule
from the first to the second, move it.

**Reflection proposes, humans accept.** An agent that edits its own system prompt
unattended has no stable definition of correct: each run grades itself against
rules it wrote on the previous run. The human on the accept step is what makes
the loop converge instead of drift.

## Built on

[pi](https://github.com/badlogic/pi-mono) provides the loop, the translation
layer, tool dispatch, sessions, extensions and skills. This repo provides the
parts pi deliberately has no opinion about, and the prompts to make them yours.

MIT.
