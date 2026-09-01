import { SEPTEMBER_ASSET_SOURCES } from "./assets.mjs";

export const SEPTEMBER_GIFT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "cake",
    productAssetId: SEPTEMBER_ASSET_SOURCES.products.cake.assetId,
    productName: "Bánh tiramisu chanh",
    variant: "Ảnh Pexels · bản xem thử",
    alt: "Bánh kem chanh nhiều lớp với kem tươi và lát chanh",
    messageKey: "cake",
    fixture: true,
    approved: false,
  }),
  Object.freeze({
    id: "bouquet",
    productAssetId: SEPTEMBER_ASSET_SOURCES.products.bouquet.assetId,
    productName: "Bó hồng kem và hồng phấn",
    variant: "Ảnh Pexels · bản xem thử",
    alt: "Bó hồng màu kem và hồng phấn trong ánh sáng mềm",
    messageKey: "bouquet",
    fixture: true,
    approved: false,
  }),
]);
