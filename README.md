# Romantic Birthday Web App ❤️

Ứng dụng thiệp sinh nhật tương tác lãng mạn với hiệu ứng 3D, AI nhận diện cử chỉ và nhạc nền.

## 📁 Cấu trúc thư mục chuẩn

Để ứng dụng hoạt động tốt nhất, hãy sắp xếp các file như sau:

```text
romantic-birthday-app/
├── index.html
├── audio.mp3          <-- Nhạc nền của bạn (đổi tên thành audio.mp3)
└── images/            <-- Thư mục chứa ảnh kỷ niệm
    ├── 1.png
    ├── 2.png
    ...
    └── 20.png
```

## 🚀 Cách chạy trên máy tính (Local)

1. Bỏ ảnh của bạn vào thư mục `images/` và đặt tên từ `1.png` đến `20.png`.
2. Bỏ file nhạc vào thư mục gốc và đổi tên thành `audio.mp3`.
3. **Mở bằng Local Server**: Đừng mở file trực tiếp. Hãy dùng extension **Live Server** trong VS Code hoặc chạy lệnh `npx serve .` trong terminal. Điều này bắt buộc để trình duyệt cho phép truy cập Camera.

## 🔗 Cách cá nhân hóa qua URL

Bạn có thể thay đổi tên và tuổi bằng cách thêm tham số vào link:
`index.html?to=Tên_Người_Nhận&age=23&from=Tên_Người_Gửi`

## 🖐️ Hướng dẫn tương tác

- **Màn 1**: Bấm "Mở quà" để bắt đầu nhạc.
- **Màn 2**: Bấm vào phong bì để mở thư.
- **Màn 3**: Vẫy tay nhanh trước webcam để thổi nến.
- **Màn 4**:
  - 🖐️ Di chuyển tay trái/phải để xoay gallery ảnh.
  - 🤏 Chụm ngón cái và ngón trỏ để phóng to ảnh.

## 🌐 Deploy lên GitHub Pages

1. Up toàn bộ thư mục lên một Repo mới.
2. Vào Settings -> Pages -> Chọn branch `main` -> Save.
3. Chờ 1 phút để nhận link công khai.
