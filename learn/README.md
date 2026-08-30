# learn/

Parts 3 and 4 of a harness, built by hand, so that the frameworks stop looking
like magic.

Nothing in here is on the production path. `src/` uses pi for both. This exists
because you should write the loop once before you let something else own it.

```bash
npm run learn:loop "what is in src, and what does the harness do?"
npm run learn:loop -- --openai "same question"
```

## Part 3: the agentic loop

`loop.ts`, about forty lines of actual logic:

```
model picks an action -> we execute it -> result goes back -> repeat
```

The interesting part is not the repeat. It is the six ways it stops, all of them
explicit in the file:

| Exit | Why it exists |
|---|---|
| provider error | A loop that retries an auth failure ten times burns a rate limit at 3am |
| max_tokens | The model ran out of room mid-answer; more turns will not help |
| no tool calls | The model believes it has answered. This is the normal exit |
| unknown tool | Tell the model what does exist rather than crashing; it usually recovers |
| repeated failure | Every tool failed for three turns running. It is stuck |
| turn budget | The backstop that guarantees termination |

Most agent loops in the wild have the first three. The bugs live in the last
three.

## Part 4: the translation layer

`providers/types.ts` is the whole seam: one interface the loop calls, one adapter
per vendor behind it. Build it and you own your harness. Skip it and you have
written an application for one vendor.

Four things actually differ, and all four are visible in the two adapters:

1. **Tool call format.** Anthropic returns `tool_use` content blocks. OpenAI
   returns a separate `tool_calls` array with JSON-string arguments.
2. **Tool results.** Anthropic sends them back as user-role content blocks, and
   consecutive ones must be merged into one message. OpenAI gives them their own
   role. This one difference is most of `toAnthropic()`.
3. **Stop reasons.** `end_turn`/`tool_use`/`max_tokens` against
   `stop`/`tool_calls`/`length`. The loop branches on a normalised `StopReason`
   and never sees either spelling.
4. **Token accounting.** `input_tokens`/`output_tokens` against
   `prompt_tokens`/`completion_tokens`. Same numbers, different names, and it is
   the field everyone hardcodes and then wonders why their cost dashboard is
   wrong after a provider switch.

Streaming is the fifth difference and it is not modelled here on purpose. It
roughly doubles the size of the adapters and teaches you nothing the other four
did not. `@earendil-works/pi-ai` has the real version.

## What pi replaces

| You wrote | pi's version |
|---|---|
| `run()` in `loop.ts` | `session.prompt()`, plus the agent loop in `pi-agent-core` |
| `Provider` in `providers/types.ts` | `@earendil-works/pi-ai`, every provider, with streaming |
| `tools.ts` | `defineTool()` and the tool registry |
| the `SYSTEM` constant | `DefaultResourceLoader({ systemPrompt })` |
| nothing yet | sessions, compaction, skills, extensions, MCP, permissions |

Read `src/harness.ts` after this file. Every line of it maps to something you
just wrote by hand.
