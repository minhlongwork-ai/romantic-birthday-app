import { SEPTEMBER_COPY } from "./copy.mjs";
import { SEPTEMBER_ASSET_SOURCES } from "./assets.mjs";

const reason =
  "Ảnh và quà trong bản xem thử chỉ để minh họa; người tặng sẽ thay bằng món quà thật trước khi phát hành.";

export const SEPTEMBER_GIFT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "cake",
    groupId: "sweet",
    groupLabel: "Một chút ngọt",
    clue: SEPTEMBER_COPY.groupClues.sweet,
    productAssetId: SEPTEMBER_ASSET_SOURCES.products.cake.assetId,
    productName: "Bánh tiramisu chanh",
    variant: "Ảnh Pexels · bản xem thử",
    alt: "Bánh kem chanh nhiều lớp với kem tươi và lát chanh",
    reason,
    personalMessageKey: "cake",
    fixture: true,
    approved: false,
  }),
  Object.freeze({
    id: "bouquet",
    groupId: "bloom",
    groupLabel: "Một chút hoa",
    clue: SEPTEMBER_COPY.groupClues.bloom,
    productAssetId: SEPTEMBER_ASSET_SOURCES.products.bouquet.assetId,
    productName: "Bó hồng kem và hồng phấn",
    variant: "Ảnh Pexels · bản xem thử",
    alt: "Bó hồng màu kem và hồng phấn trong ánh sáng mềm",
    reason,
    personalMessageKey: "bouquet",
    fixture: true,
    approved: false,
  }),
]);
