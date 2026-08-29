export const EXPECTED_GIFT_IDS = Object.freeze(["cake", "bouquet"]);

export const EXPECTED_GROUP_IDS = Object.freeze(["sweet", "bloom"]);

const EXPECTED_GIFT_GROUP_PAIRS = Object.freeze([
  "bouquet:bloom",
  "cake:sweet",
]);

const APPROVED_THEME_BY_GIFT = Object.freeze({
  cake: Object.freeze({
    groupLabel: "Một chút ngọt",
    clue: "Một vị ngọt có chút tươi",
    personalMessage:
      "Anh chọn bánh tiramisu chanh vì vị vừa ngọt vừa tươi. Nhớ ăn khi còn mát nhé.",
  }),
  bouquet: Object.freeze({
    groupLabel: "Một chút hoa",
    clue: "Một bó dịu dàng ở lại",
    personalMessage:
      "Bó hoa này không cần chờ một dịp đặc biệt. Anh chỉ muốn em có hoa và vui thêm một chút.",
  }),
});

const DEVELOPMENT_PLACEHOLDER_PATTERN =
  /(?:Sản phẩm mẫu|Sản phẩm minh họa|Màu mẫu|DEMO-|Ảnh Pexels|bản xem thử|dung tích chờ duyệt|đang chờ người tặng hoàn thiện|chỉ để minh họa)/iu;

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function mediaStem(publicPath, expectedExtension) {
  if (typeof publicPath !== "string") return null;
  const match = /^\.\/images\/([a-z0-9][a-z0-9_-]*)\.([a-z]+)$/u.exec(
    publicPath,
  );
  if (!match) return null;
  const [, stem, extension] = match;
  const extensionMatches =
    expectedExtension === "jpeg"
      ? extension === "jpg" || extension === "jpeg"
      : extension === expectedExtension;
  return extensionMatches ? stem : null;
}

export function orderedProductMedia(media) {
  return [
    { src: media?.avifSrc, type: "image/avif" },
    { src: media?.webpSrc, type: "image/webp" },
    { src: media?.jpegSrc, type: "image/jpeg" },
  ];
}

export class SeptemberContentError extends Error {
  constructor(errors) {
    super(`September content validation failed:\n- ${errors.join("\n- ")}`);
    this.name = "SeptemberContentError";
    this.errors = errors;
  }
}

export function validateSeptemberContent(gifts, { release = false } = {}) {
  if (!Array.isArray(gifts)) {
    return ["September content must be an array."];
  }
  if (gifts.length !== 2) {
    return ["September content must contain exactly two gifts."];
  }

  const errors = [];
  const actualPairs = gifts
    .map((gift) => `${gift?.id}:${gift?.groupId}`)
    .sort();
  if (
    actualPairs.some((pair, index) => pair !== EXPECTED_GIFT_GROUP_PAIRS[index])
  ) {
    errors.push(
      "September content must preserve the exact gift-to-group mapping: cake/sweet, bouquet/bloom.",
    );
  }

  for (const [index, gift] of gifts.entries()) {
    const approvedTheme = APPROVED_THEME_BY_GIFT[gift?.id];
    if (
      !approvedTheme
      || Object.entries(approvedTheme).some(
        ([field, expected]) => gift?.[field] !== expected,
      )
    ) {
      errors.push(
        `gifts[${index}] must use the approved thematic copy for its gift ID.`,
      );
    }

    if (
      !isNonEmptyString(gift?.productAssetId)
      || !isNonEmptyString(gift?.productName)
      || !isNonEmptyString(gift?.variant)
      || !isNonEmptyString(gift?.reason)
      || !isNonEmptyString(gift?.media?.alt)
    ) {
      errors.push(
        `gifts[${index}] must contain complete product content: productAssetId, productName, variant, reason, and media.alt.`,
      );
    }

    const mediaStems = [
      mediaStem(gift?.media?.avifSrc, "avif"),
      mediaStem(gift?.media?.webpSrc, "webp"),
      mediaStem(gift?.media?.jpegSrc, "jpeg"),
    ];
    if (
      mediaStems.some((stem) => stem === null)
      || new Set(mediaStems).size !== 1
    ) {
      errors.push(
        `gifts[${index}] must use safe local media paths with one shared stem and AVIF, WebP, JPEG extensions.`,
      );
    }

    if (
      typeof gift?.approved !== "boolean"
      || (gift?.fixture !== undefined && typeof gift.fixture !== "boolean")
    ) {
      errors.push(
        `gifts[${index}] must declare boolean approved; fixture, when present, must be boolean.`,
      );
    }

    if (release) {
      if (gift?.approved !== true) {
        errors.push(`gifts[${index}] must set approved:true for release.`);
      }
      if (gift?.fixture === true) {
        errors.push(`gifts[${index}] is a development fixture and cannot ship.`);
      }
      if (
        [
          gift?.groupLabel,
          gift?.clue,
          gift?.productName,
          gift?.variant,
          gift?.reason,
          gift?.personalMessage,
          gift?.media?.alt,
        ].some(
          (value) =>
            typeof value === "string"
            && DEVELOPMENT_PLACEHOLDER_PATTERN.test(value),
        )
      ) {
        errors.push(
          `gifts[${index}] contains placeholder product content and cannot ship.`,
        );
      }
    }
  }

  return errors;
}

export function assertSeptemberContent(gifts, options) {
  const errors = validateSeptemberContent(gifts, options);
  if (errors.length > 0) {
    throw new SeptemberContentError(errors);
  }
  return gifts;
}
