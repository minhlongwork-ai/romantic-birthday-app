import assert from "node:assert/strict";
import test from "node:test";

import { createSoundtrackPlayer } from "../src/herbarium/soundtrack-controller.js";

class FakeAudio extends EventTarget {
  constructor({ rejectPlay = false } = {}) {
    super();
    this.currentTime = 0;
    this.loop = false;
    this.pauseCalls = 0;
    this.paused = true;
    this.playCalls = 0;
    this.preload = "auto";
    this.rejectPlay = rejectPlay;
    this.src = "";
    this.volume = 1;
  }

  async play() {
    this.playCalls += 1;
    if (this.rejectPlay) throw new Error("playback blocked");
    this.paused = false;
    this.dispatchEvent(new Event("playing"));
  }

  pause() {
    this.pauseCalls += 1;
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }

  load() {}

  removeAttribute(name) {
    if (name === "src") this.src = "";
  }
}

const soundtrackConfig = Object.freeze({
  title: "Có Em",
  artist: "Madihu ft. Low G",
  src: "/audio/co-em-madihu-low-g.mp3",
  volume: 0.2,
  loop: true,
  fadeDurationMs: 0,
});

test("starts the self-hosted soundtrack lazily after a user action", async () => {
  const createdAudio = [];
  const player = createSoundtrackPlayer(soundtrackConfig, {
    createAudio() {
      const audio = new FakeAudio();
      createdAudio.push(audio);
      return audio;
    },
  });

  assert.equal(createdAudio.length, 0);
  assert.equal(player.getState().status, "idle");

  assert.equal(await player.play(), true);

  assert.equal(createdAudio.length, 1);
  assert.equal(createdAudio[0].src, soundtrackConfig.src);
  assert.equal(createdAudio[0].preload, "none");
  assert.equal(createdAudio[0].loop, true);
  assert.equal(createdAudio[0].volume, soundtrackConfig.volume);
  assert.equal(createdAudio[0].playCalls, 1);
  assert.equal(player.getState().status, "playing");

  player.destroy();
});

test("toggles playback and resets the soundtrack for replay", async () => {
  const audio = new FakeAudio();
  const player = createSoundtrackPlayer(soundtrackConfig, {
    createAudio: () => audio,
  });

  await player.play();
  player.toggle();

  assert.equal(audio.pauseCalls, 1);
  assert.equal(player.getState().status, "paused");

  await player.toggle();
  assert.equal(audio.playCalls, 2);
  assert.equal(player.getState().status, "playing");

  audio.currentTime = 42;
  player.reset();

  assert.equal(audio.currentTime, 0);
  assert.equal(audio.src, "");
  assert.equal(player.getState().status, "idle");

  player.destroy();
});

test("pauses on a hidden tab and resumes only when playback was active", async () => {
  const visibilityTarget = new EventTarget();
  visibilityTarget.hidden = false;
  const audio = new FakeAudio();
  const player = createSoundtrackPlayer(soundtrackConfig, {
    createAudio: () => audio,
    visibilityTarget,
  });

  await player.play();
  visibilityTarget.hidden = true;
  visibilityTarget.dispatchEvent(new Event("visibilitychange"));

  assert.equal(audio.pauseCalls, 1);
  assert.equal(player.getState().status, "paused");

  visibilityTarget.hidden = false;
  visibilityTarget.dispatchEvent(new Event("visibilitychange"));
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(audio.playCalls, 2);
  assert.equal(player.getState().status, "playing");

  player.pause();
  visibilityTarget.hidden = true;
  visibilityTarget.dispatchEvent(new Event("visibilitychange"));
  visibilityTarget.hidden = false;
  visibilityTarget.dispatchEvent(new Event("visibilitychange"));
  await Promise.resolve();

  assert.equal(audio.playCalls, 2);

  player.destroy();
});

test("reports an audio failure without throwing or blocking the card", async () => {
  const player = createSoundtrackPlayer(soundtrackConfig, {
    createAudio: () => new FakeAudio({ rejectPlay: true }),
  });

  await assert.doesNotReject(() => player.play());
  assert.equal(await player.play(), false);
  assert.equal(player.getState().status, "error");

  player.destroy();
});

test("publishes playback state for the persistent music control", async () => {
  const player = createSoundtrackPlayer(soundtrackConfig, {
    createAudio: () => new FakeAudio(),
  });
  const statuses = [];
  const unsubscribe = player.subscribe(({ status }) => statuses.push(status));

  await player.play();
  player.pause();
  player.reset();
  unsubscribe();

  assert.deepEqual(statuses, ["idle", "loading", "playing", "paused", "idle"]);

  player.destroy();
});

test("fades the soundtrack to its configured background volume", async () => {
  const frames = [];
  const audio = new FakeAudio();
  const player = createSoundtrackPlayer(
    { ...soundtrackConfig, fadeDurationMs: 1000 },
    {
      createAudio: () => audio,
      requestFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      },
      cancelFrame() {},
    },
  );

  await player.play();
  assert.equal(audio.volume, 0);

  frames.shift()(0);
  frames.shift()(500);
  assert.equal(audio.volume, 0.1);

  frames.shift()(1000);
  assert.equal(audio.volume, soundtrackConfig.volume);

  player.destroy();
});

test("loads lyrics lazily and publishes only the cue active at playback time", async () => {
  const audio = new FakeAudio();
  let loadCalls = 0;
  const player = createSoundtrackPlayer(
    { ...soundtrackConfig, lyricsSrc: "/audio/test-lyrics.txt" },
    {
      createAudio: () => audio,
      async loadLyrics(source) {
        loadCalls += 1;
        assert.equal(source, "/audio/test-lyrics.txt");
        return [
          { start: 8, text: "Dòng đầu" },
          { start: 15, text: "Dòng tiếp theo" },
        ];
      },
    },
  );

  assert.equal(player.getState().lyricsStatus, "idle");
  assert.equal(player.getState().lyric, null);

  await player.play();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(loadCalls, 1);
  assert.equal(player.getState().lyricsStatus, "ready");

  audio.currentTime = 9;
  audio.dispatchEvent(new Event("timeupdate"));
  assert.deepEqual(player.getState().lyric, {
    index: 0,
    start: 8,
    text: "Dòng đầu",
  });

  audio.currentTime = 16;
  audio.dispatchEvent(new Event("timeupdate"));
  assert.equal(player.getState().lyric.text, "Dòng tiếp theo");

  audio.currentTime = 1;
  audio.dispatchEvent(new Event("timeupdate"));
  assert.equal(player.getState().lyric, null);

  player.reset();
  assert.equal(player.getState().lyric, null);

  player.destroy();
});
