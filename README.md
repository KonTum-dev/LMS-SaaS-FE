# DX LMS Frontend

Giao diện quản trị và học tập cho LMS SaaS đa tenant, xây bằng Next.js 16 App Router và Ant Design 6.

## Chức năng

- Workspace riêng theo tổ chức, áp dụng màu thương hiệu và module đã bật.
- Giao diện theo bốn vai trò: quản trị nền tảng, quản trị tổ chức, giảng viên, học viên.
- Quản lý tổ chức, người dùng, khóa học, ghi danh và bài tập.
- Responsive cho desktop/mobile; có loading, empty và error state.
- Phiên JWT được xác thực lại qua `/auth/me` khi tải trang.

## Chạy local

Yêu cầu Node.js 20+ và backend đang chạy tại cổng `4000`.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000). Biến môi trường:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

# Firebase Web SDK (optional until Firebase Auth/Storage is enabled)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Firebase được khởi tạo tại `lib/firebase.ts` khi đủ các biến `NEXT_PUBLIC_FIREBASE_*`. Cấu hình Firebase Web có thể xuất hiện trong bundle trình duyệt; quyền truy cập dữ liệu vẫn phải được bảo vệ bằng Firebase Rules và backend. Luồng đăng nhập hiện tại của LMS vẫn dùng JWT backend.

## Kiểm tra production

```bash
npm run lint
npm test
npm run build
npm run start
```

Tài khoản demo được tạo bởi lệnh seed của backend; xem README của `lms-edu-be`.

## Cấu trúc chính

- `app/(auth)` — đăng nhập.
- `app/(workspace)` — dashboard và các màn hình nghiệp vụ.
- `components/providers` — session, Ant Design theme theo tenant.
- `components/layout` — shell và menu theo quyền/module.
- `lib/api.ts` — API client và chuẩn hóa lỗi.
