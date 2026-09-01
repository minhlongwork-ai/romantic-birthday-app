import assert from "node:assert/strict";
import test from "node:test";

import {
  BRANCH_DWELL_MS,
  BRIDGE_DWELL_MS,
  DROPOUT_TOLERANCE_MS,
  OPEN_PALM_THRESHOLD,
  POINTER_HOLD_TOLERANCE_PX,
  advanceBridgeGate,
  advanceForkGate,
  createBridgeGate,
  createForkGate,
  derivePalmOpenness,
  resetPointerGate,
  sanitizeCameraSample,
} from "../src/core/workshop-gesture.mjs";

const POINTS = 21;

function point(x, y) {
  return { x, y, z: 0 };
}

function canonicalHand({ extension = 1, thumb = 1 } = {}) {
  const landmarks = Array.from({ length: POINTS }, () => point(0.5, 0.5));
  landmarks[0] = point(0.5, 0.8);
  landmarks[5] = point(0.42, 0.62);
  landmarks[9] = point(0.5, 0.58);
  landmarks[13] = point(0.58, 0.62);
  landmarks[17] = point(0.64, 0.68);

  const fingers = [
    [6, 7, 8, 0.34],
    [10, 11, 12, 0.42],
    [14, 15, 16, 0.38],
    [18, 19, 20, 0.30],
  ];
  for (const [pip, dip, tip, distance] of fingers) {
    const mcp = landmarks[tip - 3];
    const pipDistance = 0.12;
    const tipDistance = pipDistance + distance * extension;
    landmarks[pip] = point(mcp.x, mcp.y - pipDistance);
    landmarks[dip] = point(mcp.x, mcp.y - (pipDistance + tipDistance) / 2);
    landmarks[tip] = point(mcp.x, mcp.y - tipDistance);
  }

  landmarks[1] = point(0.47, 0.75);
  landmarks[2] = point(0.39, 0.73);
  landmarks[3] = point(0.35, 0.68);
  landmarks[4] = point(0.30 + 0.16 * thumb, 0.60);
  return landmarks;
}

function transformHand(landmarks, { angle = 0, mirror = false, scale = 1 } = {}) {
  const origin = landmarks[0];
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  return landmarks.map(({ x, y, z = 0 }) => {
    const dx = (x - origin.x) * scale;
    const dy = (y - origin.y) * scale;
    const rotatedX = dx * cos - dy * sin;
    const rotatedY = dx * sin + dy * cos;
    return point(
      Math.max(0, Math.min(1, origin.x + (mirror ? -rotatedX : rotatedX))),
      Math.max(0, Math.min(1, origin.y + rotatedY)),
    );
  });
}

function advance(gate, sample) {
  return advanceForkGate(gate, sample);
}

test("derivePalmOpenness requires exactly 21 normalized landmarks", () => {
  assert.throws(() => derivePalmOpenness([]), /21 normalized landmarks/);
  assert.throws(
    () => derivePalmOpenness(Array.from({ length: 21 }, () => point(2, 0.5))),
    /normalized landmark/,
  );
});

test("sanitizeCameraSample passes only normalized worker gesture data to input adapters", () => {
  assert.deepEqual(sanitizeCameraSample({
    generation: 4,
    sequence: 2,
    timestampMs: 120,
    tracking: true,
    palmX: 0.25,
    palmY: 0.75,
    openness: 0.9,
    landmarks: canonicalHand(),
    bitmap: "not allowed",
  }), {
    generation: 4,
    sequence: 2,
    timestampMs: 120,
    tracking: true,
    palmX: 0.25,
    palmY: 0.75,
    openness: 0.9,
  });
  assert.equal(sanitizeCameraSample({ tracking: true, palmX: 2 }), null);
  assert.deepEqual(sanitizeCameraSample({
    generation: 4,
    sequence: 3,
    timestampMs: 121,
    tracking: false,
    rawFrame: "not allowed",
  }), {
    generation: 4,
    sequence: 3,
    timestampMs: 121,
    tracking: false,
  });
});

test("open and closed synthetic hands separate at the calibrated threshold", () => {
  assert.ok(derivePalmOpenness(canonicalHand()) >= OPEN_PALM_THRESHOLD);
  assert.ok(derivePalmOpenness(canonicalHand({ extension: 0, thumb: 0 })) < OPEN_PALM_THRESHOLD);
});

test("openness is invariant to scale, rotation, and horizontal mirroring", () => {
  const open = derivePalmOpenness(canonicalHand());
  assert.ok(Math.abs(derivePalmOpenness(transformHand(canonicalHand(), { scale: 0.7 })) - open) < 0.03);
  assert.ok(Math.abs(derivePalmOpenness(transformHand(canonicalHand(), { angle: 0.35 })) - open) < 0.03);
  assert.ok(Math.abs(derivePalmOpenness(transformHand(canonicalHand(), { mirror: true })) - open) < 0.03);
});

test("partial extension stays between closed and open and tolerates small landmark noise", () => {
  const closed = derivePalmOpenness(canonicalHand({ extension: 0, thumb: 0 }));
  const partial = derivePalmOpenness(canonicalHand({ extension: 0.25, thumb: 0.25 }));
  const open = derivePalmOpenness(canonicalHand());
  assert.ok(closed < partial);
  assert.ok(partial < open);
  const noisy = canonicalHand().map(({ x, y }) => point(x + 0.003, y - 0.002));
  assert.ok(Math.abs(derivePalmOpenness(noisy) - open) < 0.03);
});

test("bridge openness threshold is inclusive", () => {
  let gate = createBridgeGate();
  ({ gate } = advanceBridgeGate(gate, { now: 0, open: OPEN_PALM_THRESHOLD - 0.001, inZone: true }));
  assert.equal(gate.dwellStartedAt, null);
  ({ gate } = advanceBridgeGate(gate, { now: 1, open: OPEN_PALM_THRESHOLD, inZone: true }));
  assert.equal(gate.dwellStartedAt, 1);
});

test("bridge emits once after 500 ms and tolerates only a 150 ms sample gap", () => {
  let gate = createBridgeGate();
  ({ gate } = advanceBridgeGate(gate, { now: 0, open: true, inZone: true }));
  ({ gate } = advanceBridgeGate(gate, { now: 350, open: true, inZone: true }));
  const result = advanceBridgeGate(gate, { now: 500, open: true, inZone: true });
  assert.equal(result.command, "BRIDGE_CONFIRMED");
  assert.equal(advanceBridgeGate(result.gate, { now: 700, open: true, inZone: true }).command, null);
  assert.equal(BRIDGE_DWELL_MS, 500);
  assert.equal(DROPOUT_TOLERANCE_MS, 150);
});

test("bridge dropout beyond tolerance restarts the dwell", () => {
  let gate = createBridgeGate();
  ({ gate } = advanceBridgeGate(gate, { now: 0, open: true, inZone: true }));
  ({ gate } = advanceBridgeGate(gate, { now: DROPOUT_TOLERANCE_MS + 1, tracking: false }));
  ({ gate } = advanceBridgeGate(gate, { now: 500, open: true, inZone: true }));
  assert.equal(gate.dwellStartedAt, 500);
  ({ gate } = advanceBridgeGate(gate, { now: DROPOUT_TOLERANCE_MS + 1 + BRIDGE_DWELL_MS, open: true, inZone: true }));
  assert.equal(gate.locked, false);
  assert.equal(advanceBridgeGate(gate, { now: DROPOUT_TOLERANCE_MS + 1 + BRIDGE_DWELL_MS * 2, open: true, inZone: true }).command, "BRIDGE_CONFIRMED");
});

test("bridge does not carry a dwell through an unreported dropout", () => {
  let gate = createBridgeGate();
  ({ gate } = advanceBridgeGate(gate, { now: 0, open: true, inZone: true }));
  ({ gate } = advanceBridgeGate(gate, { now: 100, tracking: false }));
  ({ gate } = advanceBridgeGate(gate, { now: 300, open: true, inZone: true }));
  assert.equal(advanceBridgeGate(gate, { now: 500, open: true, inZone: true }).command, null);
  assert.equal(advanceBridgeGate(gate, { now: 800, open: true, inZone: true }).command, "BRIDGE_CONFIRMED");
});

test("bridge resets on closed palm, leaving zone, and pointer movement beyond tolerance", () => {
  let gate = createBridgeGate();
  ({ gate } = advanceBridgeGate(gate, { now: 0, open: true, inZone: true }));
  ({ gate } = advanceBridgeGate(gate, { now: 200, open: false, inZone: true }));
  assert.equal(advanceBridgeGate(gate, { now: 500, open: true, inZone: true }).command, null);

  ({ gate } = advanceBridgeGate(gate, { now: 600, open: true, inZone: true }));
  ({ gate } = advanceBridgeGate(gate, { now: 700, open: true, inZone: false }));
  assert.equal(advanceBridgeGate(gate, { now: 1_100, open: true, inZone: true }).command, null);

  ({ gate } = advanceBridgeGate(gate, { now: 1_200, event: "pointerdown", pointerId: 1, x: 100, y: 20 }));
  ({ gate } = advanceBridgeGate(gate, { now: 1_300, event: "pointermove", pointerId: 1, x: 100 + POINTER_HOLD_TOLERANCE_PX + 1, y: 20 }));
  assert.equal(advanceBridgeGate(gate, { now: 1_800, event: "pointerup", pointerId: 1, x: 120, y: 20 }).command, null);
});

test("bridge pointer ownership ignores secondary pointers and cancellation events", () => {
  let gate = createBridgeGate();
  ({ gate } = advanceBridgeGate(gate, { now: 0, event: "pointerdown", pointerId: 1, x: 10, y: 10 }));
  const secondary = advanceBridgeGate(gate, { now: 30, event: "pointerdown", pointerId: 2, x: 10, y: 10 });
  assert.equal(secondary.gate.activePointerId, 1);
  ({ gate } = advanceBridgeGate(secondary.gate, { now: 40, event: "pointercancel", pointerId: 2 }));
  assert.equal(gate.activePointerId, 1);
  ({ gate } = advanceBridgeGate(gate, { now: 50, event: "lostpointercapture", pointerId: 1 }));
  assert.equal(gate.activePointerId, null);
});

test("bridge pointer-up requires the primary id and a valid final hold sample", () => {
  let gate = createBridgeGate();
  ({ gate } = advanceBridgeGate(gate, { now: 0, event: "pointerdown", pointerId: 1, x: 100, y: 20 }));
  ({ gate } = advanceBridgeGate(gate, { now: 100, event: "pointermove", pointerId: 1, x: 100, y: 20 }));
  const mismatched = advanceBridgeGate(gate, { now: 500, event: "pointerup", pointerId: 2, x: 100, y: 20 });
  assert.equal(mismatched.command, null);
  assert.equal(mismatched.gate.activePointerId, 1);

  ({ gate } = advanceBridgeGate(createBridgeGate(), { now: 0, event: "pointerdown", pointerId: 1, x: 100, y: 20 }));
  const idless = advanceBridgeGate(gate, { now: 500, event: "pointerup", x: 100, y: 20 });
  assert.equal(idless.command, null);
  assert.equal(idless.gate.activePointerId, null);

  ({ gate } = advanceBridgeGate(createBridgeGate(), { now: 0, event: "pointerdown", pointerId: 1, x: 100, y: 20 }));
  const outOfZone = advanceBridgeGate(gate, { now: 500, event: "pointerup", pointerId: 1, x: 100, y: 20, inZone: false });
  assert.equal(outOfZone.command, null);
  assert.equal(outOfZone.gate.activePointerId, null);

  ({ gate } = advanceBridgeGate(createBridgeGate(), { now: 0, event: "pointerdown", pointerId: 1, x: 100, y: 20 }));
  const moved = advanceBridgeGate(gate, { now: 500, event: "pointerup", pointerId: 1, x: 100 + POINTER_HOLD_TOLERANCE_PX + 1, y: 20 });
  assert.equal(moved.command, null);
  assert.equal(moved.gate.activePointerId, null);

  ({ gate } = advanceBridgeGate(createBridgeGate(), { now: 0, event: "pointerdown", pointerId: 1, x: 100, y: 20, inZone: true }));
  const valid = advanceBridgeGate(gate, { now: 500, event: "pointerup", pointerId: 1, x: 100, y: 20, inZone: true });
  assert.equal(valid.command, "BRIDGE_CONFIRMED");
});

test("bridge secondary pointer-up preserves the primary hold gate", () => {
  let gate = createBridgeGate();
  ({ gate } = advanceBridgeGate(gate, {
    now: 0,
    event: "pointerdown",
    pointerId: 1,
    x: 100,
    y: 20,
    inZone: true,
  }));
  ({ gate } = advanceBridgeGate(gate, {
    now: 100,
    event: "pointermove",
    pointerId: 1,
    x: 100,
    y: 20,
    inZone: true,
  }));
  const before = structuredClone(gate);
  const secondary = advanceBridgeGate(gate, {
    now: 200,
    event: "pointerup",
    pointerId: 2,
    x: 100 + POINTER_HOLD_TOLERANCE_PX + 20,
    y: 20,
    inZone: false,
  });
  assert.equal(secondary.command, null);
  assert.deepEqual(secondary.gate, before);
});

test("fork drag never chooses on early up, cancel, loss of capture, or a secondary pointer", () => {
  let gate = createForkGate({ stageWidth: 300 });
  ({ gate } = advance(gate, { now: 0, x: 150, event: "pointerdown", pointerId: 1 }));
  const second = advance(gate, { now: 40, x: 70, event: "pointerdown", pointerId: 2 });
  assert.equal(second.command, null);
  assert.equal(second.gate.activePointerId, 1);
  ({ gate } = advance(second.gate, { now: 80, x: 230, event: "pointermove", pointerId: 1 }));
  const earlyUp = advance(gate, { now: 300, x: 230, event: "pointerup", pointerId: 1 });
  assert.equal(earlyUp.command, null);
  assert.equal(earlyUp.gate.activePointerId, null);
});

test("fork emits left or right only after 350 ms beyond the 18 percent threshold", () => {
  let left = createForkGate({ stageWidth: 300 });
  ({ gate: left } = advance(left, { now: 0, x: 150, event: "pointerdown", pointerId: 1 }));
  ({ gate: left } = advance(left, { now: 10, x: 90, event: "pointermove", pointerId: 1 }));
  assert.equal(advance(left, { now: 10 + BRANCH_DWELL_MS - 1, x: 90, event: "pointermove", pointerId: 1 }).command, null);
  assert.equal(advance(left, { now: 10 + BRANCH_DWELL_MS, x: 90, event: "pointermove", pointerId: 1 }).command, "CHOOSE_LEFT");

  let right = createForkGate({ stageWidth: 300 });
  ({ gate: right } = advance(right, { now: 0, x: 150, event: "pointerdown", pointerId: 1 }));
  ({ gate: right } = advance(right, { now: 10, x: 210, event: "pointermove", pointerId: 1 }));
  assert.equal(advance(right, { now: 10 + BRANCH_DWELL_MS, x: 210, event: "pointermove", pointerId: 1 }).command, "CHOOSE_RIGHT");
});

test("fork pointer-up at the dwell boundary may confirm, but early release resets", () => {
  let gate = createForkGate({ stageWidth: 300 });
  ({ gate } = advance(gate, { now: 0, x: 150, event: "pointerdown", pointerId: 1 }));
  ({ gate } = advance(gate, { now: 10, x: 230, event: "pointermove", pointerId: 1 }));
  ({ gate } = advance(gate, { now: 10 + BRANCH_DWELL_MS - 1, x: 230, event: "pointerup", pointerId: 1 }));
  ({ gate } = advance(gate, { now: 100, x: 150, event: "pointerdown", pointerId: 1 }));
  ({ gate } = advance(gate, { now: 110, x: 230, event: "pointermove", pointerId: 1 }));
  assert.equal(advance(gate, { now: 110 + BRANCH_DWELL_MS, x: 230, event: "pointerup", pointerId: 1 }).command, "CHOOSE_RIGHT");
});

test("fork pointer-up requires the primary id and the final position to keep the side", () => {
  let gate = createForkGate({ stageWidth: 300 });
  ({ gate } = advance(gate, { now: 0, x: 150, event: "pointerdown", pointerId: 1 }));
  ({ gate } = advance(gate, { now: 10, x: 230, event: "pointermove", pointerId: 1 }));
  const mismatched = advance(gate, { now: 360, x: 230, event: "pointerup", pointerId: 2 });
  assert.equal(mismatched.command, null);
  assert.equal(mismatched.gate.activePointerId, 1);

  ({ gate } = advance(createForkGate({ stageWidth: 300 }), { now: 0, x: 150, event: "pointerdown", pointerId: 1 }));
  ({ gate } = advance(gate, { now: 10, x: 230, event: "pointermove", pointerId: 1 }));
  const idless = advance(gate, { now: 360, x: 230, event: "pointerup" });
  assert.equal(idless.command, null);
  assert.equal(idless.gate.activePointerId, null);

  ({ gate } = advance(createForkGate({ stageWidth: 300 }), { now: 0, x: 150, event: "pointerdown", pointerId: 1 }));
  ({ gate } = advance(gate, { now: 10, x: 230, event: "pointermove", pointerId: 1 }));
  const neutral = advance(gate, { now: 360, x: 150, event: "pointerup", pointerId: 1 });
  assert.equal(neutral.command, null);
  assert.equal(neutral.gate.activePointerId, null);

  ({ gate } = advance(createForkGate({ stageWidth: 300 }), { now: 0, x: 150, event: "pointerdown", pointerId: 1 }));
  ({ gate } = advance(gate, { now: 10, x: 230, event: "pointermove", pointerId: 1 }));
  const opposite = advance(gate, { now: 360, x: 70, event: "pointerup", pointerId: 1 });
  assert.equal(opposite.command, null);
  assert.equal(opposite.gate.activePointerId, null);

  ({ gate } = advance(createForkGate({ stageWidth: 300 }), { now: 0, x: 150, event: "pointerdown", pointerId: 1 }));
  ({ gate } = advance(gate, { now: 10, x: 230, event: "pointermove", pointerId: 1 }));
  const invalid = advance(gate, { now: 360, x: undefined, event: "pointerup", pointerId: 1 });
  assert.equal(invalid.command, null);
  assert.equal(invalid.gate.activePointerId, null);
});

test("fork secondary pointer-up preserves the primary side dwell", () => {
  let gate = createForkGate({ stageWidth: 300 });
  ({ gate } = advance(gate, { now: 0, x: 150, event: "pointerdown", pointerId: 1 }));
  ({ gate } = advance(gate, { now: 10, x: 230, event: "pointermove", pointerId: 1 }));
  const before = structuredClone(gate);
  const secondary = advance(gate, {
    now: 200,
    x: 70,
    event: "pointerup",
    pointerId: 2,
  });
  assert.equal(secondary.command, null);
  assert.deepEqual(secondary.gate, before);
});

test("fork threshold boundaries and neutral hysteresis prevent direction flicker", () => {
  let gate = createForkGate({ stageWidth: 300 });
  ({ gate } = advance(gate, { now: 0, x: 150, event: "pointerdown", pointerId: 1 }));
  ({ gate } = advance(gate, { now: 10, x: 150 - 54, event: "pointermove", pointerId: 1 }));
  assert.equal(gate.side, "left");
  ({ gate } = advance(gate, { now: 100, x: 150 - 36, event: "pointermove", pointerId: 1 }));
  assert.equal(gate.side, "left");
  ({ gate } = advance(gate, { now: 200, x: 150 - 35, event: "pointermove", pointerId: 1 }));
  assert.equal(gate.side, null);
});

test("fork dropout up to 150 ms preserves dwell and a longer dropout restarts it", () => {
  let gate = createForkGate({ stageWidth: 300 });
  ({ gate } = advance(gate, { now: 0, x: 150 }));
  ({ gate } = advance(gate, { now: 1, x: 230 }));
  ({ gate } = advance(gate, { now: 1 + DROPOUT_TOLERANCE_MS, x: undefined, tracking: false }));
  ({ gate } = advance(gate, { now: 300, x: 230 }));
  assert.equal(advance(gate, { now: 1 + BRANCH_DWELL_MS, x: 230 }).command, "CHOOSE_RIGHT");

  gate = createForkGate({ stageWidth: 300 });
  ({ gate } = advance(gate, { now: 0, x: 150 }));
  ({ gate } = advance(gate, { now: 1, x: 230 }));
  ({ gate } = advance(gate, { now: 1 + DROPOUT_TOLERANCE_MS + 1, x: undefined, tracking: false }));
  assert.equal(advance(gate, { now: 1 + DROPOUT_TOLERANCE_MS + 1 + BRANCH_DWELL_MS, x: 230 }).command, null);
});

test("fork command locks once and resetPointerGate creates an unlocked neutral gate", () => {
  let gate = createForkGate({ stageWidth: 300 });
  ({ gate } = advance(gate, { now: 0, x: 150, event: "pointerdown", pointerId: 1 }));
  ({ gate } = advance(gate, { now: 1, x: 230, event: "pointermove", pointerId: 1 }));
  const result = advance(gate, { now: 1 + BRANCH_DWELL_MS, x: 230, event: "pointermove", pointerId: 1 });
  assert.equal(result.command, "CHOOSE_RIGHT");
  assert.equal(advanceForkGate(result.gate, { now: 900, x: 70 }).command, null);
  assert.equal(resetPointerGate(result.gate).activePointerId, null);
  assert.equal(resetPointerGate(result.gate).dwellStartedAt, null);
  assert.equal(resetPointerGate(result.gate).side, null);
  assert.equal(resetPointerGate(result.gate).locked, false);
});

test("fork blur and cleanup reset pointer ownership without commanding", () => {
  let gate = createForkGate({ stageWidth: 300 });
  ({ gate } = advance(gate, { now: 0, x: 150, event: "pointerdown", pointerId: 1 }));
  ({ gate } = advance(gate, { now: 50, x: 230, event: "pointermove", pointerId: 1 }));
  const blurred = advance(gate, { now: 100, event: "blur", pointerId: 1 });
  assert.equal(blurred.command, null);
  assert.equal(blurred.gate.activePointerId, null);
  assert.equal(advanceForkGate(blurred.gate, { now: 500, x: 230 }).command, null);
});

test("pointercancel, lost capture, and cleanup each reset the active fork pointer", () => {
  for (const event of ["pointercancel", "lostpointercapture", "cleanup"]) {
    let gate = createForkGate({ stageWidth: 300 });
    ({ gate } = advance(gate, { now: 0, x: 150, event: "pointerdown", pointerId: 1 }));
    ({ gate } = advance(gate, { now: 50, x: 230, event: "pointermove", pointerId: 1 }));
    const result = advance(gate, { now: 100, x: 230, event, pointerId: 1 });
    assert.equal(result.command, null);
    assert.equal(result.gate.activePointerId, null);
    assert.equal(result.gate.side, null);
  }
});

test("advance and reset never mutate their input gate", () => {
  let gate = createForkGate({ stageWidth: 300 });
  const original = structuredClone(gate);
  const advanced = advance(gate, { now: 0, x: 150, event: "pointerdown", pointerId: 1 });
  assert.deepEqual(gate, original);
  const reset = resetPointerGate(gate);
  assert.deepEqual(gate, original);
  assert.notEqual(advanced.gate, gate);
  assert.notEqual(reset, gate);

  const bridge = createBridgeGate();
  const bridgeOriginal = structuredClone(bridge);
  const bridgeAdvanced = advanceBridgeGate(bridge, {
    now: 0,
    event: "pointerdown",
    pointerId: 1,
    x: 10,
    y: 10,
  });
  assert.deepEqual(bridge, bridgeOriginal);
  assert.deepEqual(resetPointerGate(bridge), {
    ...bridgeOriginal,
    activePointerId: null,
    dwellStartedAt: null,
    lastSampleAt: null,
    dropoutStartedAt: null,
    side: null,
    pointerStartX: null,
    pointerStartY: null,
    locked: false,
  });
  assert.notEqual(bridgeAdvanced.gate, bridge);
});
