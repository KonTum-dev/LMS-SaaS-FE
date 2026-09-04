// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminCrmDashboard } from "@/lib/admin-crm-api";
import AdminCrmPage from "./page";

const mocks = vi.hoisted(() => ({
  auth: {
    organization: null,
    token: "super-token",
    user: {
      role: "SUPER_ADMIN" as const,
      sub: "root-001",
    },
  },
  overview: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/admin-crm-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/admin-crm-api")>();
  return {
    ...original,
    adminCrmApi: { overview: mocks.overview },
  };
});
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => mocks.auth,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock(
  "antd",
  async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

function dashboardData(): AdminCrmDashboard {
  return {
    generatedAt: "2026-09-04T03:00:00.000Z",
    metrics: {
      activeMembers: 348,
      activeSubscriptions: 17,
      activeTenants: 21,
      graceWorkspaces: 2,
      grossRevenueVnd: 81_000_000,
      noSubscriptionWorkspaces: 1,
      paidOrders: 42,
      readOnlyWorkspaces: 3,
      recentRevenueVnd: 12_500_000,
      reviewOrders: 2,
      suspendedTenants: 3,
      totalTenants: 24,
      trialWorkspaces: 4,
    },
    recentActivity: [
      {
        amountVnd: 1_200_000,
        id: "order:paid-1",
        kind: "PAYMENT_PAID",
        occurredAt: "2026-09-04T02:30:00.000Z",
        status: "PAID",
        tenant: {
          id: "64f000000000000000000001",
          name: "Bright Center",
          slug: "bright-center",
        },
      },
      {
        amountVnd: null,
        id: "tenant:new-1",
        kind: "TENANT_CREATED",
        occurredAt: "2026-09-04T01:00:00.000Z",
        status: null,
        tenant: {
          id: "64f000000000000000000002",
          name: "Ocean Academy",
          slug: "ocean-academy",
        },
      },
    ],
    tenants: {
      items: [
        {
          accessState: "TRIAL",
          createdAt: "2026-09-01T00:00:00.000Z",
          id: "64f000000000000000000001",
          memberCount: 92,
          name: "Bright Center",
          revenueVnd: 4_000_000,
          slug: "bright-center",
          status: "ACTIVE",
          subscription: {
            billingCycle: "MONTHLY",
            endAt: "2026-09-15T00:00:00.000Z",
            isTrial: true,
            planCode: "growth",
          },
        },
      ],
      limit: 12,
      page: 1,
      total: 25,
    },
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AdminCrmPage />
    </QueryClientProvider>,
  );
}

describe("AdminCrmPage", () => {
  beforeEach(() => {
    mocks.overview.mockReset();
    mocks.overview.mockResolvedValue(dashboardData());
    mocks.push.mockReset();
    mocks.auth.user.role = "SUPER_ADMIN";
  });

  afterEach(cleanup);

  it("renders platform KPIs, tenant health and redacted activity", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "CRM tổng quan" }),
    ).toBeTruthy();
    await screen.findAllByText("Bright Center");
    expect(screen.getByText("Tổng workspace")).toBeTruthy();
    expect(screen.getByText("Doanh thu 30 ngày")).toBeTruthy();
    expect(screen.getAllByText("Bright Center").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đang dùng thử").length).toBeGreaterThan(0);
    expect(screen.getByText("Thanh toán thành công")).toBeTruthy();
    expect(screen.queryByText(/idempotency|gateway|owner@/i)).toBeNull();
  });

  it("keeps navigation actions inside the SUPER_ADMIN workspace", async () => {
    renderPage();
    await screen.findAllByText("Bright Center");

    fireEvent.click(screen.getByRole("button", { name: "Quản lý tổ chức" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Thuê bao & thanh toán" }),
    );

    expect(mocks.push).toHaveBeenNthCalledWith(1, "/admin/tenants");
    expect(mocks.push).toHaveBeenNthCalledWith(2, "/admin/billing");
  });

  it("submits a trimmed search and requests the next server page", async () => {
    renderPage();
    await screen.findAllByText("Bright Center");

    fireEvent.change(screen.getByLabelText("Tìm workspace"), {
      target: { value: " Bright " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));

    await waitFor(() =>
      expect(mocks.overview).toHaveBeenCalledWith(
        "super-token",
        { limit: 12, page: 1, search: "Bright" },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() =>
      expect(mocks.overview).toHaveBeenCalledWith(
        "super-token",
        { limit: 12, page: 2, search: "Bright" },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
  });

  it("shows API errors and retries explicitly", async () => {
    mocks.overview
      .mockRejectedValueOnce(new Error("CRM tạm thời không khả dụng"))
      .mockResolvedValueOnce(dashboardData());
    renderPage();

    expect(await screen.findByText("CRM tạm thời không khả dụng")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(
      (await screen.findAllByText("Bright Center")).length,
    ).toBeGreaterThan(0);
    expect(mocks.overview).toHaveBeenCalledTimes(2);
  });

  it("does not request CRM data for a tenant role", () => {
    Object.assign(mocks.auth.user, { role: "TENANT_ADMIN" as const });
    renderPage();

    expect(
      screen.getByText("Khu vực CRM chỉ dành cho quản trị viên nền tảng."),
    ).toBeTruthy();
    expect(mocks.overview).not.toHaveBeenCalled();
  });
});
