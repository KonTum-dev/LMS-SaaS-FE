import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOGIN_DESTINATION,
  resolveSafeInternalPath,
} from "./safe-navigation";

describe("resolveSafeInternalPath", () => {
  it.each([
    [null, DEFAULT_LOGIN_DESTINATION],
    [undefined, DEFAULT_LOGIN_DESTINATION],
    ["", DEFAULT_LOGIN_DESTINATION],
    ["https://evil.example/steal", DEFAULT_LOGIN_DESTINATION],
    ["//evil.example/steal", DEFAULT_LOGIN_DESTINATION],
    ["/%2f%2fevil.example/steal", DEFAULT_LOGIN_DESTINATION],
    ["/%252f%252fevil.example/steal", DEFAULT_LOGIN_DESTINATION],
    ["/\\\\evil.example/steal", DEFAULT_LOGIN_DESTINATION],
    ["javascript:alert(1)", DEFAULT_LOGIN_DESTINATION],
    [" /invite/token", DEFAULT_LOGIN_DESTINATION],
    ["/invite/token\n", DEFAULT_LOGIN_DESTINATION],
    ["/%E0%A4%A", DEFAULT_LOGIN_DESTINATION],
    ["/courses?tab=mine#active", "/courses?tab=mine#active"],
    ["/invite/invite-token", "/invite/invite-token"],
  ])("chuẩn hóa đường dẫn %s thành %s", (value, expected) => {
    expect(resolveSafeInternalPath(value)).toBe(expected);
  });

  it("cho phép caller chọn fallback nội bộ", () => {
    expect(resolveSafeInternalPath("//evil.example", "/login")).toBe(
      "/login",
    );
  });
});
