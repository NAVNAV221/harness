# Build prompt: deployment

Read `spec/deployment.md`. If it is not there, run `/harness:interview deployment`
first.

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

## Then tell me two things

- What the model can reach from inside this container that it could not reach
  from a laptop, and which guardrail rule is now the only thing standing in front
  of it.
- What happens to a `requireApproval` rule when nobody is there to approve. If
  the answer is "it is denied", say which rules are now effectively dead and
  offer to move them to `deny` so the policy says what it does.
