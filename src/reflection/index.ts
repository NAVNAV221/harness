/**
 * Self reflection: the harness reading its own session and proposing changes.
 *
 * It proposes. It does not apply. Every proposal lands in reflection/proposals/
 * as markdown a human can read in ten seconds and accept with one command.
 *
 * The reason for that split is not caution for its own sake. An agent that edits
 * its own system prompt unattended has no stable definition of correct: each run
 * grades itself against rules it wrote on the previous run. Keeping a human on
 * the accept step is what makes the loop converge instead of drift.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { HarnessConfig } from "../config.ts";
import type { Conversation } from "../harness.ts";
import type { Memory } from "../memory/index.ts";
import { dropGuardrailChanges, neverRules, renderDropped } from "./guard.ts";

const REFLECTION_RULES = `
You are reviewing a finished session of an AI harness, to propose improvements.

Output format, exactly. Omit any section that has nothing worth saying. Saying
nothing is a valid and common outcome - do not invent findings to fill sections.

## capability gaps
For each request in this session that the harness could not fulfil because a tool
did not exist, or that it answered worse than it would have with one:
- <tool name>: wanted <n> times. <what was actually asked, in the person's words>

This is the highest-value thing a young harness produces, so do not skip it when
it applies. It is the difference between guessing what to build next and knowing.
Name a tool only if the session named it, or the system prompt's "Not built yet"
section lists it. Never invent a tool name to fill this in.

## memory
For each durable fact learned that memory does not already hold:
\`\`\`file:entities/<type>/<id>.md action:create|replace
---
name: ...
summary: one line
---
<body>
\`\`\`

## system prompt
For each rule that would have prevented a mistake in this session:
- add|remove|change: <the exact rule line>
  because: <the moment in this session that justifies it>

## tools
- <tool name>: <what the model got wrong about when to use it, and the description fix>

## skills
- <skill name>: <the repeated task it would collapse, in one line>

## nothing to change
Include this line alone when the session was unremarkable. A session where the
harness was asked for something it could not do is never unremarkable: that
belongs in capability gaps.

Rules:
- Cite the session. A proposal with no moment behind it is noise.
- Never propose a rule that only restates a rule already in the system prompt.
- Never propose remembering something true only today.
- Never propose loosening a Never rule or a guardrail, even when a refusal
  annoyed the person. A refusal is often the session going right. Such proposals
  are dropped in code before anyone reads them.
`.trim();

/** The live Never rules, read the same way buildSystemPrompt reads them. */
function readSystemPrompt(): string {
  return readFileSync(join(import.meta.dirname, "../system-prompt/SYSTEM_PROMPT.md"), "utf8");
}

export interface ReflectionResult {
  path: string;
  body: string;
}

/** Render what actually happened, which is the only input reflection gets. */
export function renderSessionLog(conversation: Conversation): string {
  const lines = [
    `# Session ${conversation.key}`,
    "",
    `- Started: ${conversation.startedAt}`,
    `- Ended: ${new Date().toISOString()}`,
    `- Turns: ${conversation.turns.length}`,
    "",
  ];
  for (const [i, turn] of conversation.turns.entries()) {
    lines.push(`## Turn ${i + 1}`, "", `**${turn.speaker}:** ${turn.user}`, "", `**harness:** ${turn.assistant}`);
    if (turn.decisions.length) {
      lines.push("", "Guardrail decisions:");
      for (const d of turn.decisions) {
        lines.push(`- ${d.tool}: ${d.action}${d.reason ? ` (${d.reason})` : ""}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function reflect(
  config: HarnessConfig,
  memory: Memory,
  conversation: Conversation,
): Promise<ReflectionResult | undefined> {
  if (conversation.turns.length === 0) return undefined;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const sessionLog = renderSessionLog(conversation);
  const logId = `${stamp}-${conversation.key.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const logPath = memory.writeSessionLog(logId, sessionLog);

  // A separate session with no tools. Reflection reads and writes text, nothing else.
  const agentDir = getAgentDir();
  const loader = new DefaultResourceLoader({
    cwd: config.root,
    agentDir,
    systemPrompt: REFLECTION_RULES,
    noContextFiles: true,
    noSkills: true,
    noExtensions: true,
  });
  await loader.reload();

  const { session } = await createAgentSession({
    cwd: config.root,
    agentDir,
    modelRuntime: await ModelRuntime.create(),
    resourceLoader: loader,
    settingsManager: SettingsManager.create(config.root, agentDir),
    sessionManager: SessionManager.inMemory(),
    noTools: "all",
  });

  let text = "";
  const unsubscribe = session.subscribe((event) => {
    if (event.type !== "message_end") return;
    const message = event.message as { role?: string; content?: unknown };
    if (message.role !== "assistant" || !Array.isArray(message.content)) return;
    for (const part of message.content as { type: string; text?: string }[]) {
      if (part.type === "text" && part.text) text += part.text;
    }
  });

  try {
    await session.prompt(
      [
        "Here is the session, and the memory index as it stood at the end.",
        "",
        "## Session",
        sessionLog,
        "",
        "## Memory index",
        memory.renderIndex(),
      ].join("\n"),
    );
  } finally {
    unsubscribe();
    session.dispose();
  }

  // Filter before writing, so a proposal that argues against a guardrail never
  // sits in the directory looking like advice. The full text goes to the session
  // log instead, where the owner can still read it and overrule the filter.
  const { kept, dropped } = dropGuardrailChanges(text.trim(), neverRules(readSystemPrompt()));
  if (dropped.length > 0) memory.writeSessionLog(logId, `${sessionLog}\n${renderDropped(dropped)}`);

  mkdirSync(config.proposalsDir, { recursive: true });
  const body = [
    `# Reflection proposal`,
    "",
    `- Session: ${conversation.key}`,
    `- Generated: ${new Date().toISOString()}`,
    `- Accept with: \`npm run reflect:accept ${stamp}\``,
    "",
    kept || "## nothing to change",
    "",
    // Its own heading, so accept.ts never mistakes it for part of the section above.
    ...(dropped.length > 0
      ? [
          "## dropped",
          `${dropped.length} item(s) touched a guardrail and were removed. Full text in ${join(memory.dir, logPath)}.`,
          "",
        ]
      : []),
  ].join("\n");

  const path = join(config.proposalsDir, `${stamp}.md`);
  writeFileSync(path, body, "utf8");
  return { path, body };
}
