import "@fontsource/playfair-display/vietnamese-600.css";
import "@fontsource/playfair-display/vietnamese-700.css";
import "@fontsource/be-vietnam-pro/vietnamese-400.css";
import "@fontsource/be-vietnam-pro/vietnamese-500.css";
import "@fontsource/be-vietnam-pro/vietnamese-600.css";
import "@fontsource/be-vietnam-pro/vietnamese-700.css";

import { INITIAL_DETENTS } from "./core/puzzle.mjs";
import { parsePersonalization } from "./core/personalization.mjs";
import {
  clearNfcProgress,
  parseNfcGiftFragment,
  readNfcProgress,
  recordNfcGift,
} from "./core/nfc-progress.mjs";
import {
  commitOpenedGift,
  createExperienceState,
  resolveHistoryTarget,
} from "./core/session.mjs";
import { SCENE_MOUNTS } from "./ui/scenes.js";

const root = document.querySelector("#september-app");
const liveRegion = document.querySelector("#app-live");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

if (!(root instanceof HTMLElement) || !(liveRegion instanceof HTMLElement)) {
  throw new Error("Không tìm thấy vùng hiển thị quà tháng Chín.");
}

const personalization = parsePersonalization(window.location.search);
const nfcGiftId = parseNfcGiftFragment(window.location.hash);
const cleanUrl = window.location.pathname;
let nfcStorage = null;
try {
  nfcStorage = window.localStorage;
} catch {}
const persistedOrder = readNfcProgress(nfcStorage);
let sessionToken = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
let state = createExperienceState({ openedGiftIds: persistedOrder });
if (nfcGiftId) {
  state = { ...state, scene: "reveal", activeGiftId: nfcGiftId };
}
let cleanupScene = () => {};
let focusGiftId = null;
let liveTimer = null;

function historyEntry(scene = state.scene) {
  const entry = { v: 1, sessionToken, scene };
  if (scene === "reveal") entry.giftId = state.activeGiftId;
  if (scene === "ending") entry.completionMode = state.completionMode;
  return entry;
}

function announce(message) {
  window.clearTimeout(liveTimer);
  liveRegion.textContent = "";
  liveTimer = window.setTimeout(() => {
    liveRegion.textContent = String(message ?? "");
  }, 20);
}

function replaceHistory(scene = state.scene) {
  history.replaceState(historyEntry(scene), "", cleanUrl);
}

function pushHistory(scene = state.scene) {
  history.pushState(historyEntry(scene), "", cleanUrl);
}

function updateTitle() {
  const recipient = personalization.recipient === "em" ? "" : `Gửi ${personalization.recipient} | `;
  document.title = `${recipient}Một chút ngọt, một chút hoa`;
}

function render() {
  cleanupScene();
  cleanupScene = () => {};
  const mount = SCENE_MOUNTS[state.scene];
  if (!mount) {
    state.scene = "intro";
    replaceHistory("intro");
    return render();
  }
  root.dataset.scene = state.scene;
  cleanupScene = mount(root, {
    state,
    personalization,
    reducedMotion: reducedMotionQuery.matches,
    initialPuzzleDetents: INITIAL_DETENTS,
    focusGiftId,
    announce,
    navigate,
    openGift,
    closeReveal,
    commitGift,
    updatePuzzle,
    complete,
    restart,
    recoverToBox,
  }) || (() => {});
  focusGiftId = null;
  updateTitle();
}

function navigate(scene, { replace = false } = {}) {
  state = { ...state, scene, activeGiftId: scene === "reveal" ? state.activeGiftId : null };
  if (replace) replaceHistory(scene);
  else pushHistory(scene);
  render();
}

function openGift(giftId) {
  state = { ...state, scene: "reveal", activeGiftId: giftId };
  pushHistory("reveal");
  render();
}

function closeReveal(giftId) {
  focusGiftId = giftId;
  state = { ...state, scene: "box", activeGiftId: null };
  pushHistory("box");
  render();
}

function commitGift(giftId) {
  state = commitOpenedGift(state, giftId);
  recordNfcGift(nfcStorage, giftId, state.openOrder);
}

function updatePuzzle(detents) {
  state = { ...state, puzzleDetents: { ...detents } };
}

function complete(mode) {
  state = { ...state, scene: "ending", completionMode: mode, activeGiftId: null };
  pushHistory("ending");
  render();
}

function recoverToBox() {
  state = { ...state, scene: "box", activeGiftId: null };
  replaceHistory("box");
  render();
}

function restart() {
  cleanupScene();
  sessionToken = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  clearNfcProgress(nfcStorage);
  state = createExperienceState();
  pushHistory("intro");
  render();
  announce("Hộp quà đã bắt đầu lại.");
}

function handlePopState(event) {
  const fragmentGiftId = parseNfcGiftFragment(window.location.hash);
  if (fragmentGiftId) {
    state = { ...state, scene: "reveal", activeGiftId: fragmentGiftId };
    replaceHistory("reveal");
    render();
    return;
  }
  const previousGiftId = state.activeGiftId;
  const target = resolveHistoryTarget(event.state, {
    sessionToken,
    openedGiftIds: state.openedGiftIds,
    completionMode: state.completionMode,
  });
  state = {
    ...state,
    scene: target.scene,
    activeGiftId: target.scene === "reveal" ? target.giftId : null,
    completionMode:
      target.scene === "ending" ? target.completionMode : state.completionMode,
  };
  if (target.scene === "box" && previousGiftId) focusGiftId = previousGiftId;
  if (target.replace) replaceHistory(target.scene);
  render();
}

function handleHashChange() {
  if (!window.location.hash.startsWith("#gift")) return;
  const giftId = parseNfcGiftFragment(window.location.hash);
  if (!giftId) {
    replaceHistory(state.scene);
    return;
  }
  state = { ...state, scene: "reveal", activeGiftId: giftId };
  replaceHistory("reveal");
  render();
}

window.addEventListener("popstate", handlePopState);
window.addEventListener("hashchange", handleHashChange);
reducedMotionQuery.addEventListener?.("change", render);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  cleanupScene();
  window.clearTimeout(liveTimer);
  window.removeEventListener("hashchange", handleHashChange);
  reducedMotionQuery.removeEventListener?.("change", render);
}, { once: true });

replaceHistory(state.scene);
render();
