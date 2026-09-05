export type FeedbackLocale = "vi" | "en";
export interface FeedbackErrorDescription {
  message: string;
  /** The write may have succeeded: check current state before retrying. */
  uncertain: boolean;
}

type Copy = readonly [vi: string, en: string];
const copy = (value: Copy, locale: FeedbackLocale) =>
  value[locale === "en" ? 1 : 0];
const GENERIC: Copy = [
  "Không thể hoàn tất yêu cầu. Vui lòng kiểm tra thông tin và thử lại.",
  "We could not complete the request. Check the details and try again.",
];
const UNCERTAIN: Copy = [
  "Chưa xác nhận được kết quả. Hãy tải lại và kiểm tra dữ liệu trước khi thử lại để tránh tạo thay đổi trùng lặp.",
  "The result could not be confirmed. Refresh and check the current data before retrying to avoid duplicate changes.",
];
const AUDIT_PENDING: Copy = [
  "Thay đổi đang chờ đối soát nhật ký. Hãy tải lại để kiểm tra trạng thái; không gửi lại thao tác. Liên hệ quản trị viên nếu trạng thái chưa được xác nhận.",
  "The change is awaiting audit reconciliation. Refresh to check its status; do not submit it again. Contact an administrator if the result remains unconfirmed.",
];
const CHANGED: Copy = [
  "Dữ liệu vừa được thay đổi. Hãy tải lại, kiểm tra phiên bản mới nhất rồi thực hiện lại thao tác.",
  "This data has changed. Refresh, review the latest version, then repeat your action.",
];
const BUSY: Copy = [
  "Một thay đổi khác đang được xử lý. Vui lòng chờ một lát, tải lại dữ liệu rồi thử lại.",
  "Another change is being processed. Wait a moment, refresh the data, then try again.",
];
const PERMISSION: Copy = [
  "Bạn không có quyền thực hiện thao tác này. Hãy liên hệ quản trị viên để được hỗ trợ.",
  "You do not have permission to perform this action. Contact an administrator for help.",
];
const NOT_FOUND: Copy = [
  "Không tìm thấy dữ liệu hoặc dữ liệu không còn khả dụng. Hãy tải lại danh sách.",
  "The requested data was not found or is no longer available. Refresh the list.",
];
const SESSION: Copy = [
  "Phiên đăng nhập đã hết hạn hoặc không còn hợp lệ. Vui lòng đăng nhập lại.",
  "Your session has expired or is no longer valid. Please sign in again.",
];
const VALIDATION: Copy = [
  "Thông tin chưa hợp lệ. Vui lòng kiểm tra các trường và thử lại.",
  "Some details are invalid. Check the fields and try again.",
];
const PASSWORD: Copy = [
  "Mật khẩu cần ít nhất 8 ký tự và không vượt quá 72 byte UTF-8; ký tự có dấu có thể chiếm nhiều byte.",
  "Use a password with at least 8 characters and no more than 72 UTF-8 bytes; accented characters may use more than one byte.",
];
const QUOTA: Copy = [
  "Đã đạt giới hạn của gói hiện tại. Hãy giảm số lượng đang hoạt động hoặc nâng cấp gói rồi thử lại.",
  "Your current plan's limit has been reached. Reduce active usage or upgrade the plan, then try again.",
];
const PROVISIONING: Copy = [
  "Chưa xác nhận việc tạo không gian làm việc đã hoàn tất. Giữ nguyên biểu mẫu và dùng chức năng kiểm tra/thử lại của yêu cầu này; không tạo yêu cầu mới.",
  "Workspace creation has not been confirmed. Keep this form open and use this request's check/retry action; do not start a new request.",
];

// Only reviewed copy is shown. Backend messages, stack traces and credential
// values are deliberately not passed through, even for an unknown error code.
const CODE_COPY: Readonly<Record<string, Copy>> = {
  ACCOUNT_EMAIL_EXISTS: [
    "Email này đã được sử dụng. Hãy tìm tài khoản hiện có hoặc dùng email khác.",
    "This email is already in use. Find the existing account or use another email.",
  ],
  ACCOUNT_HAS_TENANT_MEMBERSHIPS: [
    "Tài khoản này đã gắn với không gian làm việc. Hãy dùng một tài khoản độc lập để cấp quyền quản trị nền tảng.",
    "This account has workspace associations. Use a separate account for platform administrator access.",
  ],
  ACCOUNT_SELF_MUTATION_FORBIDDEN: [
    "Bạn không thể tự vô hiệu hóa tài khoản hoặc gỡ quyền quản trị của mình. Hãy nhờ quản trị viên nền tảng khác thực hiện.",
    "You cannot disable your own account or remove your own administrator access. Ask another platform administrator.",
  ],
  LAST_PLATFORM_ADMIN: [
    "Cần giữ ít nhất một quản trị viên nền tảng đang hoạt động. Hãy cấp quyền cho tài khoản khác trước.",
    "At least one active platform administrator is required. Assign another administrator first.",
  ],
  LAST_TENANT_ADMIN: [
    "Cần giữ ít nhất một quản trị viên đang hoạt động trong không gian làm việc. Hãy chỉ định người thay thế trước.",
    "The workspace needs at least one active administrator. Assign a replacement first.",
  ],
  ACCOUNT_CREDENTIAL_STATE_INVALID: [
    "Trạng thái bảo mật của tài khoản cần được kiểm tra. Hãy liên hệ quản trị viên; không thử thay đổi quyền liên tục.",
    "This account's security state needs review. Contact an administrator rather than repeatedly changing its access.",
  ],
  ACCOUNT_CHANGED: CHANGED,
  ACCOUNT_MUTATION_BUSY: BUSY,
  ACCOUNT_AUDIT_PENDING: AUDIT_PENDING,
  ACCOUNT_MUTATION_UNCERTAIN: UNCERTAIN,
  PLAN_AUDIT_PENDING: AUDIT_PENDING,
  PLAN_CHANGED_RETRY: CHANGED,
  TRIAL_PLAN_PROTECTED: [
    "Gói này đang được dùng cho đăng ký dùng thử. Hãy cấu hình gói dùng thử thay thế trước khi đổi mã hoặc vô hiệu hóa.",
    "This plan is used for trial sign-ups. Configure a replacement trial plan before changing its code or disabling it.",
  ],
  PLAN_REPAIR_REQUIRED: [
    "Cấu hình gói chưa hợp lệ nên chưa thể kích hoạt. Hãy kiểm tra tính năng, giới hạn và các tính năng phụ thuộc.",
    "This plan cannot be activated until its configuration is corrected. Check its features, limits and feature dependencies.",
  ],
  PLAN_ENTITLEMENTS_INVALID: [
    "Quyền lợi của gói chưa hợp lệ. Hãy nhờ quản trị viên kiểm tra cấu hình gói trước khi tiếp tục.",
    "This plan's entitlements are invalid. Ask an administrator to review its configuration before continuing.",
  ],
  PLAN_ENTITLEMENTS_MISSING: [
    "Gói chưa được cấu hình quyền lợi. Hãy nhờ quản trị viên bổ sung trước khi tiếp tục.",
    "This plan has no configured entitlements. Ask an administrator to complete its configuration.",
  ],
  INVALID_MODULE_DEPENDENCIES: [
    "Một số tính năng cần tính năng khác đi kèm. Hãy bật đầy đủ các tính năng phụ thuộc rồi lưu lại.",
    "Some features require other features. Enable all required dependencies, then save again.",
  ],
  USER_QUOTA_EXCEEDED: QUOTA,
  ACTIVE_LEARNER_QUOTA_EXCEEDED: QUOTA,
  BRANCH_QUOTA_EXCEEDED: QUOTA,
  COURSE_QUOTA_EXCEEDED: QUOTA,
  DOWNGRADE_QUOTA_EXCEEDED: [
    "Mức sử dụng hiện tại vượt giới hạn gói đã chọn. Hãy giảm số lượng đang hoạt động hoặc chọn gói lớn hơn.",
    "Current usage exceeds the selected plan's limits. Reduce active usage or select a larger plan.",
  ],
  SUBSCRIPTION_READ_ONLY: [
    "Không gian làm việc đang ở chế độ chỉ đọc do trạng thái thuê bao. Hãy gia hạn hoặc liên hệ quản trị viên.",
    "This workspace is read-only because of its subscription status. Renew the subscription or contact an administrator.",
  ],
  RENEWAL_ENTITLEMENTS_CHANGED: [
    "Quyền lợi của gói đã thay đổi. Hãy tải lại bảng giá và kiểm tra quyền lợi mới trước khi thanh toán.",
    "The plan's entitlements have changed. Refresh pricing and review the new entitlements before paying.",
  ],
  SCHEDULED_DOWNGRADE_PLAN_UNAVAILABLE: [
    "Gói dự kiến chuyển xuống không còn khả dụng. Hãy chọn lại gói hoặc liên hệ quản trị viên.",
    "The scheduled lower-tier plan is no longer available. Select another plan or contact an administrator.",
  ],
  TENANT_MUTATION_BUSY: BUSY,
  ORG_UNIT_MUTATION_BUSY: BUSY,
  MEMBERSHIP_REVISION_MISMATCH: CHANGED,
  ORG_UNIT_REVISION_MISMATCH: CHANGED,
  PROFILE_CHANGED_RETRY: CHANGED,
  TENANT_NOT_FOUND: NOT_FOUND,
  WORKSPACE_ACCESS_DENIED: [
    "Bạn không còn quyền truy cập không gian làm việc này. Hãy chọn không gian khác hoặc liên hệ quản trị viên.",
    "You no longer have access to this workspace. Choose another workspace or contact an administrator.",
  ],
  PLATFORM_ADMIN_TENANT_FORBIDDEN: [
    "Tài khoản quản trị nền tảng không thể làm thành viên không gian làm việc. Hãy dùng tài khoản riêng cho vai trò này.",
    "A platform administrator cannot be a workspace member. Use a separate account for this role.",
  ],
  TENANT_MEMBERSHIP_MIGRATION_REQUIRED: [
    "Dữ liệu thành viên cần được cập nhật bởi quản trị viên trước khi tiếp tục.",
    "An administrator needs to update the workspace membership data before you can continue.",
  ],
  IDENTITY_EXISTS_USE_INVITATION: [
    "Email này đã có tài khoản. Hãy gửi lời mời để thêm tài khoản vào không gian làm việc.",
    "This email already has an account. Send an invitation to add it to the workspace.",
  ],
  INVITATION_ACCOUNT_EXISTS: [
    "Email này đã có tài khoản. Hãy đăng nhập bằng tài khoản đó để nhận lời mời.",
    "This email already has an account. Sign in with that account to accept the invitation.",
  ],
  INVITATION_ACCOUNT_INACTIVE: [
    "Tài khoản đang bị vô hiệu hóa. Hãy liên hệ quản trị viên để khôi phục trước khi nhận lời mời.",
    "This account is disabled. Contact an administrator to restore it before accepting the invitation.",
  ],
  INVITATION_ALREADY_MEMBER: [
    "Lời mời này đã được xử lý. Hãy tải lại và kiểm tra danh sách không gian làm việc.",
    "This invitation has already been processed. Refresh and check your workspace list.",
  ],
  INVITATION_ALREADY_PENDING: [
    "Đã có lời mời đang chờ cho email này. Hãy kiểm tra hoặc gửi lại lời mời hiện có.",
    "An invitation is already pending for this email. Review or resend the existing invitation.",
  ],
  INVITATION_EMAIL_MISMATCH: [
    "Email đang đăng nhập không khớp với lời mời. Hãy đăng nhập bằng email được mời.",
    "Your signed-in email does not match this invitation. Sign in with the invited email.",
  ],
  INVITATION_EXPIRED: [
    "Lời mời đã hết hạn. Hãy nhờ quản trị viên gửi lời mời mới.",
    "This invitation has expired. Ask an administrator to send a new one.",
  ],
  INVITATION_INVALID: [
    "Lời mời không hợp lệ hoặc đã bị thu hồi. Hãy nhờ quản trị viên kiểm tra.",
    "This invitation is invalid or has been revoked. Ask an administrator to check it.",
  ],
  ORGANIZATION_NAME_INVALID: [
    "Tên không gian làm việc cần ít nhất 2 ký tự, không tính khoảng trắng ở hai đầu.",
    "The workspace name must have at least 2 characters, excluding surrounding spaces.",
  ],
  ADMIN_NAME_INVALID: [
    "Tên quản trị viên cần ít nhất 2 ký tự, không tính khoảng trắng ở hai đầu.",
    "The administrator's name must have at least 2 characters, excluding surrounding spaces.",
  ],
  PROFILE_NAME_INVALID: [
    "Họ tên cần ít nhất 2 ký tự, không tính khoảng trắng ở hai đầu.",
    "Your full name must have at least 2 characters, excluding surrounding spaces.",
  ],
  PASSWORD_INVALID: PASSWORD,
  CURRENT_PASSWORD_INVALID: [
    "Mật khẩu hiện tại chưa chính xác. Hãy nhập lại; không chia sẻ mật khẩu với người khác.",
    "Your current password is incorrect. Enter it again; never share your password.",
  ],
  PASSWORD_REUSE_NOT_ALLOWED: [
    "Mật khẩu mới phải khác mật khẩu hiện tại. Hãy chọn mật khẩu khác.",
    "Your new password must differ from your current one. Choose another password.",
  ],
  PASSWORD_RESET_TOKEN_INVALID: [
    "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy yêu cầu một liên kết mới.",
    "This password reset link is invalid or expired. Request a new link.",
  ],
  PASSWORD_RESET_ALREADY_APPLIED: [
    "Mật khẩu đã được đặt lại. Hãy đăng nhập bằng mật khẩu mới.",
    "Your password has already been reset. Sign in with your new password.",
  ],
  PASSWORD_RESET_IN_PROGRESS: [
    "Yêu cầu đặt lại mật khẩu đang được xử lý. Hãy chờ và kiểm tra kết quả trước khi gửi lại.",
    "Your password reset is being processed. Wait and check the result before submitting again.",
  ],
  CREDENTIAL_CHANGED_RELOGIN: SESSION,
  CREDENTIAL_VERSION_EXHAUSTED: [
    "Tài khoản cần được kiểm tra bảo mật trước khi thay đổi thông tin đăng nhập. Hãy liên hệ quản trị viên.",
    "This account requires a security review before its sign-in details can change. Contact an administrator.",
  ],
  AUTH_PROTECTION_UNAVAILABLE: [
    "Đăng nhập đang tạm dừng để bảo vệ tài khoản. Vui lòng thử lại sau.",
    "Sign-in is temporarily unavailable to protect your account. Please try again later.",
  ],
  AUTH_RECOVERY_UNAVAILABLE: [
    "Khôi phục tài khoản hiện chưa khả dụng. Hãy thử lại sau hoặc liên hệ quản trị viên.",
    "Account recovery is temporarily unavailable. Try again later or contact an administrator.",
  ],
  PUBLIC_SIGNUP_DISABLED: [
    "Đăng ký không gian làm việc mới đang tạm dừng. Hãy thử lại sau hoặc liên hệ hỗ trợ.",
    "New workspace sign-ups are temporarily paused. Try again later or contact support.",
  ],
  SIGNUP_UNAVAILABLE: [
    "Chưa thể hoàn tất đăng ký với thông tin này. Hãy kiểm tra lại thông tin, đăng nhập nếu đã có tài khoản hoặc liên hệ hỗ trợ.",
    "Sign-up could not be completed with these details. Check the information, sign in if you already have an account, or contact support.",
  ],
  SIGNUP_IN_PROGRESS: PROVISIONING,
  SIGNUP_RETRYABLE: PROVISIONING,
  TENANT_PROVISIONING_IN_PROGRESS: PROVISIONING,
  TENANT_PROVISIONING_RETRYABLE: PROVISIONING,
  TENANT_PROVISIONING_KEY_UNAVAILABLE: [
    "Chưa thể xác minh yêu cầu tạo không gian làm việc. Hãy giữ nguyên yêu cầu và liên hệ quản trị viên; không tạo lại.",
    "The workspace creation request cannot be verified. Keep the current request and contact an administrator; do not create another one.",
  ],
  ADMIN_EMAIL_CONFLICT: [
    "Email quản trị viên đã được sử dụng. Hãy kiểm tra tài khoản hiện có hoặc chọn email khác.",
    "The administrator email is already in use. Check the existing account or choose another email.",
  ],
  TENANT_SLUG_CONFLICT: [
    "Đường dẫn không gian làm việc đã được sử dụng. Hãy chọn một đường dẫn khác.",
    "This workspace URL is already in use. Choose another URL.",
  ],
  RESOURCE_INTEGRITY_CONFLICT: [
    "Yêu cầu tạo không gian làm việc cần được đối soát. Hãy liên hệ quản trị viên và không tạo yêu cầu trùng lặp.",
    "This workspace creation request needs reconciliation. Contact an administrator and do not create a duplicate request.",
  ],
  IDEMPOTENCY_KEY_INVALID: [
    "Thông tin theo dõi yêu cầu không hợp lệ. Hãy tải lại biểu mẫu trước khi gửi.",
    "The request tracking information is invalid. Reload the form before submitting.",
  ],
  IDEMPOTENCY_KEY_REUSED: [
    "Yêu cầu này đã gắn với thông tin khác. Hãy kiểm tra kết quả yêu cầu trước đó trước khi bắt đầu yêu cầu mới.",
    "This request is already associated with different details. Check the previous request's result before starting another one.",
  ],
  AUDIT_LEDGER_UNAVAILABLE: AUDIT_PENDING,
  AUDIT_LEDGER_INTEGRITY_FAILURE: AUDIT_PENDING,
  GOOGLE_LINK_REQUIRED: [
    "Email này đã có tài khoản. Hãy đăng nhập bằng email và mật khẩu rồi liên kết Google trong Bảo mật tài khoản.",
    "This email already has an account. Sign in with your email and password, then link Google in Account security.",
  ],
  GOOGLE_ACCOUNT_NOT_REGISTERED: [
    "Tài khoản Google này chưa có trên DX LMS. Hãy tạo workspace bằng email trước rồi liên kết Google trong Bảo mật tài khoản.",
    "This Google account is not registered on DX LMS. Create a workspace with email first, then link Google in Account security.",
  ],
  GOOGLE_SIGNUP_REQUIRED: [
    "Tài khoản Google này chưa có trên DX LMS. Hãy tạo workspace bằng email trước rồi liên kết Google trong Bảo mật tài khoản.",
    "This Google account is not registered on DX LMS. Create a workspace with email first, then link Google in Account security.",
  ],
  GOOGLE_ACCOUNT_UNAVAILABLE: [
    "Tài khoản DX LMS đã liên kết với Google hiện không khả dụng. Hãy liên hệ quản trị viên để được hỗ trợ.",
    "The DX LMS account linked to Google is unavailable. Contact an administrator for help.",
  ],
  GOOGLE_EMAIL_MISMATCH: [
    "Email Google phải trùng với email tài khoản LMS. Hãy chọn đúng tài khoản Google.",
    "Your Google email must match your LMS account email. Choose the matching Google account.",
  ],
  GOOGLE_ALREADY_LINKED: [
    "Tài khoản đã được liên kết với Google. Hãy tải lại hồ sơ để kiểm tra.",
    "This account is already linked to Google. Refresh your profile to check.",
  ],
  GOOGLE_LINK_NOT_FOUND: [
    "Tài khoản chưa liên kết với Google. Hãy tải lại hồ sơ để kiểm tra.",
    "This account is not linked to Google. Refresh your profile to check.",
  ],
  GOOGLE_IDENTITY_IN_USE: [
    "Tài khoản Google này đã liên kết với tài khoản khác. Hãy chọn tài khoản Google khác hoặc liên hệ hỗ trợ.",
    "This Google identity is linked to another account. Choose another Google account or contact support.",
  ],
  GOOGLE_CHALLENGE_INVALID: [
    "Yêu cầu xác minh Google đã hết hạn hoặc không hợp lệ. Hãy bắt đầu liên kết lại.",
    "The Google verification request has expired or is invalid. Start the linking process again.",
  ],
  GOOGLE_ID_TOKEN_INVALID: [
    "Không thể xác minh đăng nhập Google. Hãy thử đăng nhập lại.",
    "Google sign-in could not be verified. Try signing in again.",
  ],
  GOOGLE_LOGIN_DISABLED: [
    "Đăng nhập Google chưa được bật. Hãy sử dụng email và mật khẩu.",
    "Google sign-in is not enabled. Use your email and password.",
  ],
  GOOGLE_SUPER_ADMIN_FORBIDDEN: [
    "Quản trị viên nền tảng cần đăng nhập bằng email và mật khẩu.",
    "Platform administrators must sign in with their email and password.",
  ],
  ADMIN_ACCOUNTS_INPUT_INVALID: VALIDATION,
  API_TIMEOUT_INVALID: [
    "Cấu hình thời gian chờ chưa hợp lệ. Hãy tải lại trang hoặc liên hệ hỗ trợ.",
    "The request timeout configuration is invalid. Reload the page or contact support.",
  ],
  UPLOAD_CANCELLED: [
    "Đã hủy tải tệp. Bạn có thể chọn tệp để tải lại khi sẵn sàng.",
    "The upload was cancelled. Select the file again when you are ready.",
  ],
};

const UNCERTAIN_CODES = new Set([
  "ACCOUNT_AUDIT_PENDING",
  "ACCOUNT_MUTATION_UNCERTAIN",
  "PLAN_AUDIT_PENDING",
  "AUDIT_LEDGER_UNAVAILABLE",
  "AUDIT_LEDGER_INTEGRITY_FAILURE",
  "SIGNUP_IN_PROGRESS",
  "SIGNUP_RETRYABLE",
  "TENANT_PROVISIONING_IN_PROGRESS",
  "TENANT_PROVISIONING_RETRYABLE",
  "TENANT_PROVISIONING_KEY_UNAVAILABLE",
  "RESOURCE_INTEGRITY_CONFLICT",
  "PASSWORD_RESET_IN_PROGRESS",
]);

const LEGACY_COPY: Readonly<Record<string, Copy>> = {
  "Mã tài khoản không hợp lệ": [
    "Mã tài khoản không hợp lệ. Hãy tải lại danh sách và chọn tài khoản cần thao tác.",
    "The account identifier is invalid. Refresh the list and select the account again.",
  ],
  "Phân trang không hợp lệ": [
    "Thông tin phân trang không hợp lệ. Hãy quay lại trang đầu của danh sách.",
    "The page selection is invalid. Return to the first page of the list.",
  ],
  "Từ khóa tối đa 100 ký tự": [
    "Từ khóa tìm kiếm chỉ được tối đa 100 ký tự. Hãy rút ngắn từ khóa.",
    "Search text must not exceed 100 characters. Shorten your search.",
  ],
  "Trạng thái không hợp lệ": [
    "Hãy chọn trạng thái hợp lệ.",
    "Select a valid status.",
  ],
  "Vai trò không hợp lệ": ["Hãy chọn vai trò hợp lệ.", "Select a valid role."],
  "Lý do phải có từ 5 đến 500 ký tự": [
    "Lý do cần từ 5 đến 500 ký tự, không tính khoảng trắng ở hai đầu.",
    "The reason must have 5 to 500 characters, excluding surrounding spaces.",
  ],
  "Họ tên phải có từ 2 đến 160 ký tự": [
    "Họ tên cần từ 2 đến 160 ký tự, không tính khoảng trắng ở hai đầu.",
    "The full name must have 2 to 160 characters, excluding surrounding spaces.",
  ],
  "Mật khẩu phải có ít nhất 12 ký tự": [
    "Mật khẩu tài khoản mới cần ít nhất 12 ký tự.",
    "A new account password must have at least 12 characters.",
  ],
  "Mật khẩu không được vượt quá 72 byte UTF-8": [
    "Mật khẩu không được vượt quá 72 byte UTF-8. Hãy rút ngắn mật khẩu; ký tự có dấu có thể chiếm nhiều byte.",
    "The password must not exceed 72 UTF-8 bytes. Shorten it; accented characters may use more than one byte.",
  ],
  "Email không hợp lệ": [
    "Hãy nhập địa chỉ email hợp lệ.",
    "Enter a valid email address.",
  ],
  "Cần thay đổi họ tên hoặc vai trò": [
    "Hãy thay đổi họ tên hoặc quyền nền tảng trước khi lưu.",
    "Change the name or platform role before saving.",
  ],
  "Email hoặc mật khẩu không chính xác": [
    "Email hoặc mật khẩu chưa chính xác. Hãy kiểm tra lại hoặc dùng chức năng quên mật khẩu.",
    "The email or password is incorrect. Check your details or use the password reset option.",
  ],
  "Mã gói đã tồn tại": [
    "Mã gói đã được sử dụng. Hãy chọn một mã khác.",
    "This plan code is already in use. Choose another code.",
  ],
  "Slug tổ chức đã tồn tại": CODE_COPY.TENANT_SLUG_CONFLICT,
  "Cần thay đổi tên hoặc quyền nền tảng": [
    "Hãy thay đổi họ tên hoặc quyền nền tảng trước khi lưu.",
    "Change the name or platform role before saving.",
  ],
  "Mật khẩu không được vượt quá 72 byte": [
    "Mật khẩu không được vượt quá 72 byte UTF-8. Hãy rút ngắn mật khẩu; ký tự có dấu có thể chiếm nhiều byte.",
    "The password must not exceed 72 UTF-8 bytes. Shorten it; accented characters may use more than one byte.",
  ],
  "Gói thuê bao không khả dụng": [
    "Gói thuê bao này không còn khả dụng. Hãy tải lại bảng giá và chọn gói khác.",
    "This subscription plan is no longer available. Refresh pricing and choose another plan.",
  ],
  "Thuê bao vừa thay đổi, vui lòng thử lại": CHANGED,
  "Order vừa được xử lý bởi tiến trình khác": [
    "Đơn thanh toán vừa được xử lý. Hãy tải lại và kiểm tra trạng thái trước khi thao tác tiếp.",
    "This payment order has just been processed. Refresh and check its status before continuing.",
  ],
  "Tenant đang có checkout khác chưa hết hạn": [
    "Đang có một yêu cầu thanh toán chưa hết hạn. Hãy mở đơn hiện có và kiểm tra trước khi tạo đơn khác.",
    "An unexpired checkout already exists. Open and check the existing order before creating another.",
  ],
  "Thiếu cấu hình NEXT_PUBLIC_API_URL": [
    "Ứng dụng chưa được cấu hình kết nối máy chủ. Hãy liên hệ quản trị viên.",
    "The application is not configured to connect to the server. Contact an administrator.",
  ],
};

const FIELD_LABELS: Readonly<Record<string, Copy>> = {
  email: ["Email", "Email"],
  fullName: ["Họ tên", "Full name"],
  name: ["Tên", "Name"],
  password: ["Mật khẩu", "Password"],
  currentPassword: ["Mật khẩu hiện tại", "Current password"],
  newPassword: ["Mật khẩu mới", "New password"],
  reason: ["Lý do", "Reason"],
  platformRole: ["Quyền nền tảng", "Platform role"],
  role: ["Vai trò", "Role"],
  status: ["Trạng thái", "Status"],
  code: ["Mã", "Code"],
  slug: ["Đường dẫn", "URL slug"],
  page: ["Trang", "Page"],
  limit: ["Số mục mỗi trang", "Page size"],
  search: ["Từ khóa", "Search"],
  description: ["Mô tả", "Description"],
  tier: ["Cấp gói", "Plan tier"],
  monthlyPrice: ["Giá tháng", "Monthly price"],
  yearlyPrice: ["Giá năm", "Yearly price"],
  billingCycle: ["Chu kỳ thanh toán", "Billing cycle"],
  currency: ["Tiền tệ", "Currency"],
  active: ["Trạng thái kích hoạt", "Active status"],
  enabledModules: ["Tính năng", "Features"],
  "admin.email": ["Email quản trị viên", "Administrator email"],
  "admin.fullName": ["Họ tên quản trị viên", "Administrator name"],
  "admin.password": ["Mật khẩu quản trị viên", "Administrator password"],
  "organization.name": ["Tên không gian làm việc", "Workspace name"],
  "organization.slug": ["Đường dẫn không gian làm việc", "Workspace URL slug"],
  adminEmail: ["Email quản trị viên", "Administrator email"],
  adminFullName: ["Họ tên quản trị viên", "Administrator name"],
  adminPassword: ["Mật khẩu quản trị viên", "Administrator password"],
  organizationName: ["Tên không gian làm việc", "Workspace name"],
};

function validationMessage(
  value: unknown,
  locale: FeedbackLocale,
): string | undefined {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\.\s+|\n/)
      : [];
  const result: string[] = [];
  for (const item of values.slice(0, 30)) {
    if (typeof item !== "string" || item.length > 300) continue;
    const match = /^(?:each value in )?([a-zA-Z.]+) (.+?)\.?$/.exec(
      item.trim(),
    );
    if (!match || !Object.hasOwn(FIELD_LABELS, match[1])) continue;
    const field = copy(FIELD_LABELS[match[1]], locale);
    const rule = match[2];
    let message: string | undefined;
    if (/^must be an email$/.test(rule))
      message = copy(
        [
          `${field}: nhập địa chỉ email hợp lệ.`,
          `${field}: enter a valid email address.`,
        ],
        locale,
      );
    else if (/^should not be empty$/.test(rule))
      message = copy(
        [`${field}: không được để trống.`, `${field}: this field is required.`],
        locale,
      );
    else if (/^must be a string$/.test(rule))
      message = copy(
        [`${field}: hãy nhập văn bản.`, `${field}: enter text.`],
        locale,
      );
    else if (
      /^must be (?:an integer number|a number conforming to the specified constraints)$/.test(
        rule,
      )
    )
      message = copy(
        [`${field}: hãy nhập số hợp lệ.`, `${field}: enter a valid number.`],
        locale,
      );
    else if (/^must be a boolean value$/.test(rule))
      message = copy(
        [`${field}: hãy chọn bật hoặc tắt.`, `${field}: select on or off.`],
        locale,
      );
    else if (
      /^must be (?:one of the following values|a valid enum value)(?:: [A-Z_,\s]+)?$/.test(
        rule,
      )
    )
      message = copy(
        [
          `${field}: hãy chọn một giá trị hợp lệ.`,
          `${field}: select a valid option.`,
        ],
        locale,
      );
    else if (/^must not exceed \d{1,6} UTF-8 bytes$/.test(rule)) {
      const bytes = Number(rule.match(/\d+/)![0]);
      message = copy(
        [
          `${field}: tối đa ${bytes} byte UTF-8; ký tự có dấu có thể chiếm nhiều byte.`,
          `${field}: at most ${bytes} UTF-8 bytes; accented characters may use more than one byte.`,
        ],
        locale,
      );
    } else {
      const bound =
        /^must (?:be (longer|shorter) than or equal to (\d{1,6}) characters|not be (less|greater) than (\d{1,6}))$/.exec(
          rule,
        );
      if (bound) {
        const minimum = bound[1] === "longer" || bound[3] === "less";
        const number = Number(bound[2] ?? bound[4]);
        const unit = bound[1] ? copy([" ký tự", " characters"], locale) : "";
        message = copy(
          [
            `${field}: ${minimum ? "ít nhất" : "tối đa"} ${number}${unit}.`,
            `${field}: ${minimum ? "at least" : "at most"} ${number}${unit}.`,
          ],
          locale,
        );
      }
    }
    if (message && !result.includes(message)) result.push(message);
  }
  return result.length ? result.join(" ") : undefined;
}

function safeFallback(value: string | undefined): string | undefined {
  if (!value?.trim() || value.length > 500) return undefined;
  // The fallback is caller-owned UI copy, never an error.message. Still reject
  // common accidental debug/secret payloads rather than putting them in a toast.
  if (
    /[\u0000-\u001f<>]|https?:\/\/|mongodb(?:\+srv)?:\/\/|\b(?:Bearer|passwordHash|credentialVersion|api[_-]?key|access[_-]?token|refresh[_-]?token|secret)\s*[:= ]|\b(?:Error|Exception):|\bat \S+\([^)]*:\d+|eyJ[A-Za-z0-9_-]{10,}|\$2[aby]\$/i.test(
      value,
    )
  )
    return undefined;
  return value.trim();
}

function retryAfter(
  error: Record<string, unknown>,
  locale: FeedbackLocale,
): string {
  const seconds = error.retryAfterSeconds;
  return typeof seconds === "number" &&
    Number.isSafeInteger(seconds) &&
    seconds >= 1 &&
    seconds <= 300
    ? copy(
        [` Vui lòng chờ ${seconds} giây.`, ` Please wait ${seconds} seconds.`],
        locale,
      )
    : "";
}

/**
 * Describe an error without changing its status/code/retry metadata or exposing
 * unreviewed server text. Pass only localized, application-owned UI as fallback.
 */
export function describeFeedbackError(
  error: unknown,
  locale: FeedbackLocale,
  fallback?: string,
): FeedbackErrorDescription {
  const record =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};
  const code = typeof record.code === "string" ? record.code : "";
  const status =
    typeof record.status === "number"
      ? record.status
      : typeof record.statusCode === "number"
        ? record.statusCode
        : undefined;
  const message = typeof record.message === "string" ? record.message : "";
  const isRead = record.requestMethod === "GET" || record.requestMethod === "HEAD";
  const rateLimited =
    status === 429 ||
    code === "AUTH_RATE_LIMITED" ||
    code === "LOCAL_UPLOAD_RATE_LIMITED";
  if (rateLimited)
    return {
      message:
        copy(
          [
            "Bạn gửi yêu cầu quá nhanh. Hãy chờ một lát rồi thử lại.",
            "Too many requests were sent. Wait a moment, then try again.",
          ],
          locale,
        ) + retryAfter(record, locale),
      uncertain: false,
    };
  if (Object.hasOwn(CODE_COPY, code) && code !== "ADMIN_ACCOUNTS_INPUT_INVALID")
    return {
      message:
        copy(CODE_COPY[code], locale) +
        (code.endsWith("_BUSY") || code.endsWith("_IN_PROGRESS")
          ? retryAfter(record, locale)
          : ""),
      uncertain: UNCERTAIN_CODES.has(code),
    };
  if (Object.hasOwn(LEGACY_COPY, message))
    return { message: copy(LEGACY_COPY[message], locale), uncertain: false };
  const timeout =
    record.name === "TimeoutError" ||
    record.name === "AbortError" ||
    /^(?:Máy chủ phản hồi quá lâu, vui lòng thử lại|Request timeout|Failed to fetch|Network request failed|Không thể kết nối tới máy chủ)$/.test(
      message,
    );
  const invalidResponse =
    /(?:^|_)RESPONSE_INVALID$/.test(code) ||
    message === "Máy chủ trả dữ liệu không hợp lệ" ||
    (status !== undefined && status >= 200 && status < 300);
  if (
    timeout ||
    invalidResponse ||
    status === 0 ||
    status === 408 ||
    status === 504 ||
    (status !== undefined && status >= 500)
  ) {
    if (isRead) return {
      message: copy([
        "Chưa tải được dữ liệu. Hãy kiểm tra kết nối rồi thử lại.",
        "Could not load the data. Check your connection and try again.",
      ], locale),
      uncertain: false,
    };
    return {
      message: copy(
        timeout || status === 0
          ? [
              "Kết nối bị gián đoạn hoặc phản hồi quá lâu. " + UNCERTAIN[0],
              "The connection was interrupted or the response took too long. " +
                UNCERTAIN[1],
            ]
          : UNCERTAIN,
        locale,
      ),
      uncertain: true,
    };
  }
  if (status === 401)
    return { message: copy(SESSION, locale), uncertain: false };
  if (status === 403)
    return { message: copy(PERMISSION, locale), uncertain: false };
  if (status === 404 || status === 410)
    return { message: copy(NOT_FOUND, locale), uncertain: false };
  if (
    status === 400 ||
    status === 422 ||
    code === "ADMIN_ACCOUNTS_INPUT_INVALID"
  )
    return {
      message:
        validationMessage(record.message, locale) ??
        safeFallback(fallback) ??
        copy(VALIDATION, locale),
      uncertain: false,
    };
  if (status === 409)
    return { message: copy(CHANGED, locale), uncertain: false };
  return {
    message: safeFallback(fallback) ?? copy(GENERIC, locale),
    uncertain: false,
  };
}
