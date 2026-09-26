---
description: Scaffold a harness into this directory, shaped by five questions
argument-hint: "[optional: what the harness is for, in one line]"
---

Scaffold a working harness into the current directory and make it theirs.

Five questions, a draft they correct or interrogate, then files on disk. Nothing
else. The full interviews come later, per module, when they hit a limit.

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

## Step 1: five questions

Ask these five and only these five, plus the one follow-up to question 3. One at
a time. Wait for each answer.

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

**3, follow-up, always: which credential could do it, and can this process not
hold it?**

Ask this even when the answer to question 3 looks easy to match. A guardrail is a
tool name plus a regex over that tool's input, and the model reaches most things
through `bash`. A rule against posting to Slack does nothing about
`curl https://slack.com/api/chat.postMessage` with a token from the environment,
and no regex can list every spelling. The defence that does not depend on how
the model phrases a command is that the agent process holds no credential able
to do the worst thing. Something else holds it: a plain-code job that fetches
data and writes files the agent reads, a small service with one narrow endpoint,
or nothing on this machine at all.

Ask which tokens, keys or logins could do it - a bot token, a cloud role, a
kubeconfig, a `gh` login, a database URL - and then use `AskUserQuestion`:

- **Kept out.** The agent's environment never has it. Ask where it lives instead.
- **Kept in, on purpose.** Ask for the reason, and say plainly that the deny rule
  is then the only thing between the model and the worst thing, and that `bash`
  can route around it.
- **No credential is involved.** The worst thing is local, like deleting files
  on the host. Then the regex and the sandbox are the defence, and that is fine.

The answer goes in the spec under `Credentials`, and it decides what the policy
comment in Step 4 says.

**4. Name the three things it must be able to DO.**

Questions 1 to 3 describe what the harness is and what it must never do. Without
this one you will personalise its identity and leave its hands at the defaults,
and it will spend day one describing capabilities it does not have.

Ask for verbs, not areas. "Read a failed request's traces and name the failing
span" is a verb. "Observability" is not. Three is the number: if they give you
six, ask which three come first.

**5. Where does it run, and will its memory hold anything private?**

Use `AskUserQuestion` for both halves. Where: your laptop, a VM, a container.
Private: yes, a real person's messages, mail, customers or life; or no, team
knowledge that could be committed like code.

Where it runs decides whether it keeps working when the laptop lid closes, and
where the credentials from question 3 can live apart from it. Private memory
decides where memory goes: the default memory directory is inside the repo, and
a harness whose memory holds a person's data must never be one `git add .` away
from publishing it. This is not the deployment interview. It records the two
facts that change the scaffold today; `/harness:interview deployment` is later.

## Step 2: draft the rest, then correct it or interrogate it

From those five answers, draft two things and show them together.

**A. The remaining sections of `spec/harness.md`**: environment (where it runs,
from question 5), `Credentials` (from the question 3 follow-up: which ones, where
each lives, and whether the agent process holds any that can do the worst
thing), what it knows about (and whether that is private), working means,
decided against, and `Later` if question 1 was scoped down.

Mark every section you inferred rather than heard with `(inferred)` after its
heading. Most of the draft is inference, and they cannot tell which parts are
guesses unless you say.

**B. The split of their question 4 answers into tools and skills.** This is a
real design call and it is faster to correct than to explain:

- A **tool** is a single action the model takes: `query_traces`, `gh_pr_diff`,
  `run_local_stack`. It has arguments and a return value.
- A **skill** is a procedure the model follows when it recognises a situation:
  `analyze-failed-request`, `pr-code-review`, `repro-from-ticket`. It has steps,
  an order, an output format, and it calls tools.

Most useful answers are a skill sitting on top of one or two tools. Say which is
which and why, in one line each.

Show both drafts, then offer a choice with `AskUserQuestion`:

- **Correct it once** (the default). Ask one question: **what did I get wrong?**
  Correcting a wrong draft is faster than answering a dozen open questions, and
  it gets you a better spec than a tired person free-typing. Apply their
  corrections and move on.
- **Interrogate me.** Walk the `(inferred)` sections one at a time, in the order
  they appear. For each, ask one `AskUserQuestion` with two to four concrete
  options built from what they already said, the likeliest first. Push hardest
  on environment, credentials, what it remembers, and how much of question 1 is
  version one: interrogating those is where scope cuts and a second process for
  credentials get found. Stop when every section is confirmed or they say stop.

Either way, a section they confirmed loses its `(inferred)` marker. In the
one-round path, a marked section they read and let stand counts as confirmed;
say that when you ask, so silence is a choice rather than an accident. Anything
still resting on your guess is written into the spec with `(default)` after its
heading, so a later reader knows nobody chose it.

## Step 3: scaffold

Copy from `${CLAUDE_PLUGIN_ROOT}` into the target directory.

**Copy these** - they own and will modify them:

```
src/  test/  memory/  skills/  spec/  learn/  deploy/  scripts/  .githooks/
reflection/proposals/.gitkeep
package.json  tsconfig.json  .env.example  .gitignore
Dockerfile  .dockerignore  compose.yaml
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
  system prompt, that `npm run typecheck` must pass, and that instance data
  (their ids, workspace, people's names, real messages, internal hosts) lives
  in gitignored config and never in code, specs, tests or commit messages,
  with `npm run privacy:check` and the optional hooks in `.githooks/` to catch
  it. Say this one even when the repo is private: private repos get shared,
  forked and pasted into tickets. Do not copy the plugin's
  own `AGENTS.md`. That one is about maintaining the skeleton, and it would tell
  an agent working in their harness to keep the code small enough to throw away.

## Step 4: personalise

Make it theirs before they ever run it. Seven edits:

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

   > When asked to do something in Not built yet, say in one short line that
   > you cannot do that yet. Do not improvise it with bash and do not describe it
   > as something you can do. Name the command that builds it only when asked how
   > to get it built.

   This is the difference between a harness that says "I review PRs" on day one
   and one that says "I cannot review PRs yet." The second one is true. It names
   `/harness:build-tools` only on request: in a chat, the person is a user
   first, and a build command in every refusal reads as noise.

   If the harness cites sources, add: what the owner says directly in the
   conversation is a source in its own right ("you said, <date>"). Without it,
   the model apologises for citing the owner.
5. **`src/guardrails/policy.ts`** - add a `deny` or `requireApproval` entry for
   the question 3 answer. Prefer `deny` when a human could never legitimately
   authorise it, `requireApproval` when they could. If you cannot write a regex
   that matches it, say so rather than writing one that silently never fires.
   Rules may reference tools that do not exist yet, since `bash` can reach most
   things; say which ones those are so they are not mistaken for live coverage.

   Above the rule, write one comment saying what it is. If the credential was
   kept out: the defence is that this process holds no credential for it, and
   this regex is the backstop. If it was kept in: this regex is the only thing
   between the model and the worst thing, and `bash` can reach the same action
   by a spelling it does not match. Then run
   `npm run guardrail:demo -- bash "<a command that should trip it>"` and show
   them the verdict, plus one spelling that gets through if you can find one.
6. **`src/config.ts`** - set `adapter` to their answer from question 2 if it is
   `cli`. Otherwise leave it as `cli` and tell them which command builds theirs.
   Leave `tools` alone: it lists tools that exist, and theirs do not yet.
7. **Private memory**, only if question 5 said yes. In `.env.example`, set
   `HARNESS_MEMORY_DIR` and `HARNESS_PROPOSALS_DIR` to an absolute path outside
   the repo, on the machine from question 5 (`~` is not expanded), with a comment
   saying why. Append this to `.gitignore`, so a run that forgot the variable and
   wrote into the repo still cannot commit a person's data:

   ```
   # Private memory. Only the shape is committed: folders and TEMPLATE.md files.
   memory/entities/**
   !memory/entities/**/
   !memory/entities/**/TEMPLATE.md
   ```

   Keep `memory/INDEX.md` committed. It is still read when the private directory
   has no `INDEX.md` of its own, so the notes about what memory is for survive
   the move.

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

If memory is private, create the folders and templates here anyway, as the
committed shape, and tell them to copy it into the private directory once:
`cp -R memory/entities <HARNESS_MEMORY_DIR>/`.

If Step 2 established that this harness needs no persistent memory, say so and
leave `memory/` empty rather than inventing types for it. That is a legitimate
design and it saves them a module.

## Step 6: report, and stop

Show them, briefly:

- the deny rule you wrote, as one line of plain English, and whether it is the
  defence or the backstop
- where the credentials from question 3 live, and where memory lives
- the first Never rule now in their system prompt
- what is in `Not built yet`, so they know what their harness will refuse today
- what you deleted, and what you created in its place

Then give them these next steps, and no others:

```
npm install && npm start     # watch it run. This pulls pi, which is large.
npm test                     # the guardrail and memory tests, already passing
npm run guardrail:demo       # the policy deciding real tool calls, no model needed
/harness:status              # what is specified, what is built, what is default
```

And tell them two things they would otherwise never discover, one line each:

- `npm run guardrail:demo -- bash "<command>"` shows what the policy does with
  any tool call, in code. Asking the running harness to `rm -rf` something
  usually shows only the model refusing, because the system prompt gets there
  before any tool call is made, so it proves nothing about the guardrail.
- `/exit` ends the session by writing a reflection proposal to
  `reflection/proposals/`, which they accept with `npm run reflect:accept <id>`.
  Nothing in the running harness ever mentions this, so if you do not say it here
  they will never find it.

**Do not run `npm install` yourself.** It is a large download and it is their
call when to pay for it. Scaffolding is free and should stay that way.

Do not offer the other interviews here. They will hit a limit soon enough, and
`/harness:status` will name the right one when they do.
