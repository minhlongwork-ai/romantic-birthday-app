const forwardedKeys = ["to", "from", "age"];
const sourceParams = new URLSearchParams(window.location.search);
const forwardedParams = new URLSearchParams();

for (const key of forwardedKeys) {
  for (const value of sourceParams.getAll(key)) {
    forwardedParams.append(key, value);
  }
}

const forwardedQuery = forwardedParams.toString();

for (const link of document.querySelectorAll("[data-project-link]")) {
  const baseHref = link.getAttribute("href");
  link.setAttribute("href", forwardedQuery ? `${baseHref}?${forwardedQuery}` : baseHref);
}

for (const image of document.querySelectorAll(".gift-media img")) {
  image.addEventListener(
    "error",
    () => {
      image.closest(".gift-media")?.classList.add("is-unavailable");
    },
    { once: true },
  );
}

if ("serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    () => {
      navigator.serviceWorker.register("./service-worker.js", {
        scope: "./",
        updateViaCache: "none",
      }).catch(() => {
        // The chooser remains fully usable when service workers are unavailable.
      });
    },
    { once: true },
  );
}
