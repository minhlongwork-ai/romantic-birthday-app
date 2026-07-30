# August Herbarium

Một thiệp chúc tháng Tám dạng cuốn herbarium kỹ thuật số, được thiết kế để
kết nối với bó hoa thật ngoài đời. Dự án chạy hoàn toàn tĩnh bằng HTML, CSS
và JavaScript thuần, độc lập với `romantic-birthday-app`.

## Hành trình

Thiệp có bảy stage toàn màn hình:

1. Kéo con dấu hoặc nhấn `Mở thư`.
2. Đọc lời chúc đầu tháng.
3. Chọn một điều muốn mang theo.
4. Chụp cùng bó hoa, chọn ảnh có sẵn hoặc bỏ qua.
5. Căn ảnh, zoom, xoay và chọn khung.
6. Sắp ba cành hoa vào trang rồi ép hoa.
7. Lưu postcard PNG 1200 x 1500 hoặc chia sẻ bằng Web Share.

Nhánh không có ảnh vẫn hoàn thành đầy đủ. Toàn bộ luồng dùng được bằng bàn
phím và có chế độ `prefers-reduced-motion`.

## Quyền riêng tư

Ảnh chỉ được xử lý trong bộ nhớ của trình duyệt:

- Không có backend, tài khoản hoặc cloud upload.
- Không lưu ảnh vào URL, localStorage, IndexedDB hoặc service worker.
- Blob URL và ImageBitmap được giải phóng khi chọn ảnh khác, replay hoặc
  đóng trang.
- Nút chụp dùng camera hệ thống qua file input, không mở WebRTC stream.

Hỗ trợ JPEG, PNG và WebP tối đa 15 MB. HEIC/HEIF được dùng khi chính trình
duyệt có thể giải mã. Ảnh lớn được giảm xuống tối đa 2048 px ở cạnh dài.

## Chạy local

Yêu cầu Node.js 20 trở lên.

```bash
npm run dev
```

Mở `http://127.0.0.1:5190/`.

Tên người nhận và người gửi có thể được tùy biến:

```text
http://127.0.0.1:5190/?to=Em&from=Minh%20Long
```

Giá trị query được chuẩn hóa Unicode, cắt khoảng trắng và giới hạn 32 ký tự.

## Kiểm tra

```bash
npm run qa
```

Lệnh này kiểm tra cú pháp, cấu hình bảy stage, asset và font self-hosted,
external runtime URL, giới hạn dung lượng, photo crop math, flower anchors
và postcard helpers.

## Cấu trúc

- `index.html`: shell semantic và metadata của thiệp.
- `src/main.js`: state controller, history và lifecycle `enter/exit`.
- `src/herbarium/config.js`: copy, lời chúc, frame và asset paths.
- `src/herbarium/scenes.js`: giao diện và tương tác của bảy stage.
- `src/herbarium/photo-engine.js`: validation, decode, downscale và cleanup.
- `src/herbarium/arrangement-engine.js`: sáu anchor và layer của cành hoa.
- `src/herbarium/postcard-renderer.js`: xuất postcard Canvas 1200 x 1500.
- `public/images/herbarium/`: botanical PNG và WebP self-hosted.
- `public/fonts/`: Cormorant Garamond WOFF2 self-hosted.
- `scripts/validate.mjs`: preflight cho app static.
