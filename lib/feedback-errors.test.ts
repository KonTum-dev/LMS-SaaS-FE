import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { describeFeedbackError } from "./feedback-errors";

describe("safe bilingual API feedback", () => {
  it.each([0, 200, 408, 500, 503, 504])("describes HTTP %s read failures without write-uncertainty warnings", (status) => {
    for (const requestMethod of ["GET", "HEAD"]) {
      const error = Object.assign(new ApiError("secret=must-not-display", status), { requestMethod });
      expect(describeFeedbackError(error, "vi")).toEqual({
        message: "Chưa tải được dữ liệu. Hãy kiểm tra kết nối rồi thử lại.", uncertain: false,
      });
      expect(describeFeedbackError(error, "en")).toEqual({
        message: "Could not load the data. Check your connection and try again.", uncertain: false,
      });
    }
  });

  it.each(["POST", "PATCH", "DELETE", undefined])("preserves uncertain write outcomes for %s", (requestMethod) => {
    const error = Object.assign(new ApiError("Unavailable", 503), { requestMethod });
    expect(describeFeedbackError(error, "en").uncertain).toBe(true);
    expect(describeFeedbackError(error, "en").message).toContain("avoid duplicate changes");
  });

  it("keeps explicit reconciliation warnings even on a read request", () => {
    const error = Object.assign(new ApiError("Unavailable", 503, "PLAN_AUDIT_PENDING"), { requestMethod: "GET" });
    expect(describeFeedbackError(error, "en").uncertain).toBe(true);
    expect(describeFeedbackError(error, "en").message).toContain("do not submit it again");
  });

  it.each([
    [
      "ACCOUNT_EMAIL_EXISTS",
      "Email này đã được sử dụng",
      "This email is already in use",
    ],
    [
      "ACCOUNT_SELF_MUTATION_FORBIDDEN",
      "Bạn không thể tự",
      "You cannot disable your own",
    ],
    [
      "LAST_PLATFORM_ADMIN",
      "ít nhất một quản trị viên nền tảng",
      "At least one active platform administrator",
    ],
    [
      "LAST_TENANT_ADMIN",
      "ít nhất một quản trị viên",
      "at least one active administrator",
    ],
    ["ACCOUNT_HAS_TENANT_MEMBERSHIPS", "tài khoản độc lập", "separate account"],
    ["TRIAL_PLAN_PROTECTED", "gói dùng thử thay thế", "replacement trial plan"],
    ["PLAN_REPAIR_REQUIRED", "các tính năng phụ thuộc", "feature dependencies"],
    [
      "PLAN_ENTITLEMENTS_MISSING",
      "cấu hình quyền lợi",
      "configured entitlements",
    ],
    [
      "INVALID_MODULE_DEPENDENCIES",
      "tính năng phụ thuộc",
      "required dependencies",
    ],
    ["IDENTITY_EXISTS_USE_INVITATION", "gửi lời mời", "Send an invitation"],
    ["INVITATION_EMAIL_MISMATCH", "email được mời", "invited email"],
    ["INVITATION_EXPIRED", "lời mời mới", "new one"],
    [
      "WORKSPACE_ACCESS_DENIED",
      "chọn không gian khác",
      "Choose another workspace",
    ],
    ["PASSWORD_INVALID", "8 ký tự", "8 characters"],
    ["CURRENT_PASSWORD_INVALID", "Mật khẩu hiện tại", "current password"],
    ["PASSWORD_RESET_TOKEN_INVALID", "liên kết mới", "new link"],
    ["PUBLIC_SIGNUP_DISABLED", "đang tạm dừng", "temporarily paused"],
    ["ADMIN_EMAIL_CONFLICT", "Email quản trị viên", "administrator email"],
    ["TENANT_SLUG_CONFLICT", "đường dẫn khác", "another URL"],
    ["GOOGLE_LOGIN_DISABLED", "email và mật khẩu", "email and password"],
    ["GOOGLE_EMAIL_MISMATCH", "chọn đúng tài khoản", "matching Google account"],
    ["SUBSCRIPTION_READ_ONLY", "chỉ đọc", "read-only"],
    ["DOWNGRADE_QUOTA_EXCEEDED", "vượt giới hạn", "exceeds the selected"],
    ["RENEWAL_ENTITLEMENTS_CHANGED", "trước khi thanh toán", "before paying"],
  ])("localizes %s independently of server prose", (code, vi, en) => {
    const error = new ApiError(
      "raw database error password=do-not-show",
      409,
      code,
    );
    expect(describeFeedbackError(error, "vi").message).toContain(vi);
    expect(describeFeedbackError(error, "en").message).toContain(en);
    expect(describeFeedbackError(error, "en").message).not.toContain(
      "do-not-show",
    );
    expect(describeFeedbackError(error, "en").uncertain).toBe(false);
  });

  it.each([
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
  ])(
    "keeps an uncertain %s write distinct from a confirmed failure",
    (code) => {
      for (const locale of ["vi", "en"] as const) {
        const result = describeFeedbackError(
          new ApiError("failure", 503, code),
          locale,
          "Failed to save",
        );
        expect(result.uncertain).toBe(true);
        expect(result.message).not.toContain("Failed to save");
        expect(result.message).not.toContain("failure");
      }
    },
  );

  it.each(["ACCOUNT_AUDIT_PENDING", "PLAN_AUDIT_PENDING"])(
    "instructs users not to resubmit %s",
    (code) => {
      expect(describeFeedbackError({ code }, "en").message).toMatch(
        /Refresh.*do not submit it again/,
      );
      expect(describeFeedbackError({ code }, "vi").message).toMatch(
        /tải lại.*không gửi lại/,
      );
    },
  );

  it.each([
    new ApiError("Máy chủ phản hồi quá lâu, vui lòng thử lại", 0),
    new ApiError("Không thể kết nối tới máy chủ", 0),
    new ApiError("Máy chủ trả dữ liệu không hợp lệ", 200),
    new ApiError("invalid payload", 200, "ADMIN_ACCOUNTS_RESPONSE_INVALID"),
    new ApiError("internal failure", 500),
    new ApiError("gateway timeout", 504),
    new ApiError("request timeout", 408),
    new TypeError("Failed to fetch"),
    new DOMException("operation cancelled", "AbortError"),
    new DOMException("too slow", "TimeoutError"),
  ])(
    "handles transport/response uncertainty without recommending blind retries %#",
    (error) => {
      const en = describeFeedbackError(error, "en", "Could not create account");
      const vi = describeFeedbackError(error, "vi");
      expect(en.uncertain).toBe(true);
      expect(en.message).toMatch(/Refresh and check.*before retrying/);
      expect(en.message).not.toContain("Could not create account");
      expect(vi.message).toContain("kiểm tra dữ liệu trước khi thử lại");
    },
  );

  it.each([
    [401, "đăng nhập lại", "sign in again"],
    [403, "không có quyền", "do not have permission"],
    [404, "Không tìm thấy", "not found"],
    [410, "Không tìm thấy", "not found"],
    [409, "vừa được thay đổi", "data has changed"],
    [400, "Thông tin chưa hợp lệ", "Some details are invalid"],
    [422, "Thông tin chưa hợp lệ", "Some details are invalid"],
    [429, "quá nhanh", "Too many requests"],
  ])("provides action-oriented HTTP %s fallback", (status, vi, en) => {
    const error = new ApiError(
      "<script>dangerous database stack</script>",
      status,
    );
    expect(describeFeedbackError(error, "vi").message).toContain(vi);
    expect(describeFeedbackError(error, "en").message).toContain(en);
    expect(describeFeedbackError(error, "en").uncertain).toBe(false);
  });

  it("distinguishes incorrect sign-in credentials from an expired session", () => {
    const error = new ApiError("Email hoặc mật khẩu không chính xác", 401);
    expect(describeFeedbackError(error, "en").message).toContain(
      "email or password is incorrect",
    );
    expect(describeFeedbackError(error, "vi").message).toContain(
      "quên mật khẩu",
    );
  });

  it("does not mutate status, code, operationId, retry-after or message", () => {
    const error = Object.freeze(
      new ApiError(
        "Original message",
        409,
        "TENANT_PROVISIONING_IN_PROGRESS",
        "64b000000000000000000001",
        12,
      ),
    );
    const snapshot = { ...error };
    expect(describeFeedbackError(error, "en").message).toContain(
      "Please wait 12 seconds",
    );
    expect(describeFeedbackError(error, "vi").message).toContain("chờ 12 giây");
    expect({ ...error }).toEqual(snapshot);
    expect(error.message).toBe("Original message");
  });

  it.each([0, -1, 301, Infinity, NaN, "3", 1.5])(
    "ignores invalid retry delay %s",
    (retryAfterSeconds) => {
      const result = describeFeedbackError(
        { status: 429, retryAfterSeconds },
        "en",
      );
      expect(result.message).not.toContain("seconds");
    },
  );

  it("renders rate limiting when the server supplies the stable auth code", () => {
    expect(
      describeFeedbackError(
        { code: "AUTH_RATE_LIMITED", retryAfterSeconds: 3 },
        "en",
      ).message,
    ).toContain("Please wait 3 seconds");
  });

  it("localizes a Nest validation array without echoing submitted values", () => {
    const error = {
      statusCode: 400,
      message: [
        "email must be an email",
        "fullName must be longer than or equal to 2 characters",
        "reason must be shorter than or equal to 500 characters",
        "page must not be less than 1",
        "limit must not be greater than 100",
      ],
    };
    expect(describeFeedbackError(error, "en")).toEqual({
      uncertain: false,
      message:
        "Email: enter a valid email address. Full name: at least 2 characters. Reason: at most 500 characters. Page: at least 1. Page size: at most 100.",
    });
    expect(describeFeedbackError(error, "vi").message).toContain(
      "Họ tên: ít nhất 2 ký tự.",
    );
  });

  it("handles joined apiFetch validation messages, nested fields and deduplication", () => {
    const result = describeFeedbackError(
      new ApiError(
        "email must be an email. admin.fullName should not be empty. email must be an email",
        400,
      ),
      "en",
    );
    expect(result.message).toBe(
      "Email: enter a valid email address. Administrator name: this field is required.",
    );
  });

  it.each([
    ["name must be a string", "Name: enter text."],
    ["tier must be an integer number", "Plan tier: enter a valid number."],
    ["active must be a boolean value", "Active status: select on or off."],
    [
      "status must be one of the following values: ACTIVE, INACTIVE",
      "Status: select a valid option.",
    ],
  ])("translates validation rule %s", (message, expected) => {
    expect(
      describeFeedbackError(new ApiError(message, 422), "en").message,
    ).toBe(expected);
  });

  it.each([
    "Error: password=secret-pass at account.ts:10",
    "MongoServerError: E11000 duplicate key passwordHash=$2b$my-secret",
    "<img src=x onerror=alert(1)>",
    "mongodb://root:credential@example.test/db",
    "Bearer eyJhbGciOiJIUzI1NiJ9.secret.signature",
    "email must be an email: user-secret@example.test",
    "unknownField must be an email",
    "reason must be longer than or equal to secret characters",
  ])("never displays unknown backend text: %s", (message) => {
    for (const status of [400, 409, 500]) {
      const result = describeFeedbackError(
        new ApiError(message, status, "UNKNOWN_CODE"),
        "en",
      );
      expect(result.message).not.toContain(message);
      expect(result.message).not.toContain("credential");
      expect(result.message).not.toContain("secret");
      expect(result.message).not.toContain("<img");
    }
  });

  it("ignores malicious entries beside a valid validation field", () => {
    const message = [
      "email must be an email",
      "passwordHash must be a string",
      "secret: abcd",
      "fullName must be shorter than or equal to 160 characters\nBearer fake",
    ];
    expect(describeFeedbackError({ status: 400, message }, "en").message).toBe(
      "Email: enter a valid email address.",
    );
  });

  it.each([
    undefined,
    null,
    17,
    "raw failure",
    {},
    { message: { password: "secret" } },
    { code: "__proto__" },
    { code: "constructor" },
  ])("safely handles unknown input %#", (error) => {
    expect(describeFeedbackError(error, "en").message).toBe(
      "We could not complete the request. Check the details and try again.",
    );
  });

  it("uses an explicitly localized application-owned fallback for an unknown error", () => {
    expect(
      describeFeedbackError(
        new Error("unexpected raw response"),
        "en",
        "Could not load the account list.",
      ),
    ).toEqual({
      message: "Could not load the account list.",
      uncertain: false,
    });
    expect(
      describeFeedbackError(
        { status: 400, code: "ADMIN_ACCOUNTS_INPUT_INVALID" },
        "vi",
        "Hãy kiểm tra họ tên và lý do.",
      ).message,
    ).toBe("Hãy kiểm tra họ tên và lý do.");
  });

  it.each([
    "Error: private stack",
    "secret=private",
    "access_token=private",
    "mongodb://root:private@host/db",
    "<b>unsafe</b>",
    "Bearer abcdef",
    "x".repeat(501),
  ])("rejects an accidentally unsafe fallback %s", (fallback) => {
    expect(describeFeedbackError({}, "en", fallback).message).toBe(
      "We could not complete the request. Check the details and try again.",
    );
  });

  it("does not mislabel a known configuration error as a network outcome", () => {
    const result = describeFeedbackError(
      new ApiError("Thiếu cấu hình NEXT_PUBLIC_API_URL", 0),
      "en",
    );
    expect(result.uncertain).toBe(false);
    expect(result.message).toContain("not configured");
  });

  it("preserves the distinct account creation and normal password policies", () => {
    expect(
      describeFeedbackError({ code: "PASSWORD_INVALID" }, "en").message,
    ).toContain("8 characters");
    expect(
      describeFeedbackError(
        new ApiError(
          "Mật khẩu phải có ít nhất 12 ký tự",
          400,
          "ADMIN_ACCOUNTS_INPUT_INVALID",
        ),
        "en",
      ).message,
    ).toContain("12 characters");
    expect(
      describeFeedbackError(
        new ApiError("password must not exceed 72 UTF-8 bytes", 400),
        "en",
      ).message,
    ).toBe(
      "Password: at most 72 UTF-8 bytes; accented characters may use more than one byte.",
    );
  });

  it("explains application-owned account validation without showing backend payloads", () => {
    const inputError = new ApiError(
      "Lý do phải có từ 5 đến 500 ký tự",
      400,
      "ADMIN_ACCOUNTS_INPUT_INVALID",
    );
    expect(describeFeedbackError(inputError, "en").message).toContain(
      "reason must have 5 to 500 characters",
    );
    expect(describeFeedbackError(inputError, "vi").message).toContain(
      "Lý do cần từ 5 đến 500 ký tự",
    );
  });
});
