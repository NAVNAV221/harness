---
module: messaging
writes: spec/messaging.md
depends_on: [spec/harness.md]
---

# Interview: messaging

Read `spec/harness.md` first, and read `src/messaging/types.ts` and
`src/messaging/cli.ts` before asking anything. The CLI adapter implements the
whole interface in about 60 lines; every answer below is really about how the
target platform differs from it.

## Questions

**1. Which platform?**
Slack, Mattermost, Discord, Teams, a webhook, email, SMS, another CLI. If they
name more than one, ask which one is first - the interface exists so the second
one is cheap, and building two at once is how neither gets finished.

**2. How does the harness receive messages?**
Socket mode, events API with a public URL, a bot gateway, long polling, a
webhook. This is the single biggest implementation decision and it is entirely
platform-specific. Make them look it up rather than guessing.

**3. What counts as one conversation?**
A channel, a thread, a DM, a user. The harness keeps one session per
conversation, so this decides what the harness remembers within a turn and what
it forgets between them. Threads are usually the right answer where they exist.

**4. Does it respond to everything, or only when addressed?**
A bot that answers every message in a busy channel gets muted on day one. Ask for
the exact trigger: a mention, a prefix, a specific channel, a reaction.

**5. Who is allowed to talk to it?**
Everyone in the workspace, one channel, a named list, anyone in a group. This
becomes `allowFrom` and `allowChannels` in the guardrail policy.

**6. How does a human approve a tool call, in this platform's UI?**
`requestApproval` must block until a human answers. In a terminal that is a
y/N prompt. In Slack it is a Block Kit button and a callback. In email it might
be impossible, in which case the honest answer is that this harness cannot have
approval-gated tools. Get a concrete mechanism or get a "no".

**7. What happens on timeout?**
Nobody clicks approve. What then? The only acceptable default is deny.

**8. How does it authenticate, and where does the credential live?**
Bot token, app token, signing secret, OAuth. Ask where the secret will live:
environment variable, secret manager, file. Never a committed file.

**9. What must never leave the harness into a channel?**
Secrets, full stack traces, memory contents, file paths, anything from a private
channel repeated into a public one. This becomes redaction, enforced in code.

## Non-negotiables for the implementation

Whoever builds this adapter must follow these, and the spec must repeat them:

- Implement `MessagingAdapter` from `src/messaging/types.ts` without changing the
  interface. If the platform genuinely cannot fit, change the interface
  deliberately and update the CLI adapter in the same commit.
- `requestApproval` returns `false` on timeout, on error, and on anything
  ambiguous. A guardrail that fails open is decoration.
- Verify the platform's request signature on every inbound webhook. An
  unauthenticated inbound path means anyone on the internet can drive the harness.
- Never log message bodies or tokens at info level.
- Register the adapter in `src/messaging/index.ts`. Do not touch `src/harness.ts`:
  if you need to, the interface is wrong and that is a separate conversation.
- The credential comes from the environment. If you find yourself writing a token
  into a file in the repo, stop.

## Write the spec

Write `spec/messaging.md`:

```markdown
# Messaging spec

## Platform
<name, and the SDK or API version>

## Transport
<socket mode / events API / webhook, and what infrastructure that requires>

## Conversation key
<channel | thread | dm | user>

## Trigger
<when the harness responds at all>

## Authorization
- allowFrom: <ids or "*">
- allowChannels: <ids or "*">

## Approval UX
<the exact mechanism, and the timeout, and what happens on timeout>

## Credentials
<which secrets, which env vars, where they come from>

## Never send outward
- <rule>

## Open questions
<anything the user could not answer - the implementer must ask, not assume>
```
