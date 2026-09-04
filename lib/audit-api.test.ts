import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { auditApi, buildAuditEventsPath } from "@/lib/audit-api";

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiFetch: vi.fn() };
});

const tenantId = "507f1f77bcf86cd799439011";

beforeEach(() => vi.mocked(apiFetch).mockReset());

describe("audit API", () => {
  it("binds the first page to explicit filters", () => {
    expect(buildAuditEventsPath(
      { kind: "CURRENT_TENANT" },
      {
        action: "MEMBERSHIP_ROLE_CHANGED",
        actorId: " 507f1f77bcf86cd799439012 ",
        limit: 25,
        outcome: "SUCCEEDED",
        targetType: "MEMBERSHIP",
      },
    )).toBe(
      "/audit/events?limit=25&action=MEMBERSHIP_ROLE_CHANGED&actorId=507f1f77bcf86cd799439012&outcome=SUCCEEDED&targetType=MEMBERSHIP",
    );
  });

  it("sends only the opaque cursor and limit on continuation pages", () => {
    expect(buildAuditEventsPath(
      { kind: "PLATFORM_TENANT", tenantId },
      {
        action: "INVITATION_CREATED",
        cursor: "signed+cursor/with=symbols",
        limit: 100,
        targetId: "must-not-leak",
      },
    )).toBe(
      `/admin/audit/tenants/${tenantId}/events?limit=100&cursor=signed%2Bcursor%2Fwith%3Dsymbols`,
    );
  });

  it("rejects an unsafe tenant id before building an admin URL", () => {
    expect(() => buildAuditEventsPath(
      { kind: "PLATFORM_TENANT", tenantId: "../audit" },
    )).toThrow("Mã tổ chức không hợp lệ");
  });

  it("never mixes checkpoint and continuation implicitly", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      checkpoint: null,
      complete: false,
      continuation: "next",
      headSequence: 2,
      issue: null,
      valid: true,
      verifiedFromSequence: 1,
      verifiedThroughSequence: 1,
    });

    await auditApi.verifyIntegrity(
      { token: "secret-token" },
      { kind: "PLATFORM_TENANT", tenantId },
      { continuation: "signed-continuation", maxEvents: 5000 },
    );

    expect(apiFetch).toHaveBeenCalledWith(
      `/admin/audit/tenants/${tenantId}/integrity/verify`,
      {
        body: JSON.stringify({ continuation: "signed-continuation", maxEvents: 5000 }),
        method: "POST",
        token: "secret-token",
      },
    );
  });
});
