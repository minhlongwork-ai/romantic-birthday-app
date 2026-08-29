import assert from "node:assert/strict";
import test from "node:test";

import { SEPTEMBER_GIFTS } from "../src/content/gifts.mjs";
import { validateSeptemberContent } from "../src/content/schema.mjs";

test("development content contains the exact Sweet & Bloom gifts", () => {
  assert.deepEqual(
    SEPTEMBER_GIFTS.map(({ id, groupId, productName }) => ({ id, groupId, productName })),
    [
      { id: "cake", groupId: "sweet", productName: "Bánh tiramisu chanh — bản xem thử" },
      { id: "bouquet", groupId: "bloom", productName: "Bó hồng kem và hồng phấn — bản xem thử" },
    ],
  );
  assert.deepEqual(validateSeptemberContent(SEPTEMBER_GIFTS), []);
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

test("release rejects both demo fixtures", () => {
  const errors = validateSeptemberContent(SEPTEMBER_GIFTS, { release: true });
  assert.equal(errors.filter((error) => /approved:true/u.test(error)).length, 2);
  assert.equal(errors.filter((error) => /development fixture/u.test(error)).length, 2);
  assert.equal(errors.filter((error) => /placeholder product content/u.test(error)).length, 2);
});
