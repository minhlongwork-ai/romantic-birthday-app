import test from 'node:test';
import assert from 'node:assert/strict';

import { createCameraController } from '../../src/lib/camera-controller.js';

test('camera explains insecure origins without requesting device access', async () => {
  const statuses = [];
  let permissionRequests = 0;
  const controller = createCameraController({
    video: { srcObject: null, play: async () => {} },
    secureContext: false,
    mediaDevices: {
      getUserMedia: async () => {
        permissionRequests += 1;
        return { getTracks: () => [] };
      },
    },
    onStatus: status => statuses.push(status),
  });

  assert.equal(await controller.start(), false);
  assert.equal(permissionRequests, 0);
  assert.deepEqual(statuses, ['insecure']);
  assert.equal(controller.engaged, false);
});

test('camera exposes the live preview before gesture detection finishes loading', async () => {
  const statuses = [];
  let resolveDetector;
  const stream = { getTracks: () => [{ stop() {} }] };
  const video = {
    srcObject: null,
    play: async () => {},
  };
  const controller = createCameraController({
    video,
    mediaDevices: {
      getUserMedia: async () => stream,
    },
    createDetector: () =>
      new Promise(resolve => {
        resolveDetector = resolve;
      }),
    onStatus: status => statuses.push(status),
    scheduleFrame: () => 1,
    cancelFrame: () => {},
  });

  const startPromise = controller.start();
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(video.srcObject, stream);
  assert.deepEqual(statuses, ['requesting', 'streaming']);

  resolveDetector({ send: async () => {}, close() {} });
  assert.equal(await startPromise, true);
  assert.equal(controller.active, true);
  assert.deepEqual(statuses, ['requesting', 'streaming', 'active']);
  controller.stop();
});

test('camera times out stalled detector startup and releases the stream', async () => {
  const statuses = [];
  let trackStops = 0;
  const video = {
    srcObject: null,
    play: async () => {},
  };
  const controller = createCameraController({
    video,
    mediaDevices: {
      getUserMedia: async () => ({
        getTracks: () => [
          {
            stop() {
              trackStops += 1;
            },
          },
        ],
      }),
    },
    createDetector: () => new Promise(() => {}),
    startupTimeoutMs: 10,
    onStatus: status => statuses.push(status),
  });

  const result = await Promise.race([
    controller.start(),
    new Promise(resolve => setTimeout(() => resolve('still-pending'), 35)),
  ]);

  assert.equal(result, false);
  assert.equal(trackStops, 1);
  assert.equal(video.srcObject, null);
  assert.equal(controller.engaged, false);
  assert.deepEqual(statuses, ['requesting', 'streaming', 'timeout']);
});

test('camera stops a detector frame that stalls instead of appearing active forever', async () => {
  const statuses = [];
  let frameCallback;
  let trackStops = 0;
  let detectorCloses = 0;
  const controller = createCameraController({
    video: { srcObject: null, play: async () => {} },
    mediaDevices: {
      getUserMedia: async () => ({
        getTracks: () => [
          {
            stop() {
              trackStops += 1;
            },
          },
        ],
      }),
    },
    createDetector: async () => ({
      send: () => new Promise(() => {}),
      close() {
        detectorCloses += 1;
      },
    }),
    frameTimeoutMs: 10,
    onStatus: status => statuses.push(status),
    scheduleFrame: callback => {
      frameCallback = callback;
      return 1;
    },
    cancelFrame: () => {},
  });

  assert.equal(await controller.start(), true);
  frameCallback();
  await new Promise(resolve => setTimeout(resolve, 30));

  assert.equal(controller.engaged, false);
  assert.equal(trackStops, 1);
  assert.equal(detectorCloses, 1);
  assert.deepEqual(statuses, [
    'requesting',
    'streaming',
    'active',
    'processing-timeout',
  ]);
});

test('camera is opt-in and releases every media track when stopped', async () => {
  const events = [];
  const track = { stop: () => events.push('track:stop') };
  const stream = { getTracks: () => [track] };
  const video = {
    srcObject: null,
    play: async () => events.push('video:play'),
  };

  const controller = createCameraController({
    video,
    mediaDevices: {
      getUserMedia: async () => {
        events.push('permission:request');
        return stream;
      },
    },
    createDetector: async () => ({
      send: async () => {},
      close: () => events.push('detector:close'),
    }),
    scheduleFrame: () => 7,
    cancelFrame: id => events.push(`frame:cancel:${id}`),
  });

  assert.equal(controller.active, false);
  assert.equal(controller.engaged, false);
  assert.equal(await controller.start(), true);
  assert.equal(controller.active, true);
  assert.equal(controller.engaged, true);
  assert.equal(video.srcObject, stream);

  controller.stop();
  assert.equal(controller.active, false);
  assert.equal(controller.engaged, false);
  assert.equal(video.srcObject, null);
  assert.deepEqual(events, [
    'permission:request',
    'video:play',
    'frame:cancel:7',
    'track:stop',
    'detector:close',
  ]);
});

test('stopping during a pending permission request releases the late stream', async () => {
  const events = [];
  let resolvePermission;
  const track = { stop: () => events.push('track:stop') };
  const stream = { getTracks: () => [track] };
  const video = {
    srcObject: null,
    play: async () => events.push('video:play'),
  };

  const controller = createCameraController({
    video,
    mediaDevices: {
      getUserMedia: () =>
        new Promise(resolve => {
          resolvePermission = resolve;
        }),
    },
    createDetector: async () => {
      events.push('detector:create');
      return { send: async () => {}, close: () => {} };
    },
    scheduleFrame: () => 7,
    cancelFrame: () => {},
  });

  const startPromise = controller.start();
  controller.stop();
  resolvePermission(stream);

  assert.equal(await startPromise, false);
  assert.equal(controller.active, false);
  assert.equal(video.srcObject, null);
  assert.deepEqual(events, ['track:stop']);
});

test('results from a stopped detector cannot affect a restarted camera session', async () => {
  const statuses = [];
  const resultHandlers = [];
  let gestures = 0;
  const video = { srcObject: null, play: async () => {} };

  const controller = createCameraController({
    video,
    mediaDevices: {
      getUserMedia: async () => ({
        getTracks: () => [{ stop() {} }],
      }),
    },
    createDetector: async onResults => {
      resultHandlers.push(onResults);
      return { send: async () => {}, close() {} };
    },
    onStatus: status => statuses.push(status),
    onGesture: () => {
      gestures += 1;
    },
    scheduleFrame: () => 1,
    cancelFrame: () => {},
    now: () => 1000,
  });

  await controller.start();
  controller.stop();
  await controller.start();
  const statusCount = statuses.length;

  const landmarks = Array.from({ length: 9 }, () => ({ x: 0, y: 0 }));
  landmarks[8] = { x: 0.1, y: 0.1 };
  resultHandlers[0]({ multiHandLandmarks: [landmarks] });
  landmarks[8] = { x: 0.9, y: 0.9 };
  resultHandlers[0]({ multiHandLandmarks: [landmarks] });

  assert.equal(statuses.length, statusCount);
  assert.equal(gestures, 0);
});
