import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { APP_CONFIG } from "../src/herbarium/config.js";
import {
  findLyricCue,
  parseLyricText,
} from "../src/herbarium/lyric-timeline.js";

test("parses the supplied timestamp format and selects the active cue", () => {
  const cues = parseLyricText(
    [
      "0:08**8 giâyDòng đầu của thiệp**",
      "0:15**15 giâyDòng tiếp theo**",
      "1:07**1 phút, 7 giâyDòng cuối cùng**",
    ].join("\n"),
  );

  assert.deepEqual(cues, [
    { start: 8, text: "Dòng đầu của thiệp" },
    { start: 15, text: "Dòng tiếp theo" },
    { start: 67, text: "Dòng cuối cùng" },
  ]);
  assert.equal(findLyricCue(cues, 7.99), null);
  assert.deepEqual(findLyricCue(cues, 22), {
    index: 1,
    start: 15,
    text: "Dòng tiếp theo",
  });
});

test("loads every cue from the self-hosted lyric asset", async () => {
  assert.equal(
    APP_CONFIG.soundtrack.lyricsSrc,
    "./public/audio/co-em-lyrics.txt",
  );
  const source = await readFile(
    new URL("../public/audio/co-em-lyrics.txt", import.meta.url),
    "utf8",
  );
  const cues = parseLyricText(source);

  assert.equal(cues.length, 25);
  assert.equal(cues[0].start, 8);
  assert.equal(cues.at(-1).start, 193);
  assert.ok(
    cues.every((cue, index) => index === 0 || cue.start > cues[index - 1].start),
  );
});
