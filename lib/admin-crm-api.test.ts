import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminCrmApi,
  adminCrmQueryKeys,
  buildAdminCrmQuery,
} from "./admin-crm-api";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));

const scope = {
  membershipId: "platform",
  role: "SUPER_ADMIN" as const,
  tenantId: "platform",
  viewerId: "root-1",
};

describe("adminCrmApi", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockResolvedValue(null);
  });

  it("builds a stable encoded query and omits blank values", () => {
    expect(
      buildAdminCrmQuery({
        access: "TRIAL",
        limit: 12,
        page: 2,
        search: " Trung tâm/HCM ",
        status: undefined,
      }),
    ).toBe("?access=TRIAL&limit=12&page=2&search=Trung+t%C3%A2m%2FHCM");
  });

  it("scopes the cache to the platform administrator and filters", () => {
    const query = { access: "GRACE" as const, limit: 12, page: 1 };
    expect(adminCrmQueryKeys.overview(scope, query)).toEqual([
      "lms",
      "platform",
      "root-1",
      "platform",
      "SUPER_ADMIN",
      "admin-crm",
      "overview",
      "?access=GRACE&limit=12&page=1",
    ]);
  });

  it("calls the read-only CRM endpoint and forwards cancellation", async () => {
    const signal = new AbortController().signal;
    await adminCrmApi.overview(
      "super-token",
      {
        access: "READ_ONLY",
        limit: 12,
        page: 1,
        search: "Bright",
        status: "ACTIVE",
      },
      { signal },
    );

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/admin/dashboard?access=READ_ONLY&limit=12&page=1&search=Bright&status=ACTIVE",
      { cache: "no-store", signal, token: "super-token" },
    );
  });
});
