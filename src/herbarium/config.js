export const SCENES = Object.freeze([
  "envelope",
  "letter",
  "wishes",
  "photo-prompt",
  "photo-editor",
  "herbarium",
  "finale",
]);

export const WISHES = Object.freeze([
  {
    id: "peace",
    botanicalId: "poppy",
    name: "Poppy",
    label: "Một tháng bình an",
    sentence: "một tháng thật bình an",
    description: "Cho những ngày được thở chậm và ngủ thật ngon.",
    asset: "/images/herbarium/poppy.webp",
    fallbackAsset: "/images/herbarium/poppy.png",
    alt: "Một cành poppy màu hồng được ép khô",
  },
  {
    id: "joy",
    botanicalId: "dahlia",
    name: "Dahlia",
    label: "Thêm nhiều ngày vui",
    sentence: "thêm thật nhiều ngày vui",
    description: "Cho những niềm vui nhỏ đến đúng lúc và ở lại lâu hơn.",
    asset: "/images/herbarium/dahlia.webp",
    fallbackAsset: "/images/herbarium/dahlia.png",
    alt: "Một cành dahlia hồng được ép khô",
  },
  {
    id: "ease",
    botanicalId: "gladiolus",
    name: "Gladiolus",
    label: "Mọi việc đều thuận lợi",
    sentence: "mọi việc đều thuận lợi",
    description: "Cho những dự định được nâng đỡ bằng một chút may mắn.",
    asset: "/images/herbarium/gladiolus.webp",
    fallbackAsset: "/images/herbarium/gladiolus.png",
    alt: "Một cành gladiolus trắng hồng được ép khô",
  },
]);

export const FRAMES = Object.freeze([
  { id: "torn-paper", label: "Giấy xé" },
  { id: "polaroid", label: "Polaroid" },
  { id: "oval", label: "Oval cổ điển" },
]);

export const BOTANICALS = Object.freeze({
  poppy: {
    id: "poppy",
    asset: "/images/herbarium/poppy.webp",
    fallbackAsset: "/images/herbarium/poppy.png",
    alt: "Cành poppy ép khô",
  },
  dahlia: {
    id: "dahlia",
    asset: "/images/herbarium/dahlia.webp",
    fallbackAsset: "/images/herbarium/dahlia.png",
    alt: "Cành dahlia ép khô",
  },
  gladiolus: {
    id: "gladiolus",
    asset: "/images/herbarium/gladiolus.webp",
    fallbackAsset: "/images/herbarium/gladiolus.png",
    alt: "Cành gladiolus ép khô",
  },
  white: {
    id: "white",
    asset: "/images/herbarium/babys-breath.webp",
    fallbackAsset: "/images/herbarium/babys-breath.png",
    alt: "Nhánh hoa trắng ép khô",
  },
  olive: {
    id: "olive",
    asset: "/images/herbarium/olive.webp",
    fallbackAsset: "/images/herbarium/olive.png",
    alt: "Nhánh lá olive ép khô",
  },
});

export const APP_CONFIG = Object.freeze({
  defaultRecipient: "em",
  defaultSender: "Minh Long",
  title: "Tháng Tám ở lại",
  postcardTitle: "Một ngày tháng Tám có em và hoa",
  colors: {
    paper: "#f3ebdd",
    ink: "#25221e",
    rose: "#8f3146",
    softPink: "#d9a6ae",
    olive: "#4e604b",
    gold: "#b6945a",
  },
  assets: BOTANICALS,
  frames: FRAMES,
  wishes: WISHES,
});

export function getWish(wishId) {
  return WISHES.find((wish) => wish.id === wishId) ?? WISHES[0];
}
