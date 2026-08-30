/**
 * Configuration. Everything the harness needs to boot, resolved once.
 *
 * Deliberately small: env vars and paths, no config framework. If you grow this
 * into something with profiles and validation, keep the exported shape stable so
 * the rest of the harness does not care where the values came from.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Load .env if it is there. Env vars already in the shell win, and a missing
 * .env is normal: pi keeps credentials in ~/.pi/agent/auth.json too.
 */
function loadDotEnv(root: string): void {
  try {
    process.loadEnvFile(resolve(root, ".env"));
  } catch {
    // No .env. Not an error.
  }
}

export interface HarnessConfig {
  /** Root of the repo. All other paths hang off this. */
  root: string;
  /** provider:model, e.g. "anthropic:claude-opus-4-5". Undefined lets pi pick. */
  model: { provider: string; id: string } | undefined;
  /** Which messaging adapter to boot. */
  adapter: string;
  /** Where entities, sessions and transcripts live. */
  memoryDir: string;
  /** Where skills live. pi loads these with progressive disclosure. */
  skillsDir: string;
  /** Where reflection writes its proposals. */
  proposalsDir: string;
  /** Built-in pi tools this harness is allowed to use, plus our custom ones. */
  tools: string[];
}

function parseModel(raw: string | undefined) {
  if (!raw) return undefined;
  const idx = raw.indexOf(":");
  if (idx === -1) {
    throw new Error(`HARNESS_MODEL must be "provider:model-id", got "${raw}"`);
  }
  return { provider: raw.slice(0, idx), id: raw.slice(idx + 1) };
}

export function loadConfig(root = process.cwd()): HarnessConfig {
  loadDotEnv(root);
  return {
    root,
    model: parseModel(process.env.HARNESS_MODEL),
    adapter: process.env.HARNESS_ADAPTER ?? "cli",
    memoryDir: resolve(root, process.env.HARNESS_MEMORY_DIR ?? "./memory"),
    skillsDir: resolve(root, "./skills"),
    // Deliberately env-configurable: in a container the repo root is ephemeral,
    // and a reflection proposal nobody can read after a restart is a proposal
    // that never existed. Point this at the same volume as memory.
    proposalsDir: resolve(root, process.env.HARNESS_PROPOSALS_DIR ?? "./reflection/proposals"),
    // "bash" is here on purpose: it is what the guardrail demo blocks.
    // Trim this list to the smallest set your harness actually needs.
    tools: ["read", "grep", "bash", "memory_search", "memory_read", "memory_write"],
  };
}

/**
 * Where this process could get model credentials from, or undefined if nowhere.
 *
 * pi's own failure message says to run `/login`, which is its interactive TUI
 * command. A container has no TUI, so a deployer following that advice goes
 * nowhere. Checking at boot lets us say the container-shaped version instead of
 * letting the first message fail with the wrong instruction.
 */
export function findCredentialSource(
  env: NodeJS.ProcessEnv,
  agentDir: string,
  fileExists: (path: string) => boolean = existsSync,
): string | undefined {
  const keys = [
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_BEARER_TOKEN_BEDROCK",
  ];
  const found = keys.find((key) => (env[key] ?? "").trim().length > 0);
  if (found) return found;
  const auth = join(agentDir, "auth.json");
  return fileExists(auth) ? auth : undefined;
}
