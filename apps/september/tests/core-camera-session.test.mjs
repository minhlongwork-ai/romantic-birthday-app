import assert from "node:assert/strict";
import { mock } from "node:test";
import test from "node:test";

import { createCameraSession } from "../src/core/camera-session.mjs";

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const callbacks = listeners.get(type) ?? new Set();
      callbacks.add(listener);
      listeners.set(type, callbacks);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    emit(type) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener({ type });
    },
  };
}

function fakeTrack() {
  return { ...createEventTarget(), stop: mock.fn() };
}

function fakeStream(track = fakeTrack()) {
  return { track, getTracks: () => [track] };
}

function fakeVideo() {
  return {
    ...createEventTarget(),
    autoplay: false,
    muted: false,
    playsInline: false,
    controls: true,
    tabIndex: 0,
    style: {},
    setAttribute: mock.fn(),
    remove: mock.fn(),
    play: async () => undefined,
    srcObject: null,
  };
}

class FakeWorker {
  constructor({ readyOnInit = true } = {}) {
    this.readyOnInit = readyOnInit;
    this.messages = [];
    this.terminated = 0;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const callbacks = this.listeners.get(type) ?? new Set();
    callbacks.add(listener);
    this.listeners.set(type, callbacks);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(message) {
    this.messages.push(message);
    if (message.type === "init" && this.readyOnInit) {
      queueMicrotask(() => this.emit({ type: "ready", generation: message.generation }));
    }
  }

  emit(data) {
    for (const listener of [...(this.listeners.get("message") ?? [])]) listener({ data });
  }

  terminate() {
    this.terminated += 1;
  }
}

class FakeFrameScheduler {
  start(video, callback) {
    this.video = video;
    this.callback = callback;
    return () => {
      this.callback = null;
      this.stopped = (this.stopped ?? 0) + 1;
    };
  }

  fire(frame) {
    this.callback?.(frame);
  }
}

function fakeVideoFrame(timestampMs) {
  return { timestampMs };
}

function cameraOptions(overrides = {}) {
  const stream = fakeStream();
  const worker = new FakeWorker();
  return {
    stream,
    worker,
    options: {
      getUserMedia: async () => stream,
      workerFactory: () => worker,
      createVideo: fakeVideo,
      createImageBitmap: async () => ({ close: mock.fn() }),
      frameScheduler: new FakeFrameScheduler(),
      now: () => 100,
      ...overrides,
    },
  };
}

test("late getUserMedia resolution after stop releases tracks and cannot start a worker", async () => {
  const deferred = createDeferred();
  const track = fakeTrack();
  const workerFactory = mock.fn();
  const session = createCameraSession({
    getUserMedia: () => deferred.promise,
    workerFactory,
    createVideo: fakeVideo,
  });
  const starting = session.start();

  session.stop("touch-selected");
  deferred.resolve(fakeStream(track));

  await assert.rejects(starting, { name: "AbortError" });
  assert.equal(track.stop.mock.calls.length, 1);
  assert.equal(workerFactory.mock.calls.length, 0);
});

test("one busy inference drops newer frames and stale worker samples are ignored", async () => {
  const worker = new FakeWorker();
  const scheduler = new FakeFrameScheduler();
  const samples = [];
  const bitmaps = [];
  const session = createCameraSession({
    getUserMedia: async () => fakeStream(),
    workerFactory: () => worker,
    createVideo: fakeVideo,
    createImageBitmap: async () => {
      const bitmap = { close: mock.fn() };
      bitmaps.push(bitmap);
      return bitmap;
    },
    frameScheduler: scheduler,
    now: () => 100,
    onSample: sample => samples.push(sample),
  });

  await session.start();
  scheduler.fire(fakeVideoFrame(1));
  scheduler.fire(fakeVideoFrame(2));
  scheduler.fire(fakeVideoFrame(3));
  await new Promise(resolve => queueMicrotask(resolve));
  assert.equal(worker.messages.filter(({ type }) => type === "frame").length, 1);

  worker.emit({ type: "sample", generation: 0, sequence: 1, timestampMs: 1, tracking: true, palmX: 0.5, palmY: 0.5, openness: 1 });
  worker.emit({ type: "sample", generation: 1, sequence: 1, timestampMs: 1, tracking: true, palmX: 0.5, palmY: 0.5, openness: 1 });
  assert.deepEqual(samples.map(({ generation, sequence }) => [generation, sequence]), [[1, 1]]);
  assert.equal(bitmaps[0].close.mock.calls.length, 0);
});

test("permission denial is preserved, while a worker timeout releases every acquired resource", async () => {
  const denied = createCameraSession({
    getUserMedia: async () => {
      throw Object.assign(new Error("Permission denied"), { name: "NotAllowedError" });
    },
    createVideo: fakeVideo,
  });
  await assert.rejects(denied.start(), { name: "NotAllowedError" });

  const neverReadyWorker = new FakeWorker({ readyOnInit: false });
  const { stream, options } = cameraOptions({
    workerFactory: () => neverReadyWorker,
    startupTimeoutMs: 1,
  });
  const timedOut = createCameraSession(options);
  await assert.rejects(timedOut.start(), { name: "TimeoutError" });
  assert.equal(stream.track.stop.mock.calls.length, 1);
  assert.equal(neverReadyWorker.terminated, 1);
});

test("hidden documents and muted tracks stop frames, tracks, and workers exactly once", async () => {
  const documentTarget = { ...createEventTarget(), hidden: false };
  const windowTarget = createEventTarget();
  const video = fakeVideo();
  const { stream, worker, options } = cameraOptions({
    documentTarget,
    windowTarget,
    createVideo: () => video,
  });
  const session = createCameraSession(options);
  await session.start();

  documentTarget.hidden = true;
  documentTarget.emit("visibilitychange");
  stream.track.emit("mute");
  windowTarget.emit("pagehide");
  session.stop("branch-locked");
  session.dispose();

  assert.equal(stream.track.stop.mock.calls.length, 1);
  assert.equal(worker.terminated, 1);
  assert.equal(options.frameScheduler.stopped, 1);
  assert.equal(video.srcObject, null);
  assert.equal(video.remove.mock.calls.length, 1);
});

test("camera callbacks contain only validated gesture fields and reject stale samples", async () => {
  const { worker, options } = cameraOptions({ now: () => 1_000 });
  const samples = [];
  const fallbacks = [];
  const session = createCameraSession({
    ...options,
    onSample: sample => samples.push(sample),
    onFallback: fallback => fallbacks.push(fallback),
  });
  await session.start();

  options.frameScheduler.fire(fakeVideoFrame(900));
  await new Promise(resolve => queueMicrotask(resolve));

  worker.emit({
    type: "sample",
    generation: 1,
    sequence: 1,
    timestampMs: 900,
    tracking: true,
    palmX: 0.2,
    palmY: 0.4,
    openness: 0.8,
    landmarks: [{ x: 0.2, y: 0.4 }],
    bitmap: "forbidden",
  });
  options.frameScheduler.fire(fakeVideoFrame(749));
  await new Promise(resolve => queueMicrotask(resolve));
  worker.emit({
    type: "sample",
    generation: 1,
    sequence: 2,
    timestampMs: 749,
    tracking: true,
    palmX: 0.5,
    palmY: 0.5,
    openness: 1,
  });
  worker.emit({ type: "error", generation: 1, detail: "model internals" });

  assert.deepEqual(samples, [{
    generation: 1,
    sequence: 1,
    timestampMs: 900,
    tracking: true,
    palmX: 0.8,
    palmY: 0.4,
    openness: 0.8,
  }]);
  assert.deepEqual(fallbacks, [{ reason: "worker-error", message: "Chạm để tiếp tục" }]);
});

test("dispose prevents a second start and late bitmap work closes its local bitmap", async () => {
  const bitmapDeferred = createDeferred();
  const bitmap = { close: mock.fn() };
  const scheduler = new FakeFrameScheduler();
  const { stream, options } = cameraOptions({
    frameScheduler: scheduler,
    createImageBitmap: () => bitmapDeferred.promise,
  });
  const session = createCameraSession(options);
  await session.start();
  scheduler.fire(fakeVideoFrame(10));
  session.dispose();
  bitmapDeferred.resolve(bitmap);
  await new Promise(resolve => queueMicrotask(resolve));

  assert.equal(bitmap.close.mock.calls.length, 1);
  assert.equal(stream.track.stop.mock.calls.length, 1);
  await assert.rejects(session.start(), { name: "AbortError" });
});
