# FE và BE trên cùng VPS: lms.dolphinxstudio.com

## Luồng đúng và nguyên nhân 404

Trình duyệt gửi `https://lms.dolphinxstudio.com/api/v1/auth/register`.
Nginx nhận HTTPS rồi chuyển nguyên đường dẫn này tới
`http://127.0.0.1:4000/api/v1/auth/register` trên VPS. Các đường dẫn giao diện
được chuyển tới FE `http://127.0.0.1:3000`.

Request URL trong DevTools vẫn là domain public, không hiện upstream nội bộ.
`localhost` trong trình duyệt là máy của khách truy cập, không phải VPS.
Không mở cổng 4000 ra Internet và không thêm Next.js rewrite làm proxy thứ hai.

Ngày 2026-09-04, GET public `/api/v1/health` trả 404 HTML với
`X-Powered-By: Next.js`: request API đang bị chuyển tới FE. BE có route
`POST /api/v1/auth/register`; lỗi này không chứng minh route BE bị thiếu.

## Env: giữ URL tuyệt đối trong frontend

Giá trị FE khi build:

```dotenv
NEXT_PUBLIC_API_URL=https://lms.dolphinxstudio.com/api/v1
```

Không đổi thành `/api/v1`: bộ kiểm tra URL avatar/logo và media ticket dùng
`new URL(apiRequestUrl(""))` để kiểm tra origin. Không đặt secret của BE trong FE.
`NEXT_PUBLIC_*` được đóng vào bundle khi build; sửa env cần build lại và copy
`public`/`.next/static` vào gói standalone. Nếu FE đã gọi đúng URL public trên,
chỉ sửa Nginx là đủ, không cần rebuild hoặc restart FE vì thay đổi proxy.

BE vẫn nghe `127.0.0.1:4000`. Giữ `FRONTEND_URL=https://lms.dolphinxstudio.com`
và cấu hình tin cậy đúng proxy nội bộ (ví dụ `TRUST_PROXY_CIDRS=127.0.0.1`,
không cấu hình đồng thời `TRUST_PROXY_HOPS`).

## Áp dụng vào site HTTPS đang chạy

Chạy trên VPS, trong thư mục checkout FE chứa các file mới ở `deploy/nginx/`.
Phải đưa các file sửa đổi lên VPS trước; sửa repo local không tự cập nhật Nginx.
Các lệnh dưới dùng đúng tên site từ lần cấu hình domain này. Nếu `readlink`
không trỏ đúng file, dừng và xác định server block đang phục vụ domain trước.

```bash
sudo readlink -f /etc/nginx/sites-enabled/lms.dolphinxstudio.com
curl --fail --show-error --max-time 15 http://127.0.0.1:4000/api/v1/health
```

Health nội bộ phải trả JSON có `service: "lms-edu-api"`, `status: "ok"`
và `timestamp` của lần gọi.
Nếu BE chưa chạy, xử lý BE trước; sửa proxy không khắc phục lỗi scanner/SMTP.

Backup site và snippet cũ nếu có, giữ biến `lms_proxy_backup` trong shell này:

```bash
lms_proxy_backup="$(sudo mktemp -d /etc/nginx/lms-api-backup.XXXXXX)"
sudo cp -a /etc/nginx/sites-available/lms.dolphinxstudio.com "$lms_proxy_backup/site.conf"
if sudo test -e /etc/nginx/conf.d/lms-api-limits.conf; then
  sudo cp -a /etc/nginx/conf.d/lms-api-limits.conf "$lms_proxy_backup/limits.conf"
fi
if sudo test -e /etc/nginx/snippets/lms-api-locations.conf; then
  sudo cp -a /etc/nginx/snippets/lms-api-locations.conf "$lms_proxy_backup/locations.conf"
fi
```

Chỉ tiếp tục khi backup thành công. Cài hai snippet:

```bash
sudo install -d -m 0755 /etc/nginx/conf.d /etc/nginx/snippets
sudo install -m 0644 deploy/nginx/lms-api-limits.conf /etc/nginx/conf.d/lms-api-limits.conf
sudo install -m 0644 deploy/nginx/lms-api-locations.conf /etc/nginx/snippets/lms-api-locations.conf
sudo nano /etc/nginx/sites-available/lms.dolphinxstudio.com
```

Trong **server block HTTPS `listen 443 ssl` của `lms.dolphinxstudio.com`**, thêm
dòng sau ngang cấp `location /`, không đặt bên trong location:

```nginx
include /etc/nginx/snippets/lms-api-locations.conf;
```

Giữ nguyên certificate, private-key path, HTTPS redirect và `location /` trỏ
tới `127.0.0.1:3000`. Nếu đã có một location API trùng, thay location đó bằng
snippet; không khai báo trùng và không giữ `location ^~ /api/v1/` khác.
Đừng thay toàn bộ site HTTPS bằng mẫu HTTP `lms-frontend.nginx.conf`.

Ubuntu mặc định include `/etc/nginx/conf.d/*.conf` trong context `http`.
Nếu đã tùy chỉnh nginx.conf, bảo đảm file limits được include **đúng một lần**
trong `http`, không trong `server` hay `location`.

Snippet giữ nguyên prefix khi proxy: `proxy_pass http://127.0.0.1:4000;`
**không có dấu `/` cuối**. Thêm `/` sẽ làm mất `/api/v1/` và Nest trả 404.
Không dùng `^~` cho prefix chung vì sẽ bỏ qua regex giới hạn upload logo.

Kiểm tra rồi mới reload (không cần restart PM2 cho riêng sửa Nginx):

```bash
sudo nginx -t && sudo systemctl reload nginx
curl --fail --show-error --max-time 15 https://lms.dolphinxstudio.com/api/v1/health
```

Health public phải trả cùng loại JSON backend (timestamp có thể khác), không
còn trang HTML 404 của Next.js.
`/api/v1/ready` chỉ dành cho kiểm tra nội bộ, không yêu cầu public trả 200.
Không thử GET `/auth/register` để kiểm tra route POST và không tạo tài khoản
thật chỉ để smoke test. Nếu sau đó đăng ký trả `503 PUBLIC_SIGNUP_DISABLED`,
đó là cấu hình đăng ký riêng ở BE; không tự bật cờ trước khi kiểm tra index/plan.

Kiểm tra thêm một avatar/logo hiện hữu và các luồng upload đã được phép sử dụng.
Các snippet giữ giới hạn upload/rate/connection, không ghi query của OAuth hoặc
vé tải file vào log, và giữ IP/protocol chuyển tiếp. Không đổi các cờ media.

## Rollback

Nếu `nginx -t` lỗi, không reload. Khôi phục site và snippet đã tồn tại từ backup:

```bash
sudo cp -a "$lms_proxy_backup/site.conf" /etc/nginx/sites-available/lms.dolphinxstudio.com
if sudo test -e "$lms_proxy_backup/limits.conf"; then
  sudo cp -a "$lms_proxy_backup/limits.conf" /etc/nginx/conf.d/lms-api-limits.conf
fi
if sudo test -e "$lms_proxy_backup/locations.conf"; then
  sudo cp -a "$lms_proxy_backup/locations.conf" /etc/nginx/snippets/lms-api-locations.conf
fi
sudo nginx -t && sudo systemctl reload nginx
```

Nếu hai snippet là file mới, có thể giữ lại: site cũ không include locations;
các zone limits không được dùng không thay đổi cách route. Giữ backup để đối chiếu.

## Kiểm định trong repo

```bash
npm test -- deploy/same-domain-nginx.test.ts lib/api.test.ts lib/public-registration.test.ts lib/profile-api.test.ts lib/media-api.test.ts
```

Kiểm định local ngày 2026-09-04: 5 suite / 56 test pass, ESLint và diff check pass.
Nginx 1.24.0 biên dịch trong thư mục tạm cũng pass `nginx -t`; mock HTTP xác nhận
POST giữ method/path/query/body tới BE, giao diện tới FE, IPN quá 256 KiB bị 413,
regex upload logo trả 429 sau burst và readiness loopback hoạt động. Chỉ thay
đường dẫn include/log và cổng loopback cao trong fixture, không chạy trên VPS.
Chưa kiểm định TLS, BE thật hay truy cập readiness từ IP ngoài loopback.

Các kiểm tra local không thay thế `nginx -t` và smoke test trên VPS. Nguồn tham khảo:
[Nginx proxy_pass](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass),
[Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables).
