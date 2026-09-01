export const GIFT_IDS = Object.freeze(["cake", "bouquet"]);

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

function hasKnownState(state) {
  return Boolean(
    state
      && Array.isArray(state.deliveryOrder)
      && Number.isInteger(state.deliveredCount)
      && state.openedGiftIds instanceof Set,
  );
}

export function createExperienceState() {
  return {
    scene: "intro",
    deliveryOrder: [],
    deliveredCount: 0,
    openedGiftIds: new Set(),
    openOrder: [],
    activeGiftId: null,
    workshopPhase: "invitation",
  };
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
    default:
      return state;
  }
}

function deliveredAndOpened(state, giftId) {
  return state?.deliveryOrder?.slice(0, state.deliveredCount).includes(giftId)
    && state.openedGiftIds?.has(giftId);
}

export function resolveHistoryTarget(entry, { sessionToken, state } = {}) {
  if (entry?.v !== 2 || entry.sessionToken !== sessionToken) {
    return { scene: "intro", replace: true };
  }
  if (!hasKnownState(state)) return { scene: "workshop", replace: true };
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
