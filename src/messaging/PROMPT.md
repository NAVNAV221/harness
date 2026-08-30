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

Add the platform SDK to `package.json`, add the env vars to `.env.example` with
empty values, and add a short section to the README saying what a first-time
operator has to create in the platform's admin UI to make this work. That last
part is the step everyone forgets and everyone needs.

Then tell me how to test it without a live workspace, and run `npm run typecheck`.
