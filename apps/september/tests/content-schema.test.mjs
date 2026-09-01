import assert from "node:assert/strict";
import test from "node:test";

import {
  introNoteForGifts,
  previewBadgeForGift,
  SEPTEMBER_FINAL_LETTER,
} from "../src/content/copy.mjs";
import { SEPTEMBER_ASSET_SOURCES } from "../src/content/assets.mjs";
import { SEPTEMBER_GIFT_DEFINITIONS } from "../src/content/gift-definitions.mjs";
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

test("the approved final letter is never personalized", () => {
  assert.equal(
    SEPTEMBER_FINAL_LETTER,
    "Anh không ở cạnh lúc em mở thiếp, nên gửi một xưởng nhỏ thay anh chuẩn bị mọi thứ. Bánh để em có một chút ngọt, hoa để ngày của em đẹp hơn. Còn anh chỉ muốn em biết: dù không ở đây, anh vẫn muốn có mặt trong ngày của em theo một cách nhỏ thôi.",
  );
  assert.doesNotMatch(SEPTEMBER_FINAL_LETTER, /\{\{(?:recipient|sender)\}\}/u);
});

test("each disclosed demo gift joins its verified source JPEG and provenance", () => {
  assert.deepEqual(
    SEPTEMBER_GIFT_DEFINITIONS.map((gift) => ({
      id: gift.id,
      productAssetId: gift.productAssetId,
      productName: gift.productName,
      variant: gift.variant,
      alt: gift.alt,
      fixture: gift.fixture,
      approved: gift.approved,
      source: SEPTEMBER_ASSET_SOURCES.products[gift.id],
    })),
    [
      {
        id: "cake",
        productAssetId: "product-cake",
        productName: "Bánh tiramisu chanh",
        variant: "Ảnh Pexels · bản xem thử",
        alt: "Bánh kem chanh nhiều lớp với kem tươi và lát chanh",
        fixture: true,
        approved: false,
        source: {
          assetId: "product-cake",
          sourcePath: "src/assets/source/product-cake.jpeg",
          pageUrl: "https://www.pexels.com/photo/a-person-is-cutting-up-a-cake-with-cream-27971019/",
          sourceUrl: "https://images.pexels.com/photos/27971019/pexels-photo-27971019.jpeg",
          creator: "Beyza",
          licenseUrl: "https://www.pexels.com/license/",
          license: "Pexels license",
        },
      },
      {
        id: "bouquet",
        productAssetId: "product-bouquet",
        productName: "Bó hồng kem và hồng phấn",
        variant: "Ảnh Pexels · bản xem thử",
        alt: "Bó hồng màu kem và hồng phấn trong ánh sáng mềm",
        fixture: true,
        approved: false,
        source: {
          assetId: "product-bouquet",
          sourcePath: "src/assets/source/product-bouquet.jpeg",
          pageUrl: "https://www.pexels.com/photo/elegant-bouquets-of-blush-pink-and-cream-roses-34735100/",
          sourceUrl: "https://images.pexels.com/photos/34735100/pexels-photo-34735100.jpeg",
          creator: "Lara",
          licenseUrl: "https://www.pexels.com/license/",
          license: "Pexels license",
        },
      },
    ],
  );
});

test("preview UI copy is derived only from fixture flags", () => {
  assert.equal(previewBadgeForGift(SEPTEMBER_GIFTS[0]), "Bản xem thử · ảnh minh họa");
  assert.equal(introNoteForGifts(SEPTEMBER_GIFTS, "Minh"), "Bản xem thử · ảnh minh họa · Dành cho Minh");

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
