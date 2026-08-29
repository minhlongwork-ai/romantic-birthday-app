import { SEPTEMBER_GIFTS } from "../content/gifts.mjs";
import { SEPTEMBER_COPY } from "../content/copy.mjs";
import { RING_IDS } from "../core/puzzle.mjs";
import { button, element, focusHeading, pictureForGift } from "./dom.js";
import { mountPuzzleController } from "./puzzle-controller.js";

const GIFT_BY_ID = new Map(SEPTEMBER_GIFTS.map((gift) => [gift.id, gift]));

function sceneFrame(id, title, body) {
  const heading = element("h1", {
    className: "scene-title",
    text: title,
    attributes: { id: `${id}-title`, tabindex: "-1" },
  });
  const copy = element(
    "header",
    { className: "scene-copy" },
    element("p", { className: "scene-kicker", text: SEPTEMBER_COPY.kicker }),
    heading,
    body ? element("p", { className: "scene-body", text: body }) : null,
  );
  const stage = element("div", { className: "scene-stage" });
  const section = element(
    "section",
    {
      className: `scene scene-${id}`,
      attributes: { "aria-labelledby": `${id}-title` },
      dataset: { scene: id },
    },
    element("div", { className: "ambient-moon", attributes: { "aria-hidden": "true" } }),
    copy,
    stage,
  );
  return { section, stage, heading };
}

function createGiftSeal(gift) {
  return element(
    "span",
    {
      className: `gift-seal gift-seal-${gift.groupId}`,
      attributes: { "aria-hidden": "true" },
      dataset: { giftGroup: gift.groupId },
    },
    element("span", { className: "gift-seal-motif" }),
  );
}

function createCompartment(gift, isOpened) {
  const label = isOpened
    ? `Xem lại ${gift.productName}, ${gift.groupLabel}`
    : `Mở ngăn ${gift.groupLabel}`;
  const compartment = button(label, {
    className: `compartment ${isOpened ? "is-opened" : "is-closed"}`,
    attributes: {
      "aria-label": label,
      "aria-describedby": `${gift.id}-phase-copy`,
    },
    dataset: { giftId: gift.id },
  });
  compartment.replaceChildren(
    createGiftSeal(gift),
    element("span", {
      className: "compartment-group",
      text: gift.groupLabel,
      attributes: { id: `${gift.id}-phase-copy` },
    }),
    element("span", {
      className: "compartment-status",
      text: isOpened ? "Đã mở, chạm để xem lại" : "Chạm để mở",
    }),
  );
  return compartment;
}

export function mountIntro(root, context) {
  const { section, stage } = sceneFrame(
    "intro",
    SEPTEMBER_COPY.introTitle,
    SEPTEMBER_COPY.introBody,
  );
  const start = button(SEPTEMBER_COPY.introCta, {
    className: "button button-primary intro-cta",
  });
  start.addEventListener("click", () => context.navigate("box"));
  stage.append(
    element(
      "div",
      { className: "intro-orbit", attributes: { "aria-hidden": "true" } },
      ...SEPTEMBER_GIFTS.map((gift) => createGiftSeal(gift)),
    ),
    element(
      "div",
      { className: "intro-note" },
      element("p", { text: `${SEPTEMBER_COPY.demoBadge} · Dành cho ${context.personalization.recipient}` }),
      start,
    ),
  );
  root.replaceChildren(section);
  focusHeading(section);
  return () => {};
}

function createNfcDialog(context) {
  const dialog = element("dialog", {
    className: "nfc-dialog",
    attributes: { "aria-labelledby": "nfc-title" },
  });
  const title = element("h2", {
    text: SEPTEMBER_COPY.nfcOpen,
    attributes: { id: "nfc-title" },
  });
  const body = element("p", {
    text: "Đưa phần trên của iPhone lại gần thẻ “Một chút ngọt” hoặc “Một chút hoa”, rồi mở thông báo hiện ra.",
  });
  const manual = button(SEPTEMBER_COPY.nfcFallback, {
    className: "button button-primary",
  });
  const stay = button(SEPTEMBER_COPY.nfcStay, {
    className: "button button-secondary",
  });
  let activeGift = null;
  let restoreFocus = null;
  manual.addEventListener("click", () => {
    if (!activeGift) return;
    const giftId = activeGift.id;
    dialog.close("open");
    context.openGift(giftId);
  });
  stay.addEventListener("click", () => dialog.close("stay"));
  dialog.addEventListener("close", () => {
    if (dialog.returnValue !== "open") restoreFocus?.focus();
  });
  dialog.append(
    title,
    body,
    element("div", { className: "dialog-actions" }, manual, stay),
  );
  return {
    dialog,
    open(trigger, gift) {
      activeGift = gift;
      restoreFocus = trigger;
      dialog.showModal();
      requestAnimationFrame(() => manual.focus());
    },
  };
}

export function mountBox(root, context) {
  const openedCount = context.state.openedGiftIds.size;
  const { section, stage } = sceneFrame(
    "box",
    openedCount > 0 ? "Chọn món quà tiếp theo." : SEPTEMBER_COPY.boxTitle,
    openedCount === 2 ? SEPTEMBER_COPY.boxCompleteBody : SEPTEMBER_COPY.boxBody,
  );
  const box = element("div", {
    className: "blind-box",
    attributes: { "aria-label": "Hộp quà gồm hai ngăn bằng nhau" },
  });
  const { dialog, open } = createNfcDialog(context);
  for (const gift of SEPTEMBER_GIFTS) {
    const compartment = createCompartment(gift, context.state.openedGiftIds.has(gift.id));
    compartment.addEventListener("click", () => {
      if (context.state.openedGiftIds.has(gift.id)) {
        context.openGift(gift.id);
      } else {
        open(compartment, gift);
      }
    });
    box.append(compartment);
  }
  stage.append(box, dialog);

  if (openedCount === 2) {
    const gameButton = button(SEPTEMBER_COPY.boxCompleteCta, {
      className: "button button-primary game-entry",
    });
    gameButton.addEventListener("click", () => context.navigate("game"));
    stage.append(
      element(
        "div",
        { className: "game-entry-wrap" },
        element("p", { text: SEPTEMBER_COPY.boxCompleteTitle }),
        gameButton,
      ),
    );
  }
  root.replaceChildren(section);
  const restoredCompartment = context.focusGiftId
    ? section.querySelector(`[data-gift-id="${context.focusGiftId}"]`)
    : null;
  if (restoredCompartment instanceof HTMLElement) {
    requestAnimationFrame(() => {
      restoredCompartment.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
      restoredCompartment.focus({ preventScroll: true });
    });
  } else {
    focusHeading(section);
  }
  return () => {};
}

function createRevealProduct(gift) {
  const card = element("article", {
    className: "reveal-product",
    attributes: { "aria-labelledby": `${gift.id}-product-name` },
  });
  const productName = element("h2", {
    text: gift.productName,
    attributes: { id: `${gift.id}-product-name` },
  });
  const copy = element(
    "div",
    { className: "product-copy" },
    element("p", { className: "product-group", text: gift.groupLabel }),
    element("span", { className: "demo-badge", text: SEPTEMBER_COPY.demoBadge }),
    productName,
    element("p", { className: "product-variant", text: gift.variant }),
    element("p", { className: "product-reason", text: gift.reason }),
  );
  card.append(pictureForGift(gift), copy);
  return card;
}

export function mountReveal(root, context) {
  const gift = GIFT_BY_ID.get(context.state.activeGiftId);
  if (!gift) {
    context.recoverToBox();
    return () => {};
  }
  const wasOpened = context.state.openedGiftIds.has(gift.id);
  const { section, stage } = sceneFrame(
    "reveal",
    gift.groupLabel,
    gift.clue,
  );
  section.dataset.giftId = gift.id;
  const clue = element("p", { className: "reveal-clue", text: `“${gift.clue}”` });
  const silhouette = element(
    "div",
    { className: `gift-silhouette gift-silhouette-${gift.id}`, attributes: { "aria-hidden": "true" } },
    createGiftSeal(gift),
  );
  const product = createRevealProduct(gift);
  product.hidden = true;
  const close = button(SEPTEMBER_COPY.revealReturn, { className: "button button-secondary" });
  close.hidden = true;
  close.addEventListener("click", () => context.closeReveal(gift.id));
  stage.append(
    element("div", { className: "reveal-sequence" }, clue, silhouette, product),
    close,
  );
  root.replaceChildren(section);
  focusHeading(section);

  const timers = [];
  const schedule = (callback, delay) => {
    const timer = window.setTimeout(callback, delay);
    timers.push(timer);
  };
  const revealProduct = () => {
    clue.classList.add("is-past");
    silhouette.classList.add("is-past");
    product.hidden = false;
    product.classList.add("is-visible");
    close.hidden = false;
    if (!wasOpened) context.commitGift(gift.id);
    context.announce(`${gift.productName} đã được mở.`);
  };

  if (wasOpened) {
    clue.hidden = true;
    silhouette.hidden = true;
    revealProduct();
  } else if (context.reducedMotion) {
    schedule(() => silhouette.classList.add("is-visible"), 50);
    schedule(revealProduct, 150);
  } else {
    schedule(() => silhouette.classList.add("is-visible"), 800);
    schedule(revealProduct, 1900);
  }

  return () => timers.forEach(window.clearTimeout);
}

function createRingSvg(ringId, index) {
  const namespace = "http://www.w3.org/2000/svg";
  const group = document.createElementNS(namespace, "g");
  group.classList.add("ribbon-ring", `ribbon-ring-${ringId}`);
  group.dataset.ring = ringId;
  group.setAttribute("role", "slider");
  group.setAttribute("tabindex", "0");
  group.setAttribute("aria-label", ringId === "outer" ? "Dải nơ ngoài" : "Dải nơ trong");
  group.setAttribute("aria-valuemin", "0");
  group.setAttribute("aria-valuemax", "7");
  const radius = [116, 76][index];
  const hitTarget = document.createElementNS(namespace, "circle");
  hitTarget.classList.add("ring-hit-target");
  hitTarget.setAttribute("cx", "140");
  hitTarget.setAttribute("cy", "140");
  hitTarget.setAttribute("r", String(radius));
  const circle = document.createElementNS(namespace, "circle");
  circle.classList.add("ring-track");
  circle.setAttribute("cx", "140");
  circle.setAttribute("cy", "140");
  circle.setAttribute("r", String(radius));
  const marker = document.createElementNS(namespace, "circle");
  marker.classList.add("ring-marker");
  marker.setAttribute("cx", "140");
  marker.setAttribute("cy", String(140 - radius));
  marker.setAttribute("r", "5");
  group.append(hitTarget, circle, marker);
  return group;
}

function ringControls(ringId) {
  const label = ringId === "outer" ? "Dải nơ ngoài" : "Dải nơ trong";
  return element(
    "div",
    { className: "ring-control-row" },
    element("span", { className: "ring-control-label", text: label }),
    button("Xoay trái", {
      className: "button button-ribbon",
      dataset: { ringControl: ringId, steps: -1 },
      attributes: { "aria-label": `Xoay ${label.toLocaleLowerCase("vi")} sang trái` },
    }),
    button("Xoay phải", {
      className: "button button-ribbon",
      dataset: { ringControl: ringId, steps: 1 },
      attributes: { "aria-label": `Xoay ${label.toLocaleLowerCase("vi")} sang phải` },
    }),
  );
}

function createSkipDialog(context) {
  const dialog = element("dialog", {
    className: "skip-dialog",
    attributes: { "aria-labelledby": "skip-title" },
  });
  const title = element("h2", {
    text: "Mình xem lời nhắn luôn nhé?",
    attributes: { id: "skip-title" },
  });
  const body = element("p", { text: "Em vẫn nhận đủ hai lời nhắn. Trò thắt nơ có thể bỏ qua bất cứ lúc nào." });
  const confirm = button("Xem lời nhắn ngay", { className: "button button-primary" });
  const stay = button("Ở lại ghép", { className: "button button-secondary" });
  let restoreFocus = null;
  confirm.addEventListener("click", () => {
    dialog.close("skip");
    context.complete("skipped");
  });
  stay.addEventListener("click", () => dialog.close("stay"));
  dialog.addEventListener("close", () => {
    if (dialog.returnValue !== "skip") restoreFocus?.focus();
  });
  dialog.append(title, body, element("div", { className: "dialog-actions" }, confirm, stay));
  return {
    dialog,
    open(trigger) {
      restoreFocus = trigger;
      dialog.showModal();
      requestAnimationFrame(() => stay.focus());
    },
  };
}

export function mountGame(root, context) {
  const { section, stage } = sceneFrame(
    "game",
    SEPTEMBER_COPY.gameTitle,
    SEPTEMBER_COPY.gameInstruction,
  );
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("ribbon-puzzle");
  svg.setAttribute("viewBox", "0 0 280 280");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Hai dải nơ có thể xoay");
  svg.append(...RING_IDS.map(createRingSvg));

  const puzzle = element(
    "div",
    { className: "puzzle-layout" },
    element(
      "div",
      { className: "puzzle-visual" },
      svg,
      element("div", { className: "bow-core", attributes: { "aria-hidden": "true" } }),
    ),
    element("div", { className: "ring-controls" }, ...RING_IDS.map(ringControls)),
  );
  const hint = element("p", {
    className: "puzzle-hint",
    attributes: { hidden: true, "data-puzzle-hint": "" },
  });
  const reset = button("Đặt lại dải nơ", {
    className: "button button-secondary",
    attributes: { "data-puzzle-reset": "" },
  });
  const skip = button(SEPTEMBER_COPY.gameSkip, {
    className: "button button-quiet",
  });
  const { dialog, open } = createSkipDialog(context);
  skip.addEventListener("click", () => open(skip));
  stage.append(
    puzzle,
    hint,
    element("div", { className: "puzzle-actions" }, reset, skip),
    dialog,
  );
  root.replaceChildren(section);
  focusHeading(section);

  let disposed = false;
  let solved = false;
  let completionTimer = null;
  const cleanupController = mountPuzzleController(section, {
    detents: context.state.puzzleDetents,
    initialDetents: context.initialPuzzleDetents,
    onChange: context.updatePuzzle,
    announce: context.announce,
    onSolved() {
      if (disposed || solved) return;
      solved = true;
      section.classList.add("is-solved");
      context.announce("Hai dải ruy-băng đã khớp thành một chiếc nơ hoàn chỉnh.");
      completionTimer = window.setTimeout(
        () => {
          completionTimer = null;
          if (disposed) return;
          context.complete("solved");
        },
        context.reducedMotion ? 150 : 900,
      );
    },
  });
  return () => {
    if (disposed) return;
    disposed = true;
    cleanupController();
    if (completionTimer !== null) {
      window.clearTimeout(completionTimer);
      completionTimer = null;
    }
  };
}

export function mountEnding(root, context) {
  const solved = context.state.completionMode === "solved";
  const { section, stage } = sceneFrame(
    "ending",
    SEPTEMBER_COPY.endingTitle,
    solved ? SEPTEMBER_COPY.endingSolvedBody : SEPTEMBER_COPY.endingSkippedBody,
  );
  if (solved && !context.reducedMotion) {
    stage.append(element("div", {
      className: "bow-flourish",
      attributes: { "aria-hidden": "true" },
    }));
  }
  const messages = element("ol", { className: "gift-messages" });
  for (const gift of SEPTEMBER_GIFTS) {
    messages.append(
      element(
        "li",
        { className: "gift-message" },
        createGiftSeal(gift),
        element("div", {},
          element("h2", { text: gift.groupLabel }),
          element("p", { text: gift.personalMessage }),
        ),
      ),
    );
  }
  const finalMessage = element(
    "p",
    { className: "final-message" },
    document.createTextNode(`${context.personalization.recipient}, mong em thích hai món quà nhỏ này. `),
    element("strong", { text: context.personalization.sender }),
    document.createTextNode(" chỉ muốn thấy em vui thôi."),
  );
  const replay = button(SEPTEMBER_COPY.endingReplay, { className: "button button-secondary" });
  const replayDialog = element("dialog", {
    className: "replay-dialog",
    attributes: { "aria-labelledby": "replay-title" },
  });
  const replayTitle = element("h2", {
    text: "Mở lại từ đầu?",
    attributes: { id: "replay-title" },
  });
  const replayConfirm = button("Mở lại", { className: "button button-primary" });
  const replayStay = button("Ở lại", { className: "button button-secondary" });
  replayConfirm.addEventListener("click", () => {
    replayDialog.close("restart");
    context.restart();
  });
  replayStay.addEventListener("click", () => replayDialog.close("stay"));
  replayDialog.addEventListener("close", () => {
    if (replayDialog.returnValue !== "restart") replay.focus();
  });
  replayDialog.append(
    replayTitle,
    element("p", { text: "Tiến trình tìm quà hiện tại sẽ được xóa." }),
    element("div", { className: "dialog-actions" }, replayConfirm, replayStay),
  );
  replay.addEventListener("click", () => {
    replayDialog.showModal();
    requestAnimationFrame(() => replayStay.focus());
  });
  stage.append(messages, finalMessage, replay, replayDialog);
  root.replaceChildren(section);
  focusHeading(section);
  return () => {};
}

export const SCENE_MOUNTS = Object.freeze({
  intro: mountIntro,
  box: mountBox,
  reveal: mountReveal,
  game: mountGame,
  ending: mountEnding,
});
