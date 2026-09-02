export const SEPTEMBER_COPY = Object.freeze({
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
  imageError: "Ảnh món quà chưa tải được",
  demoBadge: "Bản xem thử · ảnh minh họa",
  wishes: Object.freeze({
    cake: "Tiramisu chanh — ngọt vừa đủ, lại có một chút chua. Anh nghĩ em sẽ thích. Nhớ ăn lúc còn ngon nhé.",
    bouquet: "Không cần đợi một dịp đặc biệt — chỉ cần hôm nay em xứng đáng nhận một điều thật đẹp.",
  }),
});

export const SEPTEMBER_FINAL_LETTER =
  "Anh không ở cạnh lúc em mở thiếp, nên gửi một xưởng nhỏ thay anh chuẩn bị mọi thứ. Bánh để em có một chút ngọt, hoa để ngày của em đẹp hơn. Còn anh chỉ muốn em biết: dù không ở đây, anh vẫn muốn có mặt trong ngày của em theo một cách nhỏ thôi.";

export function previewBadgeForGift(gift) {
  return gift?.fixture === true ? SEPTEMBER_COPY.demoBadge : null;
}
