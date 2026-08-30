/**
 * Part 3: the agentic loop, by hand, no framework.
 *
 *   model picks an action -> we execute it -> result goes back -> repeat
 *
 * That is the whole thing. Every agent framework you have heard of is this loop
 * with opinions bolted on. Run it once, read it once, and the frameworks stop
 * looking like magic.
 *
 *   ANTHROPIC_API_KEY=... npm run learn:loop "what is in the src directory?"
 *   OPENAI_API_KEY=...    npm run learn:loop --openai "..."
 *
 * The exit conditions are the interesting part, and they are all explicit below.
 */
import { anthropic } from "./providers/anthropic.ts";
import { openai } from "./providers/openai.ts";
import type { Msg, Provider } from "./providers/types.ts";
import { execute, tools } from "./tools.ts";

const MAX_TURNS = 10;
const MAX_CONSECUTIVE_FAILURES = 3;

const SYSTEM = `You explore a codebase with the tools you are given.
Never guess a file's contents. Read it or say you did not read it.
When you have the answer, say it in one paragraph and stop calling tools.`;

export async function run(provider: Provider, task: string): Promise<string> {
  const messages: Msg[] = [{ role: "user", text: task }];
  let failures = 0;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const response = await provider.chat({ system: SYSTEM, messages, tools });
    console.log(`\n[turn ${turn}] ${provider.name} stop=${response.stopReason} in=${response.usage.input} out=${response.usage.output}`);
    if (response.text) console.log(response.text);

    // EXIT 1: the model errored. Do not retry blindly; a loop that retries an
    // auth failure ten times is how you burn a rate limit at 3am.
    if (response.stopReason === "error") return `stopped: provider error\n${response.text}`;

    // EXIT 2: the model ran out of room mid-answer.
    if (response.stopReason === "max_tokens") return "stopped: hit max_tokens";

    // EXIT 3: done. No tool calls means the model believes it has answered.
    if (response.toolCalls.length === 0) return response.text;

    messages.push({ role: "assistant", text: response.text, toolCalls: response.toolCalls });

    let allFailed = true;
    for (const call of response.toolCalls) {
      const known = tools.some((t) => t.name === call.name);
      // EXIT 4 (soft): the model asked for a tool that does not exist. Tell it
      // what does exist rather than crashing - usually it recovers next turn.
      const result = known
        ? execute(call.name, call.args)
        : { text: `No tool named "${call.name}". Available: ${tools.map((t) => t.name).join(", ")}`, isError: true };

      console.log(`  [${call.name}] ${result.isError ? "error" : "ok"}: ${result.text.split("\n")[0]?.slice(0, 80)}`);
      if (!result.isError) allFailed = false;
      messages.push({ role: "tool", callId: call.id, name: call.name, text: result.text, isError: result.isError });
    }

    // EXIT 5: repeated failure. Every tool in a whole turn failed, three turns
    // running. The model is stuck and more turns will not unstick it.
    failures = allFailed ? failures + 1 : 0;
    if (failures >= MAX_CONSECUTIVE_FAILURES) return `stopped: ${failures} consecutive failed turns`;
  }

  // EXIT 6: turn budget. The backstop that guarantees termination.
  return `stopped: hit the ${MAX_TURNS} turn limit without finishing`;
}

const args = process.argv.slice(2);
const useOpenAI = args.includes("--openai");
const task = args.filter((a) => a !== "--openai").join(" ") || "What is in the src directory, and what does the harness do?";

// Swap the provider, prove the loop did not change. That is part 4 working.
run(useOpenAI ? openai() : anthropic(), task)
  .then((result) => console.log(`\n=== ${result}`))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
