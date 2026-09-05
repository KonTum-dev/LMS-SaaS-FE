/**
 * Local, reviewed toast copy. The original Vietnamese strings remain valid keys
 * while existing screens migrate to semantic feedback identifiers.
 *
 * This is a translator, not an error sanitizer. Callers must turn untrusted
 * server errors into safe user-facing copy before passing them here.
 */
export type FeedbackLocale = "vi" | "en";
export type FeedbackKind = "success" | "error" | "warning" | "info" | "loading";

interface FeedbackCopy {
  en: string;
  vi?: string;
}

const catalog: Readonly<Record<string, FeedbackCopy>> = {
  "Đăng nhập thành công": { en: "Signed in successfully" },
  "Không thể đăng nhập": { en: "Could not sign in" },
  "Không thể hoàn tất yêu cầu": { en: "Could not complete the request" },
  "Đã tiếp nhận yêu cầu. Nếu email thuộc một tài khoản, hướng dẫn đặt lại mật khẩu sẽ được gửi trong ít phút.":
    {
      en: "Request received. If an account uses this email, password reset instructions will arrive shortly.",
    },
  "Không thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại.": {
    en: "Could not request a password reset. Please try again.",
  },
  "Đã đặt lại mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới.": {
    en: "Password reset. Please sign in with your new password.",
  },
  "Yêu cầu đặt lại mật khẩu đã được xử lý trước đó. Vui lòng đăng nhập lại.": {
    en: "This password reset request has already been processed. Please sign in again.",
  },
  "Thông tin đăng nhập đã thay đổi. Vui lòng đăng nhập lại.": {
    en: "Your sign-in details have changed. Please sign in again.",
  },
  "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.":
    {
      en: "This password reset link is invalid or has expired. Request a new link.",
    },
  "Không thể đặt lại mật khẩu. Vui lòng thử lại.": {
    en: "Could not reset your password. Please try again.",
  },
  "Đã tạo không gian làm việc và kích hoạt dùng thử. Bạn có thể bắt đầu thiết lập ngay.":
    {
      en: "Your workspace was created and the trial is active. You can start setting it up now.",
    },
  "Chưa thể hoàn tất đăng ký. Hãy kiểm tra hướng dẫn trên biểu mẫu trước khi thử lại.":
    {
      en: "Registration could not be completed. Check the instructions on the form before trying again.",
    },
  "Đã cập nhật hồ sơ": { en: "Profile updated" },
  "Đã gỡ ảnh đại diện": { en: "Profile photo removed" },
  "Đã cập nhật ảnh đại diện": { en: "Profile photo updated" },
  "Đã cập nhật tài khoản nền tảng.": { en: "Platform account updated." },
  "Đã tạo tài khoản nền tảng.": { en: "Platform account created." },
  "Đã vô hiệu hóa tài khoản nền tảng.": { en: "Platform account disabled." },
  "Đã khôi phục tài khoản nền tảng.": { en: "Platform account restored." },
  "Không thể lưu gói thuê bao": { en: "Could not save the subscription plan" },
  "Đã cập nhật gói thuê bao": { en: "Subscription plan updated" },
  "Đã tạo gói thuê bao": { en: "Subscription plan created" },
  "Không thể cập nhật trạng thái gói": {
    en: "Could not change the plan status",
  },
  "Đã mở bán lại gói thuê bao": {
    en: "Subscription plan is available for purchase again",
  },
  "Đã ngừng bán gói thuê bao": {
    en: "Subscription plan is no longer available for purchase",
  },
  "Không thể xử lý đơn thanh toán": {
    en: "Could not process the payment order",
  },
  "Đã áp dụng giao dịch và cập nhật thuê bao": {
    en: "Payment applied and subscription updated",
  },
  "Không thể cập nhật trạng thái tổ chức": {
    en: "Could not change the organization status",
  },
  "Đã khôi phục tổ chức": { en: "Organization restored" },
  "Đã khóa tổ chức": { en: "Organization suspended" },
  "Đã tạo tổ chức và tài khoản quản trị": {
    en: "Organization and administrator account created",
  },
  "Đã cập nhật tổ chức": { en: "Organization updated" },
  "Không thể lưu tổ chức": { en: "Could not save the organization" },
  "Đã gỡ logo tổ chức": { en: "Organization logo removed" },
  "Đã cập nhật logo tổ chức": { en: "Organization logo updated" },
  "Không thể bắt đầu lượt làm": {
    en: "Could not start the assessment attempt",
  },
  "Đã tạo bản nháp bài kiểm tra": { en: "Assessment draft created" },
  "Không thể tạo bài kiểm tra": { en: "Could not create the assessment" },
  "Đã lưu bản nháp": { en: "Draft saved" },
  "Đã nộp bài": { en: "Submission received" },
  "Đã trả bài cho học viên": { en: "Submission returned to the learner" },
  "Đã lưu kết quả chấm bài": { en: "Grading results saved" },
  "Đã cập nhật bài tập": { en: "Assignment updated" },
  "Đã tạo bài tập": { en: "Assignment created" },
  "Đã lưu trữ bài tập": { en: "Assignment archived" },
  "Không thể lưu bài tập": { en: "Could not save the assignment" },
  "Không thể lưu trữ bài tập": { en: "Could not archive the assignment" },
  "Không thể tạo yêu cầu thanh toán": {
    en: "Could not create the payment request",
  },
  "Đã tạo đơn thanh toán mô phỏng và đang chờ xử lý. Hãy dùng nút “Mô phỏng đã thanh toán” trong lịch sử đơn để hoàn tất.":
    {
      en: "A simulated payment order was created and is pending. Use the “Simulate paid” button in the order history to complete it.",
    },
  "Không thể mô phỏng thanh toán": { en: "Could not simulate the payment" },
  "Đã mô phỏng thanh toán thành công": { en: "Successful payment simulated" },
  "Đã mô phỏng hủy thanh toán": { en: "Payment cancellation simulated" },
  "Không thể hẹn hạ gói": { en: "Could not schedule the plan downgrade" },
  "Đã hẹn hạ gói; gói hiện tại vẫn giữ nguyên đến hết kỳ": {
    en: "Downgrade scheduled. Your current plan remains active until the end of the billing period.",
  },
  "Không thể hủy lịch hạ gói": {
    en: "Could not cancel the scheduled downgrade",
  },
  "Đã hủy lịch hạ gói": { en: "Scheduled downgrade canceled" },
  "Không thể lưu điểm danh": { en: "Could not save attendance" },
  "Đã cập nhật lớp học": { en: "Class updated" },
  "Đã tạo lớp học": { en: "Class created" },
  "Đã lưu trữ lớp học": { en: "Class archived" },
  "Đã cập nhật buổi học": { en: "Class session updated" },
  "Đã thêm buổi học": { en: "Class session added" },
  "Đã hủy buổi học": { en: "Class session canceled" },
  "Đã rút học viên khỏi lớp": { en: "Learner withdrawn from the class" },
  "Không thể lưu lớp học": { en: "Could not save the class" },
  "Không thể lưu buổi học": { en: "Could not save the class session" },
  "Không thể lưu trữ lớp học": { en: "Could not archive the class" },
  "Không thể hủy buổi học": { en: "Could not cancel the class session" },
  "Không thể thêm học viên vào lớp": {
    en: "Could not add learners to the class",
  },
  "Không thể rút học viên khỏi lớp": {
    en: "Could not withdraw the learner from the class",
  },
  "Không thể lưu thông báo": { en: "Could not save the announcement" },
  "Đã tạo bản nháp thông báo": { en: "Announcement draft created" },
  "Đã cập nhật thông báo": { en: "Announcement updated" },
  "Không thể phát hành thông báo": { en: "Could not publish the announcement" },
  "Đã phát hành thông báo": { en: "Announcement published" },
  "Không thể lưu trữ thông báo": { en: "Could not archive the announcement" },
  "Đã lưu trữ thông báo": { en: "Announcement archived" },
  "Vui lòng nhập tiêu đề và nội dung thông báo": {
    en: "Enter the announcement title and content",
  },
  "Vui lòng chọn ít nhất một nhóm người nhận": {
    en: "Select at least one recipient group",
  },
  "Vui lòng chọn lớp nhận thông báo": {
    en: "Select the class that should receive this announcement",
  },
  "Vui lòng chọn đơn vị nhận thông báo": {
    en: "Select the organizational unit that should receive this announcement",
  },
  "Giảng viên chỉ được gửi cho học viên hoặc phụ huynh của lớp": {
    en: "Instructors can only send announcements to learners or guardians in their class",
  },
  "Đã thêm chương": { en: "Chapter added" },
  "Đã thêm bài học": { en: "Lesson added" },
  "Đã cập nhật chương": { en: "Chapter updated" },
  "Đã công bố chương": { en: "Chapter published" },
  "Đã lưu trữ chương": { en: "Chapter archived" },
  "Đã công bố bài học": { en: "Lesson published" },
  "Đã lưu trữ bài học": { en: "Lesson archived" },
  "Đã đánh dấu bài học là chưa hoàn thành": {
    en: "Lesson marked as incomplete",
  },
  "Đã hoàn thành bài học": { en: "Lesson completed" },
  "Đã cập nhật khóa học": { en: "Course updated" },
  "Đã tạo khóa học": { en: "Course created" },
  "Đã lưu trữ khóa học": { en: "Course archived" },
  "Đã ghi danh học viên": { en: "Learner enrolled" },
  "Đã rút học viên khỏi khóa học": { en: "Learner withdrawn from the course" },
  "Không thể lưu khóa học": { en: "Could not save the course" },
  "Không thể lưu trữ khóa học": { en: "Could not archive the course" },
  "Không thể ghi danh": { en: "Could not enroll the learner" },
  "Không thể hủy ghi danh": { en: "Could not cancel the enrollment" },
  "Đã thêm quan hệ người giám hộ": { en: "Guardian relationship added" },
  "Đã cập nhật quan hệ người giám hộ": { en: "Guardian relationship updated" },
  "Đã lưu trữ quan hệ người giám hộ": { en: "Guardian relationship archived" },
  "Không thể thêm người giám hộ": { en: "Could not add the guardian" },
  "Không thể cập nhật người giám hộ": { en: "Could not update the guardian" },
  "Không thể lưu trữ người giám hộ": {
    en: "Could not archive the guardian relationship",
  },
  "Không thể lưu phân quyền": { en: "Could not save access permissions" },
  "Đã cấp quyền chi nhánh": { en: "Branch access granted" },
  "Đã cập nhật quyền chi nhánh": { en: "Branch access updated" },
  "Không thể thu hồi phân quyền": { en: "Could not revoke access permissions" },
  "Đã thu hồi quyền chi nhánh": { en: "Branch access revoked" },
  "Vui lòng chọn đơn vị và thành viên cần cấp quyền": {
    en: "Select an organizational unit and a member to grant access",
  },
  "Đã thêm đơn vị tổ chức": { en: "Organizational unit added" },
  "Đã cập nhật cơ cấu tổ chức": { en: "Organization structure updated" },
  "Đã lưu trữ đơn vị tổ chức": { en: "Organizational unit archived" },
  "Không thể lưu đơn vị tổ chức": {
    en: "Could not save the organizational unit",
  },
  "Không thể lưu trữ đơn vị tổ chức": {
    en: "Could not archive the organizational unit",
  },
  "Vui lòng chọn đủ ngày bắt đầu và ngày kết thúc": {
    en: "Select both a start date and an end date",
  },
  "Ngày bắt đầu phải trước hoặc trùng ngày kết thúc": {
    en: "The start date must be on or before the end date",
  },
  "Đã áp dụng cấu hình thương hiệu": { en: "Brand settings applied" },
  "Không thể lưu cấu hình": { en: "Could not save settings" },
  "Đã gỡ logo workspace": {
    en: "Workspace logo removed",
    vi: "Đã gỡ logo không gian làm việc",
  },
  "Đã cập nhật logo workspace": {
    en: "Workspace logo updated",
    vi: "Đã cập nhật logo không gian làm việc",
  },
  "Đã tạo hóa đơn học phí nháp": { en: "Tuition invoice draft created" },
  "Đã phát hành hóa đơn học phí": { en: "Tuition invoice issued" },
  "Đã hủy hóa đơn học phí": { en: "Tuition invoice canceled" },
  "Đã ghi nhận thanh toán học phí": { en: "Tuition payment recorded" },
  "Không thể tạo hóa đơn": { en: "Could not create the invoice" },
  "Không thể phát hành hóa đơn": { en: "Could not issue the invoice" },
  "Không thể hủy hóa đơn": { en: "Could not cancel the invoice" },
  "Không thể ghi nhận thanh toán": { en: "Could not record the payment" },
  "Tệp CSV không được vượt quá 1 MB": {
    en: "The CSV file must be no larger than 1 MB",
  },
  "Đã sao chép danh sách liên kết mời": { en: "Invitation links copied" },
  "Đã cập nhật thành viên": { en: "Member updated" },
  "Đã tạo tài khoản mới": { en: "New account created" },
  "Đã tạo lời mời": { en: "Invitation created" },
  "Đã tạo liên kết mời mới; liên kết cũ không còn hiệu lực": {
    en: "New invitation link created. The previous link is no longer valid.",
  },
  "Đã thu hồi lời mời": { en: "Invitation revoked" },
  "Đã trao quyền quản trị toàn tổ chức": {
    en: "Organization-wide administrator access granted",
  },
  "Không thể lưu thành viên": { en: "Could not save the member" },
  "Không thể tạo lời mời": { en: "Could not create the invitation" },
  "Không thể gửi lại lời mời": { en: "Could not resend the invitation" },
  "Không thể thu hồi lời mời": { en: "Could not revoke the invitation" },
  "Không thể trao quyền quản trị toàn tổ chức": {
    en: "Could not grant organization-wide administrator access",
  },
  "Đã sao chép liên kết mời": { en: "Invitation link copied" },
  "Không thể sao chép tự động; hãy sao chép liên kết trong ô bên dưới": {
    en: "Automatic copying failed. Copy the link from the field below.",
  },
  "Đã xuất bản bài kiểm tra": { en: "Assessment published" },
  "Đã xuất bản phiên bản mới": { en: "New version published" },
  "Đã lưu trữ bài kiểm tra": { en: "Assessment archived" },
  "Đã nạp revision mới và giữ nội dung bạn đang soạn": {
    en: "Latest version loaded. Your unsaved edits have been kept.",
    vi: "Đã tải phiên bản mới nhất và giữ nội dung bạn đang soạn",
  },
  "Không thể kiểm tra chuỗi audit": {
    en: "Could not verify the audit log",
    vi: "Không thể kiểm tra tính toàn vẹn của nhật ký thay đổi",
  },
  "Đã hoàn tất quét chuỗi audit từ genesis": {
    en: "The audit log has been verified from its first record",
    vi: "Đã kiểm tra nhật ký thay đổi từ bản ghi đầu tiên",
  },
  "Phạm vi audit incremental từ checkpoint hợp lệ": {
    en: "The audit log is valid from the saved checkpoint",
    vi: "Nhật ký thay đổi hợp lệ kể từ điểm kiểm tra đã lưu",
  },
  "Đã sao chép checkpoint": {
    en: "Verification checkpoint copied",
    vi: "Đã sao chép điểm kiểm tra",
  },
  "Trình duyệt không cho phép sao chép; hãy chọn checkpoint thủ công": {
    en: "Your browser blocked copying. Select and copy the checkpoint manually.",
    vi: "Trình duyệt không cho phép sao chép. Hãy chọn và sao chép điểm kiểm tra thủ công.",
  },
  "Không thể cập nhật trạng thái thành viên": {
    en: "Could not change the member status",
  },
  "Đã khôi phục thành viên": { en: "Member restored" },
  "Đã vô hiệu hóa thành viên trong tổ chức": {
    en: "Member disabled in this organization",
  },
  "Đã thêm thành viên": { en: "Member added" },
  "Không thể tự hạ quyền tài khoản đang đăng nhập.": {
    en: "You cannot remove your own platform administrator access.",
  },
  "Không thể tự vô hiệu hóa tài khoản đang đăng nhập.": {
    en: "You cannot disable the account you are currently signed in with.",
  },
  "Tài khoản có membership tổ chức không thể được nâng thành quản trị nền tảng.":
    {
      en: "An account with organization memberships cannot become a platform administrator.",
      vi: "Tài khoản đang có quan hệ thành viên với tổ chức không thể trở thành quản trị nền tảng.",
    },
  "Dữ liệu tài khoản trả về không hợp lệ. Hãy tải lại trước khi thao tác tiếp.":
    {
      en: "The account data could not be verified. Reload it before continuing.",
    },
  "Chưa xác định được kết quả. Hãy tải lại danh sách và kiểm tra tài khoản trước khi thử lại.":
    {
      en: "The result is not yet confirmed. Reload the list and check the account before trying again.",
    },
  "Không thể hoàn tất yêu cầu. Vui lòng thử lại.": {
    en: "Could not complete the request. Please try again.",
  },
  "Mã tài khoản không hợp lệ": { en: "Invalid account ID" },
  "Phân trang không hợp lệ": { en: "Invalid page selection" },
  "Từ khóa tối đa 100 ký tự": {
    en: "Search text must be no longer than 100 characters",
  },
  "Trạng thái không hợp lệ": { en: "Invalid status" },
  "Vai trò không hợp lệ": { en: "Invalid role" },
  "Mật khẩu phải có ít nhất 12 ký tự": {
    en: "The password must contain at least 12 characters",
  },
  "Mật khẩu không được vượt quá 72 byte UTF-8": {
    en: "The password must be no longer than 72 UTF-8 bytes. Accented characters may use more than one byte.",
    vi: "Mật khẩu quá dài, tối đa 72 byte UTF-8. Ký tự có dấu có thể chiếm nhiều byte.",
  },
  "Lý do phải có từ 5 đến 500 ký tự": {
    en: "The reason must contain between 5 and 500 characters",
  },
  "Họ tên phải có từ 2 đến 160 ký tự": {
    en: "The full name must contain between 2 and 160 characters",
  },
  "Email không hợp lệ": { en: "Enter a valid email address" },
  "Cần thay đổi họ tên hoặc vai trò": {
    en: "Change the full name or role before saving",
  },
  "Vui lòng nhập lý do tối thiểu 3 ký tự": {
    en: "Enter a reason with at least 3 characters",
  },
  "Phiên đăng nhập đã thay đổi, vui lòng thử lại": {
    en: "Your sign-in session has changed. Please try again.",
  },
  "Mật khẩu ban đầu là bắt buộc": { en: "An initial password is required" },
  "Cần đầy đủ thông tin quản trị viên đầu tiên": {
    en: "Enter all details for the first administrator",
  },
  "Trình duyệt không hỗ trợ tạo khóa retry an toàn": {
    en: "This browser cannot prepare a secure request. Use an updated browser and try again.",
    vi: "Trình duyệt không thể tạo yêu cầu an toàn. Hãy dùng trình duyệt mới hơn rồi thử lại.",
  },
  "Trình duyệt không hỗ trợ tạo khóa đăng ký an toàn": {
    en: "This browser cannot prepare a secure registration request. Use an updated browser and try again.",
    vi: "Trình duyệt không thể tạo yêu cầu đăng ký an toàn. Hãy dùng trình duyệt mới hơn rồi thử lại.",
  },
  "Mã operation trả về không khớp yêu cầu đối soát": {
    en: "The response does not match this verification request. Reload before continuing.",
    vi: "Phản hồi không khớp với yêu cầu kiểm tra. Hãy tải lại trước khi tiếp tục.",
  },
  "Mã operation trả về không khớp khóa retry": {
    en: "The response does not match this request. Reload and check the organization before trying again.",
    vi: "Phản hồi không khớp với yêu cầu. Hãy tải lại và kiểm tra tổ chức trước khi thử lại.",
  },
  "Workspace đang ở chế độ chỉ đọc": {
    en: "This workspace is read-only",
    vi: "Không gian làm việc đang ở chế độ chỉ đọc",
  },
  "Workspace đang ở chế độ chỉ đọc.": {
    en: "This workspace is read-only.",
    vi: "Không gian làm việc đang ở chế độ chỉ đọc.",
  },
  "Workspace hiện không cho phép thay đổi thông báo": {
    en: "Announcements cannot be changed in this workspace right now",
    vi: "Không gian làm việc hiện không cho phép thay đổi thông báo",
  },
  "Workspace hiện không cho phép thay đổi lớp học": {
    en: "Classes cannot be changed in this workspace right now",
    vi: "Không gian làm việc hiện không cho phép thay đổi lớp học",
  },
  "Workspace hiện không cho phép lưu trữ lớp học": {
    en: "Classes cannot be archived in this workspace right now",
    vi: "Không gian làm việc hiện không cho phép lưu trữ lớp học",
  },
  "Workspace hiện không cho phép thay đổi lịch học": {
    en: "Class schedules cannot be changed in this workspace right now",
    vi: "Không gian làm việc hiện không cho phép thay đổi lịch học",
  },
  "Workspace hiện không cho phép hủy buổi học": {
    en: "Class sessions cannot be canceled in this workspace right now",
    vi: "Không gian làm việc hiện không cho phép hủy buổi học",
  },
  "Workspace hiện không cho phép lưu điểm danh": {
    en: "Attendance cannot be saved in this workspace right now",
    vi: "Không gian làm việc hiện không cho phép lưu điểm danh",
  },
  "Hãy chọn trạng thái cho ít nhất một học viên": {
    en: "Select an attendance status for at least one learner",
  },
  "Chỉ quản trị viên có thể thêm học viên vào lớp": {
    en: "Only administrators can add learners to a class",
  },
  "Chỉ quản trị viên có thể rút học viên khỏi lớp": {
    en: "Only administrators can withdraw learners from a class",
  },
  "Tài khoản này không thể thay đổi phân quyền chi nhánh": {
    en: "Your account cannot change branch access permissions",
  },
  "Tài khoản này không thể thu hồi phân quyền chi nhánh": {
    en: "Your account cannot revoke branch access permissions",
  },
  "Policy ghi đè phải là JSON hợp lệ": {
    en: "Policy overrides must use valid JSON",
    vi: "Cấu hình chính sách ghi đè phải có định dạng JSON hợp lệ",
  },
  "Policy ghi đè phải là một object JSON": {
    en: "Policy overrides must be a JSON object",
    vi: "Cấu hình chính sách ghi đè phải là một đối tượng JSON",
  },
  "Số tiền phải là số nguyên VND lớn hơn 0": {
    en: "Enter a whole-number amount in VND greater than zero",
  },
  "Số tiền thanh toán vượt số dư hóa đơn": {
    en: "The payment amount exceeds the invoice balance",
  },
  "Ngày đến hạn không hợp lệ": { en: "Invalid due date" },
  "Ngày thanh toán không hợp lệ": { en: "Invalid payment date" },
  "Bạn không có quyền cập nhật bài tập trong workspace này": {
    en: "You do not have permission to update assignments in this workspace",
    vi: "Bạn không có quyền cập nhật bài tập trong không gian làm việc này",
  },
  "Bạn không có quyền lưu trữ bài tập trong workspace này": {
    en: "You do not have permission to archive assignments in this workspace",
    vi: "Bạn không có quyền lưu trữ bài tập trong không gian làm việc này",
  },
  "Module Tài liệu riêng tư phải hoạt động để lưu bài tập nhận tệp.": {
    en: "Enable the Private Documents module before saving an assignment that accepts files.",
    vi: "Cần bật chức năng Tài liệu riêng tư để lưu bài tập nhận tệp.",
  },
  "Chỉ có thể công bố bài tập khi khóa học đang mở": {
    en: "Assignments can only be published in a published course",
  },
  "Workspace hiện không cho phép cập nhật tệp bản nháp.": {
    en: "Draft files cannot be updated in this workspace right now.",
    vi: "Không gian làm việc hiện không cho phép cập nhật tệp bản nháp.",
  },
  "Workspace hiện không cho phép trả lại bài nộp.": {
    en: "Submissions cannot be returned in this workspace right now.",
    vi: "Không gian làm việc hiện không cho phép trả lại bài nộp.",
  },
  "Bật module Tài liệu riêng tư trước khi trả lại bài nhận tệp.": {
    en: "Enable the Private Documents module before returning a file submission.",
    vi: "Hãy bật chức năng Tài liệu riêng tư trước khi trả lại bài nhận tệp.",
  },
  "Workspace hiện không cho phép lưu kết quả chấm bài.": {
    en: "Grading results cannot be saved in this workspace right now.",
    vi: "Không gian làm việc hiện không cho phép lưu kết quả chấm bài.",
  },
  "Workspace hoặc khóa học hiện không cho phép chỉnh sửa.": {
    en: "This workspace or course does not currently allow editing.",
    vi: "Không gian làm việc hoặc khóa học hiện không cho phép chỉnh sửa.",
  },
  "Chương chỉ có thể được công bố trong khóa học đang công bố.": {
    en: "Chapters can only be published in a published course.",
  },
  "Workspace hoặc chương hiện không cho phép lưu trữ.": {
    en: "This workspace or chapter does not currently allow archiving.",
    vi: "Không gian làm việc hoặc chương hiện không cho phép lưu trữ.",
  },
  "Bài học chỉ có thể được công bố trong chương và khóa học đang công bố.": {
    en: "Lessons can only be published when both their chapter and course are published.",
  },
  "Workspace hoặc bài học hiện không cho phép lưu trữ.": {
    en: "This workspace or lesson does not currently allow archiving.",
    vi: "Không gian làm việc hoặc bài học hiện không cho phép lưu trữ.",
  },
  "Workspace hiện không cho phép cập nhật tiến độ học tập.": {
    en: "Learning progress cannot be updated in this workspace right now.",
    vi: "Không gian làm việc hiện không cho phép cập nhật tiến độ học tập.",
  },
  "Workspace, khóa học hoặc chương hiện không cho phép chỉnh sửa.": {
    en: "This workspace, course, or chapter does not currently allow editing.",
    vi: "Không gian làm việc, khóa học hoặc chương hiện không cho phép chỉnh sửa.",
  },
  "Workspace, khóa học hoặc bài học hiện không cho phép cập nhật tệp.": {
    en: "Files cannot currently be updated in this workspace, course, or lesson.",
    vi: "Không gian làm việc, khóa học hoặc bài học hiện không cho phép cập nhật tệp.",
  },
  "Không tìm thấy bài học hiện tại.": {
    en: "The current lesson could not be found.",
  },
  "Đã vô hiệu hóa tài khoản trên toàn hệ thống. Các phiên đăng nhập cũ đã bị thu hồi.":
    {
      en: "Account disabled across the platform. Previous sign-in sessions have been revoked.",
    },
  "Đã khôi phục tài khoản. Người dùng cần đăng nhập lại để tiếp tục.": {
    en: "Account restored. The user must sign in again to continue.",
  },
  "Vui lòng kiểm tra các trường được đánh dấu trước khi lưu thành viên": {
    en: "Check the highlighted fields before saving the member",
  },
  "Không thể nhập danh sách lời mời. Vui lòng thử lại.": {
    en: "Could not import the invitation list. Please try again.",
  },
  "Không thể đọc tệp CSV. Hãy chọn lại tệp hoặc dán nội dung trực tiếp.": {
    en: "Could not read the CSV file. Select the file again or paste its contents directly.",
  },
  "Chưa có liên kết lời mời thành công để sao chép": {
    en: "There are no successful invitation links to copy yet",
  },
  "Trình duyệt không cho phép sao chép. Hãy tải CSV kết quả để lưu liên kết mời.":
    {
      en: "Your browser blocked copying. Download the results CSV to save the invitation links.",
    },
  "Đã cập nhật bài học": { en: "Lesson updated" },
  "Không thể cập nhật bài học": { en: "Could not update the lesson" },
  "Không thể công bố bài học": { en: "Could not publish the lesson" },
  "Không thể lưu trữ bài học": { en: "Could not archive the lesson" },
  "Đã cập nhật tệp đính kèm của bài học": { en: "Lesson attachments updated" },
  "Không thể cập nhật tệp đính kèm của bài học": {
    en: "Could not update the lesson attachments",
  },
  "Đã đánh dấu bài học hoàn thành": { en: "Lesson marked as complete" },
  "Đã bỏ đánh dấu hoàn thành bài học": { en: "Lesson completion mark removed" },
  "Không thể cập nhật tiến độ bài học": {
    en: "Could not update lesson progress",
  },
  "Chưa gửi được yêu cầu": { en: "Your request has not been sent" },
  "Kênh liên hệ đang được hoàn thiện nên thông tin chưa được gửi hoặc lưu. Bạn có thể tạo workspace dùng thử ngay.":
    {
      en: "The contact channel is still being set up, so your information has not been sent or saved. You can create a trial workspace now.",
      vi: "Kênh liên hệ đang được hoàn thiện nên thông tin chưa được gửi hoặc lưu. Bạn có thể tạo không gian làm việc dùng thử ngay.",
    },
  "Tạo workspace dùng thử": {
    en: "Create a trial workspace",
    vi: "Tạo không gian làm việc dùng thử",
  },
  "Hạn thanh toán không hợp lệ": { en: "Invalid payment due date" },
  "Thời điểm thanh toán không hợp lệ": { en: "Invalid payment date and time" },
  "Tên bài kiểm tra phải có từ 2 đến 200 ký tự.": {
    en: "The assessment title must contain between 2 and 200 characters.",
  },
  "Hướng dẫn vượt quá giới hạn 20.000 ký tự.": {
    en: "Instructions exceed the 20,000-character limit.",
  },
  "Thời điểm mở không hợp lệ.": { en: "Invalid opening date and time." },
  "Thời điểm đóng không hợp lệ.": { en: "Invalid closing date and time." },
  "Thời điểm mở phải trước thời điểm đóng.": {
    en: "The opening time must be before the closing time.",
  },
  "Thời lượng phải từ 1 đến 180 phút.": {
    en: "The time limit must be between 1 and 180 minutes.",
  },
  "Số lượt làm phải từ 1 đến 5.": {
    en: "The number of attempts must be between 1 and 5.",
  },
  "Điểm đạt phải là số nguyên từ 0 đến 100%.": {
    en: "The passing score must be a whole percentage from 0 to 100%.",
  },
  "Chính sách công bố sau khi đóng yêu cầu thời điểm đóng.": {
    en: "Set a closing time to release results after the assessment closes.",
  },
  "Bài kiểm tra phải có từ 1 đến 50 câu hỏi.": {
    en: "The assessment must contain between 1 and 50 questions.",
  },
  "Tổng điểm không được vượt quá 10.000.": {
    en: "The total score must not exceed 10,000.",
  },
};

const translations = new Map<string, { vi: string; en: string }>();
for (const [source, copy] of Object.entries(catalog)) {
  const entry = { vi: copy.vi ?? source, en: copy.en };
  translations.set(source, entry);
  translations.set(entry.vi, entry);
  translations.set(entry.en, entry);
}

const paymentStatuses = [
  ["Đã thanh toán", "Paid"],
  ["Đã hủy", "Canceled"],
  ["Đã hết hạn", "Expired"],
  ["Cần đối soát", "Needs review"],
  ["Cần hoàn tiền", "Refund required"],
  ["Đang chờ", "Pending"],
] as const;
for (const [vi, en] of paymentStatuses) {
  const copy = {
    vi: `Đã cập nhật đơn thanh toán sang trạng thái “${vi}”`,
    en: `Payment order status changed to “${en}”`,
  };
  translations.set(copy.vi, copy);
  translations.set(copy.en, copy);
}

interface CountTemplate {
  vi: RegExp;
  en: RegExp;
  formatVi: (count: string) => string;
  formatEn: (count: string, singular: boolean) => string;
}

const countTemplates: CountTemplate[] = [
  {
    vi: /^Đã lưu điểm danh (\d+(?:\.\d{3})*) học viên$/,
    en: /^Attendance saved for (\d+(?:,\d{3})*) learners?$/,
    formatVi: (count) => `Đã lưu điểm danh ${count} học viên`,
    formatEn: (count, singular) =>
      `Attendance saved for ${count} ${singular ? "learner" : "learners"}`,
  },
  {
    vi: /^Đã thêm (\d+(?:\.\d{3})*) học viên vào lớp$/,
    en: /^(\d+(?:,\d{3})*) learners? added to the class$/,
    formatVi: (count) => `Đã thêm ${count} học viên vào lớp`,
    formatEn: (count, singular) =>
      `${count} ${singular ? "learner" : "learners"} added to the class`,
  },
  {
    vi: /^Đã tạo (\d+(?:\.\d{3})*) lời mời$/,
    en: /^(\d+(?:,\d{3})*) invitations? created$/,
    formatVi: (count) => `Đã tạo ${count} lời mời`,
    formatEn: (count, singular) =>
      `${count} ${singular ? "invitation" : "invitations"} created`,
  },
  {
    vi: /^Không tạo được (\d+(?:\.\d{3})*) lời mời\. Hãy xem chi tiết từng dòng trước khi thử lại\.$/,
    en: /^Could not create (\d+(?:,\d{3})*) invitations?\. Check each row before trying again\.$/,
    formatVi: (count) =>
      `Không tạo được ${count} lời mời. Hãy xem chi tiết từng dòng trước khi thử lại.`,
    formatEn: (count, singular) =>
      `Could not create ${count} ${singular ? "invitation" : "invitations"}. Check each row before trying again.`,
  },
  {
    vi: /^Bài học chỉ được đính kèm tối đa (\d+) tệp\.$/,
    en: /^A lesson can have up to (\d+) attachments?\.$/,
    formatVi: (count) => `Bài học chỉ được đính kèm tối đa ${count} tệp.`,
    formatEn: (count, singular) =>
      `A lesson can have up to ${count} ${singular ? "attachment" : "attachments"}.`,
  },
  {
    vi: /^Bài làm chỉ được đính kèm tối đa (\d+) tệp\.$/,
    en: /^A submission can have up to (\d+) attachments?\.$/,
    formatVi: (count) => `Bài làm chỉ được đính kèm tối đa ${count} tệp.`,
    formatEn: (count, singular) =>
      `A submission can have up to ${count} ${singular ? "attachment" : "attachments"}.`,
  },
  {
    vi: /^Bản nháp nhận tệp phải có từ 1 đến (\d+) tệp không trùng lặp\.$/,
    en: /^A file submission draft must contain between 1 and (\d+) unique files\.$/,
    formatVi: (count) =>
      `Bản nháp nhận tệp phải có từ 1 đến ${count} tệp không trùng lặp.`,
    formatEn: (count) =>
      `A file submission draft must contain between 1 and ${count} unique files.`,
  },
];

const partialImportVi =
  /^Đã tạo (\d+(?:\.\d{3})*) lời mời; (\d+(?:\.\d{3})*) lời mời chưa tạo được\. Hãy xem chi tiết từng dòng trước khi thử lại\.$/;
const partialImportEn =
  /^(\d+(?:,\d{3})*) invitations? created; (\d+(?:,\d{3})*) invitations? could not be created\. Check each row before trying again\.$/;

// Only numeric question/choice indexes are substituted; user-entered content
// never becomes part of a trusted translation template.
const numberedTemplates = [
  [
    "Câu {0} có mã không hợp lệ hoặc bị trùng.",
    "Question {0} has an invalid or duplicate ID.",
  ],
  [
    "Nội dung câu {0} đang trống hoặc vượt giới hạn.",
    "Question {0} is empty or exceeds the length limit.",
  ],
  [
    "Điểm của câu {0} phải là số nguyên dương.",
    "The points for question {0} must be a positive whole number.",
  ],
  [
    "Câu {0} phải có từ 2 đến 8 lựa chọn.",
    "Question {0} must have between 2 and 8 choices.",
  ],
  [
    "Lựa chọn {0} của câu {1} có mã bị trùng.",
    "Choice {0} in question {1} has a duplicate ID.",
  ],
  [
    "Lựa chọn {0} của câu {1} đang trống hoặc vượt giới hạn.",
    "Choice {0} in question {1} is empty or exceeds the length limit.",
  ],
  [
    "Đáp án đúng của câu {0} không hợp lệ.",
    "The correct answer for question {0} is invalid.",
  ],
  [
    "Câu {0} phải có đúng một đáp án đúng.",
    "Question {0} must have exactly one correct answer.",
  ],
  [
    "Câu {0} phải có ít nhất hai đáp án đúng và một đáp án sai.",
    "Question {0} must have at least two correct answers and one incorrect answer.",
  ],
].map(([vi, en]) => {
  const pattern = (value: string) =>
    new RegExp(
      `^${value
        .split(/\{\d+\}/)
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("([1-9]\\d?)")}$`,
    );
  return { vi, en, viPattern: pattern(vi), enPattern: pattern(en) };
});

function numberedCopy(text: string): { vi: string; en: string } | undefined {
  for (const template of numberedTemplates) {
    const match =
      template.viPattern.exec(text) ?? template.enPattern.exec(text);
    if (!match) continue;
    const format = (copy: string) =>
      copy.replace(
        /\{(\d+)\}/g,
        (_placeholder, index: string) => match[Number(index) + 1],
      );
    return { vi: format(template.vi), en: format(template.en) };
  }
}

function validCount(value: string): number | null {
  const number = Number(value.replace(/[.,]/g, ""));
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

/** True only for reviewed literals and tightly bounded, known templates. */
export function isKnownFeedbackText(text: string): boolean {
  if (/[\u0000-\u001f\u007f]/.test(text)) return false;
  if (translations.has(text)) return true;
  if (numberedCopy(text)) return true;
  const partialImport =
    partialImportVi.exec(text) ?? partialImportEn.exec(text);
  if (partialImport)
    return (
      validCount(partialImport[1]) !== null &&
      validCount(partialImport[2]) !== null
    );
  return countTemplates.some((template) => {
    const match = template.vi.exec(text) ?? template.en.exec(text);
    return Boolean(match && validCount(match[1]) !== null);
  });
}

/** Returns reviewed bilingual copy, preserving unknown text for the caller. */
export function translateFeedbackText(
  text: string,
  locale: FeedbackLocale,
  // Reserved for contextual translations; sanitizing errors belongs to the caller.
  kind?: FeedbackKind,
): string {
  void kind;
  if (/[\u0000-\u001f\u007f]/.test(text)) return text;
  const copy = translations.get(text);
  if (copy) return copy[locale];
  const numbered = numberedCopy(text);
  if (numbered) return numbered[locale];
  const partialVi = partialImportVi.exec(text);
  const partialEn = partialVi ? null : partialImportEn.exec(text);
  const partial = partialVi ?? partialEn;
  if (partial) {
    const successful = validCount(partial[1]);
    const failed = validCount(partial[2]);
    if (successful === null || failed === null) return text;
    if (locale === "vi" && partialVi) return text;
    const numberLocale = locale === "vi" ? "vi-VN" : "en-US";
    const successCount = successful.toLocaleString(numberLocale);
    const failedCount = failed.toLocaleString(numberLocale);
    return locale === "vi"
      ? `Đã tạo ${successCount} lời mời; ${failedCount} lời mời chưa tạo được. Hãy xem chi tiết từng dòng trước khi thử lại.`
      : `${successCount} ${successful === 1 ? "invitation" : "invitations"} created; ${failedCount} ${failed === 1 ? "invitation" : "invitations"} could not be created. Check each row before trying again.`;
  }
  for (const template of countTemplates) {
    const viMatch = template.vi.exec(text);
    const enMatch = viMatch ? null : template.en.exec(text);
    const match = viMatch ?? enMatch;
    if (!match) continue;
    const number = validCount(match[1]);
    if (number === null) return text;
    // Existing Vietnamese number formatting is preserved. English gets its own
    // grouping and plural rules rather than copying locale-specific punctuation.
    if (locale === "vi" && viMatch) return text;
    const count = number.toLocaleString(locale === "vi" ? "vi-VN" : "en-US");
    return locale === "vi"
      ? template.formatVi(count)
      : template.formatEn(count, number === 1);
  }
  return text;
}
