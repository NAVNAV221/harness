/**
 * Adapter registry. One line per platform.
 *
 * Run /harness:build-messaging after the interview and your platform gets added here.
 */
import type { MessagingAdapter } from "./types.ts";
import { CliAdapter } from "./cli.ts";

const adapters: Record<string, () => MessagingAdapter> = {
  cli: () => new CliAdapter(),
  // slack: () => new SlackAdapter(),
  // mattermost: () => new MattermostAdapter(),
  // discord: () => new DiscordAdapter(),
};

export function createAdapter(name: string): MessagingAdapter {
  const factory = adapters[name];
  if (!factory) {
    throw new Error(
      `Unknown adapter "${name}". Available: ${Object.keys(adapters).join(", ")}.\n` +
        `To add one: answer interview/04-messaging.md, then run /harness:build-messaging.`,
    );
  }
  return factory();
}

export * from "./types.ts";
