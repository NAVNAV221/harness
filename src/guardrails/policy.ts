/**
 * The whole policy, in one file you can read in a minute.
 *
 * If a rule is not here, it is not enforced. That is the point: a guardrail you
 * have to go looking for is a guardrail nobody audits.
 */

export interface GuardrailPolicy {
  /** Tool calls matching these never run. The model is told why. */
  deny: { tool: string; match?: RegExp; reason: string }[];
  /** Tool calls matching these run only after a human says yes, in the channel. */
  requireApproval: { tool: string; match?: RegExp; reason: string }[];
  /** Applied to every outbound message and every tool result before the model sees it. */
  redact: { pattern: RegExp; replacement: string }[];
  /** Who may talk to the harness. "*" allows everyone. Ids are platform sender ids. */
  allowFrom: string[];
  /** Which channels the harness answers in. "*" allows everywhere. */
  allowChannels: string[];
  /** Per-sender ceiling. Cheap protection against a loop that discovers your harness. */
  rateLimit: { messages: number; perSeconds: number };
}

export const policy: GuardrailPolicy = {
  deny: [
    // Matched against JSON.stringify(input), so the command is always followed by
    // a quote - never whitespace or end-of-string. Anchoring on those made this
    // rule silently never fire. The lookahead asks the real question instead: is
    // the path just "/", or does a path continue after it?
    { tool: "bash", match: /\brm\s+-[rf]{2}\s+\/(?![A-Za-z0-9._~*-])/, reason: "recursive delete of /" },
    { tool: "bash", match: /\b(curl|wget)\b[^|]*\|\s*(ba)?sh/, reason: "pipe-to-shell from the network" },
    { tool: "memory_write", match: /\.\./, reason: "path traversal out of the memory directory" },
  ],

  requireApproval: [
    { tool: "bash", match: /\brm\b|\bmv\b|\bgit\s+push\b|\bkubectl\b|\bterraform\b/, reason: "destructive or outward-facing shell command" },
    { tool: "memory_write", reason: "writing to long-term memory" },
  ],

  // Order matters: first match wins per pattern, all patterns are applied.
  redact: [
    { pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, replacement: "[redacted:anthropic-key]" },
    { pattern: /\bsk-[A-Za-z0-9]{32,}/g, replacement: "[redacted:api-key]" },
    { pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g, replacement: "[redacted:slack-token]" },
    { pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}/g, replacement: "[redacted:github-token]" },
    { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replacement: "[redacted:private-key]" },
    { pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: "[redacted:aws-key-id]" },
  ],

  allowFrom: ["*"],
  allowChannels: ["*"],
  rateLimit: { messages: 20, perSeconds: 60 },
};
