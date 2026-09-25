# Build prompt: messaging

Read `spec/messaging.md`. If it is not there, run `/harness:interview messaging`
first. Do not build an adapter for a platform nobody named.

Then read `src/messaging/types.ts` and `src/messaging/cli.ts` before writing a
line. The CLI adapter implements the whole interface in about 60 lines. Yours is
that file with a different transport.

Build `src/messaging/<platform>.ts` and register it in `src/messaging/index.ts`.

Non-negotiable:

- Implement `MessagingAdapter` without changing the interface. If the platform
  genuinely does not fit, stop and tell me - changing the interface means
  updating the CLI adapter in the same commit, and that is a decision, not a
  detail.
- **Do not modify `src/harness.ts`.** If you think you need to, the interface is
  wrong. Say so instead of working around it.
- `requestApproval` returns `false` on timeout, on error, on an unauthorized
  clicker, and on anything ambiguous. It must block until it has a real answer or
  the timeout fires. A guardrail that fails open is decoration.
- Verify the platform's request signature on every inbound webhook, before
  parsing the body. An unauthenticated inbound path means anyone on the internet
  can drive this harness.
- Credentials come from environment variables named in the spec. If you are about
  to write a token into a file in this repo, stop.
- Never log message bodies or tokens above debug level.
- Map the platform's idea of a conversation to the key the spec chose, and make
  it obvious in the code which one you picked.

## Things a real adapter hit

Each of these cost a debugging session the first time. Build them in.

- **Drop what you will not answer before the harness sees it.** A message from
  anyone outside the spec's authorization, in a channel it does not name, an
  edit, a delete, the bot's own message: filtered in the adapter, so a stranger
  gets no reply at all rather than a refusal that confirms the bot exists.
- **Deduplicate inbound events.** Socket and webhook transports redeliver after
  a reconnect. Keep a bounded set of seen event ids, or a turn runs twice.
- **One queue per conversation.** Two quick messages in one thread must not
  race; different threads should still run side by side.
- **Refuse to start with a credential that can act as the owner.** If the
  platform issues one token that reads as the user and another that posts as a
  bot, and only the bot's belongs to this process, check the environment at
  startup and stop with a reason if the other one is there. The split between
  processes is only as good as this check.
- **Convert Markdown to the platform's markup** in `send`. Models write
  `**bold**` and `[text](url)`; Slack shows the asterisks and pastes the URL.
  Leave code spans and blocks untouched.
- **Progress (`progress?`) is best effort and ordered.** Parallel tool calls
  emit their rows at the same instant. On a streaming API whose first call
  creates the message, two unchained writes each create one, and the first is
  orphaned forever. Chain every write per conversation. Streams also expire
  during a long quiet tool call: reopen once, then give up quietly. A progress
  failure must never cost the owner the reply.
- **`post?` posts only where the harness may talk.** It is the one outbound path
  that is not a reply; resolve its destination at startup from the spec, never
  from an argument.

Add the platform SDK to `package.json`, add the env vars to `.env.example` with
empty values, and add a short section to the README saying what a first-time
operator has to create in the platform's admin UI to make this work. That last
part is the step everyone forgets and everyone needs.

Then tell me how to test it without a live workspace, and run `npm run typecheck`.
