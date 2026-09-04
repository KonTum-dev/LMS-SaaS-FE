import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOrgUnitAssignmentQuery,
  orgUnitAccessApi,
  orgUnitAccessQueryKeys,
  type CreateOrgUnitAssignmentInput,
} from "./org-unit-access-api";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));

const context = { token: "tenant-token" };
const scope = {
  membershipId: "membership-admin",
  role: "TENANT_ADMIN" as const,
  tenantId: "tenant-1",
  viewerId: "admin-1",
};
const createInput: CreateOrgUnitAssignmentInput = {
  accessLevel: "MANAGER",
  includeDescendants: true,
  membershipId: "membership-1",
  orgUnitId: "branch-1",
};

describe("orgUnitAccessApi contract", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockResolvedValue(null);
  });

  it("xây list query ổn định, trim và encode", () => {
    expect(
      buildOrgUnitAssignmentQuery({
        accessLevel: " MANAGER ",
        ignored: " ",
        membershipId: "membership/one",
        orgUnitId: "branch one",
        status: "ACTIVE",
      }),
    ).toBe(
      "?accessLevel=MANAGER&membershipId=membership%2Fone&orgUnitId=branch+one&status=ACTIVE",
    );
    expect(
      buildOrgUnitAssignmentQuery({ status: "ACTIVE", orgUnitId: "branch-1" }),
    ).toBe(
      buildOrgUnitAssignmentQuery({ orgUnitId: "branch-1", status: "ACTIVE" }),
    );
  });

  it("scope cache theo tenant, viewer, membership và role", () => {
    expect(
      orgUnitAccessQueryKeys.list(scope, {
        accessLevel: "STAFF",
        status: "ACTIVE",
      }),
    ).toEqual([
      "lms",
      "tenant-1",
      "admin-1",
      "membership-admin",
      "TENANT_ADMIN",
      "org-unit-assignments",
      "list",
      "?accessLevel=STAFF&status=ACTIVE",
    ]);
    expect(orgUnitAccessQueryKeys.me(scope)).toEqual([
      ...orgUnitAccessQueryKeys.root(scope),
      "me",
    ]);
  });

  it("list và me dùng no-store, chuyển AbortSignal", async () => {
    const signal = new AbortController().signal;
    await orgUnitAccessApi.list(
      context,
      { orgUnitId: "branch-1", status: "ACTIVE" },
      { signal },
    );
    await orgUnitAccessApi.me(context, { signal });

    expect(mocks.apiFetch.mock.calls).toEqual([
      ["/org-unit-assignments?orgUnitId=branch-1&status=ACTIVE", {
        cache: "no-store",
        signal,
        token: "tenant-token",
      }],
      ["/org-unit-assignments/me", {
        cache: "no-store",
        signal,
        token: "tenant-token",
      }],
    ]);
  });

  it("create, CAS update và archive dùng đúng target routes", async () => {
    await orgUnitAccessApi.create(context, createInput);
    await orgUnitAccessApi.update(context, "assignment/one", {
      accessLevel: "VIEWER",
      expectedRevision: 4,
      includeDescendants: false,
    });
    await orgUnitAccessApi.archive(context, "assignment/one", 5);

    expect(mocks.apiFetch.mock.calls).toEqual([
      ["/org-unit-assignments", {
        body: JSON.stringify(createInput),
        method: "POST",
        token: "tenant-token",
      }],
      ["/org-unit-assignments/assignment%2Fone", {
        body: JSON.stringify({
          accessLevel: "VIEWER",
          expectedRevision: 4,
          includeDescendants: false,
        }),
        method: "PATCH",
        token: "tenant-token",
      }],
      ["/org-unit-assignments/assignment%2Fone/archive", {
        body: JSON.stringify({ expectedRevision: 5 }),
        method: "POST",
        token: "tenant-token",
      }],
    ]);
  });
});
