/**
 * Entry point. Boot the adapter, hand every message to the harness, reflect on
 * the way out.
 *
 * Read this file top to bottom and you have read the whole control flow.
 */
import { findCredentialSource, loadConfig } from "./config.ts";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { Memory } from "./memory/index.ts";
import { Harness } from "./harness.ts";
import { createAdapter } from "./messaging/index.ts";
import { reflect } from "./reflection/index.ts";

async function main(): Promise<void> {
  const config = loadConfig();

  // Warn, do not exit: an exotic provider setup may authenticate in a way this
  // check does not know about. But say it now rather than on the first message.
  if (!findCredentialSource(process.env, getAgentDir())) {
    console.warn(
      [
        "  ! no model credentials found.",
        `    Looked for a provider key in the environment, and ${getAgentDir()}/auth.json.`,
        "    On a laptop: run `pi` once to log in, or put a key in .env.",
        "    In a container: inject one through your platform's secrets. pi will tell",
        "    you to run /login, which needs a terminal this process does not have.",
        "",
      ].join("\n"),
    );
  }

  const memory = new Memory(config.memoryDir);
  const adapter = createAdapter(config.adapter);
  const harness = new Harness(config, memory, adapter);

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const conversation of harness.openConversations) {
      const result = await reflect(config, memory, conversation).catch((error) => {
        console.error(`  reflection failed: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
      });
      if (result) console.log(`\n  reflection proposal written -> ${result.path}`);
    }
    await harness.dispose();
    await adapter.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  await adapter.start({
    onMessage: (message) => harness.handleMessage(message),
    onShutdown: shutdown,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
