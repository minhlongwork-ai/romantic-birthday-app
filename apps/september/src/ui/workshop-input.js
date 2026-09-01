import {
  advanceBridgeGate,
  advanceForkGate,
  createBridgeGate,
  createForkGate,
  resetPointerGate,
} from "../core/workshop-gesture.mjs";
import { SEPTEMBER_COPY } from "../content/copy.mjs";

const NO_HAND_TIMEOUT_MS = 3_000;

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function inStage(event, stage) {
  const bounds = stage?.getBoundingClientRect?.();
  if (!bounds) return true;
  return event.clientX >= bounds.left
    && event.clientX <= bounds.left + bounds.width
    && event.clientY >= bounds.top
    && event.clientY <= bounds.top + bounds.height;
}

function stageWidth(stage) {
  return Math.max(stage?.getBoundingClientRect?.().width ?? 1, 1);
}

function isInAppBrowser(options) {
  if (typeof options.isInAppBrowser === "function") return Boolean(options.isInAppBrowser());
  return Boolean(options.isInAppBrowser);
}

/**
 * Adapts keyboard, touch, pointer, and camera samples into the three workshop
 * commands. Camera samples have already been reduced to position/openness by
 * the camera session; this adapter never accepts frames or landmarks.
 */
export function createWorkshopInput(options = {}) {
  const {
    stage,
    bridgeButton,
    leftButton,
    rightButton,
    forkGuide = stage,
    onCommand = () => {},
    onPaperShadow = () => {},
    onCameraNotice = () => {},
    getPhase = () => "invitation",
    documentTarget = globalThis.document,
    windowTarget = globalThis.window,
    now: clock = now,
  } = options;
  if (!bridgeButton || !leftButton || !rightButton) {
    throw new TypeError("Workshop input requires bridge and branch controls.");
  }

  const abortController = new AbortController();
  const { signal } = abortController;
  let disposed = false;
  let touchStarted = false;
  let camera = null;
  let cameraPromise = null;
  let cameraPermanentlyStopped = false;
  let cameraHadUsableHand = false;
  let noHandTimer = null;
  let bridgeGate = createBridgeGate();
  let forkGate = createForkGate({ stageWidth: stageWidth(stage) });
  let bridgePointerOwned = false;
  let bridgeClickSuppressed = false;
  let activeBridgePointerId = null;
  let activeForkPointerId = null;
  let activePointerControl = null;

  const clearNoHandTimer = () => {
    if (noHandTimer === null) return;
    globalThis.clearTimeout(noHandTimer);
    noHandTimer = null;
  };

  const offerTouch = (reason, label = SEPTEMBER_COPY.touchContinueCta) => {
    if (disposed) return;
    clearNoHandTimer();
    onCameraNotice({ reason, label, touchPrimary: true });
  };

  const command = (type) => {
    if (disposed) return;
    if (type === "CHOOSE_LEFT" || type === "CHOOSE_RIGHT") {
      cameraPermanentlyStopped = true;
      stopCamera("branch-locked");
    }
    onCommand(type);
  };

  const setPointerControl = (control) => {
    if (activePointerControl && activePointerControl !== control) {
      activePointerControl.style.touchAction = "";
    }
    activePointerControl = control;
    if (activePointerControl) activePointerControl.style.touchAction = "none";
  };

  const clearPointerControl = () => {
    if (activePointerControl) activePointerControl.style.touchAction = "";
    activePointerControl = null;
  };

  const applyBridge = (sample) => {
    const result = advanceBridgeGate(bridgeGate, sample);
    bridgeGate = result.gate;
    if (result.command) command(result.command);
  };

  const applyFork = (sample) => {
    const result = advanceForkGate(forkGate, sample);
    forkGate = result.gate;
    if (result.command) command(result.command);
  };

  const resetBridgePointer = (eventName = "cleanup") => {
    if (activeBridgePointerId !== null) {
      applyBridge({ now: clock(), event: eventName, pointerId: activeBridgePointerId });
    }
    activeBridgePointerId = null;
    bridgePointerOwned = false;
    clearPointerControl();
  };

  const resetForkPointer = (eventName = "cleanup") => {
    if (activeForkPointerId !== null) {
      applyFork({ now: clock(), event: eventName, pointerId: activeForkPointerId });
    }
    activeForkPointerId = null;
    forkGate = resetPointerGate(forkGate);
    clearPointerControl();
  };

  const isBranchAction = (event) => event.target === leftButton || event.target === rightButton;

  bridgeButton.addEventListener("click", (event) => {
    if (event.detail !== 0 || bridgePointerOwned || bridgeClickSuppressed) {
      bridgeClickSuppressed = false;
      return;
    }
    command("BRIDGE_CONFIRMED");
  }, { signal });
  leftButton.addEventListener("click", () => command("CHOOSE_LEFT"), { signal });
  rightButton.addEventListener("click", () => command("CHOOSE_RIGHT"), { signal });

  bridgeButton.addEventListener("pointerdown", (event) => {
    if (disposed || event.isPrimary === false || activeBridgePointerId !== null) return;
    bridgePointerOwned = true;
    bridgeClickSuppressed = true;
    activeBridgePointerId = event.pointerId;
    event.preventDefault();
    bridgeButton.setPointerCapture?.(event.pointerId);
    setPointerControl(bridgeButton);
    applyBridge({
      now: clock(),
      event: "pointerdown",
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      inZone: inStage(event, stage),
    });
  }, { signal });

  bridgeButton.addEventListener("pointermove", (event) => {
    if (disposed || event.pointerId !== activeBridgePointerId) return;
    event.preventDefault();
    applyBridge({
      now: clock(),
      event: "pointermove",
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      inZone: inStage(event, stage),
    });
  }, { signal });

  bridgeButton.addEventListener("pointerup", (event) => {
    if (disposed || event.pointerId !== activeBridgePointerId) return;
    event.preventDefault();
    applyBridge({
      now: clock(),
      event: "pointerup",
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      inZone: inStage(event, stage),
    });
    bridgeButton.releasePointerCapture?.(event.pointerId);
    resetBridgePointer();
  }, { signal });

  for (const eventName of ["pointercancel", "lostpointercapture"]) {
    bridgeButton.addEventListener(eventName, (event) => {
      if (disposed || event.pointerId !== activeBridgePointerId) return;
      bridgeClickSuppressed = true;
      resetBridgePointer(eventName);
    }, { signal });
  }

  if (forkGuide) {
    forkGuide.addEventListener("pointerdown", (event) => {
      if (disposed || isBranchAction(event) || event.isPrimary === false || activeForkPointerId !== null) return;
      activeForkPointerId = event.pointerId;
      event.preventDefault();
      forkGuide.setPointerCapture?.(event.pointerId);
      setPointerControl(forkGuide);
      applyFork({
        now: clock(),
        event: "pointerdown",
        pointerId: event.pointerId,
        x: event.clientX,
        tracking: true,
      });
    }, { signal });
    forkGuide.addEventListener("pointermove", (event) => {
      if (disposed || event.pointerId !== activeForkPointerId) return;
      event.preventDefault();
      applyFork({
        now: clock(),
        event: "pointermove",
        pointerId: event.pointerId,
        x: event.clientX,
        tracking: true,
      });
    }, { signal });
    forkGuide.addEventListener("pointerup", (event) => {
      if (disposed || event.pointerId !== activeForkPointerId) return;
      event.preventDefault();
      applyFork({
        now: clock(),
        event: "pointerup",
        pointerId: event.pointerId,
        x: event.clientX,
        tracking: true,
      });
      forkGuide.releasePointerCapture?.(event.pointerId);
      resetForkPointer();
    }, { signal });
    for (const eventName of ["pointercancel", "lostpointercapture"]) {
      forkGuide.addEventListener(eventName, (event) => {
        if (disposed || event.pointerId !== activeForkPointerId) return;
        resetForkPointer(eventName);
      }, { signal });
    }
  }

  const handleBlur = () => {
    if (disposed) return;
    bridgeClickSuppressed = true;
    resetBridgePointer("blur");
    resetForkPointer("blur");
  };
  windowTarget?.addEventListener?.("blur", handleBlur, { signal });
  documentTarget?.addEventListener?.("visibilitychange", () => {
    if (documentTarget.hidden) {
      stopCamera("document-hidden");
      offerTouch("document-hidden", SEPTEMBER_COPY.resumeCameraCta);
    }
  }, { signal });

  function handleCameraSample(sample) {
    if (disposed || !sample || typeof sample !== "object") return;
    const { tracking, palmX, palmY, openness } = sample;
    if (!tracking || !Number.isFinite(palmX) || !Number.isFinite(palmY)) return;
    cameraHadUsableHand = true;
    clearNoHandTimer();
    onPaperShadow({ x: palmX, y: palmY, opacity: 0.42 });
    if (getPhase() === "bridge") {
      applyBridge({ now: clock(), open: openness, inZone: true });
    } else if (getPhase() === "fork") {
      applyFork({ now: clock(), x: palmX, tracking: true });
    }
  }

  function stopCamera(reason = "stopped") {
    clearNoHandTimer();
    camera?.stop?.(reason);
    camera = null;
    cameraPromise = null;
  }

  async function startCamera() {
    if (disposed || cameraPermanentlyStopped || cameraPromise) return cameraPromise;
    if (isInAppBrowser(options)) {
      offerTouch("in-app-browser", SEPTEMBER_COPY.inAppCameraNote);
      return undefined;
    }
    cameraHadUsableHand = false;
    onCameraNotice({ reason: "starting", label: "", touchPrimary: false });
    noHandTimer = globalThis.setTimeout(() => {
      if (!cameraHadUsableHand) offerTouch("no-hand");
    }, NO_HAND_TIMEOUT_MS);
    cameraPromise = (async () => {
      try {
        const module = await (options.loadCameraSession?.() ?? import("../core/camera-session.mjs"));
        if (disposed || cameraPermanentlyStopped) return;
        camera = module.createCameraSession({
          onSample: handleCameraSample,
          onFallback: ({ reason }) => offerTouch(reason),
          documentTarget,
          windowTarget,
        });
        await camera.start();
      } catch (error) {
        if (!disposed) offerTouch(error?.name ?? "camera-unavailable");
      } finally {
        if (!cameraHadUsableHand) offerTouch("camera-unavailable");
      }
    })();
    return cameraPromise;
  }

  function startTouch() {
    if (disposed) return;
    touchStarted = true;
    stopCamera("touch-selected");
    onCameraNotice({ reason: "touch", label: "", touchPrimary: true });
  }

  function stop(reason = "stopped") {
    stopCamera(reason);
    resetBridgePointer("sceneexit");
    resetForkPointer("sceneexit");
  }

  return Object.freeze({
    startCamera,
    startTouch,
    stop,
    dispose() {
      if (disposed) return;
      disposed = true;
      abortController.abort();
      stopCamera("disposed");
      resetBridgePointer("cleanup");
      resetForkPointer("cleanup");
      touchStarted = false;
    },
  });
}
