# Thêm một thiệp hàng tháng

`src/content/experiences.json` là registry duy nhất của timeline thiệp. Mỗi
record trong đó cung cấp copy của thẻ, route, metadata, preview, build config và
validation hook; composite build sẽ tự suy ra những phần còn lại.

## Quy trình bảy bước

1. Tạo app mới, Vite config và preview asset.
2. Thêm một record với `status: "draft"` vào
   `src/content/experiences.json`.
3. Chạy source/schema tests.
4. Dùng preview build để kiểm tra: thiệp tự xuất hiện trong dòng thời gian
   nhưng không có hành động mở; direct route vẫn được build cho người review.
5. Review nội dung, accessibility, assets và các release gate riêng của app.
6. Đổi `status` của record thành `"published"` khi mọi release gate đã đạt.
7. Chạy production composite build: route được thêm tự động và thẻ trở thành
   liên kết với lời mời mở tự nhiên.

Khi thêm tháng, editor không được chỉnh thủ công HTML của portal, route arrays,
metadata maps hoặc test route lists. Nếu một trong các phần đó cần sửa, record
registry hoặc consumer của registry đang thiếu dữ liệu cần thiết.

`status` chỉ là logic build nội bộ. Không bao giờ thêm `draft`, `published`,
nhãn trạng thái, CTA giả hoặc copy kỹ thuật vào thẻ người nhận nhìn thấy. Một
thiệp draft vẫn có ảnh, tên tháng, tiêu đề và mô tả; nó không có `href` hay
tab stop, và chỉ có mô tả dành cho screen reader rằng thiệp chưa thể mở.

Sau thay đổi registry, chạy ít nhất:

```bash
npm run validate
npm run build
npx playwright test tests/e2e/portal-registry.spec.js tests/e2e/routing-metadata.spec.js --project=desktop-chrome
```

Trước khi phát hành, chạy `npm run build:release` và `npm run validate:dist`.
