---
module: deployment
writes: spec/deployment.md
depends_on: [spec/harness.md, spec/messaging.md]
---

# Interview: deployment

Read `spec/harness.md` and `spec/messaging.md` first, then `Dockerfile` and
`compose.yaml`.

**Check one thing before you ask anything else.** If `src/messaging/` still has
only the CLI adapter, say so and stop:

> The CLI adapter reads stdin. Deployed with no terminal attached, this harness
> boots, prints "harness ready", and waits forever for input that never comes.
> Deployment is downstream of `/harness:build-messaging`. Run that first, or
> tell me you want the container only for local sandboxing, which is a real
> reason and changes the rest of these answers.

Running a harness unattended changes three things, and each one is a decision
somebody has to make on purpose:

1. **Nobody is watching.** No terminal, no stdin, no one to notice it is stuck.
2. **Nobody can approve.** `requestApproval` blocks until a human answers, and
   fails closed. Deployed without an approval path, every `requireApproval` rule
   becomes a silent deny.
3. **The filesystem is gone on restart.** Memory, sessions and reflection
   proposals live on disk. In a container that disk is ephemeral by default.

## Questions

**1. Where does it run?**
A VM with docker compose, Kubernetes, ECS, Fly, a Raspberry Pi under a desk, or
your own laptop in a container because you want the `bash` tool sandboxed. Each
answer changes the artifact. Ask which, do not assume Kubernetes.

**2. How does a human approve a tool call once it is deployed?**
This is the question that decides whether the harness can do anything useful.
The options are real and different:
- The messaging adapter implements approval (a Slack button, a reply). Best.
- Nobody can approve, so `requireApproval` rules effectively become `deny`. Then
  say so out loud and move those rules to `deny`, where they are honest.
- Approval is dropped and the rules are removed. Make them say that deliberately.

**3. What has to survive a restart?**
Memory always. Sessions and reflection proposals usually. If nothing does, this
harness has no memory module and the interview should have caught that earlier.
Get a volume, a path, and a backup answer: a volume nobody backs up is a volume
that loses everything the first time the host dies.

**4. Where do credentials come from?**
`pi` uses `~/.pi/agent/auth.json` on your laptop, and that OAuth flow needs a
browser. A container has neither, so a deployed harness needs an API key in the
environment, injected by whatever your platform uses for secrets. Ask which:
compose `env_file`, Kubernetes secret, SSM, Vault. Never a file in the repo.

**5. What does the container need installed?**
The `bash` tool can run anything present in the image. Every binary you add is a
binary the model can invoke, so this is a guardrail question wearing a packaging
question's clothes. The base image ships `git` and CA certificates. Ask what the
skills in `spec/skills.md` actually shell out to, and add only that.

**6. What network can it reach?**
It needs the model provider. Does it also need your Grafana, your GitHub, your
cluster? Anything reachable from the container is reachable by the model. If the
answer is "everything on the VPC", say plainly that the guardrail policy is now
the only thing between the model and production.

**7. How do you know it is alive?**
This harness has no health endpoint. It is a process that waits for messages, so
"the process is running" is the only signal without adding one. Ask whether they
need more than that, and if so, what checks it: a scheduled message to the
harness that expects a reply is usually cheaper and more honest than a `/health`
route that only proves the process started.

**8. What happens when it crashes at 3am?**
Restart policy, log destination, whether anyone is paged. A harness that restarts
in a loop while the model API is down burns tokens on every boot.

## Write the spec

Write `spec/deployment.md`:

```markdown
# Deployment spec

## Target
<where it runs, and with what>

## Adapter
<which messaging adapter runs deployed; "cli" here means it is not deployable yet>

## Approval path
<the exact mechanism, or an explicit statement that requireApproval means deny>

## Persistence
- Volume: <path -> what lives there>
- Backed up by: <what, how often, or "nothing" said out loud>

## Credentials
<which secrets, injected how, from where>

## Image contents
<what is installed beyond node, and which skill needs each thing>

## Network
<what it can reach, and what that means for the guardrail policy>

## Liveness
<what tells you it is alive, and who looks>

## On failure
<restart policy, logs, who is paged>
```
