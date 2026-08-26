// @vitest-environment jsdom

import { App as AntdApp } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentOrder } from "@/lib/types";
import BillingPage from "./page";

const api = vi.hoisted(() => ({
  cancelScheduledDowngrade: vi.fn(),
  createCheckout: vi.fn(),
  getSubscription: vi.fn(),
  listOrders: vi.fn(),
  listPlans: vi.fn(),
  scheduleDowngrade: vi.fn(),
  simulate: vi.fn(),
}));
const { submitCheckoutForm } = vi.hoisted(() => ({
  submitCheckoutForm: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ billingApi: api, submitCheckoutForm }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    organization: { _id: "tenant-001" },
    token: "tenant-token",
    user: { role: "TENANT_ADMIN", sub: "user-001", tenantId: "tenant-001" },
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

function mockPending(): PaymentOrder {
  return {
    _id: "mock-order-001",
    amountVnd: 499000,
    canceledAt: null,
    createdAt: "2030-08-16T00:00:00.000Z",
    currency: "VND",
    expiresAt: "2030-08-16T00:30:00.000Z",
    invoiceNumber: "DXLMS-MOCK-001",
    paidAt: null,
    paymentCapturedAt: null,
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
    provider: "MOCK",
    reviewReason: null,
    status: "PENDING",
    subscriptionAppliedAt: null,
    tenantId: "tenant-001",
    type: "NEW",
    updatedAt: "2030-08-16T00:00:00.000Z",
  };
}

describe("BillingPage mock reload", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listPlans.mockResolvedValue([]);
    api.getSubscription.mockResolvedValue(null);
    api.listOrders.mockResolvedValue([mockPending()]);
    api.simulate.mockResolvedValue({ ...mockPending(), status: "PAID" });
    submitCheckoutForm.mockReset();
  });

  afterEach(cleanup);

  it("hiện thao tác mock từ order backend sau reload và gửi đúng order id", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><AntdApp><BillingPage /></AntdApp></QueryClientProvider>);

    const paidButton = await screen.findByRole("button", { name: /Paid mock/i });
    fireEvent.click(paidButton);

    await waitFor(() => expect(api.simulate).toHaveBeenCalledWith(
      { token: "tenant-token" },
      "mock-order-001",
      "PAID",
    ));
  });

  it("click CTA SePay tạo checkout rồi submit form đúng một lần", async () => {
    api.listPlans.mockResolvedValue([
      {
        _id: "plan-001",
        active: true,
        code: "standard",
        description: "",
        features: [],
        monthlyPriceVnd: 499000,
        name: "Standard",
        tierLevel: 2,
        yearlyPriceVnd: 4990000,
      },
    ]);
    api.listOrders.mockResolvedValue([]);
    const sepayOrder = { ...mockPending(), provider: "SEPAY" as const };
    api.createCheckout.mockResolvedValue({
      checkout: {
        action: "https://pay-sandbox.sepay.vn/v1/checkout/init",
        fields: { merchant: "merchant-id", signature: "signed" },
        method: "POST",
        mode: "SEPAY",
      },
      order: sepayOrder,
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><AntdApp><BillingPage /></AntdApp></QueryClientProvider>);

    fireEvent.click(await screen.findByRole("button", { name: /Chọn gói/i }));

    await waitFor(() => expect(api.createCheckout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(submitCheckoutForm).toHaveBeenCalledTimes(1));
    expect(submitCheckoutForm).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "SEPAY" }),
    );
  });

  it("recycle Idempotency-Key khi live order của attempt đã EXPIRED", async () => {
    api.listPlans.mockResolvedValue([
      {
        _id: "plan-001",
        active: true,
        code: "standard",
        description: "",
        features: [],
        monthlyPriceVnd: 499000,
        name: "Standard",
        tierLevel: 2,
        yearlyPriceVnd: 4990000,
      },
    ]);
    api.listOrders
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ ...mockPending(), status: "EXPIRED" }]);
    api.createCheckout.mockResolvedValue({
      checkout: { action: null, fields: {}, method: null, mode: "MOCK" },
      order: mockPending(),
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><AntdApp><BillingPage /></AntdApp></QueryClientProvider>);

    const button = await screen.findByRole("button", { name: /Chọn gói/i });
    fireEvent.click(button);
    await waitFor(() => expect(api.createCheckout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.listOrders).toHaveBeenCalledTimes(2));
    fireEvent.click(button);
    await waitFor(() => expect(api.createCheckout).toHaveBeenCalledTimes(2));

    const firstKey = api.createCheckout.mock.calls[0][1].idempotencyKey;
    const secondKey = api.createCheckout.mock.calls[1][1].idempotencyKey;
    expect(secondKey).not.toBe(firstKey);
  });

  it("giữ Idempotency-Key khi checkout lỗi chưa rõ kết quả để retry an toàn", async () => {
    api.listPlans.mockResolvedValue([
      {
        _id: "plan-001",
        active: true,
        code: "standard",
        description: "",
        features: [],
        monthlyPriceVnd: 499000,
        name: "Standard",
        tierLevel: 2,
        yearlyPriceVnd: 4990000,
      },
    ]);
    api.listOrders.mockResolvedValue([]);
    api.createCheckout.mockRejectedValue(new Error("network timeout"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><AntdApp><BillingPage /></AntdApp></QueryClientProvider>);

    const button = await screen.findByRole("button", { name: /Chọn gói/i });
    fireEvent.click(button);
    await waitFor(() => expect(api.createCheckout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button.className).not.toContain("ant-btn-loading"));
    fireEvent.click(button);
    await waitFor(() => expect(api.createCheckout).toHaveBeenCalledTimes(2));

    expect(api.createCheckout.mock.calls[1][1].idempotencyKey).toBe(
      api.createCheckout.mock.calls[0][1].idempotencyKey,
    );
  });
});
