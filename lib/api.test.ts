import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, type ApiError } from "./api";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("xử lý response 200 rỗng như null thay vì ném lỗi JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );

    await expect(apiFetch<null>("/empty")).resolves.toBeNull();
  });

  it("Việt hóa lỗi và phát tín hiệu hết phiên khi API trả 401", async () => {
    const browser = new EventTarget();
    const expired = vi.fn();
    browser.addEventListener("auth:expired", expired);
    vi.stubGlobal("window", browser);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ message: ["Phiên đã hết hạn", "Đăng nhập lại"] }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          ),
        ),
    );

    await expect(
      apiFetch("/private", { token: "old-token" }),
    ).rejects.toMatchObject({
      message: "Phiên đã hết hạn. Đăng nhập lại",
      status: 401,
    } satisfies Partial<ApiError>);
    expect(expired).toHaveBeenCalledOnce();
    expect(expired.mock.calls[0]?.[0]).toMatchObject({
      detail: { token: "old-token" },
    });
  });

  it("chỉ giữ metadata provisioning đã validate từ error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              code: "TENANT_PROVISIONING_IN_PROGRESS",
              message: "Đang xử lý",
              operationId: "64B000000000000000000042",
              retryAfterSeconds: 7,
            }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              code: "unsafe-code",
              message: ["Thông báo hợp lệ", { unsafe: true }],
              operationId: "not-an-object-id",
              retryAfterSeconds: 999_999,
              adminPassword: "must-not-survive",
            }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          ),
        ),
    );

    await expect(apiFetch("/organizations")).rejects.toMatchObject({
      code: "TENANT_PROVISIONING_IN_PROGRESS",
      message: "Đang xử lý",
      operationId: "64b000000000000000000042",
      retryAfterSeconds: 7,
      status: 409,
    } satisfies Partial<ApiError>);
    await expect(apiFetch("/organizations")).rejects.toMatchObject({
      code: undefined,
      message: "Thông báo hợp lệ",
      operationId: undefined,
      retryAfterSeconds: undefined,
      status: 503,
    } satisfies Partial<ApiError>);
  });

  it("vẫn áp deadline khi caller truyền AbortSignal riêng", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener(
              "abort",
              () => {
                reject(options.signal?.reason);
              },
              { once: true },
            );
          }),
      ),
    );

    const pending = apiFetch("/slow", { signal: new AbortController().signal });
    const assertion = expect(pending).rejects.toMatchObject({
      message: "Máy chủ phản hồi quá lâu, vui lòng thử lại",
      status: 0,
    } satisfies Partial<ApiError>);
    await vi.advanceTimersByTimeAsync(15_000);

    await assertion;
  });
});
