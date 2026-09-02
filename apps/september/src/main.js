import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/600-italic.css";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";

import { parsePersonalization } from "./core/personalization.mjs";
import { mountLetter } from "./ui/scenes.js";

const root = document.querySelector("#september-app");

if (!(root instanceof HTMLElement)) {
  throw new Error("Không tìm thấy vùng hiển thị thiệp tháng Chín.");
}

const personalization = parsePersonalization(window.location.search);
const cleanUrl = window.location.pathname;
const sessionToken = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function historyEntry() {
  return { v: 1, sessionToken, scene: "letter" };
}

function restart() {
  window.scrollTo({ top: 0, behavior: "auto" });
  root.querySelector("h1")?.focus({ preventScroll: true });
}

function render() {
  root.dataset.scene = "letter";
  mountLetter(root, { personalization, restart });
  const recipient = personalization.recipient === "em" ? "" : `Gửi ${personalization.recipient} | `;
  document.title = `${recipient}Một chút ngọt, một chút hoa`;
}

window.addEventListener("popstate", () => {
  if (history.state?.v !== 1 || history.state.sessionToken !== sessionToken) {
    history.replaceState(historyEntry(), "", cleanUrl);
  }
  render();
});

history.replaceState(historyEntry(), "", cleanUrl);
render();
