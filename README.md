# Romantic Gift Collection

Một website tĩnh gồm cổng chọn thiệp và ba trải nghiệm độc lập:

- `/birthday/`: Memory Scrapbook sinh nhật được xây bằng Vite.
- `/august/`: August Herbarium với ảnh tùy chọn và postcard hoa ép.
- `/september/`: Một chút ngọt, một chút hoa — bánh tiramisu chanh, bó hồng kem
  hồng phấn và chiếc nơ cuối cùng.

Trang gốc hiển thị ba bìa thiệp để người nhận chọn. Các query `to`, `from` và
`age` được giữ lại khi chuyển sang thiệp tương ứng. Nội dung album sinh nhật,
nhạc nền và 21 kỷ niệm được quản lý trong `src/content/gift.json`; August
Herbarium nằm riêng trong `apps/august/`.

## Chạy trên máy

Yêu cầu Node.js `^20.19.0` hoặc `>=22.12.0` và npm.

```bash
npm ci
npm run dev
```

Mở `http://127.0.0.1:4183/` để xem cổng chọn thiệp. `npm run dev` tạo bản
composite trong `dist/` rồi chạy static server. Khi chỉ phát triển thiệp sinh
nhật và cần hot reload, dùng `npm run dev:birthday`.

Không mở trực tiếp `index.html`, vì camera, module JavaScript và service worker
cần một origin an toàn (`localhost` hoặc HTTPS).

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

URL production, canonical route, Open Graph và đích QR được quản lý riêng trong
`src/content/site.json`. QR Birthday luôn trỏ tới `/birthday/`, không mang query
hoặc fragment cá nhân hóa.

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

## Thẻ NFC cho món quà tháng Chín

NFC chỉ là một cách mở quà tiện hơn, không phải điều kiện để tiếp tục. Ghi hai
thẻ NDEF tương thích NTAG213 bằng đúng hai URL HTTPS cố định sau, sau khi bản
HTTPS staging cuối cùng đã được người tặng duyệt:

```text
https://romantic-birthday-app.vercel.app/september/#gift=sweet
https://romantic-birthday-app.vercel.app/september/#gift=bloom
```

URL thứ nhất dành cho bánh tiramisu chanh, URL thứ hai dành cho bó hồng kem và
hồng phấn. Không thêm tên, query, ảnh, mã bí mật hay URL khác vào thẻ. Trên
iPhone XS hoặc mới hơn, người nhận bật màn hình, chạm phần trên của iPhone gần
thẻ, rồi chạm thông báo hệ thống để mở Safari. Website không xin quyền NFC và
không đọc dữ liệu NFC thô.

Không dán thẻ trực tiếp lên kim loại hoặc giấy bạc. Đặt thẻ bánh trong hang tag
giấy cán màng/chống ẩm, để cả hai thẻ vẫn chạm được sau khi mở quà, và in chỉ dẫn
ngắn “Chạm phần trên iPhone vào đây”. Mỗi ngăn vẫn có nút **Mở không dùng NFC**
với kết quả tương đương; hãy hướng dẫn người nhận dùng nút này nếu điện thoại
không hiện thông báo.

Chỉ tiến trình NFC ẩn danh của hai món quà được lưu cùng origin, tối đa 24 giờ.
Nó không chứa tên, query, URL, ảnh hoặc referrer; khi local storage bị từ chối,
trải nghiệm vẫn tiếp tục trong bộ nhớ và reset sẽ xóa bản ghi.

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
| `npm run dev` | Build và chạy cổng chọn cùng ba thiệp tại port 4183. |
| `npm run dev:birthday` | Chạy riêng Vite development server của thiệp sinh nhật. |
| `npm run build` | Build preview chooser, Birthday, August và September vào `dist/`; fixture September chỉ dùng để duyệt local. |
| `npm run build:release` | Chạy approval gate September rồi mới build artifact có thể phát hành. |
| `npm run validate:september:release` | Chặn fixture hoặc nội dung/ảnh September chưa được người tặng duyệt. |
| `npm run validate` | Kiểm tra config nguồn, nội dung, Open Graph và toàn bộ media. |
| `npm run validate:dist` | Xác minh digest, MIME, route và giới hạn asset trong `dist/`. |
| `npm run validate:remote -- URL` | HEAD mọi asset và GET asset critical của deployment. |
| `npm run generate:qr` | Sinh `public/share-qr.svg` từ URL chia sẻ an toàn. |
| `npm test` | Chạy unit test của Birthday, August và September. |
| `npm run test:e2e` | Build production rồi chạy browser matrix Playwright trên `dist/`. |
| `npm run test:e2e:run` | Chạy Playwright trên `dist/` đã build sẵn (dùng trong CI). |
| `npm run optimize` | Tạo WebP, AVIF và các asset thương hiệu từ ảnh gốc. |

E2E được cấu hình cho desktop Chrome, Pixel 7 Chromium, desktop Firefox,
desktop WebKit, iPhone 13 WebKit và một project regression iPhone X riêng.
Đặt `E2E_REMOTE_URL=https://deployment.example/` để test trực tiếp deployment;
Playwright sẽ không khởi động local server trong chế độ này.

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

## CI và triển khai Vercel

Workflow `.github/workflows/ci.yml` chỉ làm quality gate, không có quyền deploy:

1. validate source;
2. chạy unit test;
3. build và validate artifact composite;
4. chạy toàn bộ Playwright matrix;
5. giữ report, test result và build manifest trong 30 ngày.

Vercel là nền tảng production duy nhất. Preview chạy `npm run build`; production
chạy approval gate tương đương `npm run build:release` rồi publish `dist/`.
Release chỉ được chấp nhận khi deployment
`READY` có đúng Git commit SHA đã merge và vượt qua remote quality gates.

Artifact sau build có cấu trúc:

```text
dist/
  index.html
  birthday/
  august/
  september/
```

Service worker tại trang gốc chỉ dùng để gỡ cache của bản Birthday cũ. Thiệp
sinh nhật đăng ký service worker riêng trong scope `/birthday/`, nên không can
thiệp vào August Herbarium hoặc September Sweet & Bloom.

Ảnh social preview là artwork chung, không chứa tên hoặc ảnh cá nhân. Build cũng
tạo `public/share-qr.svg` từ `src/content/site.json`; QR cố ý không dùng các
query `to`, `age`, `from`. Khi đổi domain chính thức, chỉ cập nhật `origin` trong
file này rồi chạy lại validate/build.

`vercel.json` phục vụ custom 404, buộc root migration worker và Birthday service
worker revalidate, đồng thời giữ bốn route canonical `/`, `/birthday/`, `/august/`,
`/september/` hoạt động khi truy cập hoặc refresh trực tiếp. Không lập trình thẻ
NFC vật lý trước khi có deployment HTTPS staging cuối cùng đã được duyệt.
