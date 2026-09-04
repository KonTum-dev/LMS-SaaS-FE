import { describe, expect, it, vi } from "vitest";
import {
  consumePasswordResetToken,
  passwordConfirmationError,
  passwordValidationError,
} from "./password-security";

const validToken = "0123456789abcdef01234567.abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";

describe("password security helpers", () => {
  it("đếm tối thiểu 8 Unicode code points, không dùng UTF-16 units", () => {
    expect(passwordValidationError("1234567")).toBe("Mật khẩu phải có ít nhất 8 ký tự");
    expect(passwordValidationError("😀😀😀😀😀😀😀")).toBe("Mật khẩu phải có ít nhất 8 ký tự");
    expect(passwordValidationError("😀😀😀😀😀😀😀😀")).toBeNull();
  });

  it("giới hạn mật khẩu ở 72 byte UTF-8", () => {
    expect(passwordValidationError("a".repeat(72))).toBeNull();
    expect(passwordValidationError(`${"a".repeat(69)}€`)).toBeNull();
    expect(passwordValidationError(`${"a".repeat(70)}€`)).toBe("Mật khẩu không được vượt quá 72 byte UTF-8");
    expect(passwordValidationError("😀".repeat(19))).toBe("Mật khẩu không được vượt quá 72 byte UTF-8");
  });

  it("xác nhận mật khẩu phải khớp chính xác", () => {
    expect(passwordConfirmationError("NewPassword123", "NewPassword123")).toBeNull();
    expect(passwordConfirmationError("NewPassword123", "newpassword123")).toBe("Mật khẩu xác nhận chưa khớp");
  });

  it("lấy token hợp lệ từ fragment rồi xóa fragment ngay, giữ nguyên query an toàn", () => {
    const replaceState = vi.fn();
    const result = consumePasswordResetToken(
      { hash: `#token=${validToken}`, pathname: "/reset-password", search: "?campaign=welcome" },
      { replaceState, state: { next: 1 } },
    );

    expect(result).toBe(validToken);
    expect(replaceState).toHaveBeenCalledWith({ next: 1 }, "", "/reset-password?campaign=welcome");
  });

  it.each([
    "",
    "#token=invalid",
    `#token=${validToken}&next=%2Fdashboard`,
    `#token=${validToken}&token=${validToken}`,
  ])("từ chối fragment thiếu, sai hoặc nhập nhằng: %s", (hash) => {
    const replaceState = vi.fn();
    expect(consumePasswordResetToken(
      { hash, pathname: "/reset-password", search: "" },
      { replaceState, state: null },
    )).toBeNull();
    expect(replaceState).toHaveBeenCalledTimes(hash ? 1 : 0);
  });

  it("không đọc token từ query string", () => {
    const replaceState = vi.fn();
    expect(consumePasswordResetToken(
      { hash: "", pathname: "/reset-password", search: `?campaign=welcome&token=${validToken}` },
      { replaceState, state: null },
    )).toBeNull();
    expect(replaceState).toHaveBeenCalledWith(null, "", "/reset-password?campaign=welcome");
  });

  it("xóa cả token query nếu fragment hợp lệ", () => {
    const replaceState = vi.fn();
    expect(consumePasswordResetToken(
      {
        hash: `#token=${validToken}`,
        pathname: "/reset-password",
        search: `?Token=${validToken}&campaign=welcome`,
      },
      { replaceState, state: null },
    )).toBe(validToken);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/reset-password?campaign=welcome");
  });

  it("fallback bằng replace navigation để không giữ entry chứa secret trong history", () => {
    const replaceState = vi.fn(() => { throw new DOMException("blocked"); });
    const replace = vi.fn();
    expect(consumePasswordResetToken(
      { hash: `#token=${validToken}`, pathname: "/reset-password", replace, search: "" },
      { replaceState, state: null },
    )).toBeNull();
    expect(replace).toHaveBeenCalledWith("/reset-password");
  });
});
