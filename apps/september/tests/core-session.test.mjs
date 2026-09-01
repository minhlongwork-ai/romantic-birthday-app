import assert from "node:assert/strict";
import test from "node:test";

import {
  commitOpenedGift,
  createExperienceState,
  deriveWorkshopPhase,
  markDeliveryReady,
  resolveHistoryTarget,
  selectWorkshopBranch,
} from "../src/core/session.mjs";

test("the workshop locks a deterministic order and keeps a sealed first envelope secret", () => {
  const selected = selectWorkshopBranch(createExperienceState(), "left");

  assert.deepEqual(selected.deliveryOrder, ["cake", "bouquet"]);
  assert.equal(selected.deliveredCount, 0);

  const ready = markDeliveryReady(selected);
  assert.equal(ready.workshopPhase, "first-envelope-ready");
  assert.deepEqual(ready.openOrder, []);

  const opened = commitOpenedGift(ready, "cake");
  assert.deepEqual(opened.openOrder, ["cake"]);
  assert.equal(deriveWorkshopPhase(opened), "between-gifts");
});

test("the alternate branch locks bouquet before cake", () => {
  const selected = selectWorkshopBranch(createExperienceState(), "right");

  assert.deepEqual(selected.deliveryOrder, ["bouquet", "cake"]);
  assert.equal(selected.workshopPhase, "delivering-first");
  assert.equal(selectWorkshopBranch(selected, "left"), selected);
});

test("fresh workshop state owns only the v2 delivery fields", () => {
  const state = createExperienceState();

  assert.deepEqual(state, {
    scene: "intro",
    deliveryOrder: [],
    deliveredCount: 0,
    openedGiftIds: new Set(),
    openOrder: [],
    activeGiftId: null,
    workshopPhase: "invitation",
  });
});

test("cannot open a gift before its closed envelope is ready", () => {
  const selected = selectWorkshopBranch(createExperienceState(), "left");

  assert.throws(() => commitOpenedGift(selected, "cake"), /Gift is not ready/);
  assert.throws(() => markDeliveryReady(createExperienceState()), /No pending delivery/);
});

test("does not deliver a second envelope while the first is sealed", () => {
  const ready = markDeliveryReady(selectWorkshopBranch(createExperienceState(), "left"));

  assert.throws(() => markDeliveryReady(ready), /still sealed/);
});

test("refuses to commit an unknown gift identifier without changing state", () => {
  const ready = markDeliveryReady(selectWorkshopBranch(createExperienceState(), "left"));
  assert.throws(
    () => commitOpenedGift(ready, "rare-prize"),
    /Unknown September gift/,
  );
  assert.deepEqual(ready.openOrder, []);
});

test("history rejects an unopened reveal and restores its sealed workshop state", () => {
  const state = markDeliveryReady(selectWorkshopBranch(createExperienceState(), "left"));
  const before = {
    deliveredCount: state.deliveredCount,
    openedGiftIds: new Set(state.openedGiftIds),
    openOrder: [...state.openOrder],
  };
  const target = resolveHistoryTarget(
    { v: 2, sessionToken: "session-a", scene: "reveal", giftId: "cake" },
    { sessionToken: "session-a", state },
  );

  assert.deepEqual(target, { scene: "workshop", replace: true });
  assert.equal(state.deliveredCount, before.deliveredCount);
  assert.deepEqual(state.openedGiftIds, before.openedGiftIds);
  assert.deepEqual(state.openOrder, before.openOrder);
});

test("v2 history restores only delivered and opened gifts", () => {
  const opened = commitOpenedGift(
    markDeliveryReady(selectWorkshopBranch(createExperienceState(), "left")),
    "cake",
  );

  assert.deepEqual(
    resolveHistoryTarget(
      { v: 2, sessionToken: "session-a", scene: "reveal", giftId: "cake" },
      { sessionToken: "session-a", state: opened },
    ),
    { scene: "reveal", giftId: "cake", replace: false },
  );
});

test("v2 recovery rejects wrong tokens, versions, and early endings to safe scenes", () => {
  const state = selectWorkshopBranch(createExperienceState(), "left");

  assert.deepEqual(
    resolveHistoryTarget({ v: 2, sessionToken: "other", scene: "workshop" }, {
      sessionToken: "session-a",
      state,
    }),
    { scene: "intro", replace: true },
  );
  assert.deepEqual(
    resolveHistoryTarget({ v: 3, sessionToken: "session-a", scene: "workshop" }, {
      sessionToken: "session-a",
      state,
    }),
    { scene: "intro", replace: true },
  );
  assert.deepEqual(
    resolveHistoryTarget({ v: 2, sessionToken: "session-a", scene: "ending" }, {
      sessionToken: "session-a",
      state,
    }),
    { scene: "workshop", replace: true },
  );
});

test("v2 accepts completion only after both deliveries and reveals", () => {
  const first = commitOpenedGift(
    markDeliveryReady(selectWorkshopBranch(createExperienceState(), "left")),
    "cake",
  );
  const complete = commitOpenedGift(markDeliveryReady(first), "bouquet");

  assert.equal(complete.workshopPhase, "complete");
  assert.deepEqual(
    resolveHistoryTarget(
      { v: 2, sessionToken: "session-a", scene: "ending" },
      { sessionToken: "session-a", state: complete },
    ),
    { scene: "ending", replace: false },
  );
});

test("v1 history entries cannot revive removed NFC or puzzle scenes", () => {
  assert.deepEqual(
    resolveHistoryTarget({ v: 1, sessionToken: "session-a", scene: "reveal", giftId: "cake" }, {
      sessionToken: "session-a",
      state: createExperienceState(),
    }),
    { scene: "intro", replace: true },
  );
});
