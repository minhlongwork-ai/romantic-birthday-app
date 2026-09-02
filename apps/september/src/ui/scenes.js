import { SEPTEMBER_GIFTS } from "../content/gifts.mjs";
import { SEPTEMBER_COPY, SEPTEMBER_FINAL_LETTER } from "../content/copy.mjs";
import { button, element, focusHeading, pictureForGift } from "./dom.js";

function letterGift(gift) {
  const groupTitle = element("h2", { attributes: { id: `${gift.id}-title` } });
  const [prefix, emphasis] = gift.groupLabel.split(/\s+(?=\S+$)/u);
  groupTitle.append(
    document.createTextNode(`${prefix} `),
    element("em", { text: emphasis }),
  );
  return element(
    "article",
    { className: `letter-gift letter-gift-${gift.id}`, attributes: { "aria-labelledby": `${gift.id}-title` } },
    pictureForGift(gift, { eager: gift.id === "cake" }),
    element(
      "div",
      { className: "letter-gift-copy" },
      element("p", { className: "letter-gift-eyebrow", text: gift.clue }),
      groupTitle,
      element("p", { className: "letter-gift-name", text: gift.productName }),
      element("p", { className: "letter-gift-message", text: gift.personalMessage }),
    ),
  );
}

export function mountLetter(root, context) {
  const recipient = context.personalization.recipient;
  const title = recipient === "em"
    ? SEPTEMBER_COPY.letterTitle
    : `Gửi ${recipient},`;
  const heading = element("h1", {
    className: "scene-title",
    attributes: { id: "letter-title", tabindex: "-1" },
  });
  if (recipient === "em") {
    heading.textContent = title;
  } else {
    heading.textContent = title;
  }
  const replay = button(SEPTEMBER_COPY.endingReplay, { className: "button button-quiet letter-replay" });
  replay.addEventListener("click", context.restart);
  const section = element(
    "section",
    { className: "scene scene-letter", attributes: { "aria-labelledby": "letter-title" }, dataset: { scene: "letter" } },
    element(
      "header",
      { className: "letter-intro" },
      element("p", { className: "scene-kicker", text: SEPTEMBER_COPY.kicker }),
      heading,
      element("p", { className: "scene-body", text: SEPTEMBER_COPY.introBody }),
    ),
    element("div", { className: "letter-gifts" }, ...SEPTEMBER_GIFTS.map(letterGift)),
    element(
      "footer",
      { className: "letter-closing" },
      element("p", { className: "letter-closing-mark", text: "—" }),
      element("p", { className: "letter-closing-note", text: "Cho một ngày của em." }),
      element("p", { className: "final-message", text: SEPTEMBER_FINAL_LETTER }),
      replay,
    ),
  );
  root.replaceChildren(section);
  focusHeading(section);
  return () => {};
}
