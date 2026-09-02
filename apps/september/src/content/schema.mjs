export const EXPECTED_GIFT_IDS = Object.freeze(["cake", "bouquet"]);

const APPROVED_COPY_BY_GIFT = Object.freeze({
  cake: Object.freeze({
    productName: "Bánh tiramisu chanh",
    message:
      "Tiramisu chanh — ngọt vừa đủ, lại có một chút chua. Anh nghĩ em sẽ thích. Nhớ ăn lúc còn ngon nhé.",
  }),
  bouquet: Object.freeze({
    productName: "Bó hồng kem và hồng phấn",
    message:
      "Không cần đợi một dịp đặc biệt — chỉ cần hôm nay em xứng đáng nhận một điều thật đẹp.",
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
  if (gifts.length !== EXPECTED_GIFT_IDS.length) {
    return ["September content must contain exactly two gifts."];
  }

  const errors = [];
  const actualIds = gifts.map((gift) => gift?.id).sort();
  if (actualIds.some((id, index) => id !== [...EXPECTED_GIFT_IDS].sort()[index])) {
    errors.push("September content must contain cake and bouquet exactly once.");
  }

  for (const [index, gift] of gifts.entries()) {
    const approvedCopy = APPROVED_COPY_BY_GIFT[gift?.id];
    if (
      !approvedCopy
      || Object.entries(approvedCopy).some(
        ([field, expected]) => gift?.[field] !== expected,
      )
    ) {
      errors.push(
        `gifts[${index}] must use the approved product copy for its gift ID.`,
      );
    }

    if (
      !isNonEmptyString(gift?.productAssetId)
      || !isNonEmptyString(gift?.productName)
      || !isNonEmptyString(gift?.variant)
      || !isNonEmptyString(gift?.message)
      || !isNonEmptyString(gift?.media?.alt)
    ) {
      errors.push(
        `gifts[${index}] must contain complete product content: productAssetId, productName, variant, message, and media.alt.`,
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
      || typeof gift?.fixture !== "boolean"
    ) {
      errors.push(
        `gifts[${index}] must declare boolean approved and fixture.`,
      );
    }

    if (release) {
      if (gift?.approved !== true) {
        errors.push(`gifts[${index}] must set approved:true for release.`);
      }
      if (gift?.fixture === true) {
        errors.push(`gifts[${index}] is a development fixture and cannot ship.`);
      } else if (gift?.fixture !== false) {
        errors.push(`gifts[${index}] must set fixture:false for release.`);
      }
      if (
        [
          gift?.productName,
          gift?.variant,
          gift?.message,
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
