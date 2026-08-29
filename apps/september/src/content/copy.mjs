export const SEPTEMBER_COPY = Object.freeze({
  kicker: "Một chút ngọt, một chút hoa",
  introTitle: "Một chút ngọt, một chút hoa — anh chọn riêng cho em.",
  introBody: "Cả hai đều là của em. Em chỉ cần chọn món mình muốn mở trước.",
  introCta: "Bắt đầu",
  boxTitle: "Em muốn tìm món nào trước?",
  boxBody: "Hai món quà, hai điều nhỏ. Thứ tự là do em chọn.",
  boxCompleteTitle: "Cả hai món đã ở đây.",
  boxCompleteBody: "Giờ mình thắt hai dải ruy-băng lại nhé.",
  boxCompleteCta: "Thắt nơ cho món quà",
  nfcOpen: "Chạm iPhone vào thẻ quà",
  nfcFallback: "Mở không dùng NFC",
  nfcStay: "Để sau",
  revealReturn: "Trở về hộp quà",
  imageError: "Ảnh món quà chưa tải được",
  gameTitle: "Thắt nơ cho món quà",
  gameInstruction: "Xoay hai dải ruy-băng để nối chúng thành một chiếc nơ hoàn chỉnh.",
  gameSkip: "Bỏ qua và xem lời nhắn",
  gameSolved: "Em thắt được rồi.",
  endingTitle: "Một chút ngọt. Một chút hoa.",
  endingSolvedBody: "Hai dải ruy-băng đã khép thành một chiếc nơ.",
  endingSkippedBody: "Không cần hoàn thành trò chơi để nhận đủ hai lời nhắn.",
  endingReplay: "Mở lại từ đầu",
  demoBadge: "Bản xem thử",
  wishes: Object.freeze({
    cake: "Anh chọn bánh tiramisu chanh vì vị vừa ngọt vừa tươi. Nhớ ăn khi còn mát nhé.",
    bouquet: "Bó hoa này không cần chờ một dịp đặc biệt. Anh chỉ muốn em có hoa và vui thêm một chút.",
  }),
  groupClues: Object.freeze({
    sweet: "Một vị ngọt có chút tươi",
    bloom: "Một bó dịu dàng ở lại",
  }),
});

export const SEPTEMBER_ENDING_TEMPLATE =
  "{{recipient}}, mong em thích hai món quà nhỏ này. {{sender}} chỉ muốn thấy em vui thôi.";

export function previewBadgeForGift(gift) {
  return gift?.fixture === true ? SEPTEMBER_COPY.demoBadge : null;
}

export function introNoteForGifts(gifts, recipient) {
  const prefix = Array.isArray(gifts) && gifts.some((gift) => gift?.fixture === true)
    ? `${SEPTEMBER_COPY.demoBadge} · `
    : "";
  return `${prefix}Dành cho ${recipient}`;
}
