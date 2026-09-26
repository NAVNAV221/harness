/**
 * The privacy check, on synthetic text only. A fixture that used real ids or
 * names would be the leak this check exists to stop.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findLeaks, loadDenylist } from "../scripts/privacy-check.ts";

// Built from parts, so this file does not trip the check it tests.
const ID = "U07QK2M9" + "ZRB";
const EMAIL = "someone@" + "acme-corp.io";

describe("findLeaks", () => {
  test("flags a real-looking Slack id, not a made-up one or an ordinary word", () => {
    assert.deepEqual(findLeaks(`owner is ${ID}`), [{ line: 1, kind: "slack-id", match: ID }]);
    assert.deepEqual(findLeaks("see U0123456789, C01PLATFORM, CHANGELOG, WARRANTIES and C01OPS"), []);
  });

  test("flags an email unless its domain is reserved for examples", () => {
    assert.equal(findLeaks(`mail ${EMAIL}`)[0]?.kind, "email");
    assert.deepEqual(findLeaks("dana@example.com, ops@team.example, x@host.test"), []);
  });

  test("flags denylist terms as whole words, case-insensitive, with line numbers", () => {
    const text = "fine\nDeploy to Build-Box-7 tonight\nbuild-box-70 is another host";
    assert.deepEqual(findLeaks(text, ["build-box-7"]), [{ line: 2, kind: "denylist", match: "build-box-7" }]);
  });

  test("a line marked privacy-check: allow is skipped", () => {
    assert.deepEqual(findLeaks(`${ID} is the format  <!-- privacy-check: allow -->`), []);
  });
});

describe("loadDenylist", () => {
  test("reads the repo file and the one in ~/.config, skipping blanks and comments", () => {
    const root = mkdtempSync(join(tmpdir(), "repo-"));
    const home = mkdtempSync(join(tmpdir(), "home-"));
    writeFileSync(join(root, ".privacy-denylist"), "# names\nacme\n\n");
    mkdirSync(join(home, ".config", "harness"), { recursive: true });
    writeFileSync(join(home, ".config", "harness", "privacy-denylist"), "build-box-7\n");
    assert.deepEqual(loadDenylist(root, home), ["acme", "build-box-7"]);
  });
});
