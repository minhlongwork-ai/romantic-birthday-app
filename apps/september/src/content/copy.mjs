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
    cake: "Tiramisu chanh — ngọt vừa đủ, lại có một chút chua. Anh nghĩ em sẽ thích. Nhớ ăn lúc còn ngon nhé.",
    bouquet: "Không cần đợi một dịp đặc biệt — chỉ cần hôm nay em xứng đáng nhận một điều thật đẹp.",
  }),
  groupClues: Object.freeze({
    sweet: "Một vị ngọt có chút tươi",
    bloom: "Một bó dịu dàng ở lại",
  }),
});

export const SEPTEMBER_FINAL_LETTER =
  "Anh không ở cạnh lúc em mở thiếp, nên gửi một xưởng nhỏ thay anh chuẩn bị mọi thứ. Bánh để em có một chút ngọt, hoa để ngày của em đẹp hơn. Còn anh chỉ muốn em biết: dù không ở đây, anh vẫn muốn có mặt trong ngày của em theo một cách nhỏ thôi.";

export const SEPTEMBER_ENDING_TEMPLATE = SEPTEMBER_FINAL_LETTER;

export function previewBadgeForGift(gift) {
  return gift?.fixture === true ? SEPTEMBER_COPY.demoBadge : null;
}

export function introNoteForGifts(gifts, recipient) {
  const prefix = Array.isArray(gifts) && gifts.some((gift) => gift?.fixture === true)
    ? `${SEPTEMBER_COPY.demoBadge} · `
    : "";
  return `${prefix}Dành cho ${recipient}`;
}
