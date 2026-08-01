export const MAX_SENDER_NAME_LENGTH = 32;

export function normalizeSenderName(value, fallback = "Shyn") {
  const normalized = String(value ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();

  return [...normalized].slice(0, MAX_SENDER_NAME_LENGTH).join("") || fallback;
}

export function resolveSenderSignature(state = {}, config = {}) {
  const fallback = normalizeSenderName(config.defaultSender, "Shyn");
  return {
    visible: state.showSender !== false,
    name: normalizeSenderName(state.sender, fallback),
  };
}
