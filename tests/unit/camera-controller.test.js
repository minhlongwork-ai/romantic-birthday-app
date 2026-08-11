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
  assert.deepEqual(statuses, ['unsupported']);
  assert.equal(controller.engaged, false);
});

test('camera maps permission and device failures to stable terminal states', async (t) => {
  const cases = [
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotReadableError', 'busy'],
    ['AbortError', 'busy'],
    ['NotFoundError', 'unsupported'],
    ['OverconstrainedError', 'unsupported'],
    ['UnknownError', 'error'],
  ];
  for (const [name, expected] of cases) {
    await t.test(`${name} becomes ${expected}`, async () => {
      const statuses = [];
      const error = new Error(name);
      error.name = name;
      const controller = createCameraController({
        video: { srcObject: null, play: async () => {} },
        mediaDevices: { getUserMedia: async () => { throw error; } },
        onStatus: status => statuses.push(status),
      });
      assert.equal(await controller.start(), false);
      assert.deepEqual(statuses, ['requesting', expected]);
      assert.equal(controller.engaged, false);
    });
  }
});

test('camera reports unsupported when the media API is missing', async () => {
  const statuses = [];
  const controller = createCameraController({
    video: { srcObject: null, play: async () => {} },
    mediaDevices: {},
    onStatus: status => statuses.push(status),
  });
  assert.equal(await controller.start(), false);
  assert.deepEqual(statuses, ['unsupported']);
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
  assert.deepEqual(statuses, ['requesting', 'streaming', 'detector-loading']);

  resolveDetector({ send: async () => {}, close() {} });
  assert.equal(await startPromise, true);
  assert.equal(controller.active, true);
  assert.deepEqual(statuses, [
    'requesting',
    'streaming',
    'detector-loading',
    'active',
  ]);
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
  assert.deepEqual(statuses, [
    'requesting',
    'streaming',
    'detector-loading',
    'timeout',
  ]);
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
    'detector-loading',
    'active',
    'timeout',
  ]);
});

test('camera uses injected timeout schedulers and cancels every settled timer', async () => {
  const statuses = [];
  const timers = new Map();
  let nextTimer = 0;
  let cancelledTimers = 0;
  const controller = createCameraController({
    video: { srcObject: null, play: async () => {} },
    mediaDevices: {
      getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
    },
    createDetector: () => new Promise(() => {}),
    startupTimeoutMs: 100,
    scheduleTimeout(callback) {
      const id = ++nextTimer;
      timers.set(id, callback);
      return id;
    },
    cancelTimeout(id) {
      if (timers.delete(id)) cancelledTimers += 1;
    },
    onStatus: status => statuses.push(status),
  });

  const startPromise = controller.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(statuses.at(-1), 'detector-loading');
  assert.equal(timers.size, 1);
  timers.values().next().value();

  assert.equal(await startPromise, false);
  assert.equal(statuses.at(-1), 'timeout');
  assert.equal(timers.size, 0);
  assert.ok(cancelledTimers >= 2);
});

test('a permission stream resolving after timeout is still released exactly once', async () => {
  const statuses = [];
  let resolvePermission;
  let trackStops = 0;
  const stream = {
    getTracks: () => [{ stop: () => { trackStops += 1; } }],
  };
  const video = { srcObject: null, play: async () => {} };
  const controller = createCameraController({
    video,
    mediaDevices: {
      getUserMedia: () => new Promise(resolve => { resolvePermission = resolve; }),
    },
    startupTimeoutMs: 5,
    onStatus: status => statuses.push(status),
  });

  assert.equal(await controller.start(), false);
  resolvePermission(stream);
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(trackStops, 1);
  assert.equal(video.srcObject, null);
  assert.deepEqual(statuses, ['requesting', 'timeout']);
  controller.stop();
  assert.equal(trackStops, 1);
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

test('double start requests one stream and double stop disposes it once', async () => {
  let permissionRequests = 0;
  let trackStops = 0;
  let detectorCloses = 0;
  let resolvePermission;
  const stream = {
    getTracks: () => [{ stop: () => { trackStops += 1; } }],
  };
  const controller = createCameraController({
    video: { srcObject: null, play: async () => {} },
    mediaDevices: {
      getUserMedia: () => {
        permissionRequests += 1;
        return new Promise(resolve => { resolvePermission = resolve; });
      },
    },
    createDetector: async () => ({
      send: async () => {},
      close: () => { detectorCloses += 1; },
    }),
    scheduleFrame: () => 12,
    cancelFrame: () => {},
  });

  const first = controller.start();
  const second = controller.start();
  assert.equal(permissionRequests, 1);
  resolvePermission(stream);
  assert.deepEqual(await Promise.all([first, second]), [true, true]);

  controller.stop();
  controller.stop();
  assert.equal(trackStops, 1);
  assert.equal(detectorCloses, 1);
});

test('stopping during detector loading cancels timers and closes a late detector', async () => {
  let resolveDetector;
  let trackStops = 0;
  let detectorCloses = 0;
  const pendingTimers = new Map();
  let nextTimer = 0;
  const video = { srcObject: null, play: async () => {} };
  const controller = createCameraController({
    video,
    mediaDevices: {
      getUserMedia: async () => ({
        getTracks: () => [{ stop: () => { trackStops += 1; } }],
      }),
    },
    createDetector: () => new Promise(resolve => { resolveDetector = resolve; }),
    scheduleTimeout(callback) {
      const id = ++nextTimer;
      pendingTimers.set(id, callback);
      return id;
    },
    cancelTimeout(id) {
      pendingTimers.delete(id);
    },
  });

  const startPromise = controller.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(pendingTimers.size, 1);
  controller.stop();
  assert.equal(await startPromise, false);
  assert.equal(pendingTimers.size, 0);
  resolveDetector({ send: async () => {}, close: () => { detectorCloses += 1; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(trackStops, 1);
  assert.equal(detectorCloses, 1);
  assert.equal(video.srcObject, null);
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
