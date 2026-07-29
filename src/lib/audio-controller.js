export function createAudioController({
  audio,
  lyrics = [],
  lyricsElement,
  onStateChange = () => {},
  scheduleFrame = callback => requestAnimationFrame(callback),
  cancelFrame = id => cancelAnimationFrame(id),
}) {
  let frameId = null;
  let activeLyric = '';
  let startPromise = null;
  let generation = 0;
  let lastState = null;

  function emitState(playing, error = null) {
    if (lastState?.playing === playing && lastState?.error === error) return;
    lastState = { playing, error };
    onStateChange(lastState);
  }

  function updateLyrics() {
    if (audio.paused) {
      frameId = null;
      return;
    }
    if (lyricsElement && lyrics.length) {
      const line = lyrics.findLast(item => item.time <= audio.currentTime);
      if (line && line.text !== activeLyric) {
        activeLyric = line.text;
        lyricsElement.textContent = line.text;
        lyricsElement.hidden = false;
      }
    }
    frameId = scheduleFrame(updateLyrics);
  }

  function ensureLyricsLoop() {
    if (lyricsElement && lyrics.length && frameId === null) {
      frameId = scheduleFrame(updateLyrics);
    }
  }

  function stopLyricsLoop() {
    if (frameId !== null) {
      cancelFrame(frameId);
      frameId = null;
    }
  }

  async function start() {
    if (!audio.paused) return true;
    if (startPromise) return startPromise;
    const requestGeneration = ++generation;

    const pending = (async () => {
      try {
        await audio.play();
        if (requestGeneration !== generation) {
          audio.pause();
          return false;
        }
        ensureLyricsLoop();
        emitState(true);
        return true;
      } catch (error) {
        if (requestGeneration === generation) emitState(false, error);
        return false;
      }
    })();

    startPromise = pending;
    try {
      return await pending;
    } finally {
      if (startPromise === pending) startPromise = null;
    }
  }

  function pause() {
    generation += 1;
    startPromise = null;
    audio.pause();
    stopLyricsLoop();
    emitState(false);
  }

  function handleNativePause() {
    generation += 1;
    startPromise = null;
    stopLyricsLoop();
    emitState(false);
  }

  function handleNativeError() {
    generation += 1;
    startPromise = null;
    stopLyricsLoop();
    emitState(false, audio.error || new Error('Không thể phát file âm thanh.'));
  }

  audio.addEventListener?.('pause', handleNativePause);
  audio.addEventListener?.('ended', handleNativePause);
  audio.addEventListener?.('error', handleNativeError);

  return {
    get playing() {
      return !audio.paused;
    },
    start,
    pause,
    async toggle() {
      if (startPromise) {
        pause();
        return false;
      }
      if (audio.paused) return start();
      pause();
      return true;
    },
    stop({ reset = false } = {}) {
      pause();
      if (reset) {
        audio.currentTime = 0;
        activeLyric = '';
        if (lyricsElement) {
          lyricsElement.textContent = '';
          lyricsElement.hidden = true;
        }
      }
    },
    destroy() {
      pause();
      audio.removeEventListener?.('pause', handleNativePause);
      audio.removeEventListener?.('ended', handleNativePause);
      audio.removeEventListener?.('error', handleNativeError);
    },
  };
}
