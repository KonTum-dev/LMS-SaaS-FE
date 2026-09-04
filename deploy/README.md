# Triển khai production frontend

Tài liệu này chỉ áp dụng cho repository frontend `LMS-SaaS-FE`.

Frontend và backend là hai GitHub repository độc lập. Vì vậy, các Secrets và
Variables bên dưới phải được tạo trong **Settings của repo frontend này**. Việc
tạo cùng tên ở repo backend không làm chúng xuất hiện trong repo frontend.

Workflow được sử dụng: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

## 1. Workflow làm gì

- Pull request: cài dependency, lint, test và build; không deploy.
- Push vào `main`: kiểm tra cấu hình, build Next.js standalone, upload release,
  kích hoạt release và kiểm tra health.
- Chạy thủ công: chỉ deploy khi workflow chạy trên nhánh `main`.
- VPS chỉ chạy artifact đã build bằng `node server.js`; VPS không chạy
  `npm install` hoặc `npm run build`.

Release được lưu tại `/srv/lms/frontend/releases/<revision>` và symlink đang
chạy là `/srv/lms/frontend/current`.

## 2. GitHub Repository Secrets của frontend

Vào repo `LMS-SaaS-FE`:

`Settings` → `Secrets and variables` → `Actions` → `Secrets` →
`New repository secret`

Tạo riêng trong repo frontend đủ năm secret:

| Secret | Giá trị | Ghi chú |
| --- | --- | --- |
| `DEPLOY_HOST` | `103.72.97.24` | Chỉ IP/hostname; không thêm `ssh://`, user hoặc port |
| `DEPLOY_PORT` | `24700` | Chỉ nhập số |
| `DEPLOY_USER` | `deploy` | Không dùng `root` |
| `DEPLOY_SSH_KEY` | Toàn bộ private key `lms_github_actions` | Nhiều dòng, không phải `.pub`, không Base64 |
| `DEPLOY_KNOWN_HOSTS` | Toàn bộ dòng `[103.72.97.24]:24700 ssh-ed25519 ...` | Host key của VPS, không phải fingerprint |

Workflow hiện tại đọc `${{ secrets.* }}` ở cấp repository. Có thể dùng
Organization secrets sau này, nhưng phải cấp quyền cho repo frontend.

### 2.1. Ba loại khóa không được nhầm lẫn

| Khóa | Nơi lưu |
| --- | --- |
| Private key `lms_github_actions` | GitHub secret `DEPLOY_SSH_KEY` của repo frontend |
| Public key `lms_github_actions.pub` | `/home/deploy/.ssh/authorized_keys` trên VPS |
| VPS public host key `/etc/ssh/ssh_host_ed25519_key.pub` | GitHub secret `DEPLOY_KNOWN_HOSTS` |

Private key chứng minh GitHub Actions có quyền vào VPS. `KNOWN_HOSTS` giúp
GitHub Actions kiểm tra VPS không phải máy giả mạo.

### 2.2. Tạo deploy key một lần

Chạy trên máy quản trị đáng tin cậy:

```bash
ssh-keygen -t ed25519 -a 100 \
  -C "github-actions-lms" \
  -f "$HOME/.ssh/lms_github_actions"
```

Để trống passphrase bằng cách nhấn `Enter` hai lần. Workflow chạy không tương
tác nên không mở được key có passphrase.

Copy public key:

```bash
pbcopy < "$HOME/.ssh/lms_github_actions.pub"
```

Trên web console VPS, đăng nhập `root` rồi chạy:

```bash
id -u deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
nano /home/deploy/.ssh/authorized_keys
```

Dán public key thành một dòng riêng, lưu file, rồi chạy:

```bash
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
```

Nếu backend đã dùng đúng cặp key này và public key đã nằm trong
`authorized_keys`, không cần thêm lại dòng giống hệt.

### 2.3. Lấy `DEPLOY_SSH_KEY`

```bash
pbcopy < "$HOME/.ssh/lms_github_actions"
```

Paste trực tiếp vào secret. Nội dung phải còn nguyên dạng:

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

Không commit private key, không đặt private key trên VPS và không gửi nó trong
chat/log. Repo backend có thể dùng cùng key nhưng vẫn phải tạo secret riêng
trong Settings của repo backend.

### 2.4. Lấy `DEPLOY_KNOWN_HOSTS`

Trên web console VPS, kiểm tra fingerprint:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256
```

Fingerprint đã xác minh tại thời điểm viết tài liệu:

```text
SHA256:L9VM/vEeX7wRagVJ4FpCSGpGZXs3SrBsEMfY3y2TFGA
```

Tạo dòng `known_hosts` từ chính VPS:

```bash
awk '{print "[103.72.97.24]:24700 " $1 " " $2}' \
  /etc/ssh/ssh_host_ed25519_key.pub
```

Copy toàn bộ dòng kết quả có dạng:

```text
[103.72.97.24]:24700 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA...
```

Paste dòng đó vào `DEPLOY_KNOWN_HOSTS`; không paste riêng `SHA256:...`. Nếu cài
lại VPS, xác minh host key mới và cập nhật secret ở cả hai repo.

## 3. GitHub Repository Variables chỉ dành cho frontend

Vào repo `LMS-SaaS-FE`:

`Settings` → `Secrets and variables` → `Actions` → `Variables` →
`New repository variable`

Không tạo các biến này trong repo backend.

| Variable | Bắt buộc | Giá trị/nguồn |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Có khi deploy production | URL public HTTPS của backend, kết thúc đúng bằng `/api/v1` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Cần khi bật Firebase | Trường `apiKey` trong Firebase Web config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Cần khi bật Firebase | Trường `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Cần khi bật Firebase | Trường `projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Cần nếu dùng Storage | Trường `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Cần khi bật Firebase | Trường `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Cần khi bật Firebase | Trường `appId` |

### 3.1. `NEXT_PUBLIC_API_URL`

Giá trị này không lấy từ Firebase. Nó được tạo từ domain public mà Nginx dùng
để reverse proxy tới backend đang nghe nội bộ tại `127.0.0.1:4000`.

Ví dụ, nếu DNS `api.example.com` trỏ tới VPS và HTTPS đã hoạt động:

```env
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
```

Thay `example.com` bằng domain thật. Workflow từ chối URL HTTP, credential,
query, fragment hoặc dấu `/` cuối. Không đặt
`http://103.72.97.24:4000/api/v1` cho production.

### 3.2. Firebase Web config

Trong Firebase Console, chọn project `demoauth-c3177`, sau đó vào:

`Project settings` → `General` → `Your apps` → Web App `</>` →
`SDK setup and configuration` → `Config`

Nếu chưa có Web App, chọn `Add app` → `Web` → `Register app`.

Cấu hình Web App hiện tại ánh xạ thành:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDr_mci0WcmKgkiDettJ8sJC_bn1CWuKo8
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demoauth-c3177.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demoauth-c3177
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demoauth-c3177.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1058209549286
NEXT_PUBLIC_FIREBASE_APP_ID=1:1058209549286:web:7269656484d9c1ee526427
```

Không thêm dấu nháy hoặc ký tự `\` trước dấu gạch dưới. Đây là Web config được
nhúng vào browser bundle, không phải Firebase Admin service-account key. Không
đặt `serviceAccountKey.json` trong biến `NEXT_PUBLIC_*`.

Firebase là tùy chọn ở thời điểm build. Nếu ứng dụng gọi `getFirebaseApp()`,
cần tối thiểu `API_KEY`, `APP_ID`, `AUTH_DOMAIN`, `MESSAGING_SENDER_ID` và
`PROJECT_ID`; thêm `STORAGE_BUCKET` khi dùng Storage.

Mọi `NEXT_PUBLIC_*` được nhúng vào artifact khi build. Sau khi đổi một biến,
phải chạy deployment mới.

## 4. Cài đặt VPS một lần cho frontend

Chạy trên VPS với quyền `root`, sau khi đã copy hai file cấu hình trong
`deploy/` lên một thư mục làm việc:

```bash
id -u lms >/dev/null 2>&1 || adduser --system --group --home /var/lib/lms lms
usermod -aG lms deploy
install -d -o deploy -g lms -m 2770 /srv/lms/frontend/releases
install -o root -g root -m 0644 deploy/lms-frontend.service /etc/systemd/system/lms-frontend.service
install -o root -g root -m 0440 deploy/lms-frontend.sudoers /etc/sudoers.d/lms-frontend-deploy
visudo -cf /etc/sudoers.d/lms-frontend-deploy
systemctl daemon-reload
systemctl enable lms-frontend.service
```

Các đường dẫn `deploy/...` là đường dẫn tới file đã copy lên VPS; điều chỉnh nếu
bạn đặt chúng ở thư mục khác. Sau `usermod`, đăng nhập lại user `deploy` để
group `lms` có hiệu lực.

Không start service trước lần deploy đầu tiên vì chưa có
`/srv/lms/frontend/current`. Frontend chỉ nghe `127.0.0.1:3000`; không mở port
`3000` ra Internet, hãy reverse proxy qua Nginx.

## 5. Checklist riêng của repo frontend

- [ ] Repo `LMS-SaaS-FE` có đủ năm `DEPLOY_*` Repository Secrets.
- [ ] `DEPLOY_HOST` chỉ là `103.72.97.24`; port nằm riêng ở `DEPLOY_PORT`.
- [ ] `DEPLOY_SSH_KEY` là private key nguyên bản nhiều dòng.
- [ ] Public key tương ứng nằm trong `/home/deploy/.ssh/authorized_keys`.
- [ ] `DEPLOY_KNOWN_HOSTS` chứa `[103.72.97.24]:24700`, loại key và Base64 key.
- [ ] `NEXT_PUBLIC_API_URL` là URL HTTPS thật, kết thúc đúng bằng `/api/v1`.
- [ ] Firebase Variables đã được tạo nếu frontend sử dụng Firebase.
- [ ] Systemd unit và sudoers frontend đã được cài và kiểm tra bằng `visudo`.
- [ ] Port `3000` chỉ nghe nội bộ và domain được proxy qua Nginx.

## 6. Lỗi thường gặp

- `Repository secret ... is required`: secret đang thiếu trong chính repo frontend.
- `NEXT_PUBLIC_API_URL must ...`: URL chưa là HTTPS hoặc không kết thúc đúng `/api/v1`.
- `Load key ... invalid format`: đã paste `.pub`, Base64, literal `\n` hoặc thiếu đầu/cuối private key.
- `Permission denied (publickey)`: private key không khớp `authorized_keys` hoặc permission SSH sai.
- `DEPLOY_KNOWN_HOSTS does not contain ...`: đã paste fingerprint thay vì dòng `known_hosts` đầy đủ.
- `Host key verification failed`: VPS đổi host key; xác minh qua console rồi cập nhật secret.
- Restart yêu cầu mật khẩu sudo: chưa cài hoặc chưa kiểm tra `lms-frontend.sudoers`.
