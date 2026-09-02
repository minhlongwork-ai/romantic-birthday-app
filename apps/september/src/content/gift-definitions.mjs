import { SEPTEMBER_COPY } from "./copy.mjs";

export const SEPTEMBER_GIFT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "cake",
    groupId: "sweet",
    groupLabel: "Một chút ngọt",
    clue: SEPTEMBER_COPY.groupClues.sweet,
    productAssetId: "product-cake",
    productName: "Bánh tiramisu chanh",
    variant: "Tiramisu chanh",
    alt: "Miếng tiramisu chanh trên đĩa sứ, cạnh những lát chanh vàng",
    reason: "Một chút chua dịu, một chút ngọt vừa đủ cho những ngày em cần một niềm vui nhỏ.",
    personalMessageKey: "cake",
    fixture: false,
    approved: true,
  }),
  Object.freeze({
    id: "bouquet",
    groupId: "bloom",
    groupLabel: "Một chút hoa",
    clue: SEPTEMBER_COPY.groupClues.bloom,
    productAssetId: "product-bouquet",
    productName: "Bó hoa hồng phấn và hoa trắng",
    variant: "Hoa tươi gói giấy kraft",
    alt: "Bó hoa hồng phấn và hoa trắng nhỏ được gói bằng giấy kraft",
    reason: "Một bó hoa nhỏ để giữa những ngày bình thường, em vẫn có một điều mềm mại và đẹp đẽ.",
    personalMessageKey: "bouquet",
    fixture: false,
    approved: true,
  }),
]);
