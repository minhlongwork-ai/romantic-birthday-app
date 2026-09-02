import { SEPTEMBER_COPY } from "./copy.mjs";

const reason =
  "Ảnh và quà trong bản xem thử chỉ để minh họa; người tặng sẽ thay bằng món quà thật trước khi phát hành.";

export const SEPTEMBER_GIFT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "cake",
    groupId: "sweet",
    groupLabel: "Một chút ngọt",
    clue: SEPTEMBER_COPY.groupClues.sweet,
    productAssetId: "product-cake",
    productName: "Bánh tiramisu chanh",
    variant: "Ảnh Pexels · bản xem thử",
    alt: "Miếng tiramisu chanh trên đĩa sứ, cạnh những lát chanh vàng",
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
    productAssetId: "product-bouquet",
    productName: "Bó hồng kem và hồng phấn",
    variant: "Ảnh Pexels · bản xem thử",
    alt: "Bó hoa hồng phấn và hoa trắng nhỏ được gói bằng giấy kraft",
    reason,
    personalMessageKey: "bouquet",
    fixture: true,
    approved: false,
  }),
]);
