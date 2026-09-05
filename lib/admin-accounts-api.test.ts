import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import {
  adminAccountPasswordError,
  adminAccountsApi,
  buildAdminAccountsPath,
  parseAdminAccountDetail,
  parseAdminAccountsPage,
  type CreateAdminAccountInput,
} from "./admin-accounts-api";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: mocks.apiFetch,
}));

const accountId = "64b000000000000000000001";
const actorId = "64b000000000000000000002";
const tenantId = "64b000000000000000000003";
function detail() {
  return {
    _id: accountId,
    email: "member@example.test",
    fullName: "Nguyễn An",
    status: "ACTIVE",
    platformRole: null,
    createdAt: "2030-08-16T00:00:00.000Z",
    updatedAt: "2030-08-16T00:00:00.000Z",
    passwordHash: "private-password-hash",
    credentialVersion: 17,
    memberships: [
      {
        membershipId: "64b000000000000000000004",
        tenantId,
        tenantName: "Bright",
        tenantSlug: "bright",
        role: "LEARNER",
        status: "ACTIVE",
        secret: "private-membership",
      },
    ],
    audit: [
      {
        _id: "64b000000000000000000005",
        actorId,
        action: "ACCOUNT_CREATED",
        reason: "Create approved account",
        status: "SUCCEEDED",
        createdAt: "2030-08-16T00:00:00.000Z",
        completedAt: "2030-08-16T00:00:01.000Z",
        secret: "private-audit",
      },
    ],
  };
}
const input: CreateAdminAccountInput = {
  email: "  Member@Example.Test  ",
  fullName: "  Nguyễn An  ",
  password: "PasswordLong!123",
  platformRole: null,
  reason: "  Approved account creation  ",
};
const query = { limit: 20, page: 1 };

describe("platform accounts API", () => {
  beforeEach(() => mocks.apiFetch.mockReset());

  it("builds encoded server filters and bounds pagination/search", () => {
    expect(
      buildAdminAccountsPath({
        page: 2,
        limit: 50,
        search: "  a+b@test.vn  ",
        status: "ACTIVE",
        platformRole: "USER",
      }),
    ).toBe(
      "/admin/accounts?page=2&limit=50&search=a%2Bb%40test.vn&status=ACTIVE&platformRole=USER",
    );
    for (const invalid of [
      { page: 0, limit: 20 },
      { page: 100001, limit: 20 },
      { page: 1, limit: 101 },
      { page: 1, limit: 20, search: "x".repeat(101) },
    ])
      expect(() => buildAdminAccountsPath(invalid)).toThrow(ApiError);
  });

  it("allow-lists list/detail data and drops credentials and unknown fields", () => {
    const parsed = parseAdminAccountDetail(detail());
    expect(parsed.memberships[0]).toMatchObject({
      tenantName: "Bright",
      role: "LEARNER",
    });
    expect(parsed.audit[0]).toMatchObject({
      actorId,
      reason: "Create approved account",
    });
    expect(JSON.stringify(parsed)).not.toContain("private-");
    expect(parsed).not.toHaveProperty("credentialVersion");
    const list = parseAdminAccountsPage(
      { items: [detail()], total: 1, ...query },
      query,
    );
    expect(list.items[0]).not.toHaveProperty("memberships");
    expect(list.items[0]).not.toHaveProperty("audit");
  });

  it("rejects malformed response or filter-mismatched page", () => {
    for (const invalid of [
      { ...detail(), status: "DELETED" },
      { ...detail(), platformRole: "LEARNER" },
      { ...detail(), _id: "bad" },
      { ...detail(), createdAt: "yesterday" },
      { ...detail(), memberships: null },
      { ...detail(), audit: null },
    ])
      expect(() => parseAdminAccountDetail(invalid)).toThrowError(
        expect.objectContaining({ code: "ADMIN_ACCOUNTS_RESPONSE_INVALID" }),
      );
    expect(() =>
      parseAdminAccountsPage(
        { items: [detail()], total: 1, limit: 20, page: 2 },
        query,
      ),
    ).toThrow(ApiError);
    expect(() =>
      parseAdminAccountsPage(
        { items: [detail()], total: 1, ...query },
        { ...query, status: "INACTIVE" },
      ),
    ).toThrow(ApiError);
    expect(() =>
      parseAdminAccountsPage(
        { items: [detail()], total: 1, ...query },
        { ...query, platformRole: "SUPER_ADMIN" },
      ),
    ).toThrow(ApiError);
  });

  it("uses token, cancellation and no-store/no-referrer for list/detail", async () => {
    const signal = new AbortController().signal;
    mocks.apiFetch
      .mockResolvedValueOnce({ items: [detail()], total: 1, ...query })
      .mockResolvedValueOnce(detail());
    await adminAccountsApi.list({ token: "admin-token", signal }, query);
    await adminAccountsApi.get({ token: "admin-token", signal }, accountId);
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      1,
      "/admin/accounts?page=1&limit=20",
      {
        token: "admin-token",
        signal,
        cache: "no-store",
        referrerPolicy: "no-referrer",
      },
    );
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      2,
      `/admin/accounts/${accountId}`,
      {
        token: "admin-token",
        signal,
        cache: "no-store",
        referrerPolicy: "no-referrer",
      },
    );
  });

  it("creates a normalized account without persisting password in returned data", async () => {
    mocks.apiFetch.mockResolvedValue(detail());
    const result = await adminAccountsApi.create(
      { token: "admin-token" },
      input,
    );
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/admin/accounts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "member@example.test",
          fullName: "Nguyễn An",
          password: input.password,
          platformRole: null,
          reason: "Approved account creation",
        }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain(input.password);
  });

  it.each([
    { password: "short" },
    { password: "é".repeat(37) },
    { email: "invalid" },
    { fullName: "a" },
    { reason: "   " },
    { reason: "x".repeat(501) },
  ])("rejects invalid create payload before network %#", async (override) => {
    await expect(
      adminAccountsApi.create(
        { token: "admin-token" },
        { ...input, ...override },
      ),
    ).rejects.toThrow(ApiError);
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("enforces 12 characters and 72 UTF-8 bytes", () => {
    expect(adminAccountPasswordError("abcdefghijk")).toMatch(/12/);
    expect(adminAccountPasswordError("a".repeat(12))).toBeNull();
    expect(adminAccountPasswordError("é".repeat(36))).toBeNull();
    expect(adminAccountPasswordError("é".repeat(37))).toMatch(/72/);
  });

  it("updates only allowed fields, preserving explicit null demotion", async () => {
    mocks.apiFetch.mockResolvedValue(detail());
    await adminAccountsApi.update({ token: "admin-token" }, accountId, {
      fullName: "  Edited Name  ",
      platformRole: null,
      reason: " Role correction ",
      email: "unwanted@test.vn",
      password: "never-send",
    } as Parameters<typeof adminAccountsApi.update>[2]);
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      `/admin/accounts/${accountId}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          fullName: "Edited Name",
          platformRole: null,
          reason: "Role correction",
        }),
      }),
    );
    await expect(
      adminAccountsApi.update({ token: "admin-token" }, accountId, {
        reason: "No changes",
      }),
    ).rejects.toThrow(ApiError);
  });

  it("soft-disables and restores with auditable reason, never hard deletes", async () => {
    mocks.apiFetch.mockResolvedValue(detail());
    await adminAccountsApi.disable(
      { token: "admin-token" },
      accountId,
      " Security policy ",
    );
    await adminAccountsApi.restore(
      { token: "admin-token" },
      accountId,
      " Re-enable approved ",
    );
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      1,
      `/admin/accounts/${accountId}`,
      expect.objectContaining({
        method: "DELETE",
        body: '{"reason":"Security policy"}',
      }),
    );
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      2,
      `/admin/accounts/${accountId}/restore`,
      expect.objectContaining({
        method: "POST",
        body: '{"reason":"Re-enable approved"}',
      }),
    );
  });

  it("rejects invalid request IDs and wrong response identity", async () => {
    await expect(
      adminAccountsApi.get({ token: "admin-token" }, "../tenants"),
    ).rejects.toThrow(ApiError);
    expect(mocks.apiFetch).not.toHaveBeenCalled();
    mocks.apiFetch.mockResolvedValue({ ...detail(), _id: actorId });
    await expect(
      adminAccountsApi.get({ token: "admin-token" }, accountId),
    ).rejects.toThrow(ApiError);
    await expect(
      adminAccountsApi.disable(
        { token: "admin-token" },
        accountId,
        "Security policy",
      ),
    ).rejects.toThrow(ApiError);
  });
});
