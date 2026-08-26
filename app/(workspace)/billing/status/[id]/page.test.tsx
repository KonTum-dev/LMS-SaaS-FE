// @vitest-environment jsdom

import { App as AntdApp } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentOrder } from "@/lib/types";
import BillingStatusPage from "./page";

const { auth, getOrder, invalidateQueries } = vi.hoisted(() => ({
  auth: { role: "TENANT_ADMIN" },
  getOrder: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ billingApi: { getOrder } }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "order-001" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    organization: { _id: "tenant-001" },
    token: "tenant-token",
    user: { role: auth.role, sub: "user-001", tenantId: "tenant-001" },
  }),
}));

function order(status: PaymentOrder["status"]): PaymentOrder {
  return {
    _id: "order-001",
    amountVnd: 499000,
    canceledAt: null,
    createdAt: "2030-08-16T00:00:00.000Z",
    currency: "VND",
    expiresAt: "2030-08-16T00:30:00.000Z",
    invoiceNumber: "DXLMS-001",
    paidAt: status === "PAID" ? "2030-08-16T00:01:00.000Z" : null,
    paymentCapturedAt: status === "PAID" ? "2030-08-16T00:01:00.000Z" : null,
    planId: "plan-001",
    planSnapshot: {
      billingCycle: "MONTHLY",
      code: "standard",
      durationMonths: 1,
      formula: "FULL",
      fullPeriodMs: null,
      name: "Standard",
      planId: "plan-001",
      priceDifferenceVnd: null,
      priceVnd: 499000,
      remainingMs: null,
      sourceCurrentPeriodStartAt: null,
      sourceEndAt: null,
      sourcePlanCode: null,
      sourceBillingCycle: null,
      sourcePlanId: null,
      sourcePriceVnd: null,
      sourceTierLevel: null,
      tierLevel: 2,
    },
    provider: "SEPAY",
    reviewReason: null,
    status,
    subscriptionAppliedAt: status === "PAID" ? "2030-08-16T00:01:00.000Z" : null,
    tenantId: "tenant-001",
    type: "NEW",
    updatedAt: "2030-08-16T00:01:00.000Z",
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  vi.spyOn(client, "invalidateQueries").mockImplementation(invalidateQueries);
  render(<QueryClientProvider client={client}><AntdApp><BillingStatusPage /></AntdApp></QueryClientProvider>);
}

describe("BillingStatusPage polling", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getOrder.mockReset();
    invalidateQueries.mockReset().mockResolvedValue(undefined);
    auth.role = "TENANT_ADMIN";
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("poll lại PENDING rồi dừng ở PAID và làm mới cache thuê bao/order", async () => {
    getOrder.mockResolvedValueOnce(order("PENDING")).mockResolvedValue(order("PAID"));
    renderPage();
    await screen.findAllByText("Đang chờ");

    await vi.advanceTimersByTimeAsync(2000);
    await screen.findAllByText("Đã thanh toán");
    expect(getOrder).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(2));

    await vi.advanceTimersByTimeAsync(4000);
    expect(getOrder).toHaveBeenCalledTimes(2);
  });

  it("không poll khi response đầu tiên đã terminal", async () => {
    getOrder.mockResolvedValue(order("EXPIRED"));
    renderPage();
    await screen.findAllByText("Đã hết hạn");
    await vi.advanceTimersByTimeAsync(4000);
    expect(getOrder).toHaveBeenCalledTimes(1);
  });

  it("EXPIRED tiếp tục poll chậm để nhận late IPN", async () => {
    getOrder.mockResolvedValueOnce(order("EXPIRED")).mockResolvedValue(order("PAID"));
    renderPage();
    await screen.findAllByText("Đã hết hạn");

    await vi.advanceTimersByTimeAsync(9000);
    expect(getOrder).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    await screen.findAllByText("Đã thanh toán");
    expect(getOrder).toHaveBeenCalledTimes(2);
  });

  it("lỗi transient sau PENDING vẫn tiếp tục poll tới PAID", async () => {
    getOrder
      .mockResolvedValueOnce(order("PENDING"))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(order("PAID"));
    renderPage();
    await screen.findAllByText("Đang chờ");

    await vi.advanceTimersByTimeAsync(2000);
    await screen.findByText(/Kết nối tạm thời gián đoạn/);
    await vi.advanceTimersByTimeAsync(2000);
    await screen.findAllByText("Đã thanh toán");
    expect(getOrder).toHaveBeenCalledTimes(3);
  });

  it("lỗi 404 ban đầu dừng poll", async () => {
    getOrder.mockRejectedValue(new Error("Không tìm thấy order"));
    renderPage();
    await screen.findByText("Không tìm thấy order");
    await vi.advanceTimersByTimeAsync(20000);
    expect(getOrder).toHaveBeenCalledTimes(1);
  });

  it("vai trò khác TENANT_ADMIN chỉ thấy cảnh báo và không gọi API", async () => {
    auth.role = "LEARNER";
    renderPage();
    await screen.findByText("Bạn không có quyền xem order billing.");
    expect(getOrder).not.toHaveBeenCalled();
  });
});
