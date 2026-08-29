import assert from "node:assert/strict";
import test from "node:test";

import {
  commitOpenedGift,
  createExperienceState,
  resolveHistoryTarget,
} from "../src/core/session.mjs";
import { INITIAL_DETENTS } from "../src/core/puzzle.mjs";

test("hydrates a fresh in-memory experience from a validated NFC gift order", () => {
  const state = createExperienceState({
    openedGiftIds: ["cake", "bouquet", "cake", "unknown"],
  });

  assert.deepEqual(state, {
    scene: "intro",
    openedGiftIds: new Set(["cake", "bouquet"]),
    openOrder: ["cake", "bouquet"],
    activeGiftId: null,
    puzzleDetents: { ...INITIAL_DETENTS },
    completionMode: null,
  });
  assert.notEqual(state.puzzleDetents, INITIAL_DETENTS);
});

test("commits each gift exactly once while preserving the user's first-open order", () => {
  const fresh = createExperienceState();
  const first = commitOpenedGift(fresh, "bouquet");
  const second = commitOpenedGift(first, "cake");
  const repeated = commitOpenedGift(second, "bouquet");

  assert.deepEqual(repeated.openOrder, ["bouquet", "cake"]);
  assert.deepEqual(repeated.openedGiftIds, new Set(["bouquet", "cake"]));
  assert.equal(repeated, second);
  assert.deepEqual(fresh.openOrder, []);
});

test("preserves both possible first-open orders", () => {
  const orders = [
    ["cake", "bouquet"],
    ["bouquet", "cake"],
  ];

  for (const order of orders) {
    const finalState = order.reduce(commitOpenedGift, createExperienceState());
    assert.deepEqual(finalState.openOrder, order);
    assert.equal(finalState.openedGiftIds.size, 2);
  }
});

test("refuses to commit an unknown gift identifier", () => {
  assert.throws(
    () => commitOpenedGift(createExperienceState(), "rare-prize"),
    /Unknown September gift/,
  );
});

test("restores the exact gift recorded by a valid reveal history entry", () => {
  const target = resolveHistoryTarget(
    { v: 1, sessionToken: "session-a", scene: "reveal", giftId: "bouquet" },
    {
      sessionToken: "session-a",
      openedGiftIds: new Set(["cake"]),
      completionMode: null,
    },
  );

  assert.deepEqual(target, {
    scene: "reveal",
    giftId: "bouquet",
    replace: false,
  });
});

test("recovers an invalid reveal gift to the box with replaceState semantics", () => {
  const target = resolveHistoryTarget(
    { v: 1, sessionToken: "session-a", scene: "reveal", giftId: "jackpot" },
    {
      sessionToken: "session-a",
      openedGiftIds: new Set(),
      completionMode: null,
    },
  );

  assert.deepEqual(target, { scene: "box", replace: true });
});

test("accepts valid intro and box entries without creating replacement history", () => {
  const context = {
    sessionToken: "session-a",
    openedGiftIds: new Set(),
    completionMode: null,
  };

  assert.deepEqual(
    resolveHistoryTarget({ v: 1, sessionToken: "session-a", scene: "intro" }, context),
    { scene: "intro", replace: false },
  );
  assert.deepEqual(
    resolveHistoryTarget({ v: 1, sessionToken: "session-a", scene: "box" }, context),
    { scene: "box", replace: false },
  );
});

test("allows game history only after both guaranteed gifts are open", () => {
  const entry = { v: 1, sessionToken: "session-a", scene: "game" };

  assert.deepEqual(
    resolveHistoryTarget(entry, {
      sessionToken: "session-a",
      openedGiftIds: new Set(["cake"]),
      completionMode: null,
    }),
    { scene: "box", replace: true },
  );
  assert.deepEqual(
    resolveHistoryTarget(entry, {
      sessionToken: "session-a",
      openedGiftIds: new Set(["bouquet", "cake"]),
      completionMode: null,
    }),
    { scene: "game", replace: false },
  );
});

test("guards ending history with gift completion and an explicit valid mode", () => {
  const allGifts = new Set(["cake", "bouquet"]);
  const baseEntry = { v: 1, sessionToken: "session-a", scene: "ending" };

  assert.deepEqual(
    resolveHistoryTarget({ ...baseEntry, completionMode: "solved" }, {
      sessionToken: "session-a",
      openedGiftIds: new Set(["cake"]),
      completionMode: "solved",
    }),
    { scene: "box", replace: true },
  );
  assert.deepEqual(
    resolveHistoryTarget(baseEntry, {
      sessionToken: "session-a",
      openedGiftIds: allGifts,
      completionMode: "solved",
    }),
    { scene: "game", replace: true },
  );
  assert.deepEqual(
    resolveHistoryTarget({ ...baseEntry, completionMode: "skipped" }, {
      sessionToken: "session-a",
      openedGiftIds: allGifts,
      completionMode: null,
    }),
    { scene: "ending", completionMode: "skipped", replace: false },
  );
});

test("recovers wrong version, token, or scene to intro", () => {
  const context = {
    sessionToken: "session-a",
    openedGiftIds: new Set(["cake", "bouquet"]),
    completionMode: "solved",
  };
  const invalidEntries = [
    { v: 2, sessionToken: "session-a", scene: "box" },
    { v: 1, sessionToken: "session-b", scene: "box" },
    { v: 1, sessionToken: "session-a", scene: "secret" },
    null,
  ];

  for (const entry of invalidEntries) {
    assert.deepEqual(resolveHistoryTarget(entry, context), {
      scene: "intro",
      replace: true,
    });
  }
});
