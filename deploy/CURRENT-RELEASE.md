# Release đang chạy — DX LMS

Cập nhật: 05/09/2026, sau khi triển khai CRM tenant và giao diện login/workspace.
Trial vẫn là 30 ngày cho workspace mới, không đổi chính sách của release trước.

## Runtime và đường quay lại

| Vai trò | Đường dẫn |
| --- | --- |
| Frontend hiện hành | `/root/lms-releases/20260905-tenant-crm/frontend` |
| PM2 config frontend | `/root/lms-releases/20260905-tenant-crm/frontend.ecosystem.config.cjs` |
| Frontend rollback gần nhất | `/root/lms-releases/20260905-guardian-portal/frontend` |
| Backend source/build hiện hành | `/root/lms-releases/20260905-tenant-crm/backend` |
| Backend cwd và `.env` giữ nguyên | `/root/LMS-SaaS-BE` |
| PM2 config backend | `/root/lms-releases/20260905-tenant-crm/backend.ecosystem.config.cjs` |
| Backup/rollback CRM | `/root/lms-ops-backups/tenant-crm-20260905` |
| Backup cổng phụ huynh | `/root/lms-ops-backups/guardian-portal-20260905` |
| Công cụ triển khai cổng phụ huynh | `/root/lms-ops-tools/guardian-portal-20260905` |
| Backup email HTML/notification | `/root/lms-ops-backups/email-design-20260905` |
| Backup nút ngôn ngữ | `/root/lms-ops-backups/locale-flags-20260905` |
| Backup thay UI login | `/root/lms-ops-backups/login-clean-20260905` |
| Backup thay policy | `/root/lms-ops-backups/trial30-20260905` |

Build frontend: `dTD3jq8oQy-9zIQKR2sZp`. PM2: `LMS-SaaS-FE` và
`LMS-SaaS-BE`; cổng loopback lần lượt 3000 và 4000. PM2 đã lưu cấu hình.
Website/API public: `https://lms.dolphinxstudio.com` và `/api/v1`.

`/root/LMS-SaaS-FE` là checkout/bản cũ hơn, không phải frontend đang phục vụ.
`/root/LMS-SaaS-BE.rollback-20260905-google-auth-v1` vẫn được giữ; PM2 daemon
còn dùng thư mục đó làm cwd, không tự ý xóa/di chuyển.

## CRM tenant — release hiện tại

- Code đã push lên `main` và VPS pull qua checkout sạch. BE code commit
  `07114623dabba6bd7483cf87775d7c2f9c925788`; FE code commit
  `e39e1fa213fe0759e4017063d54cfbd5b6fc8857`. Các commit chỉ cập nhật tài liệu
  sau đó không thay đổi bundle đã build.
- CRM thuộc tenant: liên hệ, trạng thái tư vấn, lịch chăm sóc, ghi chú, lọc và
  phân trang; giới hạn theo tenant/chi nhánh/quyền ghi. Không thêm CRM khách hàng
  toàn nền tảng. Login có nền minh họa và workspace đã chỉnh khoảng cách.
- Backend executable: `/root/lms-releases/20260905-tenant-crm/backend/dist/main.js`.
  Cwd vẫn là `/root/LMS-SaaS-BE` để giữ đường dẫn env/storage. Checkout cũ và mọi
  chỉnh sửa chưa commit trên VPS được giữ nguyên; `git pull` ở checkout cũ **không**
  cập nhật executable đang chạy. Lần release kế tiếp cần build rồi chuyển PM2.
- Giữ nguyên toàn bộ `.env`, override trial/email/Zalo CORS, Nginx/TLS, storage
  và các tích hợp đang chạy. Backend PID `103258`, frontend PID `103387`; PM2
  đã save, mỗi process chỉ listen loopback và restart count sau smoke là 0.
- CRM tạo bốn index ứng dụng, gồm hai partial unique index đã verify; collection
  không có contact trước/sau migration. Không drop index hay sửa dữ liệu khách hàng.
- Linux: 2.241 BE tests/196 suites, 163 FE tests/6 suites và cả hai build đạt.
  Local FE: 1.519 tests/132 suites đạt. Sửa test inventory để nhận catalog tạo
  tài khoản đã được UI sử dụng; không thay đổi chính sách mật khẩu.
- HTTPS smoke: `/`, `/login`, `/crm`, `/family`, `/pricing`, API health 200;
  CRM/Zalo/guardian API thiếu JWT trả 401; readiness nội bộ đạt và vẫn bị chặn
  public. 29 static assets và hash minh họa login khớp release. Browser login
  desktop/mobile 390px tải đúng, không lỗi console, không tràn ngang khi tải mới.
- Zalo profile sync **chưa bật**: production thiếu `ZALO_APP_ID` và
  `ZALO_APP_SECRET`. Mini App local chưa có CLI developer authentication;
  chưa upload/phát hành Zalo, chưa xác nhận quyền số điện thoại/native-device QA.
  Manual CRM không phụ thuộc việc bật Zalo.
- Không đăng nhập tài khoản LMS thật, tạo contact/học viên, gửi email hay giao
  dịch production để smoke test. Kiểm thử CRUD và tenant isolation dùng fixture
  cùng database local cách ly, không phải bằng chứng CRUD bằng tài khoản live.

Rollback riêng từng process bằng config tương ứng trong backup:
`backend.rollback.config.cjs` hoặc `frontend.rollback.config.cjs`. Chỉ thay
process có tên tương ứng, kiểm tra readiness rồi `pm2 save`; giữ nguyên index
CRM và dữ liệu mới. Không khôi phục env cũ hoặc drop collection. Script
`activate.cjs` dùng PID/commit preflight riêng của đợt này, không chạy lại mù quáng.
Config/backup có env riêng tư, không commit hoặc chia sẻ công khai.

FE dùng `npm ci` theo `package-lock.json`; hai file pnpm phát sinh ở local không
được đưa vào release. BE dùng `pnpm install --frozen-lockfile`. Không chuyển
`node_modules` macOS lên Linux.

## Cổng phụ huynh — release trước

- Web `/family`: chọn con, tiến độ, feedback/điểm bài tập và điểm bài kiểm tra đã công bố; VI/EN, phân trang độc lập, loading/empty/error/retry.
- Tenant tạo tài khoản Phụ huynh trong `/users`, liên kết với học viên tại `/guardians`. GUARDIAN là vai trò đã có; release này bổ sung cổng học tập và hoàn thiện luồng tạo tài khoản, không tạo vai trò mới.
- Tạo mới yêu cầu mật khẩu 12 ký tự/không quá 72 byte và không nhận SUPER_ADMIN; không đổi chính sách đăng nhập/reset/lời mời hiện có. Giao diện khóa submit/cancel/input khi đang lưu.
- API `/guardians/portal/children` và `/guardians/portal/children/:learnerId/learning` chỉ đọc, lấy tenant từ JWT, kiểm tra membership/role/consent. Không lộ email con, bài làm, đáp án hay tài liệu riêng; không chấm/finalize attempt bằng GET.
- Bật đúng `ZALO_MINI_APP_ENABLED=true` trên env/PM2; chỉ thêm origin `https://h5.zdn.vn`, không wildcard. Giữ nguyên mọi dòng env khác, cutover email, Google, SePay, trial và dữ liệu.
- Linux: 311 tests BE/20 suites và 163 tests FE/8 suites PASS, cả hai build PASS. Backend readiness nội bộ đạt; portal thiếu JWT trả 401; CORS origin lạ bị từ chối; `/family` và `/login` public 200.
- BE PID lúc triển khai 101482; FE PID 101560. PM2 đã lưu; cả hai chỉ listen loopback. Không có migration/schema/index thay đổi.
- Source Zalo tại `/Users/nhatanh/LMS/LMS-Sass-ZLM` đã build dùng duy nhất API production, có UI phụ huynh VI/EN. **Chưa tuyên bố đã deploy/phát hành Zalo**: còn xác thực CLI bằng tài khoản developer đúng App ID và kiểm thử native.
- Kiểm thử trình duyệt dùng API giả lập hoàn toàn, không tạo user/học sinh/liên kết hoặc gửi email/giao dịch production. Cần tài khoản phụ huynh test được người dùng xác nhận để kiểm thử end-to-end với dữ liệu thật.

Rollback UI gần nhất: `/root/lms-releases/20260905-email-design/ecosystem.config.cjs`, chỉ thay process FE. Backend backup gồm dist/source trước và env riêng tư. Đối chiếu drift trước khôi phục; chỉ hoàn tác cổng phụ huynh/CORS flag, không reset email hay trial. Scripts activation dùng PID/hash preflight của lần triển khai này, không chạy lại mù quáng.

## Chính sách dùng thử

- `FREE_TRIAL_DAYS=30` ở file env backend và override của PM2; source mặc định 30.
- Chỉ workspace mới nhận 30 ngày. Không migration hay gia hạn workspace đã có.
- Giữ nguyên plan `center-v2`, grace 0, giá, quota và mọi secret/tích hợp.
- Hero, bảng giá/FAQ, đăng ký, metadata và VI/EN cùng dùng thông tin 30 ngày.

Trong release trial trước: 93 test BE và 66 test FE liên quan đã qua,
đối chiếu chỉ đọc xác nhận ba trial đã tồn tại giữ nguyên các mốc thời gian.
Không tạo workspace hay giao dịch production để test.

## Email và quên mật khẩu — được giữ nguyên

- Email HTML có thương hiệu DX LMS, bản chữ thuần, VI/EN, thời hạn thật và CTA
  rõ ràng. Form gửi locale đang chọn, khóa input và hiển thị loading khi chờ.
- Giữ reset-link một lần hiện có. Renderer OTP đã có nhưng chưa nối vào luồng
  xác thực; không có API phát/kiểm tra OTP mới.
- Bật email cho năm sự kiện học tập hiện có, locale mặc định VI, từ
  `2026-09-05T09:08:23.191Z` (16:08:23 giờ Việt Nam). Không backfill inbox cũ.
  Chưa bao gồm Thông báo trung tâm, thanh toán hoặc mọi toast trên giao diện.
- Hàng đợi có claim/lease/retry và kiểm tra quyền trước gửi; thêm đúng hai
  partial index, không drop index hoặc migration dữ liệu cũ.
- Linux: 338 test BE/32 suite, 31 test FE liên quan và cả hai build đạt.
  Email: 42 lượt render + 14 fallback bỏ style block ở 720/390/320px đạt.
  Form: 8 trường hợp VI/EN, desktop/mobile, success/loading/retry đạt trên
  preview; request thay đổi dữ liệu đều giả lập. Database thử riêng: 16 kiểm
  tra đạt, đã xóa đúng database thử và xác nhận không còn.
- Production đúng domain cũng đạt 8/8 trường hợp form ở 1440/390px VI/EN;
  12 POST đều bị chặn/mock, không gửi email hoặc sửa dữ liệu thật. Readiness
  loopback đạt; endpoint readiness public bị Nginx chặn có chủ đích. Kiểm tra
  queue chỉ đọc xác nhận chưa có job cũ trước cutover và runtime đúng bản build.
- SMTP verify kết nối/xác thực đạt, **chưa gửi mẫu hoặc xác nhận inbox thật**.
  Gmail/Outlook thực tế cần được kiểm tra bằng địa chỉ người dùng xác nhận.

Xem tài liệu backend `docs/integrations/transactional-email-design.md`,
`docs/features/notification-email.md` và `docs/integrations/smtp-email-setup.md`.
Không sửa SMTP credentials, Google, SePay, trial hay dữ liệu tài khoản.

Rollback kênh notification bằng `NOTIFICATION_EMAIL_ENABLED=false` ở env và
PM2 override, restart đúng backend; giữ nguyên index/state. Backup có dist,
source trước/sau và env riêng tư; chỉ restore đúng phạm vi sau khi đối chiếu
với những thay đổi mới hơn. Backend giữ cwd cũ để không đổi đường dẫn media.

## Nút ngôn ngữ có cờ — release trước

- Component chung hiển thị cờ Việt Nam cạnh VI, cờ Anh cạnh EN.
- SVG trang trí không đổi tên truy cập, focus, trạng thái chọn hay cơ chế lưu locale.
- Kích thước 118×42px, thu còn 96×42px ở màn hình ≤380px để không ép logo.
  Kiểm tra cả khung link lẫn ảnh logo bên trong, tránh bỏ sót ảnh bị tràn khung.
- 118/118 test thuộc sáu suite locale/i18n/marketing/login/workspace đã qua
  khi chạy tuần tự. ESLint, TypeScript và Linux build thành công.
- Không sửa/restart backend, env, OAuth, CORS, database hay thanh toán.

Production đạt 18/18 trạng thái VI/EN trên homepage, pricing và login tại
1440, 390 và 320px. Cờ hiển thị đúng, không tràn/chèn logo, đổi bằng chuột
hoặc bàn phím và giữ lựa chọn sau reload. Không có lỗi console/page trong
các lượt kiểm tra này; Google trên origin production tải được. Workspace
header được kiểm tra với API/session giả lập, không đăng nhập thật.

## Giao diện đăng nhập — đã triển khai ở release trước

- Một form căn giữa, một logo, bỏ panel minh họa và các đoạn giải thích dài.
- Email/password, Google chính thức, quên mật khẩu và tạo workspace vẫn giữ.
- Nhãn mật khẩu và link khôi phục cùng hàng; input 48px, font mobile 16px.
- Giữ an toàn chuyển hướng `next`, chống gửi lặp và recovery Google/email.
- Có loading, khóa form khi xử lý, VI/EN và thông báo lỗi dễ đọc.

62 test login/Google/navigation/form đã qua; lint, TypeScript và Linux build
thành công. Trạng thái loading/lỗi được kiểm tra bằng API/GIS giả lập trong
trình duyệt, không gửi thông tin đăng nhập thật. Không sửa/restart backend,
env, CORS, OAuth, database, billing hay SePay trong release UI này.

Production đã đạt 8/8 trường hợp VI/EN ở 1440×900, 390×844, 320×740 và
1586×992. Google thật tải được, không có thông báo thiếu cấu hình; validation,
đổi ngôn ngữ giữ dữ liệu, password toggle, focus bàn phím và link khôi phục/
đăng ký đã được kiểm tra. Bốn kịch bản loading/lỗi API giả lập cũng đạt trên
bản Linux. Cảnh báo Google `initialize()` khi đổi ngôn ngữ đã có từ trước;
không có lỗi ứng dụng, HTTP, ảnh hay tràn ngang.

Preview loopback không thuộc Google/CORS production nên không dùng lỗi
Google tại preview để kết luận production hỏng hoặc nới lỏng origin.

## Lưu ý PM2 và rollback

PM2 trên máy này nhận `ecosystem.config.cjs` là config; một tên `.cjs` tùy ý
có thể bị hiểu là script ứng dụng. Luôn kiểm tra nhận diện config và
cwd/executable sau thao tác. Đổi entrypoint cần tạo lại **đúng process FE**,
không dựa vào `startOrReload` để đổi executable/cwd và không xóa toàn bộ PM2.

Lần chuyển trial trước từng gặp lỗi tên config, đã tự khôi phục UI cũ rồi sửa
tên config và chuyển thành công. Release login đã kiểm tra nhận diện config
trước khi chuyển. Không tuyên bố zero-downtime cho PM2 fork mode.

Rollback UI của release email cũ bằng config tại
`/root/lms-releases/20260905-locale-flags-compact/ecosystem.config.cjs`, chỉ tác động
`LMS-SaaS-FE`, kiểm tra trang/asset rồi lưu PM2. Bản này có UI login gọn và
trial 30 ngày, có cờ nhưng chưa gửi locale trong form quên mật khẩu. Không đổi
ngày hết hạn đã lưu. Backend mới vẫn nhận được request không có locale.

Bản cũ hơn `/root/lms-fe-ui-release.iSG4qg` vẫn được giữ; copy ở đó là 14 ngày,
không ưu tiên làm rollback hiện tại. Static chunks cũ được giữ trong bản mới
để client đang mở trang trước release tiếp tục tải được tài nguyên.

Backup backend chứa source/config cũ và env nhạy cảm, quyền `600`. Không giải
nén đè môi trường sau các thay đổi khác; đối chiếu và chỉ khôi phục đúng phần
policy cần thiết. Khôi phục policy cũ cũng chỉ áp dụng cho trial cấp sau đó.

Các lần vệ sinh trước được ghi trong `/root/lms-ops-backups/cleanup-2026-09-05`.
Giữ source/config cần thiết và bản rollback; bỏ staging sau khi đã xác minh,
không để script/backup rải ở `/root`.
