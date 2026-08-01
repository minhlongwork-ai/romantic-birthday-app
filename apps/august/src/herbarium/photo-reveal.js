const FULL_REVEAL_TIMING = Object.freeze({
  duration: 1_600,
  topLeft: Object.freeze({ start: 120, end: 880, duration: 760 }),
  bottomRight: Object.freeze({ start: 260, end: 1_020, duration: 760 }),
});

const REDUCED_REVEAL_TIMING = Object.freeze({
  duration: 180,
  topLeft: Object.freeze({ start: 0, end: 180, duration: 180 }),
  bottomRight: Object.freeze({ start: 0, end: 180, duration: 180 }),
});

export function getPhotoRevealTiming(reducedMotion = false) {
  const timing = reducedMotion
    ? REDUCED_REVEAL_TIMING
    : FULL_REVEAL_TIMING;

  return {
    duration: timing.duration,
    topLeft: { ...timing.topLeft },
    bottomRight: { ...timing.bottomRight },
  };
}

export function createPhotoRevealLifecycle(options = {}) {
  const {
    duration = FULL_REVEAL_TIMING.duration,
    signal,
    setTimer = globalThis.setTimeout,
    clearTimer = globalThis.clearTimeout,
    onCleanup = () => {},
  } = options;
  let settled = false;
  let cleaned = false;
  let timerId;
  let resolveResult;
  const handleAbort = () => settle("aborted");

  const result = new Promise((resolve) => {
    resolveResult = resolve;
  });

  function cleanupResources() {
    if (cleaned) return;
    cleaned = true;
    clearTimer(timerId);
    signal?.removeEventListener?.("abort", handleAbort);
    onCleanup();
  }

  function settle(status) {
    if (settled) return;
    settled = true;
    cleanupResources();
    resolveResult(status);
  }

  if (signal?.aborted) {
    settle("aborted");
  } else {
    signal?.addEventListener?.("abort", handleAbort, { once: true });
    timerId = setTimer(
      () => settle("completed"),
      Math.max(0, Number(duration) || 0),
    );
  }

  return {
    result,
    cleanup() {
      settle("aborted");
    },
  };
}

function createBotanicalPicture(documentRef, botanical, modifier, assetSignal) {
  const picture = documentRef.createElement("picture");
  picture.className =
    `photo-reveal__botanical photo-reveal__botanical--${modifier}`;
  picture.setAttribute("aria-hidden", "true");

  const webpAsset = String(botanical?.asset ?? "").trim();
  const fallbackAsset = String(
    botanical?.fallbackAsset ?? botanical?.asset ?? "",
  ).trim();

  if (webpAsset) {
    const source = documentRef.createElement("source");
    source.srcset = webpAsset;
    source.type = "image/webp";
    picture.append(source);
  }

  const image = documentRef.createElement("img");
  image.alt = "";
  image.decoding = "async";
  image.draggable = false;
  if (fallbackAsset) image.src = fallbackAsset;
  picture.append(image);

  if (!webpAsset && !fallbackAsset) {
    picture.hidden = true;
    return picture;
  }

  let attemptedFallback = !webpAsset;
  image.addEventListener(
    "error",
    () => {
      if (!attemptedFallback && fallbackAsset) {
        attemptedFallback = true;
        picture.querySelectorAll("source").forEach((source) => source.remove());
        image.src = fallbackAsset;
        return;
      }
      picture.hidden = true;
    },
    { signal: assetSignal },
  );

  return picture;
}

function createCluster(documentRef, position, specimens, assetSignal) {
  const cluster = documentRef.createElement("div");
  cluster.className =
    `photo-reveal__cluster photo-reveal__cluster--${position}`;
  cluster.setAttribute("aria-hidden", "true");

  for (const [modifier, botanical] of specimens) {
    cluster.append(
      createBotanicalPicture(
        documentRef,
        botanical,
        modifier,
        assetSignal,
      ),
    );
  }

  return cluster;
}

function setRevealTimingProperties(overlay, timing) {
  overlay.style.setProperty(
    "--photo-reveal-duration",
    `${timing.duration}ms`,
  );
  overlay.style.setProperty(
    "--photo-reveal-top-delay",
    `${timing.topLeft.start}ms`,
  );
  overlay.style.setProperty(
    "--photo-reveal-top-duration",
    `${timing.topLeft.duration}ms`,
  );
  overlay.style.setProperty(
    "--photo-reveal-bottom-delay",
    `${timing.bottomRight.start}ms`,
  );
  overlay.style.setProperty(
    "--photo-reveal-bottom-duration",
    `${timing.bottomRight.duration}ms`,
  );
}

/**
 * Plays the decorative transition between photo selection and editing.
 * The AbortSignal owns the complete lifecycle; the returned promise never
 * rejects because a decorative image failed to load.
 */
export function playPhotoReveal(
  container,
  { photo, botanicals = {}, reducedMotion = false, signal } = {},
) {
  if (signal?.aborted) return Promise.resolve("aborted");

  const photoUrl = String(photo?.objectUrl ?? "").trim();
  if (!photoUrl) return Promise.resolve("completed");

  if (!container || typeof container.append !== "function") {
    throw new TypeError("Photo reveal requires a DOM container.");
  }

  const documentRef = container.ownerDocument ?? globalThis.document;
  if (!documentRef?.createElement) return Promise.resolve("completed");
  const mountTarget = documentRef.body ?? container;

  const timing = getPhotoRevealTiming(reducedMotion);
  const assetController = new AbortController();
  const overlay = documentRef.createElement("div");
  overlay.className = "photo-reveal";
  overlay.dataset.reducedMotion = String(Boolean(reducedMotion));
  overlay.setAttribute("aria-hidden", "true");
  setRevealTimingProperties(overlay, timing);

  const wash = documentRef.createElement("div");
  wash.className = "photo-reveal__wash";

  const card = documentRef.createElement("figure");
  card.className = "photo-reveal__card";
  const image = documentRef.createElement("img");
  image.className = "photo-reveal__image";
  image.src = photoUrl;
  image.alt = "";
  image.decoding = "async";
  image.draggable = false;
  image.addEventListener(
    "error",
    () => card.classList.add("is-image-missing"),
    { once: true, signal: assetController.signal },
  );
  card.append(image);

  const topLeft = createCluster(
    documentRef,
    "top-left",
    [
      ["lily", botanicals.lily],
      ["olive", botanicals.olive],
    ],
    assetController.signal,
  );
  const bottomRight = createCluster(
    documentRef,
    "bottom-right",
    [
      ["dahlia", botanicals.dahlia],
      ["olive", botanicals.olive],
    ],
    assetController.signal,
  );

  overlay.append(wash, card, topLeft, bottomRight);
  mountTarget.append(overlay);

  const canUseAnimationFrame =
    typeof globalThis.requestAnimationFrame === "function";
  const scheduleFrame = canUseAnimationFrame
    ? globalThis.requestAnimationFrame.bind(globalThis)
    : (callback) => globalThis.setTimeout(callback, 0);
  const cancelFrame = canUseAnimationFrame
    ? globalThis.cancelAnimationFrame?.bind(globalThis)
    : globalThis.clearTimeout.bind(globalThis);
  let activationFrame;

  const lifecycle = createPhotoRevealLifecycle({
    duration: timing.duration,
    signal,
    onCleanup() {
      if (activationFrame !== undefined) cancelFrame?.(activationFrame);
      assetController.abort();
      overlay.remove();
    },
  });

  if (!signal?.aborted) {
    activationFrame = scheduleFrame(() => overlay.classList.add("is-active"));
  }

  return lifecycle.result;
}
