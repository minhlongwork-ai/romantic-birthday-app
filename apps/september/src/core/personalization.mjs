import GraphemeSplitter from "grapheme-splitter";

const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;
const GRAPHEME_SPLITTER = new GraphemeSplitter();

function graphemeCount(value) {
  return GRAPHEME_SPLITTER.countGraphemes(value);
}

export function normalizePersonalization(value, fallback) {
  if (typeof value !== "string" || CONTROL_CHARACTER_PATTERN.test(value)) {
    return fallback;
  }

  const normalized = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!normalized || graphemeCount(normalized) > 32) {
    return fallback;
  }

  return normalized;
}

export function parsePersonalization(search = "") {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);

  return {
    recipient: normalizePersonalization(params.get("to"), "em"),
    sender: normalizePersonalization(params.get("from"), "anh"),
    // The chooser still receives this normalized value, but the experience
    // must never render, persist, log, or put it in history.
    age: normalizePersonalization(params.get("age"), ""),
  };
}
