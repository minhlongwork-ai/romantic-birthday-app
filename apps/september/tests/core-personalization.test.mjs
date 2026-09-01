import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizePersonalization,
  parsePersonalization,
} from "../src/core/personalization.mjs";

test("normalizes a valid personalized name to NFC and collapses surrounding whitespace", () => {
  const decomposed = "  Nguye\u0302\u0303n   An  ";

  assert.equal(normalizePersonalization(decomposed, "em"), "Nguyễn An");
});

test("personalization keeps normalized chooser age only in memory", () => {
  const parsed = parsePersonalization("?to=%00Eve&from=Minh%20%20Long&age=99");

  assert.deepEqual(parsed, { recipient: "em", sender: "Minh Long", age: "99" });
});

test("personalization strips query values from the visible URL without rendering age", () => {
  const parsed = parsePersonalization("?to=Minh&from=Long&age=29");

  assert.deepEqual(parsed, { recipient: "Minh", sender: "Long", age: "29" });
});

test("rejects control characters, empty values, and more than 32 grapheme clusters", () => {
  assert.equal(normalizePersonalization("Mai\nAnh", "em"), "em");
  assert.equal(normalizePersonalization("   ", "em"), "em");
  assert.equal(normalizePersonalization("a".repeat(33), "em"), "em");
});

test("counts a joined emoji family as one grapheme cluster", () => {
  const family = "👩‍👩‍👧‍👦";

  assert.equal(normalizePersonalization(family.repeat(32), "em"), family.repeat(32));
  assert.equal(normalizePersonalization(family.repeat(33), "em"), "em");
});
