/**
 * Memory is the fifth part of the harness, and it is really context management.
 *
 * Two jobs live here, and they are different:
 *   1. What the harness KNOWS      - entities, sessions, transcripts on disk.
 *   2. What the model SEES         - the index injected each turn, and how a
 *                                    read is truncated when it is too big.
 *
 * Job 2 is the one people skip. Every read in this module returns a Clipped
 * result that says out loud when it dropped something.
 */

/** One thing the harness knows about: a person, a project, a service, a rule. */
export interface Entity {
  /** Folder under entities/, e.g. "people". You invent these. */
  type: string;
  /** Filename without .md, e.g. "dana". */
  id: string;
  /** Path relative to the memory dir, e.g. "entities/people/dana.md". */
  path: string;
  /** From frontmatter. Falls back to the id. */
  name: string;
  /** From frontmatter. This is what the model sees in the index. Keep it one line. */
  summary: string;
  /** Remaining frontmatter keys, untouched. */
  fields: Record<string, string>;
}

/** A read that knows whether it lied to you. */
export interface Clipped {
  text: string;
  truncated: boolean;
  /** Told to the model verbatim when truncated. Must say how to get the rest. */
  note?: string;
  originalBytes: number;
}

/** One line of a channel transcript. Append-only, never rewritten. */
export interface TranscriptEntry {
  ts: string;
  channel: string;
  sender: string;
  text: string;
}
