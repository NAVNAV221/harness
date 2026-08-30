<div align="center">

<img src="docs/logo.png" width="96" alt="harness">

# harness

**Build your own agent harness. Three questions, and it is yours.**

[![license](https://img.shields.io/badge/license-MIT-black?style=flat-square)](LICENSE)
[![built on pi](https://img.shields.io/badge/built%20on-pi-6b46c1?style=flat-square)](https://github.com/badlogic/pi-mono)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-d97757?style=flat-square)](https://docs.claude.com/en/docs/claude-code)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)](package.json)
[![status](https://img.shields.io/badge/status-early-orange?style=flat-square)](#what-this-does-not-do-yet)

</div>

A harness is the software your model runs inside: the thing that decides what the
model sees, what it can do, and when it stops. This is a working one, small enough
to read in an afternoon, with an interview and a build prompt behind every part
you are meant to replace.

Companion to [How can I build a Harness?](https://navnav221.github.io/learn/harness/)

![The skeleton and your harness are the same nine parts. On the left they ship hollow: system prompt, tools, memory, messaging, guardrails, skills, reflection, plus the agentic loop and translation layer that pi already wrote. In the middle, interview/04-messaging.md asks you which platform, what counts as one conversation, and how a human approves a tool call; your answers become spec/messaging.md, which src/messaging/PROMPT.md reads to build the adapter. On the right the same nine parts, now filled in with your own answers.](docs/harness.png)

## Start

```
/plugin marketplace add NAVNAV221/harness
/plugin install harness
/harness:init
```

Four questions, and the harness is yours: your job in the system prompt, your
worst case as a real rule in the guardrail policy, your capabilities drafted into
a spec. No clone, no npm, no API key to get that far.

```bash
npm install && npm start     # when you want to watch it run
```

## What that gets you

**It enforces rules in code, not in the prompt.**

```
you> use bash to run: rm -rf /tmp/scratch

  ! guardrail: destructive or outward-facing shell command - approval required
    bash: {"command":"rm -rf /tmp/scratch"}
    approve? [y/N] n

harness> That command was declined - it wasn't run.
```

**It does not claim capabilities it does not have.**

```
you> why did request abc123 fail at 09:14?

harness> I can't investigate that yet: `query_traces` and `query_logs` do not
         exist, so I can't determine its failure cause.
         Run `/harness:build-tools` to build them.
```

**It tells you what to build next, from what you actually asked for.**

```
$ cat reflection/proposals/2026-08-30T21-18-32.md

## capability gaps
- query_traces: wanted 1 time. "why did request abc123 fail at 09:14?"
- gh_pr_read:   wanted 1 time. "just review PR 412 for me"
```

Every block above is real output, not a mockup.

## Make it yours

Generic prompts produce generic code. So the build prompts do not guess: they read
a spec that you produced by being interviewed.

```
interview/04-messaging.md  ->  spec/messaging.md  ->  src/messaging/PROMPT.md  ->  code
questions it asks you          your answers            reads your answers
```

`/harness:init` asks four of those questions. The rest arrive one module at a time:

```
/harness:status                  what is specified, what is built, what is default
/harness:interview messaging     the full questions for one module
/harness:build-messaging slack   implement it, from your spec
```

`/plugin update` improves the questions you get asked. It never touches the code
you own.

Not in Claude Code? Clone the repo and paste `interview/00-harness.md` into your
agent. These are markdown instructions to an agent, not a Claude Code format.

## What pi owns

[pi](https://github.com/badlogic/pi-mono) owns the agentic loop and the translation
layer. You own everything else. You should still write both yourself once:

```bash
npm run learn:loop "what does this harness do?"
```

`learn/` is a loop with all six exit conditions named, and one interface with two
provider adapters behind it. It is there to be read, not to run in production.

## What this does not do yet

- **One messaging adapter exists: the CLI.** Slack, Mattermost and Discord are a
  prompt and an interface, not an implementation. `/harness:build-messaging` writes
  yours.
- **`learn/`'s provider adapters have never run against a live API.** They compile
  and they are there to be read.
- **Reflection proposes, it never applies.** Memory changes need
  `npm run reflect:accept <id> --apply`; prompt and skill changes are yours to make
  by hand, on purpose.

## More

- [docs/five-parts.md](docs/five-parts.md) - each part, and where it lives here
- [interview/README.md](interview/README.md) - why the interview exists at all
- [A Smart Model Doesn't Make Up for Bad Context](https://navnav221.github.io/2026-06-21-smart-model-bad-context/) - why the memory module matters most
- [How can I build a Harness?](https://navnav221.github.io/learn/harness/), on [navnav221.github.io](https://navnav221.github.io/)

MIT.
