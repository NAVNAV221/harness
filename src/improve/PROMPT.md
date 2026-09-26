# Build prompt: self-improvement from sessions

Read `spec/improve.md`. If it is not there, run `/harness:interview improve`
first. Read `src/skills/validate.ts` and `src/reflection/guard.ts`: this module
reuses both, and must not loosen either.

The skeleton ships no improve code on purpose. What counts as a misroute, and
where an accepted change may live, are the design.

## What to build

1. **The record**, if the spec says there is none yet: `src/harness.ts` already
   subscribes to pi's tool events for progress rows. Append one line per
   `tool_execution_start` and `tool_execution_end` (redacted arguments; ok or
   error; duration; the first ~240 characters of the result) with the turn's
   id, plus the inbound message and the reply. A miner without result heads
   cannot tell an empty result from a full one.
2. **`src/improve/mine.ts`, pure:** turns from the record, then per turn the
   expected skill (the routes table), the skills opened (a `read` of
   `skills/<name>/SKILL.md`, or of the memory override), errors, empty results
   ("No ...", "Nothing ...", zero hits), the same tool called 3+ times with
   different arguments, a correction in the person's next message, stops, empty
   replies, long turns, "I can't" replies. Then an aggregate over the window,
   and `topFindings()` ranking them, each with the turn and event ids behind it.
3. **`src/improve/propose.ts`:** one model call over the top findings, JSON
   only, at most the spec's cap. Then `validateMined()`, in code:
   - every cited id is one the miner saw;
   - a skill passes `validateSkill` against the enabled tools, and keeps every
     line containing "never" from the version it replaces;
   - `skill_new` has evidence from at least two separate turns;
   - a tool description is for a tool this harness defines, 20 to 1024
     characters; only the description changes, never what the tool does;
   - a rule is one line;
   - one open proposal per target: a later run does not stack a second edit to
     the same skill.
   Then `guardItems` from the reflection guard. Extend its judge prompt to read
   whole skill files and tool descriptions, and add two rules to what it checks
   against: nothing may add a way to send anything to anyone the Never rules
   exclude, and nothing may tell the assistant to act before approval. It fails
   closed, as it does now.
4. **`src/improve/apply.ts`:** snapshot what is there to an archive directory
   with a manifest, then write. Skills to `$HARNESS_MEMORY_DIR/skills/<name>/`,
   and pass that directory to pi **before** `skills/` in `additionalSkillPaths`
   (pi keeps the first skill of a name). Tool descriptions to a JSON file that
   `createTools` reads when it builds the next conversation's tools. Validate
   again at apply time; an invalid one stays pending. `npm run improve:revert
   <archive dir>` puts a snapshot back.
5. **The decision, in code.** A card per proposal (reason, evidence ids, the
   change as a diff or before/after, Accept and Reject), or "accept 2" in the
   thread, parsed before the model sees the message. Owner only. The model has
   no tool that accepts, applies or reverts.
6. **`npm run improve:mine`**, read-only: the signals and top findings, and
   `-- --propose` to add the model call and the checks without recording
   anything. This is how the owner sees what it would do before trusting it.
7. **Tests** with a fake model: each check in `validateMined`, apply and revert
   round-tripping, a skill naming a missing tool refused at apply time.

## Constraints

- Every change lands under the memory directory. Never `src/`, `skills/` or
  `spec/`: the deployed repo stays pullable, and reflection never edits code.
- Nothing applies without the owner's click. "Nothing to change" is a valid,
  common run.
- A proposal cites the turns behind it; one with no evidence is dropped, not
  shown.
- The routes table mirrors skill descriptions by hand. When a description edit
  is accepted, the miner may keep reporting the misroute it fixed. Say so in the
  spec's open questions, or derive routes from the accepted descriptions.

Then run `npm run typecheck` and `npm test`, run `npm run improve:mine` on the
real record, and show me the top findings before any proposal is made.
