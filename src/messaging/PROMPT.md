# Build prompt: messaging

Read `spec/messaging.md`. If it is not there, run `/harness:interview messaging`
first. Do not build an adapter for a platform nobody named.

**Instance data stays out of tracked files.** Owner and user ids, workspace
names, people's names, real messages, internal hosts and deploy notes go in
gitignored config (`.env`, `~/.config/<harness>/`) read at run time; specs name
the variable, not the value, and tests use synthetic fixtures. When a value is
dynamic or specific to this owner, say so and ask where it lives rather than
writing it in. `npm run privacy:check` before you commit.

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
  For Slack mrkdwn: `**x**` to `*x*`, `[t](u)` to `<u|t>`, `# Heading` lines to
  `*Heading*`, a bare user id to `<@U...>`. Split the text on code spans and
  fenced blocks first and convert only the parts outside them, or a command in
  backticks gets mangled.
- **Accept the message subtypes that are still the person talking.** Slack
  sends a message with a file attached as `file_share`, and "also send to
  channel" as `thread_broadcast`. An adapter that drops every subtype drops
  those too, with no trace: seen live, a long reply with a file was simply
  never answered. Accept those, keep ignoring edits and deletes, and log the
  subtype (never the body) of anything else you skip.
- **Forwarded messages and files are content.** A forward arrives as an
  attachment with its own author, link and text; append them to the message
  text so the model sees them. Read small text files with the platform's file
  scope, and say in the text when one could not be read. Slack without
  `files:read` answers 200 with its HTML login page, not an error: treat an
  HTML body as a failure.
- **Stop words are handled at once, not queued.** "stop" or "cancel" alone in a
  conversation (plus the words your people actually use, in their languages),
  and the platform's own stop button (Slack's `agent_session_stopped` on agent
  threads, which the app must subscribe to), call `handlers.onStop` directly.
  Through the conversation's queue, the stop waits for the turn it is meant to
  stop. With nothing running, say so.
- **Show that a turn is working even without tool calls.** A minute of model
  time with no tool call shows nothing, and people assume it died. Open one
  progress row when the message arrives and close it with the reply.
- **A redaction list built from config values must skip addresses.** A scrubber
  that hides every value in the env file hid `*_URL` values too, and cut the
  workspace host out of every link the harness sent. Skip keys ending in
  `_URL`, and values too short to be secrets.
- **Progress (`progress?`) is best effort and ordered.** Parallel tool calls
  emit their rows at the same instant. On a streaming API whose first call
  creates the message, two unchained writes each create one, and the first is
  orphaned forever. Chain every write per conversation. Streams also expire
  during a long quiet tool call: reopen once, then give up quietly. A progress
  failure must never cost the owner the reply. Slack's `chat.appendStream` task
  rows cap each chunk at 256 characters: clip the summary, not the call.
- **`post?` posts only where the harness may talk.** It is the one outbound path
  that is not a reply; resolve its destination at startup from the spec, never
  from an argument.
- **Buttons that are not approvals must not block a turn.** `requestApproval`
  blocks by design. A card with its own buttons (accept a proposal, send a
  draft) is different: post it, return, and handle the click later in code,
  checking the clicker is the owner. If the spec needs this, it is an interface
  change: add `postCard` / `updateCard` to the adapter and `onAction` to the
  handlers, the CLI adapter in the same commit, and keep cards to the one
  destination `post` uses. The model never gets a tool that clicks.

## Conversations after a restart

`src/harness.ts` keeps each conversation's pi session in memory
(`SessionManager.inMemory()`). A restart forgets them: the next reply in an old
thread starts a session that has never seen the thread, and the model answers
the last message with no idea what came before. With the drain on shutdown,
deploys no longer cut turns off, which makes this the next thing people notice.

TODO, not built in the skeleton. Pick one when the spec says threads outlive
deploys:
- persist pi sessions per conversation key (a file-backed `SessionManager` under
  the memory volume) and reopen the one for a key on its first message, or
- on the first message for a key this process has not seen, fetch the thread
  from the platform (for Slack, `conversations.replies`) and prepend it to the
  prompt, clipped and with the harness's own messages marked as its own.

The first keeps tool results; the second needs no storage and also covers
threads that began before the harness existed.

Add the platform SDK to `package.json`, add the env vars to `.env.example` with
empty values, and add a short section to the README saying what a first-time
operator has to create in the platform's admin UI to make this work. That last
part is the step everyone forgets and everyone needs.

Then tell me how to test it without a live workspace, and run `npm run typecheck`.
