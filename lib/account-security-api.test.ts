import { beforeEach, describe, expect, it, vi } from "vitest";
import { accountSecurityApi } from "./account-security-api";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));

describe("accountSecurityApi contract", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockResolvedValue(undefined);
  });

  it("gửi yêu cầu quên mật khẩu không kèm bearer", async () => {
    await accountSecurityApi.forgotPassword({ email: "learner@example.com" });

    expect(mocks.apiFetch).toHaveBeenCalledWith("/auth/password/forgot", {
      body: JSON.stringify({ email: "learner@example.com" }),
      method: "POST",
    });
  });

  it.each(["vi", "en"] as const)(
    "sends optional recovery email locale %s in the request body without bearer",
    async (locale) => {
      await accountSecurityApi.forgotPassword({
        email: "learner@example.com",
        locale,
      });

      expect(mocks.apiFetch).toHaveBeenCalledWith("/auth/password/forgot", {
        body: JSON.stringify({ email: "learner@example.com", locale }),
        method: "POST",
      });
    },
  );

  it("gửi reset token đúng body và không đưa token vào URL/header", async () => {
    await accountSecurityApi.resetPassword({
      newPassword: "NewPassword123",
      token: "0123456789abcdef01234567.abcdefghijklmnopqrstuvwxyzABCDEFGH123456789",
    });

    expect(mocks.apiFetch).toHaveBeenCalledWith("/auth/password/reset", {
      body: JSON.stringify({
        newPassword: "NewPassword123",
        token: "0123456789abcdef01234567.abcdefghijklmnopqrstuvwxyzABCDEFGH123456789",
      }),
      method: "POST",
    });
  });

  it("gửi đổi mật khẩu bằng bearer và chỉ hai trường contract", async () => {
    await accountSecurityApi.changePassword(
      { token: "session-token" },
      { currentPassword: "CurrentPassword123", newPassword: "NewPassword123" },
    );

    expect(mocks.apiFetch).toHaveBeenCalledWith("/auth/password/change", {
      body: JSON.stringify({
        currentPassword: "CurrentPassword123",
        newPassword: "NewPassword123",
      }),
      method: "POST",
      token: "session-token",
    });
  });
});
