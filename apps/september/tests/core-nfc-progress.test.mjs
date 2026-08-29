import assert from "node:assert/strict";
import test from "node:test";

import {
  clearNfcProgress,
  NFC_PROGRESS_KEY,
  parseNfcGiftFragment,
  readNfcProgress,
  recordNfcGift,
} from "../src/core/nfc-progress.mjs";

const NOW = 1_800_000_000_000;

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test("fixed NFC fragments map to exact gift IDs", () => {
  assert.equal(parseNfcGiftFragment("#gift=sweet"), "cake");
  assert.equal(parseNfcGiftFragment("#gift=bloom"), "bouquet");
  assert.equal(parseNfcGiftFragment("#gift=moon"), null);
  assert.equal(parseNfcGiftFragment("#gift=sweet&to=Minh"), null);
});

test("progress is unique, ordered, anonymous, and expires after 24 hours", () => {
  const storage = memoryStorage();
  const first = recordNfcGift(storage, "cake", [], NOW);
  const second = recordNfcGift(storage, "bouquet", first, NOW + 1_000);
  assert.deepEqual(second, ["cake", "bouquet"]);
  assert.deepEqual(readNfcProgress(storage, NOW + 86_399_999), ["cake", "bouquet"]);
  assert.deepEqual(readNfcProgress(storage, NOW + 86_400_001), []);
  assert.doesNotMatch(storage.getItem(NFC_PROGRESS_KEY) ?? "", /Minh|from|query|url/u);
});

test("clears malformed, unknown-version, duplicate, unknown, and overlong progress", () => {
  const invalidEntries = [
    "not-json",
    JSON.stringify({ v: 2, foundGiftIds: ["cake"], expiresAt: NOW + 1 }),
    JSON.stringify({ v: 1, foundGiftIds: ["cake", "cake"], expiresAt: NOW + 1 }),
    JSON.stringify({ v: 1, foundGiftIds: ["moon"], expiresAt: NOW + 1 }),
    JSON.stringify({ v: 1, foundGiftIds: ["cake"], expiresAt: NOW + 86_400_001 }),
  ];

  for (const entry of invalidEntries) {
    const storage = memoryStorage({ [NFC_PROGRESS_KEY]: entry });
    assert.deepEqual(readNfcProgress(storage, NOW), []);
    assert.equal(storage.getItem(NFC_PROGRESS_KEY), null);
  }
});

test("returns ordered progress when storage reads or writes fail", () => {
  const throwingStorage = {
    getItem: () => { throw new Error("read failed"); },
    setItem: () => { throw new Error("write failed"); },
    removeItem: () => { throw new Error("remove failed"); },
  };

  assert.deepEqual(readNfcProgress(throwingStorage, NOW), []);
  assert.deepEqual(recordNfcGift(throwingStorage, "bouquet", ["cake"], NOW), ["cake", "bouquet"]);
  assert.doesNotThrow(() => clearNfcProgress(throwingStorage));
});

test("rejects unknown gifts and clears progress idempotently", () => {
  const storage = memoryStorage({ [NFC_PROGRESS_KEY]: "present" });

  assert.deepEqual(recordNfcGift(storage, "moon", ["cake"], NOW), ["cake"]);
  clearNfcProgress(storage);
  clearNfcProgress(storage);
  assert.equal(storage.getItem(NFC_PROGRESS_KEY), null);
});
