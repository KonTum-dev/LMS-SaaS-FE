// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";
import type { AdminCrmDashboard, AdminCrmQuery } from "@/lib/admin-crm-api";
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
vi.mock("antd", async () => ({
  ...(await import("@/test-utils/lightweight-antd")).lightweightAntd,
  Col: ({ children, xs }: { children?: ReactNode; xs: number }) => (
    <div data-mobile-span={xs}>{children}</div>
  ),
  Select: ({
    "aria-label": label,
    onChange,
    options,
    value,
  }: {
    "aria-label"?: string;
    onChange: (value: string) => void;
    options: Array<{ label: string; value: string }>;
    value?: string;
  }) => (
    <select
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
      value={value ?? ""}
    >
      <option value="" />
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

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

function renderPage(locale?: "vi" | "en") {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      {locale ? (
        <FeedbackLocaleProvider initialLocale={locale}>
          <AdminCrmPage />
        </FeedbackLocaleProvider>
      ) : (
        <AdminCrmPage />
      )}
    </QueryClientProvider>,
  );
}

describe("AdminCrmPage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
    mocks.overview.mockReset();
    mocks.overview.mockResolvedValue(dashboardData());
    mocks.push.mockReset();
    mocks.auth.user.role = "SUPER_ADMIN";
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders platform KPIs, tenant health and redacted activity", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Tổng quan CRM" }),
    ).toBeTruthy();
    await screen.findAllByText("Bright Center");
    expect(screen.getByText("Tổng tổ chức")).toBeTruthy();
    expect(screen.getByText("Doanh thu 30 ngày")).toBeTruthy();
    expect(screen.getAllByText("Bright Center").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đang dùng thử").length).toBeGreaterThan(0);
    expect(screen.getByText("Đã thanh toán")).toBeTruthy();
    expect(screen.getByText("Tổ chức mới")).toBeTruthy();
    expect(document.querySelector(".page-eyebrow")).toBeNull();
    expect(
      Array.from(document.querySelectorAll("[data-mobile-span]"), (element) =>
        element.getAttribute("data-mobile-span"),
      ),
    ).toEqual(["12", "12", "24", "24"]);
    expect(screen.getByLabelText("Thông tin bổ sung").textContent).toContain("348 thành viên");
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

    fireEvent.change(screen.getByLabelText("Tìm tổ chức"), {
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

    expect(
      await screen.findByText(
        "Không thể hoàn tất yêu cầu. Vui lòng kiểm tra thông tin và thử lại.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("CRM tạm thời không khả dụng")).toBeNull();
    expect(screen.getByLabelText("Tìm tổ chức")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Danh sách tổ chức" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(
      (await screen.findAllByText("Bright Center")).length,
    ).toBeGreaterThan(0);
    expect(mocks.overview).toHaveBeenCalledTimes(2);
  });

  it("does not request per keystroke and clears the applied search immediately", async () => {
    renderPage();
    await screen.findAllByText("Bright Center");
    const input = screen.getByLabelText("Tìm tổ chức");
    fireEvent.change(input, { target: { value: "B" } });
    fireEvent.change(input, { target: { value: " Bright " } });
    expect(mocks.overview).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
    await waitFor(() => expect(mocks.overview).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() => expect(mocks.overview).toHaveBeenLastCalledWith(
      "super-token", { limit: 12, page: 2, search: "Bright" }, expect.anything(),
    ));
    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => expect(mocks.overview).toHaveBeenLastCalledWith(
      "super-token", { limit: 12, page: 1, search: undefined }, expect.anything(),
    ));
    expect(screen.queryByRole("button", { name: "Xóa bộ lọc" })).toBeNull();
  });

  it("resets server pagination on size/filter changes and clears every filter", async () => {
    mocks.overview.mockImplementation((_token, query: AdminCrmQuery) => Promise.resolve({
      ...dashboardData(), tenants: { ...dashboardData().tenants, ...query, total: 101 },
    }));
    renderPage("en");
    await screen.findAllByText("Bright Center");
    fireEvent.change(screen.getByLabelText("Filter organization status"), { target: { value: "SUSPENDED" } });
    fireEvent.change(screen.getByLabelText("Filter access status"), { target: { value: "READ_ONLY" } });
    await waitFor(() => expect(mocks.overview).toHaveBeenLastCalledWith(
      "super-token", { limit: 12, page: 1, status: "SUSPENDED", access: "READ_ONLY" }, expect.anything(),
    ));
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() => expect(screen.getByText("Trang 2")).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Rows per page|Số dòng mỗi trang/), { target: { value: "50" } });
    await waitFor(() => expect(mocks.overview).toHaveBeenLastCalledWith(
      "super-token", { limit: 50, page: 1, status: "SUSPENDED", access: "READ_ONLY" }, expect.anything(),
    ));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(mocks.overview).toHaveBeenLastCalledWith(
      "super-token", { limit: 50, page: 1 }, expect.anything(),
    ));
    expect((screen.getByLabelText("Filter organization status") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Filter access status") as HTMLSelectElement).value).toBe("");
  });

  it("shows the requested page while retaining placeholder rows during refetch", async () => {
    mocks.overview.mockResolvedValueOnce(dashboardData()).mockImplementationOnce(() => new Promise(() => {}));
    renderPage();
    await screen.findAllByText("Bright Center");
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() => expect(mocks.overview).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Trang 2")).toBeTruthy();
    expect(screen.getAllByText("Bright Center").length).toBeGreaterThan(0);
  });

  it("uses short English copy while preserving KPI values and API filter enums", async () => {
    renderPage("en");
    expect(
      await screen.findByRole("heading", { name: "CRM overview" }),
    ).toBeTruthy();
    await screen.findAllByText("Bright Center");
    expect(
      screen.getByText("Track organizations, subscriptions and payments."),
    ).toBeTruthy();
    expect(screen.getByText("348 active members")).toBeTruthy();
    expect(screen.getByText("17 active paid subscriptions")).toBeTruthy();
    expect(screen.getByText(/42 paid orders · total/)).toBeTruthy();
    expect(screen.getByText("Review or refund")).toBeTruthy();
    expect(
      within(
        document.querySelector(".admin-crm-activity-list") as HTMLElement,
      ).getByText("Paid"),
    ).toBeTruthy();
    expect(screen.getByText("New organization")).toBeTruthy();
    expect(document.querySelector(".page-eyebrow")).toBeNull();

    fireEvent.change(screen.getByLabelText("Filter organization status"), {
      target: { value: "SUSPENDED" },
    });
    await waitFor(() =>
      expect(mocks.overview).toHaveBeenLastCalledWith(
        "super-token",
        { limit: 12, page: 1, status: "SUSPENDED" },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
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
