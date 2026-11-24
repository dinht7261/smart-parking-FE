# Smart Parking – Bước 2: Cấu trúc trang và Angular Router

Dự án frontend Angular cho ứng dụng bãi đỗ xe thông minh, dựa trên giao diện tham khảo đã thống nhất.

## Công nghệ

- Angular 22 (standalone components)
- TypeScript, SCSS
- Angular Router
- npm

## Yêu cầu môi trường

- Node.js phiên bản tương thích Angular 22 (ví dụ Node.js 24.15.0 trở lên thuộc nhánh 24)
- npm
- VS Code (khuyến nghị)

## Chạy dự án

Mở terminal tại thư mục `smart-parking`:

```bash
npm install
npm start
```

Mở trình duyệt tại <http://localhost:4200>.

## Kiểm tra production build

```bash
npm run build
```

## Trạng thái hiện tại

- Đã tạo Angular workspace, hỗ trợ routing và SCSS.
- Đã cài dependencies và kiểm tra build thành công.
- Đã tạo màn hình chọn vai trò `/`.
- Đã tạo giao diện mẫu người dùng `/customer` và người điều hành `/operator`.
- Đã cấu hình điều hướng Angular Router; màn hình riêng cho từng vai trò theo hướng mobile-first.
- Chưa kết nối backend, chưa xây dựng quy trình đặt chỗ, yêu cầu, thanh toán hay điều khiển thiết bị thật.

## Kiểm tra bước 2

1. Mở `/` và chọn **Người dùng**, xác nhận chuyển sang `/customer`.
2. Chọn **Đổi vai trò**, rồi chọn **Người điều hành**, xác nhận chuyển sang `/operator`.
3. Giao diện khách hàng không có module barrier; giao diện điều hành có module này.
4. Số liệu `48/120` chỉ là dữ liệu demo.

**Lưu ý bảo mật:** Hiện tại đây mới là tách giao diện. Người dùng vẫn có thể gõ trực tiếp URL `/operator`. Cần đăng nhập, role guard và phân quyền ở backend để đảm bảo truy cập thật.

## Định hướng chức năng

- `customer`: xem số chỗ trống, đặt chỗ, gửi yêu cầu qua đêm, thanh toán, lịch sử.
- `operator`: theo dõi bãi, quản lý yêu cầu, điều khiển barrier, xử lý vi phạm, báo cáo.
- Quyền điều khiển barrier chỉ dành cho người điều hành; cả hai vai trò dùng giao diện mobile-first.
