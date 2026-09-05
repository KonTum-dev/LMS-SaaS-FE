# Tài liệu frontend DX LMS

[Về README dự án](../README.md) · [Triển khai](../deploy/README.md)

## Phát triển

- [Cài đặt và chạy local](../README.md#chạy-local).
- [Bản đồ source và quy ước thay đổi](reference/source-map.md).
- [Chạy test, lint và build](../README.md#kiểm-tra-production).
- [Quy tắc dành cho coding agent](../AGENTS.md).

## Giao diện và nội dung

- [i18n tiếng Việt/tiếng Anh](../lib/i18n/README.md): catalog, định dạng, lỗi và
  các nội dung không được dịch.
- [Graphic, logo và nguồn asset marketing](../public/marketing/ASSETS.md).
- [Release UI ngày 2026-09-05](../deploy/UI-RELEASE-2026-09-05.md): phạm vi xác
  minh và đường dẫn báo cáo, không thay thế kiểm tra production hiện tại.

## Vận hành

- [Release đang chạy và chính sách dùng thử](../deploy/CURRENT-RELEASE.md).
- [Điểm vào triển khai và rollback](../deploy/README.md).
- [Nginx domain chung, routing API và xử lý 404](../deploy/same-domain-pm2.md).
- [Systemd/hai domain cũ — chỉ tham khảo](../deploy/legacy/systemd-two-domain.md).

## Ranh giới tài liệu

Frontend trình bày trạng thái và gửi yêu cầu; backend quyết định phân quyền,
scope workspace, giá, thanh toán và hiệu lực tích hợp. Contract nghiệp vụ,
Google/Drive/YouTube, SePay và cấu hình secret được quản lý trong `docs/` của
repo `LMS-SaaS-BE`, không sao chép thành hướng dẫn cạnh tranh trong frontend.

Tài liệu sát implementation như i18n và asset vẫn nằm cạnh code/asset để dễ cập
nhật; mục lục này là điểm tìm chung. Runbook vẫn ở `deploy/` cạnh file cấu hình.
Nội dung đã thay thế phải ghi rõ trạng thái và liên kết về hướng dẫn hiện hành.
Không lưu credential, payload cá nhân, log chứa token hoặc bản dump env tại đây.
