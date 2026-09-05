/** Copy shared only by tenant-account creation and guardian linking. */
export const userCreationMessages: Readonly<Record<string, string>> = {
  "Mật khẩu cần ít nhất 12 ký tự": "Use at least 12 characters",
  "Mật khẩu không được vượt quá 72 byte UTF-8":
    "The password must not exceed 72 UTF-8 bytes",
  "Tạo tài khoản mới cho tổ chức này. Nếu email đã có tài khoản DX LMS, hãy dùng Gửi lời mời.":
    "Create a new account for this organization. If the email already has a DX LMS account, use Send invitation.",
  "Với phụ huynh, chọn vai trò Phụ huynh rồi liên kết với học viên để cấp quyền xem thông tin.":
    "For a parent, choose the Guardian role, then link the account to a learner to grant access to their information.",
  "Liên kết phụ huynh – học viên": "Link guardians and learners",
  "Tài khoản phụ huynh": "Guardian accounts",
  "Tạo hoặc mời tài khoản có vai trò Phụ huynh trong mục Người dùng, sau đó liên kết với học viên tại đây.":
    "Create or invite an account with the Guardian role under Users, then link it to a learner here.",
  "Tạo hoặc khôi phục quản trị viên, giảng viên, học viên và phụ huynh cho tổ chức này.":
    "Create or restore administrators, instructors, learners and guardians for this organization.",
};
