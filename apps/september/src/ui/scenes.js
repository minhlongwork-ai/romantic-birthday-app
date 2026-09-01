import { SEPTEMBER_COPY, SEPTEMBER_FINAL_LETTER, previewBadgeForGift } from "../content/copy.mjs";
import { SEPTEMBER_GIFTS } from "../content/gifts.mjs";
import { button, element, focusHeading, pictureForGift } from "./dom.js";
import { mountWorkshop as mountWorkshopController } from "./workshop-controller.js";

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
    copy,
    stage,
  );
  return { section, stage };
}

function disposeWithAbort(abortController) {
  return () => abortController.abort();
}

export function mountIntro(root, context) {
  const abortController = new AbortController();
  const { section, stage } = sceneFrame(
    "intro",
    SEPTEMBER_COPY.introTitle,
    SEPTEMBER_COPY.introBody,
  );
  const start = button(SEPTEMBER_COPY.introCta, {
    className: "button button-primary intro-cta",
  });
  start.addEventListener("click", () => context.navigate("workshop"), {
    signal: abortController.signal,
  });
  stage.append(
    element(
      "div",
      { className: "intro-gifts", attributes: { "aria-hidden": "true" } },
      element("span", { className: "sealed-envelope sealed-envelope-left" }),
      element("span", { className: "sealed-envelope sealed-envelope-right" }),
    ),
    element("div", { className: "intro-note" }, start),
  );
  root.replaceChildren(section);
  focusHeading(section);
  return { dispose: disposeWithAbort(abortController) };
}

export function mountWorkshop(root, context) {
  return mountWorkshopController(root, context);
}

export function mountReveal(root, context) {
  const gift = GIFT_BY_ID.get(context.giftId ?? context.state.activeGiftId);
  if (!gift) throw new TypeError("Unknown gift reveal.");

  const abortController = new AbortController();
  const { section, stage } = sceneFrame("reveal", gift.productName);
  section.dataset.giftId = gift.id;
  const card = createRevealProduct(gift, context, abortController);
  stage.append(card);
  root.replaceChildren(section);
  return { card, dispose: disposeWithAbort(abortController) };
}

function createRevealProduct(gift, context, abortController) {
  const card = element("article", {
    className: "reveal-product is-visible",
    attributes: {
      "data-product-card": "",
      "aria-labelledby": `${gift.id}-product-name`,
    },
  });
  const productName = element("h2", {
    text: gift.productName,
    attributes: { id: `${gift.id}-product-name` },
  });
  const copy = element(
    "div",
    { className: "product-copy" },
    previewBadgeForGift(gift)
      ? element("span", { className: "demo-badge", text: previewBadgeForGift(gift) })
      : null,
    productName,
    element("p", { className: "product-variant", text: gift.variant }),
    element("p", { className: "product-message", text: gift.message }),
  );
  const continueButton = button(SEPTEMBER_COPY.continueCta, {
    className: "button button-secondary",
  });
  continueButton.addEventListener("click", () => context.navigate("workshop", {
    restoreFocusGiftId: gift.id,
  }), {
    signal: abortController.signal,
  });
  card.append(pictureForGift(gift, { eager: true }), copy, continueButton);
  return card;
}

export function mountEnding(root, context) {
  const abortController = new AbortController();
  const { section, stage } = sceneFrame("ending", SEPTEMBER_COPY.letterCta);
  const letter = element("p", { className: "final-message", text: SEPTEMBER_FINAL_LETTER });
  const replay = button(SEPTEMBER_COPY.replayCta, {
    className: "button button-secondary",
  });
  replay.addEventListener("click", () => context.restart(), {
    signal: abortController.signal,
  });
  stage.append(letter, replay);
  root.replaceChildren(section);
  focusHeading(section);
  return { dispose: disposeWithAbort(abortController) };
}

export const SCENE_MOUNTS = Object.freeze({
  intro: mountIntro,
  workshop: mountWorkshop,
  reveal: mountReveal,
  ending: mountEnding,
});
