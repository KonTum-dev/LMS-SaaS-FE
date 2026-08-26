import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("billing callback workspace", () => {
  const statusPage = readFileSync(
    resolve(process.cwd(), "app/(workspace)/billing/status/[id]/page.tsx"),
    "utf8",
  );

  it("lấy trạng thái từ backend và poll thay vì tin query redirect", () => {
    expect(statusPage).toContain("billingApi.getOrder");
    expect(statusPage).toContain("refetchInterval");
    expect(statusPage).not.toContain("useSearchParams");
    expect(statusPage).not.toContain("searchParams");
  });

  it("chỉ cho tenant admin tải order", () => {
    expect(statusPage).toContain('user?.role === "TENANT_ADMIN"');
    expect(statusPage).toContain('user?.role !== "TENANT_ADMIN"');
  });
});
