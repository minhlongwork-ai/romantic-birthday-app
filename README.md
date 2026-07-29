# Romantic Birthday App

Một cuốn album sinh nhật tương tác được xây bằng Vite. Nội dung lời chúc, người
nhận, nhạc nền và 21 kỷ niệm được quản lý tập trung trong `src/content/gift.json`.
Ứng dụng có thể cài như PWA, hỗ trợ điều khiển bằng bàn phím/cảm ứng và có cử chỉ
camera hoàn toàn tự nguyện.

## Chạy trên máy

Yêu cầu Node.js `^20.19.0` hoặc `>=22.12.0` và npm.

```bash
npm ci
npm run dev
```

Mở địa chỉ Vite in ra trong terminal. Không mở trực tiếp `index.html`, vì camera,
module JavaScript và service worker cần một origin an toàn (`localhost` hoặc
HTTPS).

Nếu chạy E2E lần đầu, cài Chromium cho Playwright:

```bash
npx playwright install chromium
npm run test:e2e
```

## Cá nhân hóa món quà

Chỉnh `src/content/gift.json` — đây là nguồn dữ liệu duy nhất của món quà:

- `recipient` và `sender`: tên, tuổi của người nhận và tên người gửi.
- `letter` và `epilogue`: lời mở đầu, các đoạn thư và lời kết. Có thể dùng
  `{{recipient}}`, `{{age}}`, `{{sender}}`.
- `soundtrack`: đường dẫn file trong `public/`, tiêu đề, chế độ lặp và lời nhạc
  theo mốc thời gian.
- `giftReveal`: tên, mã nhận diện nội bộ, ảnh, alt text và lời mở món quà; mã sản
  phẩm chỉ dùng để giữ asset chính xác, không hiển thị như trang bán hàng.
- `memories`: danh sách ảnh, mô tả thay thế, chú thích, chương và ngày tùy chọn.
- `features`: bật/tắt các tính năng được hỗ trợ.
- `sharing.publicUrl`: URL HTTPS công khai dùng để tạo QR; không được chứa query
  cá nhân hóa, thông tin đăng nhập hoặc fragment.

Sau mỗi lần sửa, chạy:

```bash
npm run validate
```

Trình kiểm tra sẽ xác thực cấu trúc JSON, giới hạn nội dung, đường dẫn an toàn và
sự tồn tại của toàn bộ ảnh/âm thanh.

### Ảnh JPG, WebP và AVIF

Đặt đúng 21 ảnh kỷ niệm tại `public/images/1.jpg` đến
`public/images/21.jpg` và ảnh món quà JPG tại đường dẫn `giftReveal.src`. Sau đó
tạo lại các biến thể tối ưu:

```bash
npm run optimize
```

Lệnh này resize và loại metadata khỏi JPG fallback, rồi tạo WebP/AVIF cho toàn
bộ ảnh kỷ niệm và ảnh `giftReveal`. Trình duyệt sẽ ưu tiên AVIF, sau đó WebP,
rồi mới dùng JPG. File digest `.variants.json` được tạo cùng lúc để validator
chặn trường hợp JPG mới vô tình đi kèm WebP/AVIF cũ. Lệnh cũng tạo lại favicon,
ảnh xem trước khi chia sẻ và hai icon PWA trong `public/icons/`.

## Tương tác và camera

Camera luôn tắt khi bắt đầu. Người nhận phải chủ động bấm **Dùng cử chỉ** và chấp
nhận quyền của trình duyệt; video chỉ được xử lý trên thiết bị để nhận diện thao
tác vẫy tay. Camera dừng khi rời màn bánh, chuyển ứng dụng sang nền hoặc đóng
trang.

Không cấp quyền camera vẫn dùng được toàn bộ món quà: nút **Chạm để thổi nến**
luôn là phương án dự phòng. Ứng dụng không có tính năng tải ảnh riêng tư từ thiết
bị của người nhận.

Có thể ghi đè nhanh tên và tuổi bằng query URL:

```text
?to=Ten%20Nguoi%20Nhan&age=23&from=Ten%20Nguoi%20Gui
```

Query chỉ ghi đè nội dung lúc chạy, không sửa `gift.json`.

## Quyền riêng tư khi xuất bản

> **Cảnh báo:** mọi file trong `public/` và nội dung được đóng gói từ
> `src/content/gift.json` đều có thể được bất kỳ ai có URL tải xuống khi website
> được triển khai công khai. Chỉ đăng ảnh, nhạc và lời nhắn khi các bên liên quan
> đã đồng ý; không đặt bí mật hoặc thông tin nhạy cảm trong repo hay query URL.

Query cá nhân hóa có thể xuất hiện trong lịch sử trình duyệt, ảnh chụp màn hình
hoặc log của nền tảng lưu trữ. Service worker không gửi dữ liệu đến dịch vụ bên
ngoài, không chặn/cache luồng camera hay tài nguyên nhận diện camera, và bỏ query
khỏi cache key để mỗi liên kết cá nhân không tạo một bản cache riêng. Tài nguyên
tĩnh đã xem có thể vẫn nằm trong bộ nhớ website trên thiết bị cho đến khi người
dùng xóa dữ liệu trang.

## Các lệnh

| Lệnh | Công dụng |
|---|---|
| `npm run dev` | Chạy Vite development server. |
| `npm run build` | Kiểm tra dữ liệu rồi build production vào `dist/`. |
| `npm run validate` | Kiểm tra `gift.json` và toàn bộ media được tham chiếu. |
| `npm run generate:qr` | Sinh `public/share-qr.svg` từ URL chia sẻ an toàn. |
| `npm test` | Chạy unit test bằng Node test runner. |
| `npm run test:e2e` | Build production rồi chạy browser matrix Playwright trên `dist/`. |
| `npm run test:e2e:run` | Chạy Playwright trên `dist/` đã build sẵn (dùng trong CI). |
| `npm run optimize` | Tạo WebP, AVIF và các asset thương hiệu từ ảnh gốc. |

E2E được cấu hình cho desktop Chrome, Android Chrome, desktop Firefox, desktop
WebKit (Safari) và iPhone WebKit (iOS Safari). Workflow CI cài đủ ba browser
engine trước khi chạy.

## PWA và chế độ offline

Sau lần truy cập HTTPS đầu tiên, trình duyệt hỗ trợ PWA có thể đề nghị cài ứng
dụng. Khi build, Vite manifest được dùng để đưa HTML, CSS, font và JavaScript
khởi động vào app shell; cache version được tạo tự động từ nội dung build. Ảnh
và các chunk tải chậm chỉ được cache sau khi người nhận thực sự mở chúng, tránh
tải toàn bộ media ngay từ intro.

Camera/MediaPipe không được cache, nên chế độ cử chỉ có thể không sẵn sàng khi
offline; nút chạm vẫn là fallback. Nhạc dùng HTTP Range để tua/phát ổn định nên
được xem là online-only. Các kỷ niệm chưa từng mở cũng có thể chưa sẵn sàng
offline, còn app shell và nội dung đã tải sẽ dùng chiến lược static-first.
Service worker mới mặc định chờ các tab của bản cũ đóng trước khi kích hoạt. Nếu
một deployment mới làm URL chunk cũ không còn tồn tại, gallery vẫn giữ Back và
lời kết hoạt động, đồng thời hiện nút tải lại; nút này chủ động kích hoạt bản
service worker đang chờ rồi mở lại phiên bản mới.

## Triển khai GitHub Pages

Workflow `.github/workflows/pages.yml` tự động:

1. cài dependency bằng `npm ci`;
2. chạy unit test, validate dữ liệu và build Vite với base tương đối;
3. cài browser matrix rồi chạy E2E trên bản production preview;
4. với push lên `main`, upload duy nhất `dist/` và triển khai bằng GitHub Pages.

Trong repository GitHub, vào **Settings → Pages → Build and deployment** và chọn
**GitHub Actions** làm source. Mỗi lần push lên nhánh `main` (hoặc chạy workflow
thủ công) sẽ tạo một bản triển khai mới; pull request chỉ chạy kiểm tra, không có
quyền deploy. Nếu nhánh mặc định có tên khác, cập nhật `branches` trong workflow
trước khi dùng.

Ảnh social preview là artwork chung, không chứa tên hoặc ảnh cá nhân. Build cũng
tạo `public/share-qr.svg` từ `sharing.publicUrl`; QR cố ý không dùng các query
`to`, `age`, `from`. Nếu dùng custom domain, cập nhật URL này trước khi build.
