# Bản đồ source frontend

[Mục lục tài liệu](../README.md)

Các đường dẫn trong bảng tính từ root repo. Không đổi tên hoặc di chuyển route,
component và asset chỉ để khớp cách tổ chức tài liệu.

| Khu vực | Trách nhiệm |
| --- | --- |
| `app/` và `components/marketing/` | Trang public, nội dung marketing và bài viết |
| `app/(auth)/`, `app/invite/` | Đăng nhập/đăng ký và lời mời |
| `app/(workspace)/` | LMS, CRM, quản trị, billing và tài khoản |
| `components/providers/` | Session, query và theme của ứng dụng |
| `components/layout/` | Navigation, shell và scope workspace |
| `components/form/`, `components/table/`, `components/feedback/` | Form, danh sách, loading và phản hồi dùng chung |
| `components/i18n/`, `lib/i18n/` | Chọn ngôn ngữ, catalog và định dạng |
| `lib/api.ts`, `lib/*-api.ts` | Client API và contract ở biên frontend |
| `test-utils/`, các file `*.test.*` | Fixture/hỗ trợ test và kiểm tra hồi quy |
| `public/marketing/` | Asset được phục vụ cho giao diện |
| `deploy/` | Runbook và cấu hình triển khai |

## Khi thay đổi giao diện

1. Giữ kiểm tra quyền và phạm vi workspace hiện hữu; ẩn nút không thay thế kiểm
   tra quyền backend.
2. Dùng component form/table/feedback có sẵn. Thao tác bất đồng bộ cần trạng
   thái chờ và ngăn gửi trùng; thông báo lỗi phải qua mapper an toàn.
3. Cập nhật cả hai ngôn ngữ theo [quy ước i18n](../../lib/i18n/README.md).
   Không dịch dữ liệu do người dùng nhập, enum API hay bằng chứng audit.
4. Nếu đổi graphic, cập nhật [danh mục asset](../../public/marketing/ASSETS.md)
   và xác minh chỗ dùng trước khi bỏ file cũ.
5. Chạy test liên quan, test toàn bộ, lint, TypeScript và build theo mức rủi ro;
   kiểm tra thêm UI desktop/mobile và trạng thái tải/rỗng/lỗi. Không gọi mutation
   thật trên production chỉ để tạo dữ liệu cho ảnh chụp test.

## Khi thay đổi cấu hình

`NEXT_PUBLIC_API_URL` là URL public tuyệt đối, được đóng vào bundle lúc build.
Secret OAuth, key SePay, JWT và credential hạ tầng thuộc backend, không được
đưa vào biến `NEXT_PUBLIC_*` hoặc asset. Đọc [hướng dẫn triển khai](../../deploy/README.md)
trước khi chỉnh PM2, Nginx hoặc gói standalone.

## Cài mới và lockfile

Dùng Node.js **24.x từ 24.15.0** cho development/test và `npm ci` theo
`package-lock.json` hiện khớp manifest. `package.json` chưa khai báo
`packageManager`; đây là quy ước cài mới hiện hành, không phải thay đổi runtime.

Repo vẫn có `pnpm-lock.yaml`, nhưng hai lockfile resolve một số dependency
khác phiên bản. `pnpm-workspace.yaml` còn placeholder
`unrs-resolver: set this to true or false`, chưa được chuẩn hóa thành lựa chọn
build dependency. Không coi luồng pnpm FE là tương đương đã xác minh, không tự
chạy approve-builds, đổi lockfile hoặc nâng dependency khi chỉ dọn source.

Đây là rủi ro tái lập khi cài mới, không phải bằng chứng production đang hỏng.
Việc hợp nhất package manager/config cần một thay đổi riêng có kiểm tra
install, test và build; đợt sắp xếp tài liệu không đổi các file này.
