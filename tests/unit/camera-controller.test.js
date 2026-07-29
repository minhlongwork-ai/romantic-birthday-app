import test from 'node:test';
import assert from 'node:assert/strict';

import { createCameraController } from '../../src/lib/camera-controller.js';

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
