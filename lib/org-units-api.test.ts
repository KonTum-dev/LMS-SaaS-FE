import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOrgUnitQuery,
  orgUnitQueryKeys,
  orgUnitsApi,
} from "./org-units-api";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));

const context = { token: "tenant-token" };
const scope = {
  membershipId: "membership-1",
  role: "TENANT_ADMIN" as const,
  tenantId: "tenant-1",
  viewerId: "admin-1",
};

describe("orgUnitsApi contract", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockResolvedValue(null);
  });

  it("build query deterministic, giữ false/0 và bỏ blank/non-finite", () => {
    expect(
      buildOrgUnitQuery({
        blank: "  ",
        includeArchived: false,
        invalid: Number.NaN,
        page: 0,
        search: "  Hà Nội  ",
      }),
    ).toBe("?includeArchived=false&page=0&search=H%C3%A0+N%E1%BB%99i");
    expect(buildOrgUnitQuery({ search: "HCM", page: 2 })).toBe(
      buildOrgUnitQuery({ page: 2, search: " HCM " }),
    );
  });

  it("scope cache theo tenant, viewer, membership và role", () => {
    expect(orgUnitQueryKeys.tree(scope, false)).toEqual([
      "lms",
      "tenant-1",
      "admin-1",
      "membership-1",
      "TENANT_ADMIN",
      "org-units",
      "tree",
      { includeArchived: false },
    ]);
  });

  it("đọc tree bằng no-store, boolean query và chuyển AbortSignal", async () => {
    const signal = new AbortController().signal;
    await orgUnitsApi.tree(context, true, { signal });

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/org-units/tree?includeArchived=true",
      { cache: "no-store", signal, token: "tenant-token" },
    );
  });

  it("chuẩn hóa create payload và không gửi field rỗng", async () => {
    await orgUnitsApi.create(context, {
      address: { countryCode: " VN ", line1: "  12 Nguyễn Huệ  ", ward: " " },
      code: " HCM-01 ",
      contact: { email: " admin@bright.test ", phone: " " },
      name: " Chi nhánh trung tâm ",
      parentId: " root-1 ",
      policyOverrides: { attendance: { graceMinutes: 10 } },
      timezone: " Asia/Ho_Chi_Minh ",
      type: "BRANCH",
    });

    expect(mocks.apiFetch).toHaveBeenCalledWith("/org-units", {
      body: JSON.stringify({
        address: { countryCode: "VN", line1: "12 Nguyễn Huệ" },
        code: "hcm-01",
        contact: { email: "admin@bright.test" },
        name: "Chi nhánh trung tâm",
        parentId: "root-1",
        policyOverrides: { attendance: { graceMinutes: 10 } },
        timezone: "Asia/Ho_Chi_Minh",
        type: "BRANCH",
      }),
      method: "POST",
      token: "tenant-token",
    });
  });

  it("update và archive dùng encoded route cùng expected revision", async () => {
    await orgUnitsApi.update(context, "unit/one", {
      code: " SALES ",
      expectedRevision: 7,
      name: " Khối kinh doanh ",
      parentId: "branch-2",
      type: "DEPARTMENT",
    });
    await orgUnitsApi.archive(context, "unit/one", 8);

    expect(mocks.apiFetch.mock.calls).toEqual([
      [
        "/org-units/unit%2Fone",
        {
          body: JSON.stringify({
            code: "sales",
            expectedRevision: 7,
            name: "Khối kinh doanh",
            parentId: "branch-2",
            type: "DEPARTMENT",
          }),
          method: "PATCH",
          token: "tenant-token",
        },
      ],
      [
        "/org-units/unit%2Fone/archive",
        {
          body: JSON.stringify({ expectedRevision: 8 }),
          method: "POST",
          token: "tenant-token",
        },
      ],
    ]);
  });
});
