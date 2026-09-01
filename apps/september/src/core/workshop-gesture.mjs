export const BRIDGE_DWELL_MS = 500;
export const BRANCH_DWELL_MS = 350;
export const DROPOUT_TOLERANCE_MS = 150;
export const POINTER_HOLD_TOLERANCE_PX = 12;
export const OPEN_PALM_THRESHOLD = 0.65;
export const BRANCH_SELECTION_THRESHOLD = 0.18;
export const BRANCH_NEUTRAL_HYSTERESIS = 0.12;

export const OPENNESS_MARGIN_VERSION = "v1";
export const OPENNESS_FINGER_MARGIN_MIN = 0;
export const OPENNESS_FINGER_MARGIN_MAX = 0.5;
export const OPENNESS_THUMB_MARGIN_MIN = 0.15;
export const OPENNESS_THUMB_MARGIN_MAX = 1;
export const OPENNESS_ENDPOINTS = Object.freeze({
  version: OPENNESS_MARGIN_VERSION,
  finger: Object.freeze({
    min: OPENNESS_FINGER_MARGIN_MIN,
    max: OPENNESS_FINGER_MARGIN_MAX,
  }),
  thumb: Object.freeze({
    min: OPENNESS_THUMB_MARGIN_MIN,
    max: OPENNESS_THUMB_MARGIN_MAX,
  }),
});

const LANDMARK_COUNT = 21;
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const MIDDLE_MCP = 9;
const FINGER_PAIRS = Object.freeze([
  Object.freeze([8, 6]),
  Object.freeze([12, 10]),
  Object.freeze([16, 14]),
  Object.freeze([20, 18]),
]);

const POINTER_RESET_EVENTS = new Set([
  "pointercancel",
  "lostpointercapture",
  "lostcapture",
  "blur",
  "cleanup",
  "sceneexit",
]);

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mapMargin(value, min, max) {
  if (!isFiniteNumber(value)) return 0;
  if (max <= min) return value >= max ? 1 : 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function validateLandmarks(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length !== LANDMARK_COUNT) {
    throw new TypeError("Expected exactly 21 normalized landmarks.");
  }
  for (const landmark of landmarks) {
    if (!landmark || !isFiniteNumber(landmark.x) || !isFiniteNumber(landmark.y)) {
      throw new TypeError("Every landmark must be a normalized landmark with finite x and y.");
    }
    if (landmark.x < 0 || landmark.x > 1 || landmark.y < 0 || landmark.y > 1) {
      throw new RangeError("Every landmark must be a normalized landmark in the 0..1 range.");
    }
  }
}

export function derivePalmOpenness(landmarks) {
  validateLandmarks(landmarks);
  const wrist = landmarks[WRIST];
  const palmScale = distance(wrist, landmarks[MIDDLE_MCP]);
  if (!(palmScale > 0)) {
    throw new RangeError("Wrist-to-middle-MCP palm scale must be greater than zero.");
  }

  const fingerValues = FINGER_PAIRS.map(([tipIndex, pipIndex]) => {
    const margin = (distance(wrist, landmarks[tipIndex]) - distance(wrist, landmarks[pipIndex])) / palmScale;
    return mapMargin(
      margin,
      OPENNESS_FINGER_MARGIN_MIN,
      OPENNESS_FINGER_MARGIN_MAX,
    );
  });
  const thumbMargin = distance(landmarks[THUMB_TIP], landmarks[INDEX_MCP]) / palmScale;
  fingerValues.push(
    mapMargin(
      thumbMargin,
      OPENNESS_THUMB_MARGIN_MIN,
      OPENNESS_THUMB_MARGIN_MAX,
    ),
  );

  return fingerValues.reduce((sum, value) => sum + value, 0) / fingerValues.length;
}

function validNow(now) {
  return isFiniteNumber(now) ? now : null;
}

function cloneGate(gate) {
  return { ...gate };
}

function resetBridge(gate, { keepLock = true } = {}) {
  return {
    ...gate,
    dwellStartedAt: null,
    lastSampleAt: null,
    dropoutStartedAt: null,
    activePointerId: null,
    pointerStartX: null,
    pointerStartY: null,
    locked: keepLock ? Boolean(gate.locked) : false,
  };
}

function openEnough(open) {
  return typeof open === "boolean" ? open : isFiniteNumber(open) && open >= OPEN_PALM_THRESHOLD;
}

function elapsedSince(start, now) {
  return start === null || now === null ? -Infinity : Math.max(0, now - start);
}

function finishBridge(gate, now) {
  if (elapsedSince(gate.dwellStartedAt, now) < BRIDGE_DWELL_MS) {
    return { gate, command: null };
  }
  return {
    gate: { ...gate, locked: true },
    command: "BRIDGE_CONFIRMED",
  };
}

export function createBridgeGate() {
  return Object.freeze({
    dwellStartedAt: null,
    lastSampleAt: null,
    dropoutStartedAt: null,
    activePointerId: null,
    pointerStartX: null,
    pointerStartY: null,
    locked: false,
  });
}

export function advanceBridgeGate(previousGate, sample = {}) {
  const gate = cloneGate(previousGate ?? createBridgeGate());
  const now = validNow(sample.now);
  if (gate.locked || now === null) return { gate, command: null };

  const event = typeof sample.event === "string" ? sample.event : null;
  if (POINTER_RESET_EVENTS.has(event)
    && (event === "blur" || sample.pointerId === undefined || sample.pointerId === gate.activePointerId)) {
    return { gate: resetBridge(gate), command: null };
  }

  if (event === "pointerdown") {
    if (gate.activePointerId !== null || sample.pointerId === undefined || sample.inZone === false) {
      return { gate, command: null };
    }
    const x = sample.x;
    const y = sample.y;
    const next = {
      ...gate,
      activePointerId: sample.pointerId,
      pointerStartX: isFiniteNumber(x) ? x : null,
      pointerStartY: isFiniteNumber(y) ? y : null,
      dwellStartedAt: now,
      lastSampleAt: now,
      dropoutStartedAt: null,
    };
    return { gate: next, command: null };
  }

  if (gate.activePointerId !== null) {
    if (sample.pointerId !== undefined && sample.pointerId !== gate.activePointerId) {
      return { gate, command: null };
    }
    if (event === "pointerup") {
      const matchingPointer = sample.pointerId !== undefined
        && sample.pointerId === gate.activePointerId;
      const finalX = sample.x;
      const finalY = sample.y;
      const validFinalPosition = matchingPointer
        && sample.inZone === true
        && isFiniteNumber(finalX)
        && isFiniteNumber(finalY)
        && isFiniteNumber(gate.pointerStartX)
        && isFiniteNumber(gate.pointerStartY)
        && Math.hypot(finalX - gate.pointerStartX, finalY - gate.pointerStartY)
          <= POINTER_HOLD_TOLERANCE_PX;
      if (!validFinalPosition) {
        return { gate: resetBridge(gate), command: null };
      }
      if (elapsedSince(gate.dwellStartedAt, now) >= BRIDGE_DWELL_MS) {
        return finishBridge(gate, now);
      }
      return { gate: resetBridge(gate), command: null };
    }
    if (event === "pointermove") {
      if (sample.inZone === false) {
        return { gate: resetBridge(gate), command: null };
      }
      const movedX = isFiniteNumber(sample.x) && isFiniteNumber(gate.pointerStartX)
        ? sample.x - gate.pointerStartX
        : 0;
      const movedY = isFiniteNumber(sample.y) && isFiniteNumber(gate.pointerStartY)
        ? sample.y - gate.pointerStartY
        : 0;
      if (Math.hypot(movedX, movedY) > POINTER_HOLD_TOLERANCE_PX) {
        return { gate: resetBridge(gate), command: null };
      }
      const next = { ...gate, lastSampleAt: now };
      return finishBridge(next, now);
    }
    return { gate, command: null };
  }

  const dropout = sample.tracking === false || (sample.open === undefined && sample.inZone === undefined);
  if (dropout) {
    if (gate.lastSampleAt !== null && now - gate.lastSampleAt <= DROPOUT_TOLERANCE_MS) {
      return {
        gate: {
          ...gate,
          lastSampleAt: now,
          dropoutStartedAt: gate.dropoutStartedAt ?? now,
        },
        command: null,
      };
    }
    return { gate: resetBridge(gate), command: null };
  }

  const good = openEnough(sample.open) && sample.inZone === true;
  if (!good) return { gate: resetBridge(gate), command: null };
  const dropoutExpired = gate.dropoutStartedAt !== null
    && now - gate.dropoutStartedAt > DROPOUT_TOLERANCE_MS;
  const next = {
    ...gate,
    dwellStartedAt: dropoutExpired ? now : (gate.dwellStartedAt ?? now),
    lastSampleAt: now,
    dropoutStartedAt: null,
  };
  return finishBridge(next, now);
}

function stagePosition(x, stageWidth) {
  if (!isFiniteNumber(x)) return null;
  if (stageWidth > 1 && x >= 0 && x <= 1) return x * stageWidth;
  return x;
}

function sideForPosition(x, stageWidth, currentSide) {
  const position = stagePosition(x, stageWidth);
  if (position === null) return null;
  const displacement = position - stageWidth / 2;
  const selectionDistance = stageWidth * BRANCH_SELECTION_THRESHOLD;
  const neutralDistance = stageWidth * BRANCH_NEUTRAL_HYSTERESIS;
  if (displacement <= -selectionDistance) return "left";
  if (displacement >= selectionDistance) return "right";
  if (currentSide && Math.abs(displacement) >= neutralDistance) return currentSide;
  return null;
}

function resetForkDwell(gate, { keepLock = true } = {}) {
  return {
    ...gate,
    dwellStartedAt: null,
    lastSampleAt: null,
    dropoutStartedAt: null,
    side: null,
    activePointerId: null,
    pointerStartX: null,
    locked: keepLock ? Boolean(gate.locked) : false,
  };
}

function finishFork(gate, now) {
  if (!gate.side || elapsedSince(gate.dwellStartedAt, now) < BRANCH_DWELL_MS) {
    return { gate, command: null };
  }
  return {
    gate: { ...gate, locked: true },
    command: gate.side === "left" ? "CHOOSE_LEFT" : "CHOOSE_RIGHT",
  };
}

export function createForkGate({ stageWidth = 1 } = {}) {
  if (!isFiniteNumber(stageWidth) || stageWidth <= 0) {
    throw new TypeError("stageWidth must be a positive finite number.");
  }
  return Object.freeze({
    stageWidth,
    dwellStartedAt: null,
    lastSampleAt: null,
    dropoutStartedAt: null,
    side: null,
    activePointerId: null,
    pointerStartX: null,
    locked: false,
  });
}

export function advanceForkGate(previousGate, sample = {}) {
  const gate = cloneGate(previousGate ?? createForkGate());
  const now = validNow(sample.now);
  if (gate.locked || now === null) return { gate, command: null };
  const event = typeof sample.event === "string" ? sample.event : null;

  if (POINTER_RESET_EVENTS.has(event)
    && (event === "blur" || sample.pointerId === undefined || sample.pointerId === gate.activePointerId)) {
    return { gate: resetForkDwell(gate), command: null };
  }

  if (event === "pointerdown") {
    if (gate.activePointerId !== null || sample.pointerId === undefined) {
      return { gate, command: null };
    }
    const x = stagePosition(sample.x, gate.stageWidth);
    return {
      gate: {
        ...gate,
        activePointerId: sample.pointerId,
        pointerStartX: x,
        dwellStartedAt: null,
        lastSampleAt: now,
        dropoutStartedAt: null,
        side: null,
      },
      command: null,
    };
  }

  if (gate.activePointerId !== null) {
    if (sample.pointerId !== undefined && sample.pointerId !== gate.activePointerId) {
      return { gate, command: null };
    }
    if (event === "pointerup") {
      const matchingPointer = sample.pointerId !== undefined
        && sample.pointerId === gate.activePointerId;
      const finalPosition = stagePosition(sample.x, gate.stageWidth);
      const finalSide = matchingPointer && sample.tracking !== false
        ? sideForPosition(finalPosition, gate.stageWidth, gate.side)
        : null;
      if (!matchingPointer || finalSide !== gate.side) {
        return { gate: resetForkDwell(gate), command: null };
      }
      if (elapsedSince(gate.dwellStartedAt, now) >= BRANCH_DWELL_MS) {
        return finishFork({ ...gate, lastSampleAt: now }, now);
      }
      return { gate: resetForkDwell(gate), command: null };
    }
    if (event !== "pointermove") return { gate, command: null };
  } else if (event) {
    return { gate, command: null };
  }

  const position = stagePosition(sample.x, gate.stageWidth);
  if (position === null || sample.tracking === false) {
    if (gate.lastSampleAt !== null && now - gate.lastSampleAt <= DROPOUT_TOLERANCE_MS) {
      return {
        gate: {
          ...gate,
          lastSampleAt: now,
          dropoutStartedAt: gate.dropoutStartedAt ?? now,
        },
        command: null,
      };
    }
    return { gate: resetForkDwell(gate), command: null };
  }

  const nextSide = sideForPosition(position, gate.stageWidth, gate.side);
  if (!nextSide) {
    return {
      gate: {
        ...gate,
        side: null,
        dwellStartedAt: null,
        lastSampleAt: now,
        dropoutStartedAt: null,
      },
      command: null,
    };
  }
  const stale = !event && gate.lastSampleAt !== null && now - gate.lastSampleAt > DROPOUT_TOLERANCE_MS;
  const dropoutExpired = gate.dropoutStartedAt !== null
    && now - gate.dropoutStartedAt > DROPOUT_TOLERANCE_MS;
  const changedSide = gate.side !== nextSide;
  const next = {
    ...gate,
    side: nextSide,
    dwellStartedAt: stale || dropoutExpired || changedSide || gate.dwellStartedAt === null
      ? now
      : gate.dwellStartedAt,
    lastSampleAt: now,
    dropoutStartedAt: null,
  };
  return finishFork(next, now);
}

export function resetPointerGate(gate) {
  return {
    ...gate,
    activePointerId: null,
    dwellStartedAt: null,
    lastSampleAt: null,
    dropoutStartedAt: null,
    side: null,
    pointerStartX: null,
    pointerStartY: null,
    locked: false,
  };
}
