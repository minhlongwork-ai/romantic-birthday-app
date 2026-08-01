import assert from "node:assert/strict";
import test from "node:test";

import {
  POSTCARD_SIZE,
  safePostcardFilename,
  wrapText,
} from "../src/herbarium/postcard-renderer.js";

test("postcard export keeps the locked portrait dimensions", () => {
  assert.deepEqual(POSTCARD_SIZE, { width: 1200, height: 1500 });
});

test("wrapText produces bounded lines for the postcard message", () => {
  const context = {
    measureText(value) {
      return { width: String(value).length * 10 };
    },
  };

  assert.deepEqual(wrapText(context, "Thêm thật nhiều ngày vui", 110, 3), [
    "Thêm thật",
    "nhiều ngày",
    "vui",
  ]);
  assert.deepEqual(wrapText(context, "   ", 110, 3), []);
});

test("download filename is portable and strips Vietnamese diacritics", () => {
  assert.equal(
    safePostcardFilename("Tháng tám ở lại"),
    "thang-tam-o-lai.png",
  );
  assert.equal(safePostcardFilename(""), "thang-tam-o-lai.png");
});
