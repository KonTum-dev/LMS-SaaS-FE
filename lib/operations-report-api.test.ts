import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOperationsReportQuery,
  operationsReportApi,
  operationsReportQueryKeys,
} from "./operations-report-api";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));

const context = { token: "tenant-token" };
const scope = {
  membershipId: "membership-1",
  role: "INSTRUCTOR" as const,
  tenantId: "tenant-1",
  viewerId: "instructor-1",
};

describe("operationsReportApi contract", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockResolvedValue(null);
  });

  it("xây query ổn định, encoded và bỏ giá trị trống", () => {
    expect(
      buildOperationsReportQuery({
        from: " 2026-08-01T00:00:00.000Z ",
        ignored: " ",
        orgUnitId: "branch/HCM",
        to: "2026-08-31T23:59:59.999Z",
      }),
    ).toBe(
      "?from=2026-08-01T00%3A00%3A00.000Z&orgUnitId=branch%2FHCM&to=2026-08-31T23%3A59%3A59.999Z",
    );
    expect(
      buildOperationsReportQuery({
        to: "2026-08-31T23:59:59.999Z",
        from: "2026-08-01T00:00:00.000Z",
      }),
    ).toBe(
      buildOperationsReportQuery({
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-31T23:59:59.999Z",
      }),
    );
    expect(
      buildOperationsReportQuery({
        from: "2026-08-01T00:00:00.000Z",
        orgUnitId: "branch-1",
      }),
    ).toBe("?orgUnitId=branch-1");
  });

  it("scope cache theo tenant, viewer, membership và role", () => {
    expect(
      operationsReportQueryKeys.overview(scope, {
        from: "2026-08-01T00:00:00.000Z",
        orgUnitId: "branch-1",
        to: "2026-08-31T23:59:59.999Z",
      }),
    ).toEqual([
      "lms",
      "tenant-1",
      "instructor-1",
      "membership-1",
      "INSTRUCTOR",
      "operations-reports",
      "overview",
      "?from=2026-08-01T00%3A00%3A00.000Z&orgUnitId=branch-1&to=2026-08-31T23%3A59%3A59.999Z",
    ]);
  });

  it("gọi overview bằng no-store và chuyển AbortSignal", async () => {
    const signal = new AbortController().signal;
    await operationsReportApi.overview(
      context,
      {
        from: " 2026-08-01T00:00:00.000Z ",
        orgUnitId: "branch/1",
        to: "2026-08-31T23:59:59.999Z",
      },
      { signal },
    );

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/operations/reports/overview?from=2026-08-01T00%3A00%3A00.000Z&orgUnitId=branch%2F1&to=2026-08-31T23%3A59%3A59.999Z",
      {
        cache: "no-store",
        signal,
        token: "tenant-token",
      },
    );
  });

  it("không thêm dấu hỏi khi không có bộ lọc", async () => {
    await operationsReportApi.overview(context);
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/operations/reports/overview",
      { cache: "no-store", token: "tenant-token" },
    );
  });
});
