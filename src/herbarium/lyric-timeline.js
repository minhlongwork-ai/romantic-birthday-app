const LYRIC_LINE_PATTERN =
  /^\s*(\d+):([0-5]\d)(?:\*{2})?(?:(?:\d+\s*phút,\s*)?\d+\s*giây)\s*(.*)$/u;

export function parseLyricText(source) {
  return String(source ?? "")
    .split(/\r?\n/u)
    .flatMap((line) => {
      const match = line.match(LYRIC_LINE_PATTERN);
      if (!match) return [];
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const text = match[3].replace(/\*{2}\s*$/u, "").trim();
      if (!text) return [];
      return [{ start: minutes * 60 + seconds, text }];
    })
    .sort((left, right) => left.start - right.start);
}

export function findLyricCue(cues, currentTime) {
  if (!Array.isArray(cues) || cues.length === 0) return null;
  const time = Number(currentTime);
  if (!Number.isFinite(time) || time < 0) return null;

  let low = 0;
  let high = cues.length - 1;
  let activeIndex = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (Number(cues[middle]?.start) <= time) {
      activeIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (activeIndex < 0) return null;
  const cue = cues[activeIndex];
  return {
    index: activeIndex,
    start: Number(cue.start),
    text: String(cue.text ?? ""),
  };
}
