import { SEPTEMBER_COPY } from "../content/copy.mjs";

export function element(tagName, options = {}, ...children) {
  const node = document.createElement(tagName);
  const { className, text, attributes = {}, dataset = {} } = options;
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null && value !== false) {
      node.setAttribute(name, value === true ? "" : String(value));
    }
  }
  for (const [name, value] of Object.entries(dataset)) {
    node.dataset[name] = String(value);
  }
  node.append(...children.filter(Boolean));
  return node;
}

export function button(label, options = {}) {
  return element("button", {
    className: options.className ?? "button button-primary",
    text: label,
    attributes: {
      type: "button",
      ...options.attributes,
    },
    dataset: options.dataset,
  });
}

export function pictureForGift(gift, { eager = false } = {}) {
  const picture = element("picture", { className: "product-picture" });
  const avif = element("source", {
    attributes: { srcset: gift.media.avifSrc, type: "image/avif" },
  });
  const webp = element("source", {
    attributes: { srcset: gift.media.webpSrc, type: "image/webp" },
  });
  const image = element("img", {
    attributes: {
      src: gift.media.jpegSrc,
      alt: gift.media.alt,
      width: "800",
      height: "800",
      decoding: "async",
      loading: eager ? "eager" : "lazy",
    },
  });
  const fallback = element("div", {
    className: `product-fallback product-fallback-${gift.id}`,
    attributes: { role: "status", hidden: true },
  },
  element("span", {
    className: `fallback-silhouette fallback-silhouette-${gift.id}`,
    attributes: { "aria-hidden": "true" },
  }),
  element("span", { text: SEPTEMBER_COPY.imageError }));
  image.addEventListener("error", () => {
    picture.classList.add("is-error");
    fallback.hidden = false;
  }, { once: true });
  picture.append(avif, webp, image, fallback);
  return picture;
}

export function focusHeading(container) {
  requestAnimationFrame(() => {
    const heading = container.querySelector("h1, h2");
    if (!(heading instanceof HTMLElement)) return;
    heading.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });
    heading.focus({ preventScroll: true });
  });
}
