import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { buildCrmQuery, tenantCrmApi } from "./tenant-crm-api";
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));
const contactId = "a".repeat(24);
const ctx = { token: "test-only-token" };
describe("Tenant CRM client", () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());
  it("encodes allowed filters without client-selected authority", () => {
    expect(
      buildCrmQuery({
        search: "An & Bình",
        stage: "NEW",
        page: 2,
        tenantId: "other",
      } as never),
    ).toBe("?page=2&search=An+%26+B%C3%ACnh&stage=NEW");
  });
  it("passes abort and no-store to scoped read endpoints", async () => {
    const signal = new AbortController().signal;
    await tenantCrmApi.options(ctx, { signal });
    await tenantCrmApi.list(ctx, { page: 1 }, { signal });
    await tenantCrmApi.get(ctx, contactId, { signal });
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/crm/options", {
      token: ctx.token,
      signal,
      cache: "no-store",
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/crm/contacts?page=1", {
      token: ctx.token,
      signal,
      cache: "no-store",
    });
    expect(apiFetch).toHaveBeenNthCalledWith(3, `/crm/contacts/${contactId}`, {
      token: ctx.token,
      signal,
      cache: "no-store",
    });
  });
  it("only creates editable contact fields", async () => {
    await tenantCrmApi.create(ctx, {
      fullName: "Test Contact",
      phone: null,
      tenantId: "other",
      userId: "victim",
      source: "ZALO_MINI_APP",
      zalo: { phone: "fake" },
    } as never);
    expect(apiFetch).toHaveBeenCalledWith(
      "/crm/contacts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ fullName: "Test Contact", phone: null }),
      }),
    );
  });
  it("preserves partial patch and explicit phone clearing with revision", async () => {
    await tenantCrmApi.update(ctx, contactId, { phone: null, revision: 3 });
    expect(apiFetch).toHaveBeenCalledWith(
      `/crm/contacts/${contactId}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ phone: null, revision: 3 }),
      }),
    );
  });
  it("keeps notes in body and passes cancellation", async () => {
    const signal = new AbortController().signal;
    await tenantCrmApi.addNote(
      ctx,
      contactId,
      { revision: 2, body: "Private test note" },
      { signal },
    );
    expect(apiFetch).toHaveBeenCalledWith(
      `/crm/contacts/${contactId}/notes`,
      expect.objectContaining({
        method: "POST",
        signal,
        body: JSON.stringify({ revision: 2, body: "Private test note" }),
      }),
    );
  });
  it("rejects path injection before requesting contact data", () => {
    expect(() => tenantCrmApi.get(ctx, "../other")).toThrow();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
