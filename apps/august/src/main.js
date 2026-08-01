import { APP_CONFIG, SCENES } from "./herbarium/config.js";
import { createSceneMap } from "./herbarium/scenes.js";
import { disposePhoto } from "./herbarium/photo-engine.js";
import {
  createSoundtrackPlayer,
  mountSoundtrackControl,
} from "./herbarium/soundtrack-controller.js";

const root = document.querySelector("#app-root");
const appStatus = document.querySelector("#app-status");
const soundtrackRoot = document.querySelector("#soundtrack-root");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

if (
  !(root instanceof HTMLElement) ||
  !(appStatus instanceof HTMLElement) ||
  !(soundtrackRoot instanceof HTMLElement)
) {
  throw new Error("Không tìm thấy vùng hiển thị thiệp.");
}

const params = new URLSearchParams(window.location.search);
const scenes = createSceneMap();
let cleanupScene = () => {};
let isRendering = false;

function cleanText(value, fallback, maxLength) {
  const normalized = String(value ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();

  return [...normalized].slice(0, maxLength).join("") || fallback;
}

function createInitialState() {
  const recipient = cleanText(
    params.get("to"),
    APP_CONFIG.defaultRecipient,
    32,
  );
  return {
    scene: "envelope",
    history: [],
    recipient:
      recipient.toLocaleLowerCase("vi") === APP_CONFIG.defaultRecipient
        ? APP_CONFIG.defaultRecipient
        : recipient,
    sender: cleanText(params.get("from"), APP_CONFIG.defaultSender, 32),
    showSender: true,
    wishId: null,
    photo: null,
    frameId: "torn-paper",
    flowers: [],
    pressed: false,
  };
}

let state = createInitialState();
const soundtrack = createSoundtrackPlayer(APP_CONFIG.soundtrack);
const cleanupSoundtrackControl = mountSoundtrackControl(soundtrackRoot, soundtrack, {
  announce,
});

function announce(message) {
  appStatus.textContent = "";
  requestAnimationFrame(() => {
    appStatus.textContent = String(message ?? "");
  });
}

function updateDocumentTitle() {
  const recipient =
    state.recipient.toLocaleLowerCase("vi") === APP_CONFIG.defaultRecipient
      ? ""
      : `Gửi ${state.recipient} | `;
  document.title = `${recipient}${APP_CONFIG.title}`;
}

function renderScene({ announceScene = false } = {}) {
  if (isRendering) return;
  isRendering = true;
  cleanupScene();
  root.replaceChildren();
  window.scrollTo(0, 0);

  const mount = scenes[state.scene];
  if (typeof mount !== "function") {
    isRendering = false;
    throw new Error(`Scene không tồn tại: ${state.scene}`);
  }

  cleanupScene =
    mount(root, {
      state,
      config: APP_CONFIG,
      reducedMotion: reducedMotionQuery.matches,
      announce,
      soundtrack,
      navigate,
      back,
      restart,
    }) || (() => {});

  root.dataset.scene = state.scene;
  updateDocumentTitle();
  if (announceScene) {
    const index = SCENES.indexOf(state.scene);
    announce(`Đã mở trang ${Math.max(index + 1, 1)} trong ${SCENES.length}.`);
  }
  isRendering = false;
}

function navigate(nextScene, options = {}) {
  if (!SCENES.includes(nextScene) || nextScene === state.scene) return;
  const { replace = false } = options;

  if (!replace) {
    state.history = [...state.history, state.scene];
  }
  state.scene = nextScene;
  renderScene({ announceScene: true });
}

function back() {
  const history = [...state.history];
  const previous = history.pop();
  if (!previous) return;
  state.history = history;
  state.scene = previous;
  renderScene({ announceScene: true });
}

function restart() {
  disposePhoto(state.photo);
  soundtrack.reset();
  state = createInitialState();
  renderScene();
  announce("Thiệp đã bắt đầu lại từ phong thư.");
}

function handleReducedMotionChange() {
  renderScene();
}

reducedMotionQuery.addEventListener?.("change", handleReducedMotionChange);

window.addEventListener(
  "pagehide",
  () => {
    cleanupScene();
    cleanupSoundtrackControl();
    soundtrack.destroy();
    disposePhoto(state.photo);
    reducedMotionQuery.removeEventListener?.("change", handleReducedMotionChange);
  },
  { once: true },
);

renderScene();
