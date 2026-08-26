// @vitest-environment jsdom

import { App as AntdApp } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminOrderDetail, PaymentOrder } from "@/lib/types";
import AdminBillingPage from "./page";

const api = vi.hoisted(() => ({
  adminCreatePlan: vi.fn(),
  adminGetOrder: vi.fn(),
  adminListOrders: vi.fn(),
  adminListPlans: vi.fn(),
  adminListSubscriptions: vi.fn(),
  adminMarkRefundRequired: vi.fn(),
  adminReconcileOrder: vi.fn(),
  adminUpdatePlan: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ billingApi: api }));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    organization: null,
    token: "super-token",
    user: { role: "SUPER_ADMIN", sub: "root-001" },
  }),
}));

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
  vi.stubGlobal("ResizeObserver", class {
    disconnect() {}
    observe() {}
    unobserve() {}
  });
});

function reviewOrder(): PaymentOrder {
  return {
    _id: "order-review-001",
    amountVnd: 250000,
    canceledAt: null,
    createdAt: "2030-08-16T00:00:00.000Z",
    currency: "VND",
    expiresAt: "2030-08-16T00:30:00.000Z",
    invoiceNumber: "DXLMS-REVIEW-001",
    paidAt: null,
    paymentCapturedAt: "2030-08-16T00:01:00.000Z",
    planId: "plan-premium",
    planSnapshot: {
      billingCycle: "MONTHLY",
      code: "premium",
      durationMonths: 1,
      formula: "PRORATED_UPGRADE",
      fullPeriodMs: 2678400000,
      name: "Premium",
      planId: "plan-premium",
      priceDifferenceVnd: 500000,
      priceVnd: 999000,
      remainingMs: 1339200000,
      sourceBillingCycle: "MONTHLY",
      sourceCurrentPeriodStartAt: "2030-08-01T00:00:00.000Z",
      sourceEndAt: "2030-09-01T00:00:00.000Z",
      sourcePlanCode: "standard",
      sourcePlanId: "plan-standard",
      sourcePriceVnd: 499000,
      sourceTierLevel: 2,
      tierLevel: 3,
    },
    provider: "SEPAY",
    reviewReason: "Snapshot stale",
    status: "REVIEW_REQUIRED",
    subscriptionAppliedAt: null,
    tenantId: { _id: "tenant-001", name: "Bright", slug: "bright" },
    transactionReference: "tra…456",
    type: "UPGRADE",
    updatedAt: "2030-08-16T00:01:00.000Z",
  };
}

function detail(order = reviewOrder()): AdminOrderDetail {
  return { audits: [], events: [], order };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AntdApp><AdminBillingPage /></AntdApp></QueryClientProvider>);
}

async function openReviewOrder() {
  fireEvent.click(await screen.findByRole("tab", { name: "Đơn thanh toán" }));
  fireEvent.click(await screen.findByRole("button", { name: /Chi tiết/i }));
  await screen.findByText("Snapshot stale");
}

describe("AdminBillingPage order actions", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.adminListPlans.mockResolvedValue([]);
    api.adminListSubscriptions.mockResolvedValue({ items: [], limit: 10, page: 1, total: 0 });
    api.adminListOrders.mockResolvedValue({ items: [reviewOrder()], limit: 10, page: 1, total: 1 });
    api.adminGetOrder.mockResolvedValue(detail());
  });

  afterEach(cleanup);

  it("Reconcile gọi đúng API với order và reason đã chọn", async () => {
    api.adminReconcileOrder.mockResolvedValue(
      detail({ ...reviewOrder(), status: "PAID" }),
    );
    renderPage();
    await openReviewOrder();

    fireEvent.click(screen.getByRole("button", { name: /Reconcile/ }));
    fireEvent.change(await screen.findByPlaceholderText(/Lý do vận hành/), {
      target: { value: "Đã kiểm tra sao kê" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thử reconcile" }));

    await waitFor(() =>
      expect(api.adminReconcileOrder).toHaveBeenCalledWith(
        { token: "super-token" },
        "order-review-001",
        "Đã kiểm tra sao kê",
      ),
    );
    expect(api.adminMarkRefundRequired).not.toHaveBeenCalled();
  }, 10000);

  it("Refund gọi đúng API với order và reason đã chọn", async () => {
    api.adminMarkRefundRequired.mockResolvedValue(
      detail({ ...reviewOrder(), status: "REFUND_REQUIRED" }),
    );
    renderPage();
    await openReviewOrder();

    fireEvent.click(
      screen.getByRole("button", { name: /Đánh dấu cần hoàn tiền/ }),
    );
    fireEvent.change(await screen.findByPlaceholderText(/Lý do vận hành/), {
      target: { value: "Giao dịch cần hoàn ngoài hệ thống" },
    });
    const refundButtons = screen.getAllByRole("button", {
      name: /Đánh dấu cần hoàn tiền/,
    });
    fireEvent.click(refundButtons.at(-1)!);

    await waitFor(() =>
      expect(api.adminMarkRefundRequired).toHaveBeenCalledWith(
        { token: "super-token" },
        "order-review-001",
        "Giao dịch cần hoàn ngoài hệ thống",
      ),
    );
    expect(api.adminReconcileOrder).not.toHaveBeenCalled();
  }, 10000);
});
