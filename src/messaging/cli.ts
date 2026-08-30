/**
 * The reference adapter: your terminal.
 *
 * This exists so the interface is proven, not aspirational. Every platform
 * adapter you write should be recognisably this file with a different transport.
 */
import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { AdapterHandlers, ApprovalRequest, MessagingAdapter, OutgoingMessage } from "./types.ts";

export class CliAdapter implements MessagingAdapter {
  readonly name = "cli";
  private rl: Interface | undefined;
  private stopping = false;

  async start(handlers: AdapterHandlers): Promise<void> {
    this.rl = createInterface({ input: stdin, output: stdout });
    stdout.write("harness ready (adapter: cli). Type a message, or /exit.\n");

    void (async () => {
      while (!this.stopping) {
        let line: string;
        try {
          line = (await this.rl!.question("\nyou> ")).trim();
        } catch {
          break; // readline closed
        }
        if (!line) continue;
        if (line === "/exit" || line === "/quit") {
          await handlers.onShutdown();
          await this.stop();
          break;
        }
        await handlers.onMessage({
          channel: "cli",
          sender: { id: process.env.USER ?? "local", display: process.env.USER ?? "you" },
          text: line,
          ts: new Date().toISOString(),
        });
      }
    })();
  }

  async send(message: OutgoingMessage): Promise<void> {
    // Indent continuation lines so a multi-line reply still reads as one turn.
    const body = message.text.split("\n").join("\n         ");
    stdout.write(`\nharness> ${body}\n`);
  }

  async requestApproval(request: ApprovalRequest): Promise<boolean> {
    if (!this.rl) return false;
    stdout.write(`\n  ! guardrail: ${request.reason}\n    ${request.toolName}: ${request.detail}\n`);
    const answer = (await this.rl.question("    approve? [y/N] ")).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.rl?.close();
    this.rl = undefined;
  }
}
