import { sanitizeCameraSample } from "./workshop-gesture.mjs";

const CAMERA_CONSTRAINTS = Object.freeze({
  video: Object.freeze({
    facingMode: "user",
    width: Object.freeze({ ideal: 320 }),
    height: Object.freeze({ ideal: 240 }),
  }),
  audio: false,
});
const WORKING_WIDTH = 320;
const WORKING_HEIGHT = 240;
const MAX_SAMPLE_AGE_MS = 250;
const FRAME_INTERVAL_MS = 1000 / 12;
const STARTUP_TIMEOUT_MS = 8_000;
const FALLBACK_MESSAGE = "Chạm để tiếp tục";

const defaultWorkerFactory = () => new Worker(new URL("../workers/hand-landmarker.worker.js", import.meta.url), { type: "module" });

function namedError(name, message) {
  const error = new Error(message);
  error.name = name;
  return error;
}

function abortError(reason) {
  if (reason === "startup-timeout") {
    return namedError("TimeoutError", "Camera startup timed out.");
  }
  return namedError("AbortError", "Camera session was stopped.");
}

function defaultNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function defaultGetUserMedia(constraints) {
  const getUserMedia = globalThis.navigator?.mediaDevices?.getUserMedia;
  if (typeof getUserMedia !== "function") {
    throw namedError("NotSupportedError", "Camera capture is unavailable.");
  }
  return getUserMedia.call(globalThis.navigator.mediaDevices, constraints);
}

function defaultCreateImageBitmap(...args) {
  if (typeof globalThis.createImageBitmap !== "function") {
    throw namedError("NotSupportedError", "ImageBitmap is unavailable.");
  }
  return globalThis.createImageBitmap(...args);
}

function defaultFrameScheduler({ now = defaultNow } = {}) {
  return {
    start(video, onFrame) {
      let active = true;
      let callbackId = null;
      let lastFrameAt = -Infinity;
      const requestAnimationFrame = globalThis.requestAnimationFrame?.bind(globalThis);
      const cancelAnimationFrame = globalThis.cancelAnimationFrame?.bind(globalThis);

      const scheduleVideoFrame = () => {
        callbackId = video.requestVideoFrameCallback((timestampMs, metadata = {}) => {
          if (!active) return;
          scheduleVideoFrame();
          onFrame({ timestampMs: metadata.presentationTime ?? timestampMs });
        });
      };
      const scheduleAnimationFrame = () => {
        if (typeof requestAnimationFrame !== "function") return;
        callbackId = requestAnimationFrame(timestampMs => {
          if (!active) return;
          if (timestampMs - lastFrameAt >= FRAME_INTERVAL_MS) {
            lastFrameAt = timestampMs;
            onFrame({ timestampMs: now() });
          }
          scheduleAnimationFrame();
        });
      };

      if (typeof video?.requestVideoFrameCallback === "function") scheduleVideoFrame();
      else scheduleAnimationFrame();

      return () => {
        active = false;
        if (typeof video?.cancelVideoFrameCallback === "function") {
          video.cancelVideoFrameCallback(callbackId);
        } else if (typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(callbackId);
        }
      };
    },
  };
}

function createClippedVideo(documentTarget, videoHost) {
  if (!documentTarget?.createElement) {
    throw namedError("NotSupportedError", "Camera video is unavailable.");
  }
  const video = documentTarget.createElement("video");
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.controls = false;
  video.tabIndex = -1;
  video.setAttribute("aria-hidden", "true");
  Object.assign(video.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: "0",
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
    border: "0",
    pointerEvents: "none",
  });
  (videoHost ?? documentTarget.body)?.append?.(video);
  return video;
}

function addListener(target, type, listener, removers) {
  if (!target?.addEventListener) return;
  target.addEventListener(type, listener);
  removers.push(() => target.removeEventListener?.(type, listener));
}

function releaseStream(stream, releasedStreams) {
  if (!stream || releasedStreams.has(stream)) return;
  releasedStreams.add(stream);
  for (const track of stream.getTracks?.() ?? []) track.stop?.();
}

function closeBitmap(bitmap) {
  try {
    bitmap?.close?.();
  } catch {
    // A transferred/closed bitmap is already released.
  }
}

function workerErrorReason(error) {
  return error?.name === "NotAllowedError" || error?.name === "SecurityError"
    ? "permission-denied"
    : "camera-unavailable";
}

function shouldOfferTouch(reason) {
  return new Set([
    "permission-denied",
    "camera-unavailable",
    "startup-timeout",
    "worker-error",
    "track-muted",
    "track-ended",
    "document-hidden",
    "pagehide",
  ]).has(reason);
}

function cropFrame(video) {
  const sourceWidth = video.videoWidth || WORKING_WIDTH;
  const sourceHeight = video.videoHeight || WORKING_HEIGHT;
  const targetAspect = WORKING_WIDTH / WORKING_HEIGHT;
  const sourceAspect = sourceWidth / sourceHeight;
  if (sourceAspect > targetAspect) {
    const width = Math.round(sourceHeight * targetAspect);
    return [Math.round((sourceWidth - width) / 2), 0, width, sourceHeight];
  }
  const height = Math.round(sourceWidth / targetAspect);
  return [0, Math.round((sourceHeight - height) / 2), sourceWidth, height];
}

/**
 * Owns a single opt-in camera/worker generation. Samples are normalized gesture
 * values only; raw video frames and landmarks never leave this module's local
 * asynchronous boundary.
 */
export function createCameraSession(options = {}) {
  const getUserMedia = options.getUserMedia ?? defaultGetUserMedia;
  const workerFactory = options.workerFactory ?? defaultWorkerFactory;
  const createImageBitmap = options.createImageBitmap ?? defaultCreateImageBitmap;
  const now = options.now ?? defaultNow;
  const scheduler = options.frameScheduler ?? defaultFrameScheduler({ now });
  const documentTarget = options.documentTarget ?? globalThis.document;
  const windowTarget = options.windowTarget ?? globalThis.window;
  const createVideo = options.createVideo
    ?? (() => createClippedVideo(documentTarget, options.videoHost));
  const onSample = options.onSample ?? (() => {});
  const onFallback = options.onFallback ?? (() => {});
  const startupTimeoutMs = options.startupTimeoutMs ?? STARTUP_TIMEOUT_MS;
  const maxSampleAgeMs = options.maxSampleAgeMs ?? MAX_SAMPLE_AGE_MS;

  let generation = 0;
  let session = null;
  let disposed = false;
  const releasedStreams = new WeakSet();
  const releasedWorkers = new WeakSet();

  function isCurrent(candidate) {
    return session === candidate && candidate.active && !disposed;
  }

  function offerTouch(candidate, reason) {
    if (candidate.fallbackOffered || !shouldOfferTouch(reason)) return;
    candidate.fallbackOffered = true;
    try {
      onFallback({ reason, message: FALLBACK_MESSAGE });
    } catch {
      // Host callbacks cannot retain camera resources.
    }
  }

  function detachVideo(candidate) {
    if (!candidate.video) return;
    if (candidate.video.srcObject === candidate.stream) candidate.video.srcObject = null;
    candidate.video.remove?.();
    candidate.video = null;
  }

  function releaseWorker(candidate) {
    const worker = candidate.worker;
    if (!worker || releasedWorkers.has(worker)) return;
    releasedWorkers.add(worker);
    try {
      worker.postMessage({ type: "dispose", generation: candidate.generation });
    } catch {
      // Termination below owns the final cleanup.
    }
    worker.removeEventListener?.("message", candidate.onWorkerMessage);
    worker.removeEventListener?.("error", candidate.onWorkerError);
    worker.terminate?.();
    candidate.worker = null;
  }

  function end(candidate, reason = "stopped") {
    if (!candidate || candidate.ended) return;
    candidate.ended = true;
    candidate.active = false;
    candidate.abortResolve(abortError(reason));
    if (candidate.timeoutId !== null) {
      globalThis.clearTimeout(candidate.timeoutId);
      candidate.timeoutId = null;
    }
    candidate.cancelFrames?.();
    candidate.cancelFrames = null;
    for (const remove of candidate.removers.splice(0)) remove();
    releaseWorker(candidate);
    detachVideo(candidate);
    releaseStream(candidate.stream, releasedStreams);
    candidate.stream = null;
    candidate.inFlight = false;
    if (session === candidate) {
      session = null;
      generation += 1;
    }
    offerTouch(candidate, reason);
  }

  async function waitForCurrent(candidate, promise) {
    const result = await Promise.race([promise, candidate.abortPromise]);
    if (result instanceof Error) throw result;
    if (!isCurrent(candidate)) throw abortError("stopped");
    return result;
  }

  function handleWorkerMessage(candidate, event) {
    const message = event?.data ?? event;
    if (!message || message.generation !== candidate.generation || !isCurrent(candidate)) return;
    if (message.type === "ready") {
      candidate.readyResolve();
      return;
    }
    if (message.type === "error") {
      if (candidate.inFlightSequence === message.sequence) candidate.inFlight = false;
      candidate.readyReject(namedError("AbortError", "Camera worker is unavailable."));
      offerTouch(candidate, "worker-error");
      end(candidate, "worker-error");
      return;
    }
    if (message.type !== "sample") return;
    if (message.sequence !== candidate.inFlightSequence) return;
    candidate.inFlight = false;
    candidate.inFlightSequence = null;
    const sample = sanitizeCameraSample(message);
    if (!sample || now() - sample.timestampMs > maxSampleAgeMs) return;
    const mirrored = sample.tracking
      ? { ...sample, palmX: 1 - sample.palmX }
      : sample;
    try {
      onSample(mirrored);
    } catch {
      // Consumer errors must not keep capture alive.
    }
  }

  async function deliverFrame(candidate, frame = {}) {
    if (!isCurrent(candidate) || candidate.inFlight) return;
    candidate.inFlight = true;
    const sequence = ++candidate.sequence;
    candidate.inFlightSequence = sequence;
    let bitmap = null;
    try {
      const [sx, sy, sw, sh] = cropFrame(candidate.video);
      bitmap = await createImageBitmap(candidate.video, sx, sy, sw, sh, {
        resizeWidth: WORKING_WIDTH,
        resizeHeight: WORKING_HEIGHT,
        resizeQuality: "low",
      });
      if (!isCurrent(candidate)) return;
      const timestampMs = Number.isFinite(frame.timestampMs) ? frame.timestampMs : now();
      candidate.worker.postMessage({
        type: "frame",
        generation: candidate.generation,
        sequence,
        timestampMs,
        bitmap,
      }, [bitmap]);
      bitmap = null;
    } catch {
      if (isCurrent(candidate)) {
        offerTouch(candidate, "worker-error");
        end(candidate, "worker-error");
      }
    } finally {
      closeBitmap(bitmap);
      if (!isCurrent(candidate)) candidate.inFlight = false;
    }
  }

  async function start() {
    if (disposed) throw abortError("disposed");
    if (session?.active) return session.startPromise;

    const candidate = {
      generation: ++generation,
      active: true,
      ended: false,
      stream: null,
      worker: null,
      video: null,
      sequence: 0,
      inFlight: false,
      inFlightSequence: null,
      cancelFrames: null,
      timeoutId: null,
      removers: [],
      fallbackOffered: false,
      readyResolve: null,
      readyReject: null,
      abortResolve: null,
      onWorkerMessage: null,
      onWorkerError: null,
    };
    candidate.abortPromise = new Promise(resolve => {
      candidate.abortResolve = resolve;
    });
    const readyPromise = new Promise((resolve, reject) => {
      candidate.readyResolve = resolve;
      candidate.readyReject = reject;
    });
    session = candidate;
    candidate.timeoutId = globalThis.setTimeout(() => end(candidate, "startup-timeout"), startupTimeoutMs);

    candidate.startPromise = (async () => {
      try {
        const mediaPromise = Promise.resolve().then(() => getUserMedia(CAMERA_CONSTRAINTS));
        mediaPromise.then(stream => {
          if (!isCurrent(candidate)) releaseStream(stream, releasedStreams);
        }, () => {});
        const stream = await waitForCurrent(candidate, mediaPromise);
        candidate.stream = stream;
        for (const track of stream.getTracks?.() ?? []) {
          addListener(track, "mute", () => end(candidate, "track-muted"), candidate.removers);
          addListener(track, "ended", () => end(candidate, "track-ended"), candidate.removers);
        }
        candidate.video = createVideo();
        candidate.video.srcObject = stream;
        addListener(documentTarget, "visibilitychange", () => {
          if (documentTarget.hidden) end(candidate, "document-hidden");
        }, candidate.removers);
        addListener(windowTarget, "pagehide", () => end(candidate, "pagehide"), candidate.removers);
        try {
          await candidate.video.play?.();
        } catch {
          // Some browsers resolve camera frames despite an eager play rejection.
        }
        if (!isCurrent(candidate)) throw abortError("stopped");

        candidate.worker = workerFactory();
        candidate.onWorkerMessage = event => handleWorkerMessage(candidate, event);
        candidate.onWorkerError = () => {
          candidate.readyReject(namedError("AbortError", "Camera worker is unavailable."));
          offerTouch(candidate, "worker-error");
          end(candidate, "worker-error");
        };
        candidate.worker.addEventListener?.("message", candidate.onWorkerMessage);
        candidate.worker.addEventListener?.("error", candidate.onWorkerError);
        candidate.worker.postMessage({ type: "init", generation: candidate.generation });
        await waitForCurrent(candidate, readyPromise);
        if (!isCurrent(candidate)) throw abortError("stopped");
        candidate.cancelFrames = scheduler.start(candidate.video, frame => deliverFrame(candidate, frame));
        if (candidate.timeoutId !== null) {
          globalThis.clearTimeout(candidate.timeoutId);
          candidate.timeoutId = null;
        }
      } catch (error) {
        const reason = error?.name === "TimeoutError" ? "startup-timeout" : workerErrorReason(error);
        offerTouch(candidate, reason);
        end(candidate, reason);
        throw error;
      }
    })();
    return candidate.startPromise;
  }

  return Object.freeze({
    start,
    stop(reason = "stopped") {
      end(session, reason);
    },
    setVisibility(visible) {
      if (!visible) end(session, "document-hidden");
    },
    dispose() {
      disposed = true;
      end(session, "disposed");
    },
  });
}
