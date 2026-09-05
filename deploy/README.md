# Triển khai và vận hành frontend

[Mục lục tài liệu](../docs/README.md)

## Production hiện hành: PM2, domain chung

- Website: `https://lms.dolphinxstudio.com`.
- API public: `https://lms.dolphinxstudio.com/api/v1`.
- FE loopback: `127.0.0.1:3000`; BE loopback: `127.0.0.1:4000`.
- VPS: `103.72.97.24`, SSH port `24700`.
- Tên process PM2: `LMS-SaaS-FE`.

## Chọn đúng hướng dẫn

1. [Release đang chạy và rollback](CURRENT-RELEASE.md): đường dẫn hiện hành,
   standalone entrypoint và chính sách trial 30 ngày cho workspace mới.
   [Biên bản release UI trước đó](UI-RELEASE-2026-09-05.md) giữ kết quả review.
2. [Nginx/domain chung](same-domain-pm2.md): routing `/api/v1`, env public,
   kiểm tra API 404 và rollback cấu hình proxy.
3. [Systemd/hai domain cũ](legacy/systemd-two-domain.md): lưu trữ tham khảo,
   không áp dụng nguyên cho VPS PM2 hiện tại.

## Trước khi phát hành

- Xác minh cwd và executable mà PM2 đang chạy; thư mục source cũ không nhất
  thiết là release đang phục vụ traffic.
- Build trên môi trường Linux tương thích server, dùng lockfile hiện hành.
  Không đưa `node_modules` của macOS sang VPS Linux.
- Đặt `NEXT_PUBLIC_API_URL=https://lms.dolphinxstudio.com/api/v1` lúc build.
  Không nhúng secret backend hoặc địa chỉ fixture local vào bundle.
- Gói standalone cần cả `public` và `.next/static`. Kiểm tra bản dựng ở cổng
  preview loopback riêng, sau đó mới chuyển đúng process frontend.
- Giữ bản rollback, kiểm tra HTTPS, asset, route public và API health sau chuyển.
  Không restart backend hoặc thay TLS khi chỉ phát hành UI.

Trên lần triển khai đã ghi trong runbook, `startOrReload` không đổi đúng
executable/cwd. Đọc lưu ý PM2 và phương án rollback trước khi đổi entrypoint;
không dùng lệnh xóa/restart toàn bộ process.

## File cấu hình

`nginx/` và `lms-frontend.nginx.conf` chứa mẫu routing domain chung. Không ghi
đè site HTTPS hiện hữu bằng mẫu HTTP; dùng hướng dẫn Nginx ở trên.
Các file `.service` và `.sudoers` là phương án systemd cũ, không phải chỉ dẫn
phải cài vào VPS đang chạy PM2. Bí mật production không thuộc thư mục này.
