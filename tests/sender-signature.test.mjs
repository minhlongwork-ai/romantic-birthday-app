import assert from "node:assert/strict";
import test from "node:test";

import { APP_CONFIG } from "../src/herbarium/config.js";
import { resolveSenderSignature } from "../src/herbarium/sender-signature.js";

test("shows Shyn as the default postcard signature", () => {
  assert.deepEqual(resolveSenderSignature({}, APP_CONFIG), {
    visible: true,
    name: "Shyn",
  });
});

test("normalizes a custom sender name before it reaches the postcard", () => {
  assert.deepEqual(
    resolveSenderSignature(
      { sender: "  S\u0000hyn   Nguyễn   " },
      { defaultSender: "Shyn" },
    ),
    {
      visible: true,
      name: "Shyn Nguyễn",
    },
  );

  assert.equal(
    resolveSenderSignature(
      { sender: "Một cái tên dài hơn giới hạn ba mươi hai ký tự" },
      { defaultSender: "Shyn" },
    ).name.length,
    32,
  );
});

test("keeps the sender name available while hiding the signature", () => {
  assert.deepEqual(
    resolveSenderSignature(
      { sender: "Shyn", showSender: false },
      { defaultSender: "Shyn" },
    ),
    {
      visible: false,
      name: "Shyn",
    },
  );
});
