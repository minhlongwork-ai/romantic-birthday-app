export const SEPTEMBER_COPY = Object.freeze({
  kicker: "Một chút ngọt, một chút hoa",
  introTitle: "Một xưởng nhỏ đang chờ em.",
  introBody: "Anh đã để hai món ở đây. Em giúp xưởng hoàn thành nốt nhé.",
  introCta: "Khởi động xưởng",
  invitationTitle: "Cho xưởng mượn một bàn tay nhé?",
  invitationPrivacy: "Camera chỉ giúp chiếc bóng giấy đi theo tay em. Không có hình ảnh nào được lưu hoặc gửi đi.",
  cameraCta: "Dùng bàn tay",
  touchCta: "Dùng chạm",
  bridgeInstruction: "Giữ tay một chút, để nối đường ray.",
  bridgeNote: "Giữ yên một chút để giấy tìm thấy tay em.",
  forkInstruction: "Đưa chiếc bóng về hướng em muốn mở trước.",
  deliveryCue: "Nghe xem, xưởng bắt đầu chạy rồi.",
  envelopeCta: "Mở phong bì",
  continueCta: "Cho xưởng chạy tiếp",
  letterCta: "Mở lá thư",
  replayCta: "Xem lại từ đầu",
  touchContinueCta: "Chạm để tiếp tục",
  resumeCameraCta: "Tiếp tục với bàn tay",
  inAppCameraNote: "Muốn dùng bàn tay? Hãy mở liên kết này bằng Safari.",
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
  demoBadge: "Bản xem thử · ảnh minh họa",
  wishes: Object.freeze({
    cake: "Tiramisu chanh — ngọt vừa đủ, lại có một chút chua. Anh nghĩ em sẽ thích. Nhớ ăn lúc còn ngon nhé.",
    bouquet: "Anh không đợi một dịp đặc biệt mới tặng hoa. Chỉ là anh nghĩ bó hoa này sẽ rất đẹp khi ở cạnh em.",
  }),
  groupClues: Object.freeze({
    sweet: "Một vị ngọt có chút tươi",
    bloom: "Một bó dịu dàng ở lại",
  }),
});

export const SEPTEMBER_ENDING_TEMPLATE =
  "{{recipient}}, mong em thích hai món quà nhỏ này. {{sender}} chỉ muốn thấy em vui thôi.";

export const SEPTEMBER_FINAL_LETTER =
  "Anh không ở cạnh lúc em mở thiếp, nên gửi một xưởng nhỏ thay anh chuẩn bị mọi thứ. Bánh để em có một chút ngọt, hoa để ngày của em đẹp hơn. Còn anh chỉ muốn em biết: dù không ở đây, anh vẫn muốn có mặt trong ngày của em theo một cách nhỏ thôi.";

export function previewBadgeForGift(gift) {
  return gift?.fixture === true ? SEPTEMBER_COPY.demoBadge : null;
}

export function introNoteForGifts(gifts, recipient) {
  const prefix = Array.isArray(gifts) && gifts.some((gift) => gift?.fixture === true)
    ? `${SEPTEMBER_COPY.demoBadge} · `
    : "";
  return `${prefix}Dành cho ${recipient}`;
}
