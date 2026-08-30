# The interview

A prompt that says "build a messaging adapter" produces a messaging adapter that
nobody wanted. A prompt that says "build a Slack adapter for a 40 person security
team where only #ops may trigger tool calls and every destructive call is
approved in-thread" produces the one you meant.

The difference is a spec. These files are how the spec gets written without you
having to write it.

## How it runs

    interview/<module>.md   questions your agent asks YOU
            |
            v
    spec/<module>.md        your answers, written down as a contract
            |
            v
    src/<module>/PROMPT.md  the build prompt - it READS the spec
            |
            v
    working code

Open this repo in Claude Code (or pi, or Codex) and run:

    /harness:interview            all modules, in order
    /harness:interview messaging  just one

Or paste the contents of any `interview/*.md` into whatever agent you use. The
files are written to work either way - they are instructions to an agent, not a
tool-specific format.

## Order matters

`00-harness.md` comes first and the rest depend on it. What your harness is for
decides what its tools are, what it remembers, and what it must never do. Every
later interview reads the harness spec before asking anything.

You do not have to do all of them. A harness with a sharp system prompt, three
tools and no memory is a real harness. A harness with nine modules and no
purpose is a folder.
