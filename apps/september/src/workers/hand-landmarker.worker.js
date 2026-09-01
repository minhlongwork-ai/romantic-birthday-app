import { derivePalmOpenness } from "../core/workshop-gesture.mjs";

const visionBundleUrl = "/september/vendor/mediapipe/vision_bundle.mjs";
const wasmBasePath = "/september/vendor/mediapipe";
const modelAssetPath = "/september/models/hand-landmarker-float16-v1.task";

let current = null;

function closeBitmap(bitmap) {
  try {
    bitmap?.close?.();
  } catch {
    // A bitmap can be closed by a stale disposal race.
  }
}

function closeLandmarker(landmarker) {
  try {
    landmarker?.close?.();
  } catch {
    // The worker is terminating, so no recovery work is required.
  }
}

function postAdapterError(generation, sequence) {
  const message = { type: "error", generation, code: "ADAPTER_FAILURE" };
  if (Number.isInteger(sequence)) message.sequence = sequence;
  postMessage(message);
}

async function initialize(generation) {
  const next = { generation, landmarker: null, disposed: false };
  const previous = current;
  current = next;
  previous && closeLandmarker(previous.landmarker);
  try {
    const vision = await import(/* @vite-ignore */ visionBundleUrl);
    const fileset = await vision.FilesetResolver.forVisionTasks(wasmBasePath);
    const landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath, delegate: "CPU" },
      runningMode: "VIDEO",
      numHands: 1,
    });
    if (current !== next || next.disposed) {
      closeLandmarker(landmarker);
      return;
    }
    next.landmarker = landmarker;
    postMessage({ type: "ready", generation });
  } catch {
    if (current === next && !next.disposed) postAdapterError(generation);
  }
}

function sampleFrom(result, generation, sequence, timestampMs) {
  const landmarks = result?.landmarks?.[0];
  if (!Array.isArray(landmarks) || landmarks.length !== 21) {
    return { type: "sample", generation, sequence, timestampMs, tracking: false };
  }
  const wrist = landmarks[0];
  if (!Number.isFinite(wrist?.x) || !Number.isFinite(wrist?.y)) {
    return { type: "sample", generation, sequence, timestampMs, tracking: false };
  }
  try {
    return {
      type: "sample",
      generation,
      sequence,
      timestampMs,
      tracking: true,
      palmX: wrist.x,
      palmY: wrist.y,
      openness: derivePalmOpenness(landmarks),
    };
  } catch {
    return { type: "sample", generation, sequence, timestampMs, tracking: false };
  }
}

function infer({ generation, sequence, timestampMs, bitmap }) {
  try {
    if (!current || current.disposed || current.generation !== generation || !current.landmarker) return;
    const result = current.landmarker.detectForVideo(bitmap, timestampMs);
    if (!current || current.disposed || current.generation !== generation) return;
    postMessage(sampleFrom(result, generation, sequence, timestampMs));
  } catch {
    if (current?.generation === generation && !current.disposed) postAdapterError(generation, sequence);
  } finally {
    closeBitmap(bitmap);
  }
}

function dispose(generation) {
  if (!current || current.generation !== generation) return;
  current.disposed = true;
  closeLandmarker(current.landmarker);
  current = null;
}

self.addEventListener("message", event => {
  const message = event?.data ?? {};
  if (!Number.isInteger(message.generation)) return;
  if (message.type === "init") initialize(message.generation);
  else if (message.type === "frame") infer(message);
  else if (message.type === "dispose") dispose(message.generation);
});
