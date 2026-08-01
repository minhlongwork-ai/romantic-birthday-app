import assert from "node:assert/strict";
import test from "node:test";

import {
  createPhotoRevealLifecycle,
  getPhotoRevealTiming,
} from "../src/herbarium/photo-reveal.js";

test("uses the planned 1.6 second reveal choreography", () => {
  assert.deepEqual(getPhotoRevealTiming(false), {
    duration: 1_600,
    topLeft: { start: 120, end: 880, duration: 760 },
    bottomRight: { start: 260, end: 1_020, duration: 760 },
  });
});

test("collapses the reveal to a 180 ms crossfade for reduced motion", () => {
  assert.deepEqual(getPhotoRevealTiming(true), {
    duration: 180,
    topLeft: { start: 0, end: 180, duration: 180 },
    bottomRight: { start: 0, end: 180, duration: 180 },
  });
});

test("completes after the requested duration and cleans up once", async () => {
  let scheduled;
  let cleanupCount = 0;
  const lifecycle = createPhotoRevealLifecycle({
    duration: 1_600,
    setTimer(callback, delay) {
      scheduled = { callback, delay };
      return 42;
    },
    clearTimer() {},
    onCleanup() {
      cleanupCount += 1;
    },
  });

  assert.equal(scheduled.delay, 1_600);
  scheduled.callback();
  assert.equal(await lifecycle.result, "completed");

  lifecycle.cleanup();
  lifecycle.cleanup();
  assert.equal(cleanupCount, 1);
});

test("aborts an in-flight reveal and ignores a late timer", async () => {
  const controller = new AbortController();
  let scheduled;
  let clearedTimer;
  let cleanupCount = 0;
  const lifecycle = createPhotoRevealLifecycle({
    duration: 1_600,
    signal: controller.signal,
    setTimer(callback) {
      scheduled = callback;
      return 17;
    },
    clearTimer(timerId) {
      clearedTimer = timerId;
    },
    onCleanup() {
      cleanupCount += 1;
    },
  });

  controller.abort();
  assert.equal(await lifecycle.result, "aborted");
  assert.equal(clearedTimer, 17);

  scheduled();
  lifecycle.cleanup();
  assert.equal(await lifecycle.result, "aborted");
  assert.equal(cleanupCount, 1);
});

test("does not schedule work when the signal is already aborted", async () => {
  const controller = new AbortController();
  controller.abort();
  let scheduled = false;
  let cleanupCount = 0;

  const lifecycle = createPhotoRevealLifecycle({
    signal: controller.signal,
    setTimer() {
      scheduled = true;
    },
    clearTimer() {},
    onCleanup() {
      cleanupCount += 1;
    },
  });

  assert.equal(await lifecycle.result, "aborted");
  assert.equal(scheduled, false);
  lifecycle.cleanup();
  assert.equal(cleanupCount, 1);
});
