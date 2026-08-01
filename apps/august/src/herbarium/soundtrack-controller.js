import { findLyricCue, parseLyricText } from "./lyric-timeline.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createSoundtrackPlayer(config = {}, dependencies = {}) {
  const createAudio = dependencies.createAudio ?? (() => new Audio());
  const fetchImpl =
    dependencies.fetchImpl ?? globalThis.fetch?.bind(globalThis) ?? null;
  const loadLyrics =
    dependencies.loadLyrics ??
    (async (source) => {
      if (!fetchImpl) throw new Error("Lyrics loader is unavailable.");
      const response = await fetchImpl(source, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Unable to load lyrics: ${response.status}`);
      return parseLyricText(await response.text());
    });
  const visibilityTarget = dependencies.visibilityTarget ?? globalThis.document ?? null;
  const requestFrame =
    dependencies.requestFrame ??
    globalThis.requestAnimationFrame?.bind(globalThis) ??
    ((callback) => globalThis.setTimeout(() => callback(Date.now()), 16));
  const cancelFrame =
    dependencies.cancelFrame ??
    globalThis.cancelAnimationFrame?.bind(globalThis) ??
    globalThis.clearTimeout?.bind(globalThis);
  const volume = clamp(Number(config.volume) || 0.2, 0, 1);
  const fadeDurationMs = Math.max(Number(config.fadeDurationMs) || 0, 0);
  let audio = null;
  let desiredPlayback = false;
  let fadeFrame = 0;
  let status = "idle";
  let destroyed = false;
  let resumeWhenVisible = false;
  let lyrics = [];
  let lyricsPromise = null;
  let lyricsStatus = "idle";
  let activeLyric = null;
  const listeners = new Set();

  function publishState() {
    const snapshot = getState();
    listeners.forEach((listener) => listener(snapshot));
  }

  function setStatus(nextStatus) {
    status = nextStatus;
    publishState();
  }

  function updateActiveLyric({ force = false } = {}) {
    const nextLyric = findLyricCue(lyrics, Number(audio?.currentTime) || 0);
    const nextIndex = nextLyric?.index ?? -1;
    const currentIndex = activeLyric?.index ?? -1;
    if (!force && nextIndex === currentIndex) return;
    activeLyric = nextLyric;
    publishState();
  }

  function handleTimeUpdate() {
    if (lyricsStatus === "ready") updateActiveLyric();
  }

  function ensureLyrics() {
    const source = String(config.lyricsSrc || "");
    if (!source || destroyed) return Promise.resolve([]);
    if (lyricsPromise) return lyricsPromise;

    lyricsStatus = "loading";
    publishState();
    lyricsPromise = Promise.resolve()
      .then(() => loadLyrics(source))
      .then((loadedLyrics) => {
        lyrics = Array.isArray(loadedLyrics) ? loadedLyrics : [];
        lyricsStatus = lyrics.length > 0 ? "ready" : "empty";
        updateActiveLyric({ force: true });
        return lyrics;
      })
      .catch(() => {
        lyrics = [];
        lyricsStatus = "error";
        activeLyric = null;
        publishState();
        return [];
      });
    return lyricsPromise;
  }

  function ensureAudio() {
    if (audio) return audio;
    audio = createAudio();
    audio.preload = "none";
    audio.loop = config.loop !== false;
    audio.src = String(config.src || "");
    audio.volume = fadeDurationMs > 0 ? 0 : volume;
    audio.addEventListener?.("timeupdate", handleTimeUpdate);
    return audio;
  }

  function stopFade() {
    if (!fadeFrame) return;
    cancelFrame?.(fadeFrame);
    fadeFrame = 0;
  }

  function fadeTo(target, duration) {
    stopFade();
    if (!audio) return;
    const safeTarget = clamp(target, 0, 1);
    if (duration <= 0) {
      audio.volume = safeTarget;
      return;
    }
    const initialVolume = audio.volume;
    let startedAt = null;
    const step = (timestamp) => {
      if (!audio) return;
      if (startedAt === null) startedAt = timestamp;
      const progress = clamp((timestamp - startedAt) / duration, 0, 1);
      audio.volume = initialVolume + (safeTarget - initialVolume) * progress;
      if (progress < 1) fadeFrame = requestFrame(step);
      else fadeFrame = 0;
    };
    fadeFrame = requestFrame(step);
  }

  async function play() {
    if (destroyed || !config.src) return false;
    const media = ensureAudio();
    void ensureLyrics();
    desiredPlayback = true;
    setStatus("loading");
    try {
      await Promise.resolve(media.play());
      setStatus("playing");
      fadeTo(volume, fadeDurationMs);
      return true;
    } catch {
      stopFade();
      setStatus("error");
      return false;
    }
  }

  function pause({ preserveIntent = false } = {}) {
    if (!audio) return false;
    if (!preserveIntent) desiredPlayback = false;
    stopFade();
    audio.volume = 0;
    audio.pause();
    setStatus("paused");
    return false;
  }

  function toggle() {
    return status === "playing" || status === "loading" ? pause() : play();
  }

  function reset() {
    desiredPlayback = false;
    resumeWhenVisible = false;
    if (!audio) {
      activeLyric = null;
      setStatus("idle");
      return;
    }
    stopFade();
    audio.pause();
    audio.currentTime = 0;
    audio.removeEventListener?.("timeupdate", handleTimeUpdate);
    audio.removeAttribute?.("src");
    audio.load?.();
    audio = null;
    activeLyric = null;
    setStatus("idle");
  }

  function handleVisibilityChange() {
    if (visibilityTarget?.hidden) {
      resumeWhenVisible =
        desiredPlayback && (status === "playing" || status === "loading");
      if (resumeWhenVisible) pause({ preserveIntent: true });
      return;
    }
    if (!resumeWhenVisible || !desiredPlayback) return;
    resumeWhenVisible = false;
    void play();
  }

  visibilityTarget?.addEventListener?.("visibilitychange", handleVisibilityChange);

  function getState() {
    return {
      artist: String(config.artist || ""),
      lyric: activeLyric ? { ...activeLyric } : null,
      lyricsStatus,
      status,
      title: String(config.title || ""),
    };
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    listener(getState());
    return () => listeners.delete(listener);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    visibilityTarget?.removeEventListener?.("visibilitychange", handleVisibilityChange);
    reset();
    listeners.clear();
  }

  return {
    destroy,
    getState,
    pause,
    play,
    reset,
    subscribe,
    toggle,
  };
}

export function mountSoundtrackControl(root, player, options = {}) {
  if (!root || typeof player?.subscribe !== "function") return () => {};
  const announce = typeof options.announce === "function" ? options.announce : () => {};
  const controller = new AbortController();
  let previousStatus = "idle";
  let activeLyricIndex = -1;
  const compactViewport =
    globalThis.matchMedia?.("(max-width: 430px)")?.matches ?? false;
  let lyricsVisible = options.lyricsInitiallyVisible ?? !compactViewport;
  let latestState = player.getState();

  root.innerHTML = `
    <aside
      class="soundtrack-lyrics"
      aria-label="Lời bài hát đang phát"
      aria-live="off"
      data-soundtrack-lyrics
      hidden
    >
      <span class="soundtrack-lyrics__eyebrow" aria-hidden="true">Lời đang hát</span>
      <p class="soundtrack-lyrics__copy" data-soundtrack-lyric></p>
    </aside>
    <div class="soundtrack-actions">
      <button
        class="soundtrack-lyrics-toggle"
        type="button"
        aria-label="Ẩn lời bài hát"
        aria-pressed="true"
        data-soundtrack-lyrics-toggle
        hidden
      >
        Lời
      </button>
      <button class="soundtrack-control" type="button" data-soundtrack-toggle>
        <span class="soundtrack-control__disc" aria-hidden="true">
          <span data-soundtrack-icon>♪</span>
        </span>
        <span class="soundtrack-control__copy">
          <strong data-soundtrack-title></strong>
          <small data-soundtrack-artist></small>
        </span>
      </button>
    </div>
  `;

  const button = root.querySelector("[data-soundtrack-toggle]");
  const icon = root.querySelector("[data-soundtrack-icon]");
  const title = root.querySelector("[data-soundtrack-title]");
  const artist = root.querySelector("[data-soundtrack-artist]");
  const lyrics = root.querySelector("[data-soundtrack-lyrics]");
  const lyric = root.querySelector("[data-soundtrack-lyric]");
  const lyricsToggle = root.querySelector("[data-soundtrack-lyrics-toggle]");

  function render(state) {
    latestState = state;
    const isPlaying = state.status === "playing" || state.status === "loading";
    root.hidden = state.status === "idle";
    root.dataset.status = state.status;
    root.dataset.lyricsStatus = state.lyricsStatus;
    title.textContent = state.status === "loading" ? "Đang mở nhạc..." : state.title;
    artist.textContent = state.artist;
    icon.textContent = isPlaying ? "Ⅱ" : "♪";
    button.setAttribute("aria-pressed", String(isPlaying));
    button.setAttribute(
      "aria-label",
      isPlaying ? `Tạm dừng ${state.title}` : `Phát ${state.title}`,
    );
    button.title = isPlaying ? "Tạm dừng nhạc" : "Phát nhạc";

    const lyricsReady = state.lyricsStatus === "ready";
    lyricsToggle.hidden = !lyricsReady;
    lyricsToggle.setAttribute("aria-pressed", String(lyricsVisible));
    lyricsToggle.setAttribute(
      "aria-label",
      lyricsVisible ? "Ẩn lời bài hát" : "Hiện lời bài hát",
    );

    const nextLyricIndex = state.lyric?.index ?? -1;
    if (nextLyricIndex !== activeLyricIndex) {
      activeLyricIndex = nextLyricIndex;
      lyric.replaceChildren();
      if (state.lyric?.text) {
        const line = document.createElement("span");
        line.textContent = state.lyric.text;
        lyric.append(line);
      }
    }
    lyrics.hidden =
      !lyricsVisible ||
      !state.lyric?.text ||
      state.status === "idle" ||
      state.status === "error";

    if (state.status === "error" && previousStatus !== "error") {
      announce(`Không thể phát ${state.title}. Thiệp vẫn tiếp tục bình thường.`);
    }
    previousStatus = state.status;
  }

  const unsubscribe = player.subscribe(render);

  button.addEventListener(
    "click",
    () => {
      void player.toggle();
    },
    { signal: controller.signal },
  );

  lyricsToggle.addEventListener(
    "click",
    () => {
      lyricsVisible = !lyricsVisible;
      render(latestState);
    },
    { signal: controller.signal },
  );

  return () => {
    controller.abort();
    unsubscribe();
    root.replaceChildren();
    root.hidden = true;
    delete root.dataset.status;
    delete root.dataset.lyricsStatus;
  };
}
