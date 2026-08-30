# Messaging spec

This is an EXAMPLE, filled in as if a security team had answered
`interview/04-messaging.md`. It is here to show the level of specificity that
makes a build prompt useful. Yours will look nothing like it.

## Platform
Slack, via `@slack/bolt` 4.x. Workspace has ~40 people.

## Transport
Socket Mode. Chosen over the Events API because we do not want to run a
public HTTPS endpoint for this. Requires an app-level token with
`connections:write`.

## Conversation key
Thread. A message in a channel starts a thread and the harness replies in it.
Every subsequent message in that thread is the same conversation. Channel-level
messages that are not in a thread start a new conversation each time.

## Trigger
Only on `app_mention`, or any DM. The harness never responds to an unaddressed
channel message. In #ops it also responds to a `:robot_face:` reaction on any
message, which means "look at this".

## Authorization
- allowFrom: "*" within the workspace. Slack already gates workspace membership.
- allowChannels: C01OPS, C01PLATFORM, and all DMs. Nothing else, including
  channels the bot is invited to by mistake.

## Approval UX
Block Kit message posted in the same thread, with Approve and Deny buttons, and
the tool name plus redacted arguments in the body. Only members of the
@platform-oncall user group may click; a click from anyone else gets an
ephemeral "not authorized" and does not resolve the request.

Timeout: 120 seconds. On timeout the harness edits the message to "expired" and
`requestApproval` returns false.

## Credentials
- `SLACK_BOT_TOKEN` (xoxb-), from 1Password, injected by the deploy.
- `SLACK_APP_TOKEN` (xapp-), same.
- No signing secret needed: Socket Mode has no inbound HTTP.

## Never send outward
- Anything matching the redaction patterns in the guardrail policy.
- Contents of `memory/entities/people/*` into a public channel. People notes are
  DM-only. This is a hard rule, not a preference.
- Stack traces. Summarise and offer to write the trace to a file.

## Open questions
- Whether a thread should expire after N hours of silence and start fresh.
  Unresolved: implementer should ask before choosing.
