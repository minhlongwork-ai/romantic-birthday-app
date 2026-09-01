import { SEPTEMBER_COPY } from "../content/copy.mjs";
import { createWorkshopInput } from "./workshop-input.js";

const ENVELOPE_OPEN_MS = 420;

function createElement(root, tagName, options = {}, ...children) {
  const document = root?.ownerDocument ?? globalThis.document;
  if (!document?.createElement) throw new TypeError("Workshop controller requires a DOM root.");
  const node = document.createElement(tagName);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    if (value !== undefined && value !== null && value !== false) {
      node.setAttribute(name, value === true ? "" : String(value));
    }
  }
  if (options.dataset) {
    for (const [name, value] of Object.entries(options.dataset)) node.dataset[name] = String(value);
  }
  node.append(...children.filter(Boolean));
  return node;
}

function createButton(root, label, options = {}) {
  return createElement(root, "button", {
    className: `workshop-action ${options.className ?? ""}`.trim(),
    text: label,
    attributes: { type: "button", ...options.attributes },
  });
}

function focusWorkshopHeading(section) {
  const heading = section.querySelector?.("h1, h2");
  if (!heading?.focus) return;
  const focus = () => {
    heading.scrollIntoView?.({ block: "start", inline: "nearest", behavior: "auto" });
    heading.focus({ preventScroll: true });
  };
  if (typeof globalThis.requestAnimationFrame === "function") globalThis.requestAnimationFrame(focus);
  else globalThis.setTimeout(focus, 0);
}

function isDeliveryPhase(phase) {
  return phase === "delivering-first" || phase === "delivering-second";
}

function deliveryIndex(phase) {
  return phase === "delivering-second" ? 1 : 0;
}

/**
 * Owns the closed-paper workshop UI only. Gift information is deliberately
 * limited to a ready identifier at the envelope handoff boundary.
 */
export function createWorkshopController(options = {}) {
  const {
    root,
    reducedMotion = false,
    continueWorkshop = () => null,
    requestGiftReveal = () => {},
    openLetter = () => {},
    announce = () => {},
    focusGiftId = null,
  } = options;
  if (!root?.replaceChildren) throw new TypeError("Workshop controller requires a DOM root.");

  const abortController = new AbortController();
  const { signal } = abortController;
  let state = options.state ?? { workshopPhase: "invitation", deliveryOrder: [], deliveredCount: 0 };
  let interactionSelected = state.workshopPhase !== "invitation";
  let disposed = false;
  let renderer = null;
  let rendererPromise = null;
  let deliveryAbort = null;
  let deliveryKey = null;
  let envelopeTimer = null;
  let transaction = 0;

  const section = createElement(root, "section", {
    className: "scene scene-workshop",
    attributes: { "aria-labelledby": "workshop-invitation-title" },
    dataset: { scene: "workshop" },
  });

  const stage = createElement(root, "div", {
    className: "scene-stage workshop-stage",
    attributes: { "aria-live": "off" },
  });
  const visualHost = createElement(root, "div", {
    className: "workshop-render-host paper-shadow",
    attributes: { "aria-hidden": "true" },
  });
  const paperSurface = createElement(root, "section", {
    className: "workshop-paper-surface",
    attributes: { "aria-labelledby": "workshop-invitation-title" },
  });
  const invitationTitle = createElement(root, "h2", {
    className: "workshop-title",
    text: SEPTEMBER_COPY.invitationTitle,
    attributes: { id: "workshop-invitation-title", tabindex: "-1" },
  });
  const invitationPrivacy = createElement(root, "p", {
    className: "workshop-note",
    text: SEPTEMBER_COPY.invitationPrivacy,
  });
  const cameraNotice = createElement(root, "p", { className: "workshop-note", attributes: { hidden: true } });
  const cameraButton = createButton(root, SEPTEMBER_COPY.cameraCta, { className: "workshop-camera" });
  const touchButton = createButton(root, SEPTEMBER_COPY.touchCta, {
    className: "workshop-touch",
  });
  const invitationActions = createElement(
    root,
    "div",
    { className: "workshop-actions workshop-invitation-actions" },
    cameraButton,
    touchButton,
  );
  const bridgeButton = createButton(root, "Nối đường ray", {
    className: "workshop-bridge",
    attributes: { "aria-describedby": "workshop-bridge-note" },
  });
  const bridgeNote = createElement(root, "p", {
    className: "workshop-note",
    text: SEPTEMBER_COPY.bridgeInstruction,
    attributes: { id: "workshop-bridge-note" },
  });
  const bridgeControls = createElement(
    root,
    "div",
    { className: "workshop-control-group workshop-bridge-controls" },
    bridgeNote,
    bridgeButton,
  );
  const leftButton = createButton(root, "Chọn lối trái", { className: "workshop-branch" });
  const rightButton = createButton(root, "Chọn lối phải", { className: "workshop-branch" });
  const forkControls = createElement(
    root,
    "div",
    {
      className: "workshop-control-group workshop-fork-controls",
      attributes: { role: "group", "aria-label": SEPTEMBER_COPY.forkInstruction },
    },
    createElement(root, "p", { className: "workshop-note", text: SEPTEMBER_COPY.forkInstruction }),
    createElement(root, "div", { className: "workshop-actions workshop-branch-actions" }, leftButton, rightButton),
  );
  const envelope = createButton(root, SEPTEMBER_COPY.envelopeCta, {
    className: "workshop-envelope",
  });
  const envelopeControls = createElement(
    root,
    "div",
    { className: "workshop-envelope-controls" },
    envelope,
  );
  const continueButton = createButton(root, SEPTEMBER_COPY.continueCta, {
    className: "workshop-continue",
  });
  const continueControls = createElement(
    root,
    "div",
    { className: "workshop-control-group workshop-continue-controls" },
    continueButton,
  );
  const letterButton = createButton(root, SEPTEMBER_COPY.letterCta, {
    className: "workshop-letter",
  });
  const letterControls = createElement(
    root,
    "div",
    { className: "workshop-control-group workshop-letter-controls" },
    letterButton,
  );
  paperSurface.append(
    invitationTitle,
    invitationPrivacy,
    cameraNotice,
    invitationActions,
    bridgeControls,
    forkControls,
    envelopeControls,
    continueControls,
    letterControls,
  );
  stage.append(visualHost, paperSurface);
  section.append(stage);
  root.replaceChildren(section);

  const setCameraNotice = ({ label = "", touchPrimary = false }) => {
    cameraNotice.hidden = !label;
    cameraNotice.textContent = label;
    touchButton.classList.toggle?.("is-primary", touchPrimary);
  };

  const input = createWorkshopInput({
    stage,
    bridgeButton,
    leftButton,
    rightButton,
    forkGuide: forkControls,
    getPhase: () => (
      interactionSelected && state.workshopPhase === "invitation"
        ? "bridge"
        : state.workshopPhase
    ),
    onCommand(type) {
      if (type === "BRIDGE_CONFIRMED" && state.workshopPhase !== "invitation" && state.workshopPhase !== "bridge") return;
      if ((type === "CHOOSE_LEFT" || type === "CHOOSE_RIGHT") && state.workshopPhase !== "fork") return;
      applyWorkshopAction(type);
    },
    onPaperShadow(sample) {
      renderer?.setPaperShadow?.(sample);
    },
    onCameraNotice: setCameraNotice,
  });

  const ensureRenderer = () => {
    if (rendererPromise) return rendererPromise;
    rendererPromise = import("./workshop-renderer.js")
      .then(({ createWorkshopRenderer }) => createWorkshopRenderer({
        container: visualHost,
        reducedMotion,
        onFallback() {},
      }))
      .then((nextRenderer) => {
        if (disposed) {
          nextRenderer.dispose();
          return null;
        }
        renderer = nextRenderer;
        renderer.setPhase(state.workshopPhase);
        return renderer;
      })
      .catch(() => null);
    return rendererPromise;
  };

  const cancelDelivery = () => {
    deliveryAbort?.abort();
    deliveryAbort = null;
    deliveryKey = null;
  };

  const beginDelivery = () => {
    if (!isDeliveryPhase(state.workshopPhase) || disposed) return;
    const key = `${state.workshopPhase}:${state.deliveredCount}`;
    if (deliveryKey === key) return;
    cancelDelivery();
    deliveryKey = key;
    const abort = new AbortController();
    deliveryAbort = abort;
    void ensureRenderer().then(async (activeRenderer) => {
      if (!activeRenderer || disposed || abort.signal.aborted || deliveryKey !== key) return;
      activeRenderer.setPhase(state.workshopPhase);
      try {
        await activeRenderer.playDelivery({ index: deliveryIndex(state.workshopPhase), signal: abort.signal });
      } catch {
        return;
      }
      if (disposed || abort.signal.aborted || deliveryKey !== key) return;
      applyWorkshopAction("DELIVERY_READY");
    });
  };

  const renderPhase = () => {
    const phase = state.workshopPhase;
    section.dataset.workshopPhase = phase;
    invitationActions.hidden = phase !== "invitation";
    bridgeControls.hidden = phase !== "bridge" && !(phase === "invitation" && interactionSelected);
    forkControls.hidden = phase !== "fork";
    envelopeControls.hidden = phase !== "first-envelope-ready" && phase !== "second-envelope-ready";
    envelope.disabled = envelopeControls.hidden;
    continueControls.hidden = phase !== "between-gifts";
    continueButton.disabled = continueControls.hidden;
    letterControls.hidden = phase !== "complete";
    letterButton.disabled = letterControls.hidden;
    renderer?.setPhase?.(phase);
    if (isDeliveryPhase(phase)) beginDelivery();
  };

  function applyWorkshopAction(type) {
    if (disposed) return;
    const externalNext = continueWorkshop(type);
    if (!externalNext || typeof externalNext !== "object" || externalNext === state) return;
    state = externalNext;
    if (type === "CHOOSE_LEFT" || type === "CHOOSE_RIGHT") input.stop("branch-locked");
    renderPhase();
  }

  cameraButton.addEventListener("click", () => {
    interactionSelected = true;
    renderPhase();
    void input.startCamera();
  }, { signal });
  touchButton.addEventListener("click", () => {
    input.startTouch();
    interactionSelected = true;
    renderPhase();
    announce(SEPTEMBER_COPY.bridgeInstruction);
  }, { signal });
  envelope.addEventListener("click", () => {
    if (disposed || envelope.disabled || envelope.dataset.opening === "true") return;
    const giftId = state.deliveryOrder?.[state.deliveredCount - 1];
    if (!giftId) return;
    envelope.dataset.opening = "true";
    envelope.disabled = true;
    envelope.classList.add("is-opening");
    const currentTransaction = ++transaction;
    const finish = () => {
      envelopeTimer = null;
      if (disposed || envelope.dataset.opening !== "true") return;
      envelope.dataset.opening = "false";
      requestGiftReveal({ giftId, transaction: currentTransaction });
    };
    envelopeTimer = globalThis.setTimeout(finish, reducedMotion ? 150 : ENVELOPE_OPEN_MS);
  }, { signal });
  continueButton.addEventListener("click", () => {
    if (disposed || continueButton.disabled) return;
    applyWorkshopAction("DELIVERY_READY");
  }, { signal });
  letterButton.addEventListener("click", () => {
    if (disposed || letterButton.disabled) return;
    openLetter();
  }, { signal });

  renderPhase();
  void ensureRenderer();
  const stableControl = state.workshopPhase === "between-gifts"
    ? continueButton
    : state.workshopPhase === "complete"
      ? letterButton
      : state.workshopPhase === "first-envelope-ready" || state.workshopPhase === "second-envelope-ready"
        ? envelope
        : null;
  if (focusGiftId && stableControl && !stableControl.disabled) {
    const focusControl = () => {
      stableControl.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "auto" });
      stableControl.focus?.({ preventScroll: true });
    };
    if (typeof globalThis.requestAnimationFrame === "function") globalThis.requestAnimationFrame(focusControl);
    else globalThis.setTimeout(focusControl, 0);
  } else {
    focusWorkshopHeading(section);
  }

  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      abortController.abort();
      cancelDelivery();
      if (envelopeTimer !== null) {
        globalThis.clearTimeout(envelopeTimer);
        envelopeTimer = null;
      }
      input.dispose();
      renderer?.dispose?.();
      renderer = null;
      root.replaceChildren();
    },
  });
}

export function mountWorkshop(root, context) {
  const controller = createWorkshopController({
    root,
    state: context.state,
    reducedMotion: context.reducedMotion,
    continueWorkshop: context.continueWorkshop,
    requestGiftReveal: context.requestGiftReveal,
    openLetter: context.openLetter,
    announce: context.announce,
    focusGiftId: context.focusGiftId,
  });
  return { dispose: () => controller.dispose() };
}
