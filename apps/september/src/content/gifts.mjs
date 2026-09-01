import {
  SEPTEMBER_COPY,
  SEPTEMBER_FINAL_LETTER,
} from "./copy.mjs";
import { SEPTEMBER_GIFT_DEFINITIONS } from "./gift-definitions.mjs";

const mediaFor = (id, alt) => Object.freeze({
  avifSrc: `./images/${id}.avif`,
  webpSrc: `./images/${id}.webp`,
  jpegSrc: `./images/${id}.jpg`,
  alt,
});

export const SEPTEMBER_GIFTS = Object.freeze(
  SEPTEMBER_GIFT_DEFINITIONS.map((definition) =>
    Object.freeze({
      id: definition.id,
      productAssetId: definition.productAssetId,
      productName: definition.productName,
      variant: definition.variant,
      media: mediaFor(definition.id, definition.alt),
      message: SEPTEMBER_COPY.wishes[definition.messageKey],
      approved: definition.approved,
      fixture: definition.fixture,
    }),
  ),
);

export { SEPTEMBER_COPY, SEPTEMBER_FINAL_LETTER };
