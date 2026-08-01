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
    name: "Hoa anh túc",
    label: "Một tháng bình an",
    sentence: "luôn bình an",
    description: "Cho những ngày được thở chậm và ngủ thật ngon.",
    asset: "./public/images/herbarium/poppy.webp",
    fallbackAsset: "./public/images/herbarium/poppy.png",
    alt: "Một cành hoa anh túc màu hồng được ép khô",
  },
  {
    id: "joy",
    botanicalId: "dahlia",
    name: "Hoa thược dược",
    label: "Thêm nhiều ngày vui",
    sentence: "có thêm thật nhiều ngày vui",
    description: "Cho những niềm vui nhỏ đến đúng lúc và ở lại lâu hơn.",
    asset: "./public/images/herbarium/dahlia.webp",
    fallbackAsset: "./public/images/herbarium/dahlia.png",
    alt: "Một cành hoa thược dược hồng được ép khô",
  },
  {
    id: "ease",
    botanicalId: "gladiolus",
    name: "Hoa lay ơn",
    label: "Mọi việc đều thuận lợi",
    sentence: "mọi việc đều thuận lợi",
    description: "Cho những dự định được nâng đỡ bằng một chút may mắn.",
    asset: "./public/images/herbarium/gladiolus.webp",
    fallbackAsset: "./public/images/herbarium/gladiolus.png",
    alt: "Một cành hoa lay ơn trắng hồng được ép khô",
  },
]);

export const FRAMES = Object.freeze([
  { id: "torn-paper", label: "Giấy xé" },
  { id: "polaroid", label: "Ảnh lấy liền" },
  { id: "oval", label: "Khung bầu dục cổ điển" },
]);

export const BOTANICALS = Object.freeze({
  poppy: {
    id: "poppy",
    asset: "./public/images/herbarium/poppy.webp",
    fallbackAsset: "./public/images/herbarium/poppy.png",
    alt: "Cành hoa anh túc ép khô",
  },
  dahlia: {
    id: "dahlia",
    asset: "./public/images/herbarium/dahlia.webp",
    fallbackAsset: "./public/images/herbarium/dahlia.png",
    alt: "Cành hoa thược dược ép khô",
  },
  gladiolus: {
    id: "gladiolus",
    asset: "./public/images/herbarium/gladiolus.webp",
    fallbackAsset: "./public/images/herbarium/gladiolus.png",
    alt: "Cành hoa lay ơn ép khô",
  },
  white: {
    id: "white",
    asset: "./public/images/herbarium/babys-breath.webp",
    fallbackAsset: "./public/images/herbarium/babys-breath.png",
    alt: "Nhánh hoa trắng ép khô",
  },
  lily: {
    id: "lily",
    asset: "./public/images/herbarium/lily.webp",
    fallbackAsset: "./public/images/herbarium/lily.png",
    alt: "Cành ly trắng ép khô",
  },
  olive: {
    id: "olive",
    asset: "./public/images/herbarium/olive.webp",
    fallbackAsset: "./public/images/herbarium/olive.png",
    alt: "Nhánh lá ô liu ép khô",
  },
});

export const APP_CONFIG = Object.freeze({
  defaultRecipient: "em",
  defaultSender: "Shyn",
  title: "Tháng tám ở lại",
  postcardTitle: "Một ngày tháng tám có em và hoa",
  soundtrack: Object.freeze({
    title: "Có Em",
    artist: "Madihu ft. Low G",
    src: "./public/audio/co-em-madihu-low-g.mp3",
    lyricsSrc: "./public/audio/co-em-lyrics.txt",
    volume: 0.2,
    loop: true,
    fadeDurationMs: 900,
  }),
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
