import { INITIAL_DETENTS } from "./puzzle.mjs";

export const GIFT_IDS = Object.freeze(["cake", "bouquet"]);
export const COMPLETION_MODES = Object.freeze(["solved", "skipped"]);

export function createExperienceState({ openedGiftIds = [] } = {}) {
  const safeOrder = openedGiftIds.filter(
    (giftId, index) => GIFT_IDS.includes(giftId) && openedGiftIds.indexOf(giftId) === index,
  );

  return {
    scene: "intro",
    openedGiftIds: new Set(safeOrder),
    openOrder: [...safeOrder],
    activeGiftId: null,
    puzzleDetents: { ...INITIAL_DETENTS },
    completionMode: null,
  };
}

export function commitOpenedGift(state, giftId) {
  if (!GIFT_IDS.includes(giftId)) {
    throw new TypeError(`Unknown September gift: ${String(giftId)}`);
  }

  if (state.openedGiftIds.has(giftId)) {
    return state;
  }

  return {
    ...state,
    openedGiftIds: new Set([...state.openedGiftIds, giftId]),
    openOrder: [...state.openOrder, giftId],
  };
}

function hasAllGifts(openedGiftIds) {
  return GIFT_IDS.every((giftId) => openedGiftIds?.has(giftId));
}

export function resolveHistoryTarget(entry, { sessionToken, openedGiftIds }) {
  if (entry?.v !== 1 || entry.sessionToken !== sessionToken) {
    return { scene: "intro", replace: true };
  }

  if (entry.scene === "intro" || entry.scene === "box") {
    return { scene: entry.scene, replace: false };
  }

  if (entry.scene === "reveal") {
    if (GIFT_IDS.includes(entry.giftId)) {
      return { scene: "reveal", giftId: entry.giftId, replace: false };
    }
    return { scene: "box", replace: true };
  }

  if (entry.scene === "game") {
    return hasAllGifts(openedGiftIds)
      ? { scene: "game", replace: false }
      : { scene: "box", replace: true };
  }

  if (entry.scene === "ending") {
    if (!hasAllGifts(openedGiftIds)) {
      return { scene: "box", replace: true };
    }
    if (!COMPLETION_MODES.includes(entry.completionMode)) {
      return { scene: "game", replace: true };
    }
    return {
      scene: "ending",
      completionMode: entry.completionMode,
      replace: false,
    };
  }

  return { scene: "intro", replace: true };
}
