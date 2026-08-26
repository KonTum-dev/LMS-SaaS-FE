import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, type ApiError } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
  it("xử lý response 200 rỗng như null thay vì ném lỗi JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

    await expect(apiFetch<null>("/empty")).resolves.toBeNull();
  });

  it("Việt hóa lỗi và phát tín hiệu hết phiên khi API trả 401", async () => {
    const browser = new EventTarget();
    const expired = vi.fn();
    browser.addEventListener("auth:expired", expired);
    vi.stubGlobal("window", browser);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: ["Phiên đã hết hạn", "Đăng nhập lại"] }), { status: 401, headers: { "Content-Type": "application/json" } })));

    await expect(apiFetch("/private", { token: "old-token" })).rejects.toMatchObject({ message: "Phiên đã hết hạn. Đăng nhập lại", status: 401 } satisfies Partial<ApiError>);
    expect(expired).toHaveBeenCalledOnce();
  });
});
