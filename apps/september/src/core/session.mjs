import { INITIAL_DETENTS } from "./puzzle.mjs";

export const GIFT_IDS = Object.freeze(["cake", "bouquet"]);
export const COMPLETION_MODES = Object.freeze(["solved", "skipped"]);
export const WORKSHOP_PHASES = Object.freeze([
  "invitation",
  "bridge",
  "fork",
  "delivering-first",
  "first-envelope-ready",
  "between-gifts",
  "delivering-second",
  "second-envelope-ready",
  "complete",
]);

const DELIVERY_ORDER_BY_SIDE = Object.freeze({
  left: Object.freeze(["cake", "bouquet"]),
  right: Object.freeze(["bouquet", "cake"]),
});

function uniqueKnownGiftIds(giftIds) {
  if (!Array.isArray(giftIds)) return [];
  return giftIds.filter(
    (giftId, index) => GIFT_IDS.includes(giftId) && giftIds.indexOf(giftId) === index,
  );
}

function legacyDeliveryOrder(openOrder) {
  return [...openOrder, ...GIFT_IDS.filter((giftId) => !openOrder.includes(giftId))];
}

export function createExperienceState({ openedGiftIds = [], legacy = false } = {}) {
  const safeOrder = uniqueKnownGiftIds(openedGiftIds);
  // This adapter lets the legacy NFC scene stay importable until Task 9 removes it.
  const deliveryOrder = legacy
    ? legacyDeliveryOrder(safeOrder)
    : safeOrder.length > 0
      ? legacyDeliveryOrder(safeOrder)
      : [];
  const state = {
    scene: "intro",
    deliveryOrder,
    deliveredCount: legacy ? deliveryOrder.length : safeOrder.length,
    openedGiftIds: new Set(safeOrder),
    openOrder: [...safeOrder],
    activeGiftId: null,
    workshopPhase: "invitation",
    puzzleDetents: { ...INITIAL_DETENTS },
    completionMode: null,
  };

  return deliveryOrder.length > 0
    ? { ...state, workshopPhase: deriveWorkshopPhase(state) }
    : state;
}

export function deriveWorkshopPhase(state) {
  const deliveryOrder = Array.isArray(state?.deliveryOrder) ? state.deliveryOrder : [];
  const deliveredCount = Number.isInteger(state?.deliveredCount)
    ? state.deliveredCount
    : 0;
  const openedGiftIds = state?.openedGiftIds instanceof Set
    ? state.openedGiftIds
    : new Set();

  if (deliveryOrder.length === 0) {
    return ["invitation", "bridge", "fork"].includes(state?.workshopPhase)
      ? state.workshopPhase
      : "invitation";
  }
  if (deliveredCount <= 0) return "delivering-first";

  const [firstGiftId, secondGiftId] = deliveryOrder;
  const openedFirst = openedGiftIds.has(firstGiftId);
  const openedSecond = openedGiftIds.has(secondGiftId);
  if (deliveredCount === 1) {
    return openedFirst ? "between-gifts" : "first-envelope-ready";
  }
  if (openedFirst && openedSecond) return "complete";
  return openedFirst ? "second-envelope-ready" : "first-envelope-ready";
}

export function selectWorkshopBranch(state, side) {
  const deliveryOrder = DELIVERY_ORDER_BY_SIDE[side];
  if (!deliveryOrder) throw new TypeError(`Unknown workshop branch: ${String(side)}`);
  if (Array.isArray(state?.deliveryOrder) && state.deliveryOrder.length > 0) return state;

  const next = {
    ...state,
    deliveryOrder: [...deliveryOrder],
    deliveredCount: 0,
    openedGiftIds: new Set(),
    openOrder: [],
    activeGiftId: null,
  };
  return { ...next, workshopPhase: deriveWorkshopPhase(next) };
}

export function markDeliveryReady(state) {
  const deliveryOrder = Array.isArray(state?.deliveryOrder) ? state.deliveryOrder : [];
  const deliveredCount = Number.isInteger(state?.deliveredCount)
    ? state.deliveredCount
    : 0;
  if (deliveredCount >= deliveryOrder.length) throw new RangeError("No pending delivery.");
  if (deliveredCount > (state?.openedGiftIds?.size ?? 0)) {
    throw new TypeError("Current delivery is still sealed.");
  }

  const next = { ...state, deliveredCount: deliveredCount + 1 };
  return { ...next, workshopPhase: deriveWorkshopPhase(next) };
}

export function commitOpenedGift(state, giftId) {
  if (!GIFT_IDS.includes(giftId)) {
    throw new TypeError(`Unknown September gift: ${String(giftId)}`);
  }
  const readyGiftIds = state?.deliveryOrder?.slice(0, state.deliveredCount) ?? [];
  if (!readyGiftIds.includes(giftId)) throw new TypeError("Gift is not ready.");
  if (state.openedGiftIds.has(giftId)) return state;

  const openedGiftIds = new Set([...state.openedGiftIds, giftId]);
  const next = {
    ...state,
    openedGiftIds,
    openOrder: [...state.openOrder, giftId],
    activeGiftId: giftId,
  };
  return { ...next, workshopPhase: deriveWorkshopPhase(next) };
}

export function reduceWorkshopState(state, action) {
  switch (action?.type) {
    case "BRIDGE_CONFIRMED":
      if (state.workshopPhase !== "invitation" && state.workshopPhase !== "bridge") {
        return state;
      }
      return { ...state, workshopPhase: "fork" };
    case "CHOOSE_LEFT":
      return selectWorkshopBranch(state, "left");
    case "CHOOSE_RIGHT":
      return selectWorkshopBranch(state, "right");
    case "DELIVERY_READY":
      return markDeliveryReady(state);
    case "GIFT_MOUNTED":
      return commitOpenedGift(state, action.giftId);
    default:
      return state;
  }
}

function hasAllGifts(openedGiftIds) {
  return GIFT_IDS.every((giftId) => openedGiftIds?.has(giftId));
}

function resolveV1HistoryTarget(entry, { sessionToken, openedGiftIds }) {
  if (entry.sessionToken !== sessionToken) return { scene: "intro", replace: true };

  if (entry.scene === "intro" || entry.scene === "box") {
    return { scene: entry.scene, replace: false };
  }
  if (entry.scene === "reveal") {
    return GIFT_IDS.includes(entry.giftId)
      ? { scene: "reveal", giftId: entry.giftId, replace: false }
      : { scene: "box", replace: true };
  }
  if (entry.scene === "game") {
    return hasAllGifts(openedGiftIds)
      ? { scene: "game", replace: false }
      : { scene: "box", replace: true };
  }
  if (entry.scene === "ending") {
    if (!hasAllGifts(openedGiftIds)) return { scene: "box", replace: true };
    if (!COMPLETION_MODES.includes(entry.completionMode)) {
      return { scene: "game", replace: true };
    }
    return { scene: "ending", completionMode: entry.completionMode, replace: false };
  }
  return { scene: "intro", replace: true };
}

function deliveredAndOpened(state, giftId) {
  return state?.deliveryOrder?.slice(0, state.deliveredCount).includes(giftId)
    && state.openedGiftIds?.has(giftId);
}

function resolveV2HistoryTarget(entry, { sessionToken, state }) {
  if (entry.sessionToken !== sessionToken) return { scene: "intro", replace: true };
  if (!state || !Array.isArray(state.deliveryOrder) || !(state.openedGiftIds instanceof Set)) {
    return { scene: "workshop", replace: true };
  }
  if (entry.scene === "intro") return { scene: "intro", replace: false };
  if (entry.scene === "workshop") return { scene: "workshop", replace: false };
  if (entry.scene === "reveal") {
    return deliveredAndOpened(state, entry.giftId)
      ? { scene: "reveal", giftId: entry.giftId, replace: false }
      : { scene: "workshop", replace: true };
  }
  if (entry.scene === "ending") {
    return deriveWorkshopPhase(state) === "complete"
      ? { scene: "ending", replace: false }
      : { scene: "workshop", replace: true };
  }
  return { scene: "workshop", replace: true };
}

export function resolveHistoryTarget(entry, context = {}) {
  if (entry?.v === 1) return resolveV1HistoryTarget(entry, context);
  if (entry?.v === 2) return resolveV2HistoryTarget(entry, context);
  return { scene: "intro", replace: true };
}
