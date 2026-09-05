import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { describeOperationsError } from "./operations-errors";

describe("operations inline error copy", () => {
  it("translates reviewed local validation without translating arbitrary server text", () => {
    expect(
      describeOperationsError(new Error("Chọn một mã lý do retry."), "en"),
    ).toBe("Select a retry reason code.");
    expect(
      describeOperationsError(new Error("Select a retry reason code."), "vi"),
    ).toBe("Chọn một mã lý do retry.");
    expect(
      describeOperationsError(
        new ApiError("Chọn một mã lý do retry.", 403),
        "en",
      ),
    ).toContain("You do not have permission");
  });

  it.each([
    "password=private-token",
    "Error: mongodb://user:password@db/admin",
    "at database.connect(file.ts:19)",
    "<script>alert(1)</script>",
  ])("never renders unreviewed server details: %s", (message) => {
    const result = describeOperationsError(
      new Error(message),
      "en",
      "Could not load organizations.",
    );
    expect(result).toBe("Could not load organizations.");
    expect(result).not.toContain(message);
  });

  it.each(["vi", "en"] as const)(
    "keeps uncertain writes action-oriented in %s",
    (locale) => {
      for (const error of [
        new ApiError("private", 503, "PLAN_AUDIT_PENDING"),
        new Error("Mất kết nối"),
        new Error("Máy chủ trả trạng thái tạo tenant không hợp lệ"),
      ]) {
        const result = describeOperationsError(error, locale);
        expect(result).not.toContain("private");
        expect(result).toMatch(locale === "en" ? /Refresh|refresh/ : /tải lại/);
        expect(result).not.toMatch(/failed|thất bại/i);
      }
    },
  );

  it("preserves status, code and retry metadata on the original error", () => {
    const error = new ApiError("server trace", 429, "AUTH_RATE_LIMITED");
    error.retryAfterSeconds = 25;
    const snapshot = {
      message: error.message,
      status: error.status,
      code: error.code,
      retryAfterSeconds: error.retryAfterSeconds,
    };
    expect(describeOperationsError(error, "en")).toContain("25");
    expect({
      message: error.message,
      status: error.status,
      code: error.code,
      retryAfterSeconds: error.retryAfterSeconds,
    }).toEqual(snapshot);
  });
});
