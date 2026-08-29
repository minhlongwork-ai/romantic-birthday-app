import { GIFT_IDS } from "./session.mjs";

export const NFC_PROGRESS_KEY = "september:nfc-progress:v1";
export const NFC_PROGRESS_TTL_MS = 86_400_000;

const GROUP_TO_GIFT = Object.freeze({ sweet: "cake", bloom: "bouquet" });

export function parseNfcGiftFragment(hash) {
  const source = String(hash ?? "");
  if (!source.startsWith("#")) return null;
  const params = new URLSearchParams(source.slice(1));
  if ([...params.keys()].some((key) => key !== "gift")) return null;
  const values = params.getAll("gift");
  return values.length === 1 ? GROUP_TO_GIFT[values[0]] ?? null : null;
}

function removeProgress(storage) {
  try {
    storage?.removeItem(NFC_PROGRESS_KEY);
  } catch {}
}

function parseStoredProgress(storage, now) {
  try {
    const parsed = JSON.parse(storage?.getItem(NFC_PROGRESS_KEY) ?? "null");
    const validIds = Array.isArray(parsed?.foundGiftIds)
      && new Set(parsed.foundGiftIds).size === parsed.foundGiftIds.length
      && parsed.foundGiftIds.every((id) => GIFT_IDS.includes(id));
    const validExpiry = Number.isSafeInteger(parsed?.expiresAt)
      && parsed.expiresAt > now
      && parsed.expiresAt <= now + NFC_PROGRESS_TTL_MS;
    if (parsed?.v !== 1 || !validIds || !validExpiry) {
      removeProgress(storage);
      return null;
    }
    return parsed;
  } catch {
    removeProgress(storage);
    return null;
  }
}

export function readNfcProgress(storage, now = Date.now()) {
  const progress = parseStoredProgress(storage, now);
  return progress ? [...progress.foundGiftIds] : [];
}

export function recordNfcGift(storage, giftId, currentOrder, now = Date.now()) {
  const order = Array.isArray(currentOrder)
    ? currentOrder.filter((id, index) => GIFT_IDS.includes(id) && currentOrder.indexOf(id) === index)
    : [];
  if (!GIFT_IDS.includes(giftId)) return order;

  if (!order.includes(giftId)) order.push(giftId);
  const previousProgress = parseStoredProgress(storage, now);
  const expiresAt = previousProgress?.expiresAt ?? now + NFC_PROGRESS_TTL_MS;

  try {
    storage?.setItem(NFC_PROGRESS_KEY, JSON.stringify({
      v: 1,
      foundGiftIds: order,
      expiresAt,
    }));
  } catch {}

  return order;
}

export function clearNfcProgress(storage) {
  removeProgress(storage);
}
