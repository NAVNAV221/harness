/**
 * Every tracked file must be usable by a stranger. This script catches the
 * three ways instance data most often slips into one: a real-looking Slack id,
 * an email address that is not an example, and any term from your own denylist
 * (names, workspace, internal hosts, customer names).
 *
 * The denylist is the part that knows your instance, so it is never committed:
 * `.privacy-denylist` in the repo root (gitignored) and/or
 * `~/.config/harness/privacy-denylist`, one term per line, `#` for comments.
 *
 *   npm run privacy:check              every tracked file
 *   npm run privacy:check -- --staged  what is about to be committed
 *   npm run privacy:check -- --message .git/COMMIT_EDITMSG
 *
 * `git config core.hooksPath .githooks` runs the last two on every commit.
 * A line containing `privacy-check: allow` is skipped, for the rare real
 * example that must stay.
 *
 * Deliberately not a secret scanner: tokens and keys are redaction's job
 * (src/guardrails/policy.ts) and a dedicated tool's. This is about the
 * owner-specific facts no scanner knows are private.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Leak {
  line: number;
  kind: "slack-id" | "email" | "denylist";
  match: string;
}

/** Slack user, channel, DM, group and workspace ids: a prefix and 8-11 of A-Z0-9, with a digit. */
const SLACK_ID = /\b[UCDGWT](?=[A-Z0-9]*\d)[A-Z0-9]{8,11}\b/g;
/**
 * Ids that are obviously made up: a run like 0123, the word EXAMPLE, or a few
 * digits then a word (C01PLATFORM). A real id can look like that too; a false
 * pass is why the denylist exists.
 */
const EXAMPLE_ID = /0123|1234|EXAMPLE|XXXX|^[A-Z]\d{1,3}[A-Z]{4,}$/;
const EMAIL = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}\b/g;
/** Domains reserved for examples (RFC 2606), plus the commit-trailer address. */
const EXAMPLE_EMAIL = /@(?:(?:[a-z0-9-]+\.)*example\.(?:com|org|net)|[a-z0-9.-]+\.(?:example|test|invalid|localhost))$|^noreply@anthropic\.com$/i;

export function findLeaks(text: string, denylist: readonly string[] = []): Leak[] {
  const terms = denylist.map((t) => new RegExp(`(?<![A-Za-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`, "i"));
  const leaks: Leak[] = [];
  text.split("\n").forEach((content, i) => {
    if (content.includes("privacy-check: allow")) return;
    const line = i + 1;
    for (const m of content.matchAll(SLACK_ID)) if (!EXAMPLE_ID.test(m[0])) leaks.push({ line, kind: "slack-id", match: m[0] });
    for (const m of content.matchAll(EMAIL)) if (!EXAMPLE_EMAIL.test(m[0])) leaks.push({ line, kind: "email", match: m[0] });
    for (const [j, re] of terms.entries()) if (re.test(content)) leaks.push({ line, kind: "denylist", match: denylist[j]! });
  });
  return leaks;
}

export function loadDenylist(root: string, home = homedir()): string[] {
  const files = [join(root, ".privacy-denylist"), join(home, ".config", "harness", "privacy-denylist")];
  return files
    .filter((f) => existsSync(f))
    .flatMap((f) => readFileSync(f, "utf8").split("\n"))
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

/** Lockfiles and binaries are generated or opaque; a leak there starts in a file this does scan. */
const SKIP = /(^|\/)(package-lock\.json|\.privacy-denylist)$|\.(png|jpe?g|gif|ico|pdf|woff2?|excalidraw)$/;

function git(args: string[], root: string): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function main(): void {
  const root = process.cwd();
  const args = process.argv.slice(2);
  const denylist = loadDenylist(root);
  const found: string[] = [];
  const report = (where: string, text: string) => {
    for (const l of findLeaks(text, denylist)) found.push(`${where}:${l.line}  ${l.kind}  ${l.match}`);
  };

  const msg = args.indexOf("--message");
  if (msg !== -1) {
    const text = readFileSync(args[msg + 1]!, "utf8").split("\n").filter((l) => !l.startsWith("#")).join("\n");
    report("commit message", text);
  } else {
    const staged = args.includes("--staged");
    const files = (staged ? git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"], root) : git(["ls-files"], root))
      .split("\n")
      .filter((f) => f && !SKIP.test(f));
    for (const f of files) {
      const text = staged ? git(["show", `:${f}`], root) : existsSync(join(root, f)) ? readFileSync(join(root, f), "utf8") : "";
      report(f, text);
    }
  }

  if (found.length) {
    console.error(`privacy-check: ${found.length} finding(s). Move instance data to gitignored config, or mark a real example with "privacy-check: allow".`);
    for (const f of found) console.error(`  ${f}`);
    process.exit(1);
  }
  if (!denylist.length) console.log("privacy-check: clean (no denylist found; ids and emails only)");
  else console.log(`privacy-check: clean (${denylist.length} denylist terms)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
