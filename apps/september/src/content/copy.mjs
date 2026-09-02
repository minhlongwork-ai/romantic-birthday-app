export const SEPTEMBER_COPY = Object.freeze({
  kicker: "Một điều nhỏ dành cho em",
  letterTitle: "Để hôm nay có thêm một điều để nhớ.",
  introBody: "Anh để lại hai điều nhỏ cho ngày hôm nay của em.",
  imageError: "Ảnh món quà chưa tải được",
  endingReplay: "Đọc lại từ đầu",
  demoBadge: "Bản xem thử",
  wishes: Object.freeze({
    cake: "Có một chút chua dịu, một chút ngọt vừa đủ. Anh nghĩ những điều nhỏ như vậy cũng có thể làm một ngày của em dễ chịu hơn.",
    bouquet: "Bó hoa này không cần một dịp để được gửi đi. Anh chỉ nghĩ, giữa một ngày rất bình thường, em cũng xứng đáng có một điều mềm mại và đẹp đẽ.",
  }),
  groupClues: Object.freeze({
    sweet: "Một miếng tươi sáng cho hôm nay",
    bloom: "Một điều đẹp được đặt vào tay em",
  }),
});

export const SEPTEMBER_FINAL_LETTER =
  "Bánh để em có một chút ngọt, hoa để ngày của em đẹp hơn. Còn anh chỉ muốn em biết: dù không ở đây, anh vẫn mong những ngày của em, dù rực rỡ hay bình thường, vẫn luôn có đủ những điều dịu dàng để em mỉm cười.";

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
