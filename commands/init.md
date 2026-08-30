---
description: Scaffold a harness into this directory, shaped by three questions
argument-hint: "[optional: what the harness is for, in one line]"
---

Scaffold a working harness into the current directory and make it theirs.

Three questions, a draft they correct, then files on disk. Nothing else. The full
interviews come later, per module, when they hit a limit.

The plugin's own copy of the skeleton is at `${CLAUDE_PLUGIN_ROOT}`. That is the
template you copy from. Never edit anything under that path.

If they gave an argument, treat it as their answer to question 1 and do not ask it again.

---

## Step 0: work out where you are

Look at the current directory first. List it. Do not assume it is empty.

- **Contains `src/harness.ts`** - a harness is already here. Do not scaffold over
  it. Offer instead to re-run only Step 4 (personalise) against the existing
  files, and say what that would overwrite. If they decline, stop.
- **Not empty** - you are standing inside somebody's existing project, and
  scaffolding a harness into its root would scatter `src/`, `memory/` and
  `package.json` through their repo. Name what you found, in one line, and ask
  before writing anything. Default to a new `./harness/` subdirectory.
  Treat any of these as not empty: a `.git` directory, source files, a README, a
  manifest of any kind (`package.json`, `Gemfile`, `pyproject.toml`, `go.mod`,
  `Cargo.toml`). A directory holding only dotfiles you created is still empty.
- **Empty or new** - scaffold here.

Say which case you are in, in one line, before continuing. When in doubt, ask.
Scaffolding into the wrong directory is tedious to undo by hand.

## Step 1: four questions

Ask these four and only these four. One at a time. Wait for each answer.

**1. Finish this sentence: "Without this harness, someone on my team has to
______ by hand."**

Push back exactly once on a vague answer. "An assistant for my team" is not an
answer. "Answers questions about our runbooks in #ops so people stop asking me"
is. Then take what they give you and move on.

**If the answer contains more than two distinct jobs, do not just note it and
carry on.** Ask which one is version one, and say why you are asking: a system
prompt covering six jobs does none of them sharply, and a harness that cannot be
judged working cannot be improved. Record the rest under a `Later` heading in the
spec. They may overrule you, and that is fine - but make them do it on purpose.

**2. Who talks to it, and where?**

Use `AskUserQuestion` here with concrete options: a terminal (CLI, ships working),
Slack, Mattermost, Discord, something else. Only the CLI adapter exists today, so
say plainly that any other answer means they will run `/harness:build-messaging`
later, and that the harness runs on the CLI adapter until they do.

**3. What is the worst thing this harness could do by accident?**

Ask it plainly and let them think. This answer becomes a real `deny` rule in
code, so push for something specific enough to match on: "delete a production
table" gives you a rule, "break something" does not. If they cannot name one,
that is a finding worth saying out loud, and you fall back to the shipped defaults.

**4. Name the three things it must be able to DO.**

Questions 1 to 3 describe what the harness is and what it must never do. Without
this one you will personalise its identity and leave its hands at the defaults,
and it will spend day one describing capabilities it does not have.

Ask for verbs, not areas. "Read a failed request's traces and name the failing
span" is a verb. "Observability" is not. Three is the number: if they give you
six, ask which three come first.

## Step 2: draft the rest, do not ask it

From those four answers, draft two things and show them together.

**A. The remaining sections of `spec/harness.md`**: environment, what it knows
about, working means, decided against, and `Later` if question 1 was scoped down.

**B. The split of their question 4 answers into tools and skills.** This is a
real design call and it is faster to correct than to explain:

- A **tool** is a single action the model takes: `query_traces`, `gh_pr_diff`,
  `run_local_stack`. It has arguments and a return value.
- A **skill** is a procedure the model follows when it recognises a situation:
  `analyze-failed-request`, `pr-code-review`, `repro-from-ticket`. It has steps,
  an order, an output format, and it calls tools.

Most useful answers are a skill sitting on top of one or two tools. Say which is
which and why, in one line each.

Show both drafts and ask one question: **what did I get wrong?**

Correcting a wrong draft is faster than answering a dozen open questions, and it
gets you a better spec than a tired person free-typing. Apply their corrections.
Do not ask follow-ups beyond this one round.

## Step 3: scaffold

Copy from `${CLAUDE_PLUGIN_ROOT}` into the target directory.

**Copy these** - they own and will modify them:

```
src/  memory/  skills/  spec/  learn/  reflection/proposals/.gitkeep
package.json  tsconfig.json  .env.example  .gitignore
```

**Do not copy these** - the plugin provides them, and copying them means they
stop getting updates and start drifting:

```
commands/  interview/  docs/  README.md  .claude-plugin/  node_modules/  .git/
```

That split is deliberate and worth stating to them once: `/plugin update` improves
the questions they get asked, and never touches the code they own.

Then set `name` in `package.json` to the directory name, and write two files of
your own rather than copying them:

- **`README.md`** - what this harness is for, in their words from question 1, how
  to run it, and a pointer to `/harness:status`. Ten lines, not thirty.
- **`AGENTS.md`** - house rules for whoever works in *their* harness: what it is
  for, that guardrails are enforced in `src/guardrails/policy.ts` and not in the
  system prompt, and that `npm run typecheck` must pass. Do not copy the plugin's
  own `AGENTS.md`. That one is about maintaining the skeleton, and it would tell
  an agent working in their harness to keep the code small enough to throw away.

## Step 4: personalise

Make it theirs before they ever run it. Six edits:

1. **`spec/harness.md`** - write the corrected draft from Step 2.
2. **`spec/tools.md` and `spec/skills.md`** - write the corrected tool/skill split
   from Step 2, in the shape the build prompts expect. You are writing the
   headline and the one-line description for each, not the full spec: mark every
   section you could not fill from their answers as `TBD - /harness:interview
   tools` so nobody mistakes a stub for a decision.
3. **`src/system-prompt/SYSTEM_PROMPT.md`** - replace the opening line with what
   this harness is for, from question 1. Add their question 3 answer as the first
   Never rule, phrased as something the model can obey.
4. **`src/system-prompt/SYSTEM_PROMPT.md`, a `## Not built yet` section** - list
   every capability from question 4 that has no tool behind it today, which on a
   fresh scaffold is all of them. Then this rule:

   > When asked to do something in Not built yet, say that the tool for it does
   > not exist yet and name the command that builds it. Do not improvise it with
   > bash and do not describe it as something you can do.

   This is the difference between a harness that says "I review PRs" on day one
   and a harness that says "I cannot review PRs yet - run `/harness:build-tools`."
   The second one is true, and it tells them what to do next.
5. **`src/guardrails/policy.ts`** - add a `deny` or `requireApproval` entry for
   the question 3 answer. Prefer `deny` when a human could never legitimately
   authorise it, `requireApproval` when they could. If you cannot write a regex
   that matches it, say so rather than writing one that silently never fires.
   Rules may reference tools that do not exist yet, since `bash` can reach most
   things; say which ones those are so they are not mistaken for live coverage.
6. **`src/config.ts`** - set `adapter` to their answer from question 2 if it is
   `cli`. Otherwise leave it as `cli` and tell them which command builds theirs.
   Leave `tools` alone: it lists tools that exist, and theirs do not yet.

## Step 5: clear the seed data

The skeleton ships with examples so the demo works. Left in place they become
rules nobody chose, which is the exact failure the build prompts warn about.

Delete: `memory/entities/people/`, `memory/entities/projects/`,
`memory/entities/conventions/`, `skills/team-digest/`,
`reflection/proposals/EXAMPLE.md`.

Keep `spec/example/messaging.md` - it is a worked reference, not seed data.

**Then replace what you deleted.** Deleting the examples and leaving nothing
behind is worse than leaving them: the harness comes up knowing nothing, with no
shape to fill in, and its memory index reads as if memory were pointless.

- **Create the entity folders** named in the spec's "What it knows about" section:
  `mkdir memory/entities/<type>` for each. Empty folders are shown in the index,
  so the model can see what shape a memory file takes before one exists.
- **Write one `TEMPLATE.md` per type** with the frontmatter contract filled in for
  that type and a body explaining what belongs in it. Name the file `TEMPLATE.md`
  so nobody mistakes it for a fact, and say in it that it is safe to delete.
- **Rewrite `memory/INDEX.md`** with what memory is for in this harness and the
  one-line `summary:` contract each type expects.

If Step 2 established that this harness needs no persistent memory, say so and
leave `memory/` empty rather than inventing types for it. That is a legitimate
design and it saves them a module.

## Step 6: report, and stop

Show them, briefly:

- the deny rule you wrote, as one line of plain English
- the first Never rule now in their system prompt
- what is in `Not built yet`, so they know what their harness will refuse today
- what you deleted, and what you created in its place

Then give them these next steps, and no others:

```
npm install && npm start     # watch it run. This pulls pi, which is large.
/harness:status              # what is specified, what is built, what is default
```

And tell them two things they would otherwise never discover, one line each:

- Ask it to `rm -rf` something and a guardrail will stop it in code, not in the
  prompt. That is the fastest way to see the harness is real.
- `/exit` ends the session by writing a reflection proposal to
  `reflection/proposals/`, which they accept with `npm run reflect:accept <id>`.
  Nothing in the running harness ever mentions this, so if you do not say it here
  they will never find it.

**Do not run `npm install` yourself.** It is a large download and it is their
call when to pay for it. Scaffolding is free and should stay that way.

Do not offer the other interviews here. They will hit a limit soon enough, and
`/harness:status` will name the right one when they do.
