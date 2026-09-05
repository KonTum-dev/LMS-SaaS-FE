# Lưu trữ: deploy frontend bằng systemd, hai domain

> Bản lưu trữ; bắt đầu từ [hướng dẫn triển khai hiện hành](../README.md).
> Các lệnh cũ được giữ để tham khảo, không chạy nguyên trên VPS PM2 production.
> File cấu hình tương đối bên dưới vẫn thuộc `deploy/`, không phải `legacy/`.

> Production hiện dùng domain chung `lms.dolphinxstudio.com` và PM2:
> theo [hướng dẫn domain chung](../same-domain-pm2.md). Các host, user và đường dẫn
> systemd phía dưới là quy trình hai domain cũ, không áp dụng nguyên cho VPS
> PM2 hiện tại. `lms-frontend.nginx.conf` nay là mẫu HTTP cho domain chung;
> cần cài hai API snippet theo hướng dẫn mới, không ghi đè TLS đang hoạt động.

Repo này không còn GitHub Actions CI/CD. Quy trình dưới đây build gói Linux
x86_64 trên máy cá nhân, upload qua SSH và kích hoạt release bằng tay.

## Thông tin production

- Domain: https://lms.dolphinx.com
- Backend API: https://lms-be.dolphinx.com/api/v1
- VPS: 103.72.97.24
- SSH port: 24700
- SSH user: deploy
- Service: lms-frontend.service
- App nội bộ: http://127.0.0.1:3000

Không mở cổng 3000 ra Internet. Nginx nhận HTTPS rồi proxy về loopback.

## 1. Cấu hình build trên máy cá nhân

Tạo file .env.production.local ở root repo. Frontend chỉ cần địa chỉ HTTPS của
backend; không đặt private key hay backend secret trong file này.

```env
NEXT_PUBLIC_API_URL=https://lms-be.dolphinx.com/api/v1
```

Các biến NEXT_PUBLIC_* được nhúng vào bundle lúc build. Khi thay đổi giá trị,
phải build và deploy lại frontend.

## 2. Build gói Linux trên Mac

VPS hiện là Ubuntu 24.04 x86_64. Không đóng gói node_modules của macOS để chạy
trên Linux. Cách an toàn là dùng Docker Desktop:

```bash
cd "/Users/nhatanh/LMS/LMS-SaaS-FE"

release_id="$(git rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"

docker run --rm --platform linux/amd64 \
  -e RELEASE_ID="$release_id" \
  -v "$PWD:/app" \
  -v lms_fe_node_modules:/app/node_modules \
  -w /app \
  node:24-bookworm \
  bash -lc '
    set -Eeuo pipefail
    npm ci
    npm run lint
    npm test
    npm run build
    test -s .next/standalone/server.js
    mkdir -p .next/standalone/public .next/standalone/.next/static
    cp -a public/. .next/standalone/public/
    cp -a .next/static/. .next/standalone/.next/static/
    printf "%s\n" "$RELEASE_ID" > .next/standalone/REVISION
    tar -C .next/standalone \
      -czf "/app/lms-frontend-$RELEASE_ID.tar.gz" .
  '

archive="/tmp/lms-frontend-$release_id.tar.gz"
mv "lms-frontend-$release_id.tar.gz" "$archive"
test -s "$archive"
printf "Release: %s\nArchive: %s\n" "$release_id" "$archive"
```

## 3. Upload

Giữ nguyên release_id từ bước build:

```bash
scp \
  -i /Users/nhatanh/.ssh/lms_github_actions \
  -P 24700 \
  "$archive" \
  "deploy@103.72.97.24:/tmp/lms-frontend-$release_id.tar.gz"
```

Tên private key không còn liên quan tới GitHub Actions; có thể đổi tên sau nếu
muốn. Không commit hoặc gửi private key lên server.

## 4. Kích hoạt release trên VPS

SSH vào VPS bằng user deploy:

```bash
ssh \
  -i /Users/nhatanh/.ssh/lms_github_actions \
  -p 24700 \
  deploy@103.72.97.24
```

Sau đó đặt đúng release_id vừa build và chạy:

```bash
set -Eeuo pipefail
umask 0027

release_id="DAN_RELEASE_ID_VAO_DAY"
app_root="/srv/lms/frontend"
release_dir="$app_root/releases/$release_id"
archive="/tmp/lms-frontend-$release_id.tar.gz"
candidate="$app_root/.current-$release_id"

test -s "$archive"
test ! -e "$release_dir"
mkdir "$release_dir"
tar -xzf "$archive" -C "$release_dir" --no-same-owner --no-same-permissions
test -s "$release_dir/server.js"
chmod -R g+rX,o-rwx "$release_dir"
mkdir -p "$release_dir/.next/cache"
chmod 2770 "$release_dir/.next/cache"

ln -s "$release_dir" "$candidate"
mv -Tf "$candidate" "$app_root/current"
sudo -n /usr/bin/systemctl restart lms-frontend.service

curl --fail --silent --show-error \
  --max-time 5 \
  http://127.0.0.1:3000/ >/dev/null

rm -f "$archive"
echo "Frontend release $release_id đang chạy."
```

Nếu curl lỗi, xem log trước khi thay đổi thêm:

```bash
systemctl status lms-frontend.service --no-pager -l
journalctl -u lms-frontend.service -n 100 --no-pager
```

## 5. Cấu hình VPS một lần

Các file vẫn được giữ trong thư mục này vì deploy tay vẫn cần:

- lms-frontend.service: chạy Next.js bằng systemd.
- lms-frontend.nginx.conf: reverse proxy domain frontend.
- lms-frontend.sudoers: chỉ cho user deploy restart đúng service frontend.

Với quyền root trên VPS:

```bash
id -u lms >/dev/null 2>&1 || adduser --system --group --home /var/lib/lms lms
usermod -aG lms deploy
install -d -o deploy -g lms -m 2750 /srv/lms/frontend
install -d -o deploy -g lms -m 2750 /srv/lms/frontend/releases

install -o root -g root -m 0644 \
  lms-frontend.service \
  /etc/systemd/system/lms-frontend.service
install -o root -g root -m 0440 \
  lms-frontend.sudoers \
  /etc/sudoers.d/lms-frontend-deploy
install -o root -g root -m 0644 \
  lms-frontend.nginx.conf \
  /etc/nginx/sites-available/lms-frontend

ln -sfn \
  /etc/nginx/sites-available/lms-frontend \
  /etc/nginx/sites-enabled/lms-frontend

visudo -cf /etc/sudoers.d/lms-frontend-deploy
systemctl daemon-reload
systemctl enable lms-frontend.service
nginx -t
systemctl reload nginx
```

Chỉ start service sau khi /srv/lms/frontend/current đã trỏ tới một release hợp
lệ.

## 6. HTTPS

DNS phải trả đúng record:

```text
lms.dolphinx.com  A  103.72.97.24
```

Sau khi DNS hoạt động và firewall mở 80/443:

```bash
apt-get update
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d lms.dolphinx.com --redirect
nginx -t
systemctl reload nginx
```

## 7. Rollback tay

Liệt kê release và chọn đúng thư mục đã chạy ổn:

```bash
ls -1dt /srv/lms/frontend/releases/*
```

Kích hoạt lại release đó:

```bash
old_release="/srv/lms/frontend/releases/DAN_RELEASE_CU_VAO_DAY"
test -s "$old_release/server.js"
ln -s "$old_release" /srv/lms/frontend/.rollback-manual
mv -Tf /srv/lms/frontend/.rollback-manual /srv/lms/frontend/current
sudo -n /usr/bin/systemctl restart lms-frontend.service
curl --fail http://127.0.0.1:3000/ >/dev/null
```
