# DX LMS Frontend

Giao diện quản trị và học tập cho LMS SaaS đa tenant, xây bằng Next.js 16 App Router và Ant Design 6.

## Bắt đầu ở đâu?

- [Mục lục tài liệu](docs/README.md): phát triển, giao diện và vận hành.
- [Bản đồ source và quy ước đóng góp](docs/reference/source-map.md).
- [Triển khai production hiện hành](deploy/README.md).

## Chức năng

- Workspace riêng theo tổ chức, áp dụng màu thương hiệu và module đã bật.
- Giao diện theo bốn vai trò: quản trị nền tảng, quản trị tổ chức, giảng viên, học viên.
- Quản lý tổ chức, người dùng, khóa học, ghi danh và bài tập.
- Responsive cho desktop/mobile; có loading, empty và error state.
- Phiên JWT được xác thực lại qua `/auth/me` khi tải trang.

## Chạy local

Môi trường development/test: Node.js **24.x từ 24.15.0**, npm và backend đang
chạy tại cổng `4000`. Mốc Node này đáp ứng engine của bộ test đã khóa phiên bản.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Luồng cài mới hiện dùng `package-lock.json`; chưa chuyển sang pnpm vì các
lockfile/config chưa thống nhất. Xem [lưu ý tái lập dependency](docs/reference/source-map.md#cài-mới-và-lockfile).

Mở [http://localhost:3000](http://localhost:3000). Biến môi trường:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

Ảnh đại diện, logo và tệp học tập được tải qua backend rồi lưu trong kho riêng
trên VPS. Frontend không cần Firebase hoặc khóa dịch vụ lưu trữ bên thứ ba.

## Kiểm tra production

Với domain `lms.dolphinxstudio.com`, FE gọi URL public tuyệt đối
`https://lms.dolphinxstudio.com/api/v1`; Nginx chuyển API sang BE nội bộ
`127.0.0.1:4000`, còn giao diện sang FE `127.0.0.1:3000`.
Xem [cấu hình domain chung và xử lý API 404 trên PM2](deploy/same-domain-pm2.md).
Release và lưu ý rollback hiện hành nằm trong [mục triển khai](deploy/README.md).
Không đặt `localhost:4000` vào URL API của trình duyệt production.

```bash
npm run lint
npm test
npm run build
npm run start
```

Tài khoản demo chỉ dùng cho local và được tạo bởi lệnh seed trong repo
`LMS-SaaS-BE`; đọc hướng dẫn seed an toàn của backend trước khi chạy.

## Cấu trúc chính

- `app/(auth)` — đăng nhập.
- `app/(workspace)` — dashboard và các màn hình nghiệp vụ.
- `components/providers` — session, Ant Design theme theo tenant.
- `components/layout` — shell và menu theo quyền/module.
- `lib/api.ts` — API client và chuẩn hóa lỗi.
