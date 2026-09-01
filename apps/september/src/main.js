import { parsePersonalization } from "./core/personalization.mjs";
import {
  commitOpenedGift,
  createExperienceState,
  deriveWorkshopPhase,
  reduceWorkshopState,
  resolveHistoryTarget,
} from "./core/session.mjs";
import { focusHeading } from "./ui/dom.js";
import { SCENE_MOUNTS } from "./ui/scenes.js";

function loadFonts() {
  if (typeof document === "undefined") return;
  void Promise.all([
    import("@fontsource/playfair-display/vietnamese-600.css"),
    import("@fontsource/playfair-display/vietnamese-700.css"),
    import("@fontsource/be-vietnam-pro/vietnamese-400.css"),
    import("@fontsource/be-vietnam-pro/vietnamese-500.css"),
    import("@fontsource/be-vietnam-pro/vietnamese-600.css"),
    import("@fontsource/be-vietnam-pro/vietnamese-700.css"),
  ]);
}

function once(callback) {
  let called = false;
  return () => {
    if (called) return;
    called = true;
    callback?.();
  };
}

function defaultToken() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function validSceneMount(mounted, { reveal = false } = {}) {
  return Boolean(
    mounted
      && typeof mounted.dispose === "function"
      && (!reveal || mounted.card),
  );
}

function noOp() {}

export function createSeptemberExperienceApp(options = {}) {
  const windowTarget = options.windowTarget ?? globalThis.window;
  const documentTarget = options.documentTarget ?? globalThis.document;
  const historyTarget = options.history ?? windowTarget?.history;
  const location = options.location ?? windowTarget?.location ?? { pathname: "/", search: "" };
  const root = options.root;
  const liveRegion = options.liveRegion ?? { textContent: "" };
  const mounts = options.mounts ?? SCENE_MOUNTS;
  const motionQuery = options.motionQuery
    ?? windowTarget?.matchMedia?.("(prefers-reduced-motion: reduce)")
    ?? { matches: false, addEventListener: noOp, removeEventListener: noOp };
  const tokenFactory = options.tokenFactory ?? defaultToken;
  const focus = options.focusHeading ?? focusHeading;
  const personalization = options.personalization ?? parsePersonalization(location.search);
  const cleanUrl = location.pathname || "/";

  let sessionToken = tokenFactory();
  let state = options.initialState ?? createExperienceState();
  let cleanupScene = noOp;
  let activeScene = { kind: "initial" };
  let pendingReveal = null;
  let focusGiftId = null;
  let liveTimer = null;
  let started = false;

  function historyEntry(scene = state.scene) {
    const entry = { v: 2, sessionToken, scene };
    if (scene === "reveal") entry.giftId = state.activeGiftId;
    return entry;
  }

  function replaceHistory(scene = state.scene) {
    historyTarget?.replaceState?.(historyEntry(scene), "", cleanUrl);
  }

  function pushHistory(scene = state.scene) {
    historyTarget?.pushState?.(historyEntry(scene), "", cleanUrl);
  }

  function announce(message) {
    windowTarget?.clearTimeout?.(liveTimer);
    liveRegion.textContent = "";
    const write = () => {
      liveRegion.textContent = String(message ?? "");
    };
    if (windowTarget?.setTimeout) liveTimer = windowTarget.setTimeout(write, 20);
    else write();
  }

  function updateTitle() {
    if (!documentTarget || typeof documentTarget.title !== "string") return;
    const recipient = personalization.recipient === "em"
      ? ""
      : `Gửi ${personalization.recipient} | `;
    documentTarget.title = `${recipient}Một xưởng nhỏ`;
  }

  function sceneContext(extra = {}) {
    return {
      state,
      personalization,
      reducedMotion: Boolean(motionQuery.matches),
      focusGiftId,
      announce,
      navigate,
      requestGiftReveal,
      continueWorkshop,
      openLetter,
      restart,
      ...extra,
    };
  }

  function mountFor(kind, extra = {}) {
    const mount = mounts[kind];
    if (typeof mount !== "function") throw new TypeError(`Unknown September scene: ${kind}`);
    return mount(root, sceneContext(extra));
  }

  function ownsRevealTransition(attempt) {
    return Boolean(
      attempt
        && pendingReveal === attempt
        && activeScene.kind === "transition"
        && activeScene.attempt === attempt,
    );
  }

  function invalidatePendingReveal() {
    pendingReveal = null;
  }

  function createRevealMountRoot(attempt) {
    return Object.freeze({
      get dataset() {
        return root.dataset;
      },
      get ownerDocument() {
        return root.ownerDocument;
      },
      replaceChildren(...children) {
        if (ownsRevealTransition(attempt)) root.replaceChildren(...children);
      },
      querySelector(...args) {
        return root.querySelector?.(...args) ?? null;
      },
      querySelectorAll(...args) {
        return root.querySelectorAll?.(...args) ?? [];
      },
    });
  }

  function installScene(kind, mount) {
    invalidatePendingReveal();
    const previousCleanup = cleanupScene;
    cleanupScene = noOp;
    previousCleanup();
    const mounted = mount();
    if (!validSceneMount(mounted, { reveal: kind === "reveal" })) {
      throw new TypeError("Invalid SceneMount.");
    }
    cleanupScene = once(mounted.dispose);
    activeScene = kind === "reveal"
      ? { kind, giftId: state.activeGiftId }
      : { kind };
    return mounted;
  }

  function installStableScene(kind) {
    root.dataset.scene = kind;
    const mounted = installScene(kind, () => mountFor(kind));
    if (kind === "reveal") focus(mounted.card);
    updateTitle();
    return mounted;
  }

  function isCurrentReadyEnvelope({ giftId, transaction, attempt = null }, { transition = false } = {}) {
    const expectedGiftId = state.deliveryOrder?.[state.deliveredCount - 1];
    const inCurrentScene = transition
      ? ownsRevealTransition(attempt)
      : activeScene.kind === "workshop" && pendingReveal === null;
    return Boolean(
      inCurrentScene
        && state.scene === "workshop"
        && Number.isInteger(transaction)
        && transaction > 0
        && (transition ? pendingReveal === attempt : pendingReveal === null)
        && expectedGiftId === giftId
        && !state.openedGiftIds.has(giftId)
        && ["first-envelope-ready", "second-envelope-ready"].includes(
          deriveWorkshopPhase(state),
        ),
    );
  }

  function abandonRevealMount(mounted, attempt) {
    try {
      mounted?.dispose?.();
    } catch {}
    if (!ownsRevealTransition(attempt)) return false;
    invalidatePendingReveal();
    state = { ...state, scene: "workshop", activeGiftId: null };
    installStableScene("workshop");
    return false;
  }

  function commitMountedGift({ giftId, transaction, mounted, attempt = pendingReveal }) {
    if (
      !mounted?.card?.isConnected
      || !isCurrentReadyEnvelope({ giftId, transaction, attempt }, { transition: true })
    ) {
      return abandonRevealMount(mounted, attempt);
    }

    try {
      state = commitOpenedGift({ ...state, activeGiftId: giftId }, giftId);
    } catch {
      return abandonRevealMount(mounted, attempt);
    }
    state = { ...state, scene: "reveal", activeGiftId: giftId };
    pushHistory("reveal");
    cleanupScene = once(mounted.dispose);
    activeScene = { kind: "reveal", giftId };
    invalidatePendingReveal();
    focus(mounted.card);
    updateTitle();
    return true;
  }

  async function requestGiftReveal({ giftId, transaction, mount } = {}) {
    if (!isCurrentReadyEnvelope({ giftId, transaction }) || pendingReveal !== null) return false;

    const attempt = Object.freeze({ transaction });
    pendingReveal = attempt;
    const previousCleanup = cleanupScene;
    cleanupScene = noOp;
    activeScene = { kind: "transition", transaction, attempt };
    previousCleanup();

    let mounted = null;
    try {
      const revealMount = mount ?? mounts.reveal;
      mounted = await revealMount(
        createRevealMountRoot(attempt),
        sceneContext({ giftId, transaction }),
      );
    } catch {
      return abandonRevealMount(null, attempt);
    }
    if (
      !validSceneMount(mounted, { reveal: true })
      || !isCurrentReadyEnvelope({ giftId, transaction, attempt }, { transition: true })
    ) {
      return abandonRevealMount(mounted, attempt);
    }
    return commitMountedGift({ giftId, transaction, mounted, attempt });
  }

  function navigate(scene, { replace = false, restoreFocusGiftId = null } = {}) {
    if (!mounts[scene]) return false;
    if (scene === "reveal" && !state.activeGiftId) return false;
    if (scene === "ending" && deriveWorkshopPhase(state) !== "complete") return false;
    invalidatePendingReveal();
    state = {
      ...state,
      scene,
      activeGiftId: scene === "reveal" ? state.activeGiftId : null,
    };
    focusGiftId = restoreFocusGiftId;
    if (replace) replaceHistory(scene);
    else pushHistory(scene);
    installStableScene(scene);
    focusGiftId = null;
    return true;
  }

  function continueWorkshop(type) {
    if (state.scene !== "workshop" || activeScene.kind !== "workshop") return state;
    const next = reduceWorkshopState(state, { type });
    if (next === state) return state;
    state = { ...next, scene: "workshop", activeGiftId: null };
    return state;
  }

  function openLetter() {
    if (
      state.scene !== "workshop"
      || activeScene.kind !== "workshop"
      || deriveWorkshopPhase(state) !== "complete"
    ) {
      return false;
    }
    return navigate("ending");
  }

  function restart() {
    invalidatePendingReveal();
    const previousCleanup = cleanupScene;
    cleanupScene = noOp;
    previousCleanup();
    focusGiftId = null;
    sessionToken = tokenFactory();
    state = createExperienceState();
    activeScene = { kind: "transition" };
    pushHistory("intro");
    installStableScene("intro");
    announce("Xưởng nhỏ đã bắt đầu lại.");
    return true;
  }

  function handlePopState(event) {
    invalidatePendingReveal();
    const previousGiftId = state.activeGiftId;
    const target = resolveHistoryTarget(event?.state, { sessionToken, state });
    if (target.scene === "intro" && target.replace) {
      state = createExperienceState();
    } else {
      state = {
        ...state,
        scene: target.scene,
        activeGiftId: target.scene === "reveal" ? target.giftId : null,
      };
    }
    focusGiftId = target.scene === "workshop" ? previousGiftId : null;
    if (target.replace) replaceHistory(target.scene);
    installStableScene(target.scene);
    focusGiftId = null;
  }

  function handleMotionChange() {
    if (pendingReveal !== null) return;
    installStableScene(state.scene);
  }

  function dispose() {
    invalidatePendingReveal();
    const previousCleanup = cleanupScene;
    cleanupScene = noOp;
    previousCleanup();
    activeScene = { kind: "disposed" };
    windowTarget?.clearTimeout?.(liveTimer);
    windowTarget?.removeEventListener?.("popstate", handlePopState);
    motionQuery.removeEventListener?.("change", handleMotionChange);
  }

  function start() {
    if (started) return;
    started = true;
    replaceHistory("intro");
    installStableScene("intro");
    windowTarget?.addEventListener?.("popstate", handlePopState);
    motionQuery.addEventListener?.("change", handleMotionChange);
    windowTarget?.addEventListener?.("pagehide", (event) => {
      if (!event.persisted) dispose();
    }, { once: true });
  }

  return Object.freeze({
    start,
    dispose,
    navigate,
    requestGiftReveal,
    commitMountedGift,
    continueWorkshop,
    openLetter,
    restart,
    handlePopState,
    historyEntry,
    get state() {
      return state;
    },
    get activeScene() {
      return activeScene;
    },
  });
}

export function bootstrapSeptemberExperience() {
  const root = document.querySelector("#september-app");
  const liveRegion = document.querySelector("#app-live");
  if (!(root instanceof HTMLElement) || !(liveRegion instanceof HTMLElement)) {
    throw new Error("Không tìm thấy vùng hiển thị quà tháng Chín.");
  }
  const app = createSeptemberExperienceApp({
    root,
    liveRegion,
    windowTarget: window,
    documentTarget: document,
  });
  app.start();
  return app;
}

loadFonts();
if (typeof document !== "undefined") bootstrapSeptemberExperience();
