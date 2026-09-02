const DETENT_COUNT = 8;

export const RING_IDS = Object.freeze(["outer", "inner"]);
export const INITIAL_DETENTS = Object.freeze({ outer: 1, inner: 5 });
export const SOLUTION_DETENTS = Object.freeze({ outer: 6, inner: 2 });

export function rotateDetent(detent, steps) {
  return ((detent + steps) % DETENT_COUNT + DETENT_COUNT) % DETENT_COUNT;
}

export function shortestAngularDelta(previousDegrees, currentDegrees) {
  let delta = ((currentDegrees - previousDegrees) % 360 + 360) % 360;
  if (delta > 180) {
    delta -= 360;
  }
  return delta;
}

export function snapAccumulatedDrag({
  startDetent,
  accumulatedDegrees,
  travelPx,
  cancelled = false,
}) {
  if (cancelled || travelPx < 8) {
    return startDetent;
  }

  return rotateDetent(startDetent, Math.floor(accumulatedDegrees / 45 + 0.5));
}

export function isPuzzleSolved(detents) {
  return RING_IDS.every((ringId) => detents?.[ringId] === SOLUTION_DETENTS[ringId]);
}

export function getPuzzleHint(detents) {
  const ringId = RING_IDS.find((id) => detents?.[id] !== SOLUTION_DETENTS[id]);
  if (!ringId) {
    return null;
  }

  const clockwiseSteps = rotateDetent(SOLUTION_DETENTS[ringId] - detents[ringId], 0);
  if (clockwiseSteps <= DETENT_COUNT / 2) {
    return { ringId, direction: "clockwise", steps: clockwiseSteps };
  }

  return {
    ringId,
    direction: "counterclockwise",
    steps: DETENT_COUNT - clockwiseSteps,
  };
}
