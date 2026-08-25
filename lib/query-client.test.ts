import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { clearLmsSessionCache, createLmsQueryClient } from "./query-client";

describe("vòng đời Query cache", () => {
  it("xóa toàn bộ dữ liệu phiên cũ trước khi đổi viewer hoặc logout", () => {
    const queryClient = createLmsQueryClient();
    queryClient.setQueryData(["lms", "tenant-a", "viewer-a", "courses"], [{ id: "private" }]);

    clearLmsSessionCache(queryClient);

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("không retry lỗi 401 nhưng cho lỗi mạng thử lại một lần", () => {
    const retry = createLmsQueryClient().getDefaultOptions().queries?.retry;
    expect(typeof retry).toBe("function");
    if (typeof retry !== "function") return;
    expect(retry(0, new ApiError("Hết phiên", 401))).toBe(false);
    expect(retry(0, new ApiError("Mất mạng", 0))).toBe(true);
    expect(retry(1, new ApiError("Mất mạng", 0))).toBe(false);
  });
});
