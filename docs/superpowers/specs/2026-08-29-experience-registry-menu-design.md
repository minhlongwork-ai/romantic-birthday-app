# Experience Registry Menu Design

## 1. Mục tiêu

Biến menu `/` thành cổng chung có thể mở rộng cho chuỗi thiệp được thiết kế hàng tháng. Một registry trung tâm là nguồn dữ liệu duy nhất cho thẻ menu, route, metadata, share target, composite build và validation.

Thiết kế phải giữ nguyên hành vi hiện tại của ba trải nghiệm năm 2026:

- Tháng 5: Birthday tại `/birthday/`.
- Tháng 8: August tại `/august/`.
- Tháng 9: September tại `/september/`.

Trong mỗi năm, menu sắp xếp thiệp theo tháng từ cũ đến mới. Các năm được hiển thị thành nhóm riêng và cũng tăng dần theo thời gian.

## 2. Phạm vi

### Bao gồm

- Registry trung tâm cho mọi trải nghiệm.
- Menu build-time chia theo năm và sắp theo tháng.
- Hai trạng thái `draft` và `published`.
- Preview build tất cả route; production chỉ build route published.
- Thẻ draft luôn xuất hiện nhưng bị khóa.
- Direct URL của draft hoạt động trong development và preview.
- Metadata, share target, route build và validation được suy ra từ registry.
- Migration Birthday, August và September mà không đổi URL hay hành vi trong app.
- Contract, build và browser regression tests.

### Không bao gồm

- CMS hoặc backend quản lý thiệp.
- Tự quét thư mục để đưa app vào registry.
- Query bí mật để mở thiệp draft.
- Thay đổi nội dung hoặc interaction bên trong Birthday, August và September.
- Deploy hoặc thay đổi dữ liệu quà thật của September.

## 3. Nguồn dữ liệu duy nhất

Tạo `src/content/experiences.json`. Mỗi record có cấu trúc logic sau:

```json
{
  "id": "september",
  "year": 2026,
  "month": 9,
  "title": "Một chút ngọt, một chút hoa",
  "description": "Hai món quà nhỏ dành riêng cho em.",
  "route": "/september/",
  "status": "draft",
  "actionLabel": "Mở thiệp",
  "preview": {
    "source": "apps/september/public/images/preview.webp",
    "publicPath": "/experience-previews/september.webp",
    "alt": "Bánh tiramisu chanh và bó hồng kem trong studio ấm"
  },
  "metadata": {
    "title": "Một chút ngọt, một chút hoa",
    "description": "Một trải nghiệm quà tặng với bánh ngọt, hoa và nơ satin.",
    "ogImage": "/september/images/preview.webp"
  },
  "build": {
    "config": "apps/september/vite.config.js",
    "destination": "september"
  }
}
```

Registry không chứa personalized values. Query `to`, `from` và `age` chỉ được đọc tại runtime từ URL menu và chuyển tiếp theo allowlist hiện có.

## 4. Schema và bất biến

Mỗi record phải thỏa mãn:

- `id`: slug duy nhất, chỉ chữ thường, số và dấu gạch ngang.
- `year`: số nguyên bốn chữ số.
- `month`: số nguyên từ 1 đến 12.
- Cặp `(year, month)` duy nhất.
- `route`: absolute path nội bộ, có dấu `/` ở cuối, không có query, hash, backslash hoặc `..`.
- `status`: chỉ `draft` hoặc `published`.
- `title`, `description`, `actionLabel` và preview alt là chuỗi không rỗng có giới hạn độ dài.
- Preview source, preview public path, OG image, Vite config và destination đều là đường dẫn nội bộ an toàn.
- `preview.source` phải tồn tại trong repository; `preview.publicPath` phải nằm dưới `/experience-previews/` và là duy nhất.
- `build.config` phải tồn tại và nằm trong repository.
- `destination` không được trùng với record khác và không được thoát khỏi `dist`.

Validator từ chối ID, route, destination hoặc cặp năm-tháng trùng nhau. Build không được âm thầm bỏ qua record lỗi.

## 5. Kiến trúc module

### `src/content/experiences.json`

Authoritative records do người phát hành chỉnh sửa.

### `scripts/experience-registry.mjs`

Đọc, validate, normalize và sắp xếp registry. Module xuất các interface ổn định:

```js
loadExperienceRegistry({ rootDir })
validateExperienceRegistry(records, { rootDir })
groupExperiencesByYear(records)
selectBuildExperiences(records, environment)
```

`selectBuildExperiences` trả tất cả record trong development/preview và chỉ record `published` trong production.

### `portal/experience-catalog.mjs`

Nhận registry đã validate và render HTML card theo nhóm năm. Module không đọc filesystem hoặc environment trực tiếp; mọi đầu vào được truyền rõ để test độc lập.

### `portal/vite.config.js`

Dùng `transformIndexHtml` để thay marker cố định trong `portal/index.html` bằng HTML đã render. Menu vì vậy có nội dung đầy đủ ngay ở response đầu tiên và không phụ thuộc JavaScript runtime.

Vite/composite build copy preview của mọi record từ `preview.source` sang `preview.publicPath`. Preview là asset của chooser, không thuộc route app, nên card draft vẫn có ảnh trong production mà không cần phát hành route hoặc asset namespace của app.

### `scripts/site-config.mjs`

Giữ production origin trong `site.json`, nhưng suy ra routes, share targets và metadata của trải nghiệm từ registry. Cho phép các consumer hiện tại chuyển đổi dần mà không giữ hai nguồn dữ liệu song song.

### `scripts/build-composite.mjs`

Thay mảng `routeBuilds` hardcode bằng danh sách từ registry. Chooser vẫn luôn được build. Environment quyết định route trải nghiệm nào được build.

## 6. Menu và accessibility

Menu hiển thị heading năm, sau đó các thẻ tháng theo thứ tự tăng dần.

### Published card

- Là liên kết thật tới route.
- Có accessible description và action label.
- `portal.js` chuyển tiếp duy nhất `to`, `from`, `age`.
- Preview fallback hiện trạng thái ảnh không tải được mà không khóa link.

### Draft card

- Vẫn hiển thị title, tháng, preview và description.
- Có badge “Đang hoàn thiện”.
- Không có `href` và không được gắn `data-project-link`.
- Dùng phần tử semantic không tương tác với `aria-disabled="true"` và giải thích ngắn rằng bản xem thử được mở bằng URL trực tiếp.
- Không xuất hiện trong tab order như một link giả.

Không dùng disabled anchor. Target tương tác published tối thiểu 44 CSS px, focus indicator giữ nguyên AA và menu hoạt động ở zoom 200%.

## 7. Build theo môi trường

### Development và Vercel Preview

- Menu chứa tất cả record.
- Published card mở bình thường.
- Draft card bị khóa trên menu.
- Tất cả route, gồm draft, được composite build để direct URL dùng cho review.

### Production

- Menu vẫn chứa tất cả record để người nhận thấy timeline đầy đủ.
- Draft card bị khóa.
- Chỉ route published được xuất vào `dist`.
- Preview chooser của draft vẫn được xuất dưới `/experience-previews/`; các asset runtime khác của draft không được xuất.
- Direct refresh draft đi tới shared 404.
- Validator kiểm `dist` không chứa asset namespace hoặc route entry của draft.

Một draft không được chặn việc deploy các thiệp published hoặc các bản sửa site chung.
Release validator riêng của một app chỉ chạy ở production khi record tương ứng là `published`. Chuyển status sang published khi app còn fixture, placeholder hoặc chưa approved phải làm production build thất bại trước Vite.

## 8. Metadata và personalization

- Canonical URL bằng production origin cộng route.
- OG URL dùng canonical URL; OG image lấy từ record.
- Menu có metadata cấp site, không dùng metadata của thiệp đầu tiên.
- `shareTargets` được suy ra từ route registry.
- Menu chỉ chuyển `to`, `from`, `age`; duplicate values giữ thứ tự như contract hiện tại.
- Draft card không nhận query vì không có link.
- Registry, build manifest và logs không lưu personalized query.

## 9. Migration

Ba record đầu tiên thuộc năm 2026 và có thứ tự:

1. Birthday — tháng 5 — `/birthday/`.
2. August — tháng 8 — `/august/`.
3. September — tháng 9 — `/september/`.

Birthday và August giữ trạng thái published. September giữ trạng thái draft cho tới khi sender inputs, assets và approval gate hiện có được hoàn tất.

Migration giữ nguyên:

- Route và canonical URL.
- App Vite config và output directory.
- Source preview assets; menu preview được chuẩn hóa sang `/experience-previews/<id>.<ext>`.
- Nội dung và behavior trong từng app.
- Shared query allowlist.
- Shared 404.

Sau migration, route/metadata/build entries cũ bị xóa khỏi các cấu hình hardcode để registry thực sự là nguồn duy nhất.

## 10. Error handling

- Registry JSON không parse được: build fail với file và parse error.
- Record lỗi: build fail với `experience id`, field path và lý do.
- Preview hoặc config không tồn tại: source validation fail trước Vite.
- Duplicate year/month, route hoặc destination: validation fail và liệt kê cả hai record.
- Render card gặp dữ liệu đã validate nhưng không hỗ trợ: throw; không sinh card rỗng.
- Production chứa draft route: dist validation fail.
- Published route thiếu output, index, metadata hoặc critical preview: dist validation fail.

## 11. Kiểm thử và nghiệm thu

### Registry unit tests

- Đúng ba record migration và thứ tự 05 → 08 → 09.
- Nhóm nhiều năm tăng dần; trong năm tháng tăng dần.
- Từ chối duplicate và unsafe paths.
- Production selector chỉ trả published; preview selector trả tất cả.

### Menu contract tests

- Một card cho mỗi registry record, đúng nhóm năm.
- Published dùng link và `data-project-link`.
- Draft không có link, có badge, `aria-disabled` và không vào tab order.
- Copy, preview và alt lấy đúng từ registry.

### Build tests

- Development/preview build Birthday, August và September.
- Production fixture build Birthday và August, không xuất September route/runtime assets nhưng vẫn xuất chooser preview của September.
- Build manifest và initial dependency closure chỉ chứa route thực sự được build.
- Inject record lỗi làm build fail trước khi tạo artifact.

### Browser tests

- Menu desktop/mobile sắp đúng năm/tháng.
- `to`, `from`, `age` được chuyển tới published links; query lạ không được chuyển.
- Draft card không thể kích hoạt bằng pointer hoặc keyboard.
- Direct refresh September hoạt động ở preview fixture và về 404 trong production fixture.
- Canonical, OG metadata và preview đúng cho mọi published route.
- Birthday, August và September preview regressions vẫn vượt qua.

## 12. Quy trình thêm thiệp hàng tháng

1. Tạo app, Vite config và preview asset.
2. Thêm một record `status: "draft"` vào registry.
3. Chạy source/schema tests.
4. Preview tự hiển thị card khóa và build direct route.
5. Review nội dung, accessibility, assets và release-specific gates của app.
6. Đổi record sang `status: "published"`.
7. Production composite build tự thêm route và mở khóa card.

Không chỉnh thủ công HTML menu, route array, metadata map hoặc test route list khi thêm tháng mới.

## 13. Rollback

- Nếu registry migration gây lỗi, revert commit registry cùng renderer/build consumers trong một lần.
- Không xóa app hoặc assets cũ trong migration đầu tiên; chỉ thay nguồn orchestration.
- Nếu một thiệp published cần rút khẩn cấp, đổi trạng thái thành draft: menu khóa card và production kế tiếp loại route khỏi dist.
- Không tự động xóa deployment cũ hoặc dữ liệu bên ngoài repository.
