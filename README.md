# Thiệp hoa ép tháng tám

Một thiệp chúc tháng tám dạng cuốn sổ hoa ép kỹ thuật số, được thiết kế để
kết nối với bó hoa thật ngoài đời. Dự án chạy hoàn toàn tĩnh bằng HTML, CSS
và JavaScript thuần, độc lập với `romantic-birthday-app`.

## Hành trình

Thiệp có bảy màn hình toàn trang:

1. Kéo con dấu hoặc nhấn `Mở thư`.
2. Đọc lời chúc đầu tháng.
3. Chọn một điều muốn mang theo.
4. Chụp cùng bó hoa, chọn ảnh có sẵn hoặc bỏ qua.
5. Căn ảnh, phóng to, xoay và chọn khung.
6. Sắp bốn cành hoa vào trang rồi ép hoa.
7. Lưu bưu thiếp PNG 1200 × 1500 hoặc chia sẻ bằng Web Share.

Nhánh không có ảnh vẫn hoàn thành đầy đủ. Toàn bộ luồng dùng được bằng bàn
phím và có chế độ `prefers-reduced-motion`.

## Quyền riêng tư

Ảnh chỉ được xử lý trong bộ nhớ của trình duyệt:

- Không có máy chủ xử lý, tài khoản hoặc dịch vụ tải ảnh lên đám mây.
- Không lưu ảnh vào URL, localStorage, IndexedDB hoặc service worker.
- Blob URL và ImageBitmap được giải phóng khi chọn ảnh khác, xem lại từ đầu hoặc
  đóng trang.
- Nút chụp dùng camera hệ thống qua trường chọn tệp, không mở luồng WebRTC.

Hỗ trợ JPEG, PNG và WebP tối đa 15 MB. HEIC/HEIF được dùng khi chính trình
duyệt có thể giải mã. Ảnh lớn được giảm xuống tối đa 2048 px ở cạnh dài.

## Nhạc nền

Thiệp dùng `Có Em` của Madihu ft. Low G làm nhạc nền tự lưu trữ. File chỉ bắt
đầu tải và phát sau khi người nhận mở phong thư. Nút nhạc cố định cho phép phát
hoặc tạm dừng; chuyển sang tab khác sẽ tự tạm dừng và quay lại sẽ tiếp tục nếu
người nhận chưa chủ động dừng. Lời bài hát được tải riêng từ asset UTF-8 khi
nhạc bắt đầu, đổi theo 25 mốc thời gian và có nút `Lời` để ẩn hoặc hiện.

Trước khi phát hành bản GitHub Pages công khai, người triển khai chịu trách nhiệm
xác nhận quyền sử dụng và phân phối file âm thanh.

## Chạy cục bộ

Yêu cầu Node.js 20 trở lên.

```bash
npm run dev
```

Mở `http://127.0.0.1:5190/`.

Tên người nhận và người gửi có thể được tùy biến:

```text
http://127.0.0.1:5190/?to=Em&from=Minh%20Long
```

Tham số truy vấn được chuẩn hóa Unicode, cắt khoảng trắng và giới hạn 32 ký tự.

## Kiểm tra

```bash
npm run qa
```

Lệnh này kiểm tra cú pháp, cấu hình bảy màn hình, tài nguyên và phông chữ tự lưu trữ,
đường dẫn ngoài ở thời điểm chạy, giới hạn dung lượng, phép tính cắt ảnh, vị trí hoa
và các hàm hỗ trợ bưu thiếp.

## Cấu trúc

- `index.html`: cấu trúc ngữ nghĩa và siêu dữ liệu của thiệp.
- `src/main.js`: bộ điều khiển trạng thái, lịch sử và vòng đời `enter/exit`.
- `src/herbarium/config.js`: nội dung, lời chúc, khung ảnh và đường dẫn tài nguyên.
- `src/herbarium/scenes.js`: giao diện và tương tác của bảy màn hình.
- `src/herbarium/photo-engine.js`: kiểm tra, giải mã, thu nhỏ và dọn dẹp ảnh.
- `src/herbarium/photo-reveal.js`: chuyển cảnh hoa ngắn sau khi ảnh sẵn sàng.
- `src/herbarium/arrangement-engine.js`: sáu vị trí neo và lớp của cành hoa.
- `src/herbarium/postcard-renderer.js`: xuất bưu thiếp Canvas 1200 × 1500.
- `src/herbarium/lyric-timeline.js`: parse timestamp và tìm câu đang phát.
- `src/herbarium/soundtrack-controller.js`: phát nhạc lazy, lifecycle và điều khiển.
- `public/images/herbarium/`: ảnh thực vật học PNG và WebP tự lưu trữ.
- `public/audio/`: nhạc nền và file lyric tự lưu trữ.
- `public/fonts/`: Cormorant Garamond WOFF2 self-hosted.
- `scripts/validate.mjs`: preflight cho app static.
