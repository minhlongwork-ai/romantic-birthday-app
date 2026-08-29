import {
  RING_IDS,
  SOLUTION_DETENTS,
  getPuzzleHint,
  isPuzzleSolved,
  rotateDetent,
  shortestAngularDelta,
  snapAccumulatedDrag,
} from "../core/puzzle.mjs";

const RING_LABELS = Object.freeze({
  outer: "Dải nơ ngoài",
  inner: "Dải nơ trong",
});

const HINT_LABELS = Object.freeze({
  outer: "dải nơ ngoài",
  inner: "dải nơ trong",
});

function pointAngle(event, bounds) {
  const x = event.clientX - (bounds.left + bounds.width / 2);
  const y = event.clientY - (bounds.top + bounds.height / 2);
  return Math.atan2(x, -y) * 180 / Math.PI;
}

function pointerTravel(pointer, event) {
  return Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
}

export function mountPuzzleController(root, options) {
  const {
    detents,
    onChange,
    onSolved,
    announce,
  } = options;
  const abortController = new AbortController();
  const { signal } = abortController;
  const puzzle = root.querySelector(".ribbon-puzzle");
  const activePointers = new Map();
  let hintElapsed = 0;
  let hintStarted = document.visibilityState === "visible" ? performance.now() : null;
  let hintShown = false;
  let disposed = false;

  function updateRing(ringId, announceChange = false) {
    const ring = root.querySelector(`[data-ring="${ringId}"]`);
    if (!(ring instanceof Element)) return;
    const detent = detents[ringId];
    ring.style.setProperty("--ring-angle", `${detent * 45}deg`);
    ring.setAttribute("aria-valuenow", String(detent));
    ring.setAttribute("aria-valuetext", `Nấc ${detent}, góc ${detent * 45} độ`);
    ring.classList.toggle("is-aligned", detent === SOLUTION_DETENTS[ringId]);
    if (announceChange) announce(`${RING_LABELS[ringId]} ở nấc ${detent}.`);
  }

  function setDetent(
    ringId,
    next,
    announceChange = true,
    { checkSolved = true, allowAfterDispose = false } = {},
  ) {
    if (disposed && !allowAfterDispose) return;
    detents[ringId] = rotateDetent(next, 0);
    updateRing(ringId, announceChange);
    onChange({ ...detents });
    if (checkSolved && !disposed && isPuzzleSolved(detents)) onSolved();
  }

  function rotate(ringId, steps) {
    setDetent(ringId, rotateDetent(detents[ringId], steps));
  }

  function restorePointer(ringId, pointer, { allowAfterDispose = false } = {}) {
    if (!pointer) return;
    setDetent(ringId, pointer.startDetent, false, {
      checkSolved: false,
      allowAfterDispose,
    });
  }

  for (const ringId of RING_IDS) {
    const ring = root.querySelector(`[data-ring="${ringId}"]`);
    if (!(ring instanceof Element)) continue;
    updateRing(ringId);

    ring.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      rotate(ringId, event.key === "ArrowRight" ? 1 : -1);
    }, { signal });

    ring.addEventListener("pointerdown", (event) => {
      if (disposed || activePointers.size > 0 || !(puzzle instanceof Element)) return;
      event.preventDefault();
      const bounds = puzzle.getBoundingClientRect();
      const pointer = {
        pointerId: event.pointerId,
        ringId,
        startDetent: detents[ringId],
        startX: event.clientX,
        startY: event.clientY,
        previousAngle: pointAngle(event, bounds),
        accumulatedDegrees: 0,
      };
      activePointers.set(event.pointerId, pointer);
      ring.setPointerCapture(event.pointerId);
      ring.classList.add("is-dragging");
    }, { signal });

    ring.addEventListener("pointermove", (event) => {
      const pointer = activePointers.get(event.pointerId);
      if (disposed || !pointer || pointer.ringId !== ringId || !(puzzle instanceof Element)) return;
      const nextAngle = pointAngle(event, puzzle.getBoundingClientRect());
      pointer.accumulatedDegrees += shortestAngularDelta(pointer.previousAngle, nextAngle);
      pointer.previousAngle = nextAngle;
      ring.style.setProperty(
        "--ring-angle",
        `${pointer.startDetent * 45 + pointer.accumulatedDegrees}deg`,
      );
    }, { signal });

    const finishPointer = (event, cancelled = false) => {
      if (disposed) return;
      const pointer = activePointers.get(event.pointerId);
      if (!pointer || pointer.ringId !== ringId) return;
      activePointers.delete(event.pointerId);
      ring.classList.remove("is-dragging");
      const next = snapAccumulatedDrag({
        startDetent: pointer.startDetent,
        accumulatedDegrees: pointer.accumulatedDegrees,
        travelPx: pointerTravel(pointer, event),
        cancelled,
      });
      setDetent(ringId, next, next !== pointer.startDetent, {
        checkSolved: !cancelled,
      });
    };
    ring.addEventListener("pointerup", (event) => finishPointer(event), { signal });
    ring.addEventListener("pointercancel", (event) => finishPointer(event, true), { signal });
    ring.addEventListener("lostpointercapture", (event) => {
      if (disposed) return;
      const pointer = activePointers.get(event.pointerId);
      if (!pointer) return;
      activePointers.delete(event.pointerId);
      ring.classList.remove("is-dragging");
      restorePointer(ringId, pointer);
    }, { signal });
  }

  for (const control of root.querySelectorAll("[data-ring-control]")) {
    control.addEventListener("click", () => {
      rotate(control.dataset.ringControl, Number(control.dataset.steps));
    }, { signal });
  }

  const reset = root.querySelector("[data-puzzle-reset]");
  reset?.addEventListener("click", () => {
    if (disposed) return;
    for (const ringId of RING_IDS) setDetent(ringId, options.initialDetents[ringId], false);
    announce("Hai dải ruy-băng đã trở về vị trí ban đầu.");
  }, { signal });

  const showHint = () => {
    if (disposed || hintShown) return;
    const hint = getPuzzleHint(detents);
    if (!hint) return;
    hintShown = true;
    const direction = hint.direction === "clockwise" ? "sang phải" : "sang trái";
    const message = `Gợi ý: xoay ${HINT_LABELS[hint.ringId]} ${direction} ${hint.steps} nấc.`;
    const hintElement = root.querySelector("[data-puzzle-hint]");
    if (hintElement) {
      hintElement.textContent = message;
      hintElement.hidden = false;
    }
    announce(message);
  };

  const timer = window.setInterval(() => {
    if (disposed || hintShown || document.visibilityState !== "visible" || hintStarted === null) return;
    if (hintElapsed + performance.now() - hintStarted >= 20_000) showHint();
  }, 250);

  const handleVisibility = () => {
    if (disposed) return;
    if (document.visibilityState === "hidden" && hintStarted !== null) {
      hintElapsed += performance.now() - hintStarted;
      hintStarted = null;
    } else if (document.visibilityState === "visible" && hintStarted === null) {
      hintStarted = performance.now();
    }
  };
  document.addEventListener("visibilitychange", handleVisibility, { signal });

  const restoreAll = ({ allowAfterDispose = false } = {}) => {
    for (const pointer of activePointers.values()) {
      restorePointer(pointer.ringId, pointer, { allowAfterDispose });
      root.querySelector(`[data-ring="${pointer.ringId}"]`)?.classList.remove("is-dragging");
    }
    activePointers.clear();
  };
  window.addEventListener("blur", () => {
    if (!disposed) restoreAll();
  }, { signal });

  return () => {
    if (disposed) return;
    disposed = true;
    abortController.abort();
    window.clearInterval(timer);
    restoreAll({ allowAfterDispose: true });
  };
}
