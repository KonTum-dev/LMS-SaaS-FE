// @vitest-environment jsdom

import { App as AntdApp } from "antd";
import {
  defaultScheduler,
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type {
  EffectiveAccess,
  PaymentOrder,
  PlanEntitlements,
  Subscription,
} from "@/lib/types";
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
const auth = vi.hoisted(() => ({
  effectiveAccess: null as EffectiveAccess | null,
  updateEffectiveAccess: vi.fn(),
}));
const appUi = vi.hoisted(() => ({
  confirm: vi.fn(),
  message: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({ billingApi: api, submitCheckoutForm }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: auth.effectiveAccess,
    organization: { _id: "tenant-001" },
    token: "tenant-token",
    updateEffectiveAccess: auth.updateEffectiveAccess,
    user: {
      membershipId: "membership-001",
      role: "TENANT_ADMIN",
      sub: "user-001",
      tenantId: "tenant-001",
    },
  }),
}));
vi.mock("@ant-design/icons", () => ({
  CheckOutlined: () => null,
  CreditCardOutlined: () => null,
  EyeOutlined: () => null,
  HistoryOutlined: () => null,
}));
vi.mock(
  "antd",
  async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

const planEntitlements: PlanEntitlements = {
  maxActiveLearners: null,
  maxBranches: null,
  maxCourses: 25,
  maxUsers: 250,
  modules: ["USERS", "COURSES", "ASSIGNMENTS"],
};

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
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
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
      entitlements: planEntitlements,
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

function readOnlySubscription(): Subscription {
  return {
    _id: "subscription-001",
    billingCycle: "MONTHLY",
    createdAt: "2030-07-01T00:00:00.000Z",
    currentPeriodStartAt: "2030-08-01T00:00:00.000Z",
    currentPriceVnd: 499000,
    currentTierLevel: 2,
    effectiveAccess: {
      graceEndsAt: "2030-09-08T00:00:00.000Z",
      limits: {
        maxActiveLearners: null,
        maxBranches: null,
        maxCourses: 25,
        maxUsers: 250,
      },
      modules: ["USERS", "COURSES", "ASSIGNMENTS"],
      readOnly: true,
      state: "READ_ONLY",
    },
    endAt: "2030-09-01T00:00:00.000Z",
    entitlements: planEntitlements,
    planCode: "standard",
    planId: "plan-001",
    scheduledAt: null,
    scheduledPlanCode: null,
    scheduledPlanId: null,
    startedAt: "2030-07-01T00:00:00.000Z",
    status: "EXPIRED",
    tenantId: "tenant-001",
    updatedAt: "2030-09-09T00:00:00.000Z",
  };
}

describe("BillingPage mock reload", () => {
  beforeEach(() => {
    notifyManager.setScheduler((callback) => queueMicrotask(callback));
    vi.stubEnv("NEXT_PUBLIC_ENABLE_BILLING_SIMULATOR", "true");
    Object.values(api).forEach((mock) => mock.mockReset());
    auth.effectiveAccess = null;
    auth.updateEffectiveAccess.mockReset();
    appUi.confirm.mockReset();
    Object.values(appUi.message).forEach((mock) => mock.mockReset());
    vi.spyOn(AntdApp, "useApp").mockReturnValue({
      message: appUi.message,
      modal: { confirm: appUi.confirm },
    } as never);
    api.listPlans.mockResolvedValue([]);
    api.getSubscription.mockResolvedValue(null);
    api.listOrders.mockResolvedValue([mockPending()]);
    api.simulate.mockResolvedValue({ ...mockPending(), status: "PAID" });
    submitCheckoutForm.mockReset();
  });

  afterEach(() => {
    notifyManager.setScheduler(defaultScheduler);
    vi.unstubAllEnvs();
    cleanup();
    vi.restoreAllMocks();
  });

  it("hiện thao tác mock từ order backend sau reload và gửi đúng order id", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <BillingPage />
      </QueryClientProvider>,
    );

    const paidButton = await screen.findByRole("button", {
      name: /Mô phỏng đã thanh toán/i,
    });
    fireEvent.click(paidButton);

    await waitFor(() =>
      expect(api.simulate).toHaveBeenCalledWith(
        { token: "tenant-token" },
        "mock-order-001",
        "PAID",
      ),
    );
    await waitFor(() => expect(appUi.message.success).toHaveBeenCalled());
  });

  it("click CTA SePay tạo checkout rồi submit form đúng một lần", async () => {
    api.listPlans.mockResolvedValue([
      {
        _id: "plan-001",
        active: true,
        code: "standard",
        description: "",
        entitlements: planEntitlements,
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
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <BillingPage />
      </QueryClientProvider>,
    );

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
        entitlements: planEntitlements,
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
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <BillingPage />
      </QueryClientProvider>,
    );

    const button = await screen.findByRole("button", { name: /Chọn gói/i });
    fireEvent.click(button);
    await waitFor(() => expect(api.createCheckout).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(appUi.message.info).toHaveBeenCalledWith(
        "Đã tạo đơn thanh toán mô phỏng và đang chờ xử lý. Hãy dùng nút “Mô phỏng đã thanh toán” trong lịch sử đơn để hoàn tất.",
      ),
    );
    await waitFor(() => expect(api.listOrders).toHaveBeenCalledTimes(2));
    fireEvent.click(button);
    await waitFor(() => expect(api.createCheckout).toHaveBeenCalledTimes(2));

    const firstKey = api.createCheckout.mock.calls[0][1].idempotencyKey;
    const secondKey = api.createCheckout.mock.calls[1][1].idempotencyKey;
    expect(secondKey).not.toBe(firstKey);
    await waitFor(() => expect(api.listOrders).toHaveBeenCalledTimes(3));
  });

  it("giữ Idempotency-Key khi checkout lỗi chưa rõ kết quả để retry an toàn", async () => {
    api.listPlans.mockResolvedValue([
      {
        _id: "plan-001",
        active: true,
        code: "standard",
        description: "",
        entitlements: planEntitlements,
        features: [],
        monthlyPriceVnd: 499000,
        name: "Standard",
        tierLevel: 2,
        yearlyPriceVnd: 4990000,
      },
    ]);
    api.listOrders.mockResolvedValue([]);
    api.createCheckout.mockRejectedValue(new Error("network timeout"));
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <BillingPage />
      </QueryClientProvider>,
    );

    const button = await screen.findByRole("button", { name: /Chọn gói/i });
    fireEvent.click(button);
    await waitFor(() => expect(api.createCheckout).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(button.className).not.toContain("ant-btn-loading"),
    );
    fireEvent.click(button);
    await waitFor(() => expect(api.createCheckout).toHaveBeenCalledTimes(2));

    expect(api.createCheckout.mock.calls[1][1].idempotencyKey).toBe(
      api.createCheckout.mock.calls[0][1].idempotencyKey,
    );
    await waitFor(() => expect(appUi.message.error).toHaveBeenCalledTimes(2));
  });

  it("hiển thị entitlement có cấu trúc và trạng thái READ_ONLY từ backend", async () => {
    api.listPlans.mockResolvedValue([
      {
        _id: "plan-001",
        active: true,
        code: "standard",
        description: "",
        entitlements: planEntitlements,
        features: ["Hỗ trợ tiêu chuẩn"],
        monthlyPriceVnd: 499000,
        name: "Standard",
        tierLevel: 2,
        yearlyPriceVnd: 4990000,
      },
    ]);
    api.getSubscription.mockResolvedValue(readOnlySubscription());
    api.listOrders.mockResolvedValue([]);
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <BillingPage />
      </QueryClientProvider>,
    );

    await screen.findByText("Workspace đang ở chế độ chỉ đọc");
    expect(screen.getAllByText("Tối đa 250 người dùng").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText("Tối đa 25 khóa học").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Khóa học").length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(auth.updateEffectiveAccess).toHaveBeenCalledWith(
        expect.objectContaining({ readOnly: true, state: "READ_ONLY" }),
        "tenant-001",
      ),
    );
  });

  it("hiển thị trial từ subscription khi effective access chưa có cờ legacy", async () => {
    api.listPlans.mockResolvedValue([
      {
        _id: "plan-001",
        active: true,
        code: "standard",
        description: "",
        entitlements: planEntitlements,
        features: [],
        monthlyPriceVnd: 499000,
        name: "Standard",
        tierLevel: 2,
        yearlyPriceVnd: 4990000,
      },
    ]);
    api.getSubscription.mockResolvedValue({
      ...readOnlySubscription(),
      currentPriceVnd: 0,
      effectiveAccess: {
        ...readOnlySubscription().effectiveAccess,
        graceEndsAt: null,
        readOnly: false,
        state: "ACTIVE",
      },
      endAt: "2030-08-24T00:00:00.000Z",
      isTrial: true,
      status: "ACTIVE",
      trialEndsAt: "2030-08-24T00:00:00.000Z",
    });
    api.listOrders.mockResolvedValue([]);
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <BillingPage />
      </QueryClientProvider>,
    );

    await screen.findByText("Bạn đang dùng thử miễn phí");
    expect(screen.getAllByText("Bắt đầu trả phí").length).toBeGreaterThan(0);
    expect(screen.getByText(/chuyển sang thuê bao trả phí/)).toBeTruthy();
  });

  it("ưu tiên trial false từ effective access khi trial đã hết hạn", async () => {
    api.listPlans.mockResolvedValue([
      {
        _id: "plan-001",
        active: true,
        code: "standard",
        description: "",
        entitlements: planEntitlements,
        features: [],
        monthlyPriceVnd: 499000,
        name: "Standard",
        tierLevel: 2,
        yearlyPriceVnd: 4990000,
      },
    ]);
    api.getSubscription.mockResolvedValue({
      ...readOnlySubscription(),
      currentPriceVnd: 0,
      effectiveAccess: {
        ...readOnlySubscription().effectiveAccess,
        trial: false,
        trialEndsAt: "2030-08-24T00:00:00.000Z",
      },
      endAt: "2030-08-24T00:00:00.000Z",
      isTrial: true,
      status: "EXPIRED",
      trialEndsAt: "2030-08-24T00:00:00.000Z",
    });
    api.listOrders.mockResolvedValue([]);
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <BillingPage />
      </QueryClientProvider>,
    );

    await screen.findByText("Workspace đang ở chế độ chỉ đọc");
    expect(screen.queryByText("Bạn đang dùng thử miễn phí")).toBeNull();
    expect(screen.queryByText("Dùng thử miễn phí")).toBeNull();
    expect(screen.getByText(/Hiệu lực đến/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gia hạn" })).toBeTruthy();
  });

  it("cho trial chuyển sang gói khác cùng tier qua checkout", async () => {
    api.listPlans.mockResolvedValue([
      {
        _id: "plan-001",
        active: true,
        code: "standard",
        description: "",
        entitlements: planEntitlements,
        features: [],
        monthlyPriceVnd: 499000,
        name: "Standard",
        tierLevel: 2,
        yearlyPriceVnd: 4990000,
      },
      {
        _id: "plan-002",
        active: true,
        code: "flex",
        description: "",
        entitlements: planEntitlements,
        features: [],
        monthlyPriceVnd: 599000,
        name: "Flex",
        tierLevel: 2,
        yearlyPriceVnd: 5990000,
      },
    ]);
    api.getSubscription.mockResolvedValue({
      ...readOnlySubscription(),
      currentPriceVnd: 0,
      effectiveAccess: {
        ...readOnlySubscription().effectiveAccess,
        graceEndsAt: null,
        readOnly: false,
        state: "ACTIVE",
        trial: true,
        trialEndsAt: "2030-08-24T00:00:00.000Z",
      },
      endAt: "2030-08-24T00:00:00.000Z",
      isTrial: true,
      status: "ACTIVE",
      trialEndsAt: "2030-08-24T00:00:00.000Z",
    });
    api.listOrders.mockResolvedValue([]);
    api.createCheckout.mockResolvedValue({
      checkout: { action: null, fields: {}, method: null, mode: "MOCK" },
      order: { ...mockPending(), planId: "plan-002" },
    });
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <BillingPage />
      </QueryClientProvider>,
    );

    const flexHeading = await screen.findByRole("heading", { name: "Flex" });
    const flexCard = flexHeading.closest("section");
    expect(flexCard).not.toBeNull();
    const checkoutButton = within(flexCard!).getByRole("button", {
      name: "Bắt đầu trả phí",
    });
    expect((checkoutButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(checkoutButton);

    await waitFor(() =>
      expect(api.createCheckout).toHaveBeenCalledWith(
        { token: "tenant-token" },
        expect.objectContaining({ planId: "plan-002" }),
      ),
    );
    expect(appUi.confirm).not.toHaveBeenCalled();
  });

  it("hiển thị module và hạn mức hiệu lực của workspace trong trial", async () => {
    api.listPlans.mockResolvedValue([
      {
        _id: "plan-001",
        active: true,
        code: "standard",
        description: "",
        entitlements: planEntitlements,
        features: [],
        monthlyPriceVnd: 499000,
        name: "Standard",
        tierLevel: 2,
        yearlyPriceVnd: 4990000,
      },
    ]);
    api.getSubscription.mockResolvedValue({
      ...readOnlySubscription(),
      currentPriceVnd: 0,
      effectiveAccess: {
        graceEndsAt: null,
        limits: {
          maxActiveLearners: null,
          maxBranches: null,
          maxCourses: 3,
          maxUsers: 20,
        },
        modules: ["USERS"],
        readOnly: false,
        state: "ACTIVE",
        trial: true,
        trialEndsAt: "2030-08-24T00:00:00.000Z",
      },
      endAt: "2030-08-24T00:00:00.000Z",
      isTrial: true,
      status: "ACTIVE",
      trialEndsAt: "2030-08-24T00:00:00.000Z",
    });
    api.listOrders.mockResolvedValue([]);
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    const { container } = render(
      <QueryClientProvider client={client}>
        <BillingPage />
      </QueryClientProvider>,
    );

    await screen.findByText("Bạn đang dùng thử miễn phí");
    const currentSummary = container.querySelector<HTMLElement>(
      '[aria-label="Thuê bao hiện tại"]',
    );
    expect(currentSummary).not.toBeNull();
    expect(currentSummary!.textContent).toContain("Tối đa 20 người dùng");
    expect(currentSummary!.textContent).toContain("Tối đa 3 khóa học");
    expect(within(currentSummary!).getByText("Người dùng")).toBeTruthy();
    expect(within(currentSummary!).queryByText("Khóa học")).toBeNull();
    expect(
      screen.getByText(/Workspace đang dùng các quyền hiện được cấp theo gói Standard/),
    ).toBeTruthy();
    expect(screen.queryByText(/toàn bộ quyền|đầy đủ quyền/i)).toBeNull();
  });

  it("dùng ngày trial từ effective access khi subscription là contract legacy", async () => {
    api.listPlans.mockResolvedValue([
      {
        _id: "plan-001",
        active: true,
        code: "standard",
        description: "",
        entitlements: planEntitlements,
        features: [],
        monthlyPriceVnd: 499000,
        name: "Standard",
        tierLevel: 2,
        yearlyPriceVnd: 4990000,
      },
    ]);
    api.getSubscription.mockResolvedValue({
      ...readOnlySubscription(),
      currentPriceVnd: 0,
      effectiveAccess: {
        ...readOnlySubscription().effectiveAccess,
        graceEndsAt: null,
        readOnly: false,
        state: "ACTIVE",
        trial: true,
        trialEndsAt: "2030-08-26T00:00:00.000Z",
      },
      endAt: "2030-09-01T00:00:00.000Z",
      status: "ACTIVE",
    });
    api.listOrders.mockResolvedValue([]);
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <BillingPage />
      </QueryClientProvider>,
    );

    await screen.findByText("Bạn đang dùng thử miễn phí");
    expect(screen.getAllByText(/26.*2030/).length).toBeGreaterThan(0);
  });

  it("fallback về ngày hết hạn thuê bao khi contract trial cũ thiếu hai trialEndsAt", async () => {
    api.listPlans.mockResolvedValue([
      {
        _id: "plan-001",
        active: true,
        code: "standard",
        description: "",
        entitlements: planEntitlements,
        features: [],
        monthlyPriceVnd: 499000,
        name: "Standard",
        tierLevel: 2,
        yearlyPriceVnd: 4990000,
      },
    ]);
    api.getSubscription.mockResolvedValue({
      ...readOnlySubscription(),
      currentPriceVnd: 0,
      effectiveAccess: {
        ...readOnlySubscription().effectiveAccess,
        graceEndsAt: null,
        readOnly: false,
        state: "ACTIVE",
      },
      endAt: "2030-08-28T00:00:00.000Z",
      isTrial: true,
      status: "ACTIVE",
    });
    api.listOrders.mockResolvedValue([]);
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <BillingPage />
      </QueryClientProvider>,
    );

    await screen.findByText("Bạn đang dùng thử miễn phí");
    expect(screen.getAllByText(/28.*2030/).length).toBeGreaterThan(0);
  });

  it("giữ effectiveAccess từ auth/me khi tenant chưa có subscription", async () => {
    auth.effectiveAccess = readOnlySubscription().effectiveAccess;
    api.getSubscription.mockResolvedValue(null);
    api.listPlans.mockResolvedValue([]);
    api.listOrders.mockResolvedValue([]);
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <BillingPage />
      </QueryClientProvider>,
    );

    await screen.findByText("Tổ chức chưa có thuê bao");
    expect(screen.getByText("Workspace đang ở chế độ chỉ đọc")).toBeTruthy();
    expect(auth.updateEffectiveAccess).not.toHaveBeenCalled();
  });
});
