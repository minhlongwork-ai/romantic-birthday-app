import assert from "node:assert/strict";
import test from "node:test";

import {
  introNoteForGifts,
  previewBadgeForGift,
  SEPTEMBER_FINAL_LETTER,
} from "../src/content/copy.mjs";
import { SEPTEMBER_GIFTS } from "../src/content/gifts.mjs";
import { validateSeptemberContent } from "../src/content/schema.mjs";

function productionGifts() {
  return structuredClone(SEPTEMBER_GIFTS).map((gift) => ({
    ...gift,
    approved: true,
    fixture: false,
    variant: gift.id === "cake"
      ? "Bánh 18 cm · kem mascarpone chanh"
      : "Hồng kem và hồng phấn · giấy gói màu ngà",
    reason: gift.id === "cake"
      ? "Anh chọn vị chanh tươi để chiếc bánh ngọt vừa đủ."
      : "Anh chọn những màu hoa dịu dàng mà em thích.",
  }));
}

test("development content contains the exact Sweet & Bloom gifts", () => {
  assert.deepEqual(
    SEPTEMBER_GIFTS.map(({ id, groupId, productName }) => ({ id, groupId, productName })),
    [
      { id: "cake", groupId: "sweet", productName: "Bánh tiramisu chanh" },
      { id: "bouquet", groupId: "bloom", productName: "Bó hồng kem và hồng phấn" },
    ],
  );
  assert.deepEqual(validateSeptemberContent(SEPTEMBER_GIFTS), []);
});

test("the approved final letter is rendered verbatim", () => {
  assert.equal(
    SEPTEMBER_FINAL_LETTER,
    "Anh không ở cạnh lúc em mở thiếp, nên gửi một xưởng nhỏ thay anh chuẩn bị mọi thứ. Bánh để em có một chút ngọt, hoa để ngày của em đẹp hơn. Còn anh chỉ muốn em biết: dù không ở đây, anh vẫn muốn có mặt trong ngày của em theo một cách nhỏ thôi.",
  );
});

test("preview UI copy is derived only from fixture flags", () => {
  assert.equal(previewBadgeForGift(SEPTEMBER_GIFTS[0]), "Bản xem thử");
  assert.equal(introNoteForGifts(SEPTEMBER_GIFTS, "Minh"), "Bản xem thử · Dành cho Minh");

  const approvedGifts = productionGifts();
  assert.equal(previewBadgeForGift(approvedGifts[0]), null);
  assert.equal(introNoteForGifts(approvedGifts, "Minh"), "Dành cho Minh");
});

test("content requires a non-empty product asset ID", () => {
  const gifts = structuredClone(SEPTEMBER_GIFTS);
  gifts[0].productAssetId = "";

  assert.ok(
    validateSeptemberContent(gifts).some((error) =>
      /complete product content: productAssetId/u.test(error),
    ),
  );
});

test("development content rejects omitted and non-boolean fixture flags", () => {
  for (const fixture of [undefined, "false"]) {
    const gifts = structuredClone(SEPTEMBER_GIFTS);
    if (fixture === undefined) delete gifts[0].fixture;
    else gifts[0].fixture = fixture;

    assert.ok(
      validateSeptemberContent(gifts).some((error) =>
        /must declare boolean approved and fixture/u.test(error),
      ),
      `fixture ${String(fixture)} must fail development validation`,
    );
  }
});

test("release rejects both demo fixtures", () => {
  const errors = validateSeptemberContent(SEPTEMBER_GIFTS, { release: true });
  assert.equal(errors.filter((error) => /approved:true/u.test(error)).length, 2);
  assert.equal(errors.filter((error) => /development fixture/u.test(error)).length, 2);
  assert.equal(errors.filter((error) => /placeholder product content/u.test(error)).length, 2);
});

test("release accepts fully approved non-fixture gifts with no preview copy", () => {
  const gifts = productionGifts();

  assert.deepEqual(validateSeptemberContent(gifts, { release: true }), []);
  assert.doesNotMatch(JSON.stringify(gifts), /bản xem thử|Ảnh Pexels|chỉ để minh họa/iu);
});

test("release requires an explicit fixture:false flag", () => {
  const gifts = productionGifts();
  delete gifts[0].fixture;

  assert.ok(
    validateSeptemberContent(gifts, { release: true }).some((error) =>
      /must set fixture:false for release/u.test(error),
    ),
  );
});

test("release rejects residual preview wording even when flags are approved", () => {
  const gifts = productionGifts();
  gifts[0].media.alt = "Bánh tiramisu chanh · bản xem thử";

  assert.ok(
    validateSeptemberContent(gifts, { release: true }).some((error) =>
      /placeholder product content/u.test(error),
    ),
  );
});
