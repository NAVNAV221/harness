# Build prompt: deployment

Read `spec/deployment.md`. If it is not there, run `/harness:interview deployment`
first.

**Instance data stays out of tracked files.** Owner and user ids, workspace
names, people's names, real messages, internal hosts and deploy notes go in
gitignored config (`.env`, `~/.config/<harness>/`) read at run time; specs name
the variable, not the value, and tests use synthetic fixtures. When a value is
dynamic or specific to this owner, say so and ask where it lives rather than
writing it in. `npm run privacy:check` before you commit.

**Before anything else, check the adapter.** If `src/messaging/index.ts` still
registers only `cli`, stop and say so: the CLI adapter reads stdin, so deployed
with no terminal it boots and waits forever. Deployment is downstream of
`/harness:build-messaging`. The one exception is someone who wants the container
purely to sandbox the `bash` tool locally, which is legitimate and means they run
it with `docker run -it`, not as a service.

The repo already ships a working `Dockerfile`, `.dockerignore` and `compose.yaml`.
Your job is to make them match the spec, not to start over.

## What to change

1. **Base image and packages.** The `bash` tool can run anything in the image, so
   every package you add widens what the model can do. Add only what the skills in
   `spec/skills.md` actually shell out to, and say in a comment which skill needs
   each one.
2. **Persistence.** `/data` holds memory and reflection proposals via
   `HARNESS_MEMORY_DIR` and `HARNESS_PROPOSALS_DIR`. Point them wherever the spec
   says. If the spec names no backup, write that into the compose file as a
   comment rather than leaving it implied.
3. **Credentials.** From the environment, injected by the platform in the spec.
   If you are about to write a key into a file in this repo, stop.
4. **The target.** For Kubernetes write a Deployment plus a PersistentVolumeClaim
   and note that a harness with local memory does not scale past one replica. For
   ECS, Fly, or systemd, produce the equivalent. Keep the Dockerfile as the one
   source of truth for the image.
5. **Restart and logs.** Per the spec. A harness that restart-loops while the
   model API is down burns tokens on every boot, so bound it.

## What to check before you say it is done

- `docker build .` succeeds.
- `npm ci --omit=dev` still produces something that boots. `tsx` is a runtime
  dependency here, not a dev one, because `npm start` runs it.
- Nothing in `.dockerignore` slipped: `memory/`, `reflection/proposals/` and
  `.env` must never enter an image. An image gets pushed to a registry; what your
  harness knows about real people does not belong in one.
- The container runs as a non-root user.
- `npm test` passes inside the image if the spec says tests gate the deploy.

## Things a real deployment hit

- **Deploy with `npm ci`, never `npm install`.** `npm install` on the server
  rewrote `package-lock.json`, and the next `git pull` refused to merge.
- **A `pkill -f` pattern must not match its own command line.** Over ssh, the
  command that contains the pattern matches it, and the session kills itself.
  Write the pattern as `"[s]rc/worker.ts"`, which matches the process and not the
  string that names it.
- **When a model provider's plugin demands a key file, consider a local proxy.**
  If the machine already has a keyless identity (a cloud VM's attached service
  account), a small proxy on `127.0.0.1` that signs requests with it and speaks
  an API the harness already supports is safer than minting a long-lived key to
  satisfy a plugin. Bind it to localhost only.
- **User-unit logs may need privileges to read.** `journalctl --user` can show
  nothing for a user without the journal group; `sudo journalctl
  _SYSTEMD_USER_UNIT=<unit>` reads them. Say which in the runbook.
- **Two scheduled jobs that write the same state need a lock**, or a timer run
  and a manual backfill will race.
- **Timers use `OnCalendar=`, not `OnUnitInactiveSec=`.** An inactive-sec timer
  counts only from runs it started itself, so after enabling it (or after a
  manual run) it may never fire. `OnCalendar=*:0/5` fires on the clock. Give a
  timezone (`OnCalendar=Mon..Fri 08:30 Europe/London`) when the time means
  something to a person, so the host's zone does not matter.

## Deploys must not cut a turn off

The harness drains on SIGTERM (`src/index.ts`): it stops taking turns, tells
anyone who writes to resend in a minute, and waits up to `DRAIN_SECONDS`
(default 90) for running turns before it aborts them with a "send it again"
reply. Two things make that work deployed:

- **The stop timeout must exceed the drain.** systemd's default is 90 seconds,
  then SIGKILL: set `TimeoutStopSec=120` on the unit (Docker:
  `stop_grace_period: 120s`; Kubernetes: `terminationGracePeriodSeconds`).
  Otherwise the platform kills the drain it asked for.
- **Restart when idle, not on push.** A deploy script that restarts the instant
  new code lands still hits turns mid-flight; the drain then makes people wait
  up to a minute and a half. If deploys are frequent, have the harness keep a
  busy marker file while any turn runs (the conversations in it, written on
  turn start and removed when the last one ends) and have the deploy wait for
  it to go away, up to a limit, before restarting. After a crash, a marker left
  on disk names the conversations that never got an answer: tell each one to
  resend, once, on the next start.

## Secrets on the host

- **Never `source` an env file in a shell.** A value with a space in it runs as
  a command, and bash prints the error with the value in it: seen live, a token
  landed in a terminal and a log that way. Load env files with the runtime
  (`node --env-file=...`, `process.loadEnvFile`), systemd's `EnvironmentFile=`,
  or compose's `env_file:`. To check a file, print key names only
  (`cut -d= -f1`), never values, and send a failing command's stderr to
  `/dev/null` when it might echo one.
- **One env file per process, holding only that process's credentials.** The
  agent's unit gets the model and messaging credentials; an ingest or sender
  process gets its own file with the tokens only it may hold. A process that
  refuses to start when it finds a credential it must not have (the messaging
  prompt says how) keeps the split honest after someone copies the wrong file.

## Then tell me two things

- What the model can reach from inside this container that it could not reach
  from a laptop, and which guardrail rule is now the only thing standing in front
  of it.
- What happens to a `requireApproval` rule when nobody is there to approve. If
  the answer is "it is denied", say which rules are now effectively dead and
  offer to move them to `deny` so the policy says what it does.
