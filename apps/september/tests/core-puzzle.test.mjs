import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_DETENTS,
  RING_IDS,
  SOLUTION_DETENTS,
  getPuzzleHint,
  isPuzzleSolved,
  rotateDetent,
  snapAccumulatedDrag,
  shortestAngularDelta,
} from "../src/core/puzzle.mjs";

test("rotates puzzle detents through both modulo-8 boundaries", () => {
  assert.equal(rotateDetent(7, 1), 0);
  assert.equal(rotateDetent(0, -1), 7);
});

test("accumulates the shortest signed angle across the 0/360 seam", () => {
  const samples = [350, 359, 2, 10];
  const accumulated = samples.slice(1).reduce(
    (total, angle, index) => total + shortestAngularDelta(samples[index], angle),
    0,
  );

  assert.equal(accumulated, 20);
  assert.equal(shortestAngularDelta(0, 180), 180);
  assert.equal(shortestAngularDelta(180, 0), 180);
});

test("restores the starting detent for a tap-sized or cancelled drag", () => {
  assert.equal(
    snapAccumulatedDrag({ startDetent: 3, accumulatedDegrees: 90, travelPx: 7.99 }),
    3,
  );
  assert.equal(
    snapAccumulatedDrag({
      startDetent: 3,
      accumulatedDegrees: 90,
      travelPx: 40,
      cancelled: true,
    }),
    3,
  );
});

test("the bow puzzle has two exact ribbon states", () => {
  assert.deepEqual(RING_IDS, ["outer", "inner"]);
  assert.deepEqual(INITIAL_DETENTS, { outer: 1, inner: 5 });
  assert.deepEqual(SOLUTION_DETENTS, { outer: 6, inner: 2 });
  assert.equal(isPuzzleSolved(SOLUTION_DETENTS), true);
  assert.equal(isPuzzleSolved({ outer: 6, inner: 1 }), false);
});

test("hint order is outer then inner", () => {
  assert.deepEqual(getPuzzleHint({ outer: 2, inner: 2 }), {
    ringId: "outer",
    direction: "clockwise",
    steps: 4,
  });
  assert.equal(getPuzzleHint(SOLUTION_DETENTS), null);
});

test("snaps half-detents clockwise and treats exactly 8 CSS px as a drag", () => {
  assert.equal(
    snapAccumulatedDrag({ startDetent: 0, accumulatedDegrees: 22.5, travelPx: 8 }),
    1,
  );
  assert.equal(
    snapAccumulatedDrag({ startDetent: 0, accumulatedDegrees: -22.5, travelPx: 8 }),
    0,
  );
  assert.equal(
    snapAccumulatedDrag({ startDetent: 0, accumulatedDegrees: -67.5, travelPx: 8 }),
    7,
  );
});
