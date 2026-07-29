import test from 'node:test';
import assert from 'node:assert/strict';

import { createAudioController } from '../../src/lib/audio-controller.js';

test('audio starts only on request and toggle pauses active playback', async () => {
  const events = [];
  const audio = {
    paused: true,
    currentTime: 0,
    play: async () => {
      audio.paused = false;
      events.push('play');
    },
    pause: () => {
      audio.paused = true;
      events.push('pause');
    },
  };

  const controller = createAudioController({
    audio,
    lyrics: [],
    scheduleFrame: () => 1,
    cancelFrame: () => {},
  });

  assert.equal(controller.playing, false);
  assert.equal(await controller.start(), true);
  assert.equal(controller.playing, true);

  await controller.toggle();
  assert.equal(controller.playing, false);
  assert.deepEqual(events, ['play', 'pause']);
});

test('concurrent starts share one playback request and pause stops the lyrics loop', async () => {
  let resolvePlayback;
  let playCalls = 0;
  let scheduledFrames = 0;
  const cancelledFrames = [];
  const audio = {
    paused: true,
    currentTime: 0,
    play: () => {
      playCalls += 1;
      return new Promise(resolve => {
        resolvePlayback = () => {
          audio.paused = false;
          resolve();
        };
      });
    },
    pause: () => {
      audio.paused = true;
    },
  };

  const controller = createAudioController({
    audio,
    lyrics: [{ time: 0, text: 'A lyric' }],
    lyricsElement: { textContent: '', hidden: true },
    scheduleFrame: () => {
      scheduledFrames += 1;
      return scheduledFrames;
    },
    cancelFrame: id => cancelledFrames.push(id),
  });

  const firstStart = controller.start();
  const secondStart = controller.start();
  assert.equal(playCalls, 1);
  resolvePlayback();
  assert.equal(await firstStart, true);
  assert.equal(await secondStart, true);
  assert.equal(scheduledFrames, 1);

  controller.pause();
  assert.deepEqual(cancelledFrames, [1]);
});

test('playback failure is reported without starting a lyrics loop', async () => {
  const failure = new Error('missing audio');
  const states = [];
  const audio = {
    paused: true,
    currentTime: 0,
    play: async () => {
      throw failure;
    },
    pause: () => {},
  };

  const controller = createAudioController({
    audio,
    lyrics: [{ time: 0, text: 'A lyric' }],
    lyricsElement: { textContent: '', hidden: true },
    onStateChange: state => states.push(state),
    scheduleFrame: () => {
      throw new Error('lyrics loop must not start');
    },
    cancelFrame: () => {},
  });

  assert.equal(await controller.start(), false);
  assert.deepEqual(states, [{ playing: false, error: failure }]);
});

test('pause invalidates a playback request that resolves later', async () => {
  let resolvePlayback;
  let scheduledFrames = 0;
  const audio = {
    paused: true,
    currentTime: 0,
    play: () =>
      new Promise(resolve => {
        resolvePlayback = () => {
          audio.paused = false;
          resolve();
        };
      }),
    pause: () => {
      audio.paused = true;
    },
  };
  const controller = createAudioController({
    audio,
    lyrics: [{ time: 0, text: 'A lyric' }],
    lyricsElement: { textContent: '', hidden: true },
    scheduleFrame: () => {
      scheduledFrames += 1;
      return scheduledFrames;
    },
    cancelFrame: () => {},
  });

  const pendingStart = controller.start();
  controller.pause();
  resolvePlayback();

  assert.equal(await pendingStart, false);
  assert.equal(controller.playing, false);
  assert.equal(scheduledFrames, 0);
});

test('a native media error is surfaced after play has begun', () => {
  const failure = new Error('corrupt media');
  const states = [];
  const listeners = {};
  const audio = {
    paused: false,
    currentTime: 0,
    error: failure,
    play: async () => {},
    pause: () => {
      audio.paused = true;
    },
    addEventListener: (type, callback) => {
      listeners[type] = callback;
    },
    removeEventListener: () => {},
  };
  createAudioController({
    audio,
    onStateChange: state => states.push(state),
    scheduleFrame: () => 1,
    cancelFrame: () => {},
  });

  listeners.error();
  assert.deepEqual(states, [{ playing: false, error: failure }]);
});
