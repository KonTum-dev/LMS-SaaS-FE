// @vitest-environment jsdom

import { App as AntdApp, Form as AntdForm } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
import type { ReactNode } from "react";
import type {
  AdminOrderDetail,
  BillingPlan,
  PaymentOrder,
  PlanEntitlements,
  Subscription,
} from "@/lib/types";
import type { BillingPlanFormValues } from "@/lib/billing-plan";
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
const appUi = vi.hoisted(() => ({
  confirm: vi.fn(),
  message: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({ billingApi: api }));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    organization: null,
    token: "super-token",
    user: { role: "SUPER_ADMIN", sub: "root-001" },
  }),
}));
vi.mock(
  "antd",
  async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

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

const entitlements: PlanEntitlements = {
  maxActiveLearners: 200,
  maxBranches: 5,
  maxCourses: 25,
  maxUsers: 250,
  modules: ["USERS", "COURSES", "ASSIGNMENTS"],
};

function standardPlan(): BillingPlan {
  return {
    _id: "plan-standard",
    active: true,
    code: "standard",
    description: "Vận hành trung tâm",
    entitlements,
    features: ["Báo cáo cơ bản"],
    monthlyPriceVnd: 499000,
    name: "Standard",
    tierLevel: 2,
    yearlyPriceVnd: 4990000,
  };
}

const planForm = {
  resetFields: vi.fn(),
  setFieldsValue: vi.fn(),
  validateFields: vi.fn(),
};

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
      entitlements,
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

function readOnlySubscription(): Subscription {
  return {
    _id: "subscription-001",
    billingCycle: "MONTHLY",
    currentPeriodStartAt: "2030-08-01T00:00:00.000Z",
    currentPriceVnd: 499000,
    currentTierLevel: 2,
    effectiveAccess: {
      graceEndsAt: "2030-09-08T00:00:00.000Z",
      limits: {
        maxActiveLearners: 200,
        maxBranches: 5,
        maxCourses: 25,
        maxUsers: 250,
      },
      modules: ["USERS", "COURSES"],
      readOnly: true,
      state: "READ_ONLY",
    },
    endAt: "2030-09-01T00:00:00.000Z",
    entitlements,
    planCode: "standard",
    planId: "plan-standard",
    scheduledAt: null,
    scheduledPlanCode: null,
    scheduledPlanId: null,
    startedAt: "2030-07-01T00:00:00.000Z",
    status: "EXPIRED",
    tenantId: { _id: "tenant-001", name: "Bright", slug: "bright" },
  };
}

function detail(order = reviewOrder()): AdminOrderDetail {
  return { audits: [], events: [], order };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AdminBillingPage />
    </QueryClientProvider>,
  );
}

async function openReviewOrder() {
  fireEvent.click(await screen.findByRole("tab", { name: "Đơn thanh toán" }));
  fireEvent.click(await screen.findByRole("button", { name: /Chi tiết/i }));
  await screen.findByText("Snapshot stale");
}

async function submitConfirmation(reason: string) {
  const confirmation = appUi.confirm.mock.calls.at(-1)?.[0] as
    | { content?: ReactNode; onOk?: () => Promise<unknown> | unknown }
    | undefined;
  if (!confirmation?.content || !confirmation.onOk) {
    throw new Error("Không tìm thấy cấu hình xác nhận của Ant Design");
  }

  render(<>{confirmation.content}</>);
  fireEvent.change(screen.getByPlaceholderText(/Lý do xử lý/), {
    target: { value: reason },
  });
  await act(async () => {
    await confirmation.onOk?.();
  });
}

describe("AdminBillingPage order actions", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    appUi.confirm.mockReset();
    Object.values(appUi.message).forEach((mock) => mock.mockReset());
    vi.spyOn(AntdApp, "useApp").mockReturnValue({
      message: appUi.message,
      modal: { confirm: appUi.confirm },
    } as never);
    Object.values(planForm).forEach((mock) => mock.mockReset());
    vi.spyOn(AntdForm, "useForm").mockReturnValue([planForm] as never);
    api.adminListPlans.mockResolvedValue([]);
    api.adminListSubscriptions.mockResolvedValue({
      items: [],
      limit: 10,
      page: 1,
      total: 0,
    });
    api.adminListOrders.mockResolvedValue({
      items: [reviewOrder()],
      limit: 10,
      page: 1,
      total: 1,
    });
    api.adminGetOrder.mockResolvedValue(detail());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("Reconcile gọi đúng API với order và reason đã chọn", async () => {
    api.adminReconcileOrder.mockResolvedValue(
      detail({ ...reviewOrder(), status: "PAID" }),
    );
    renderPage();
    await openReviewOrder();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Áp dụng lại giao dịch vào thuê bao/,
      }),
    );
    await submitConfirmation("Đã kiểm tra sao kê");

    expect(api.adminReconcileOrder).toHaveBeenCalledWith(
      { token: "super-token" },
      "order-review-001",
      "Đã kiểm tra sao kê",
    );
    expect(api.adminMarkRefundRequired).not.toHaveBeenCalled();
    expect(appUi.message.success).toHaveBeenCalledWith(
      "Đã áp dụng giao dịch và cập nhật thuê bao",
    );
  });

  it("Refund gọi đúng API với order và reason đã chọn", async () => {
    api.adminMarkRefundRequired.mockResolvedValue(
      detail({ ...reviewOrder(), status: "REFUND_REQUIRED" }),
    );
    renderPage();
    await openReviewOrder();

    fireEvent.click(
      screen.getByRole("button", { name: /Đánh dấu giao dịch cần hoàn tiền/ }),
    );
    await submitConfirmation("Giao dịch cần hoàn ngoài hệ thống");

    expect(api.adminMarkRefundRequired).toHaveBeenCalledWith(
      { token: "super-token" },
      "order-review-001",
      "Giao dịch cần hoàn ngoài hệ thống",
    );
    expect(api.adminReconcileOrder).not.toHaveBeenCalled();
    expect(appUi.message.success).toHaveBeenCalledWith(
      "Đã cập nhật đơn thanh toán sang trạng thái “Cần hoàn tiền”",
    );
  });

  it("hiển thị entitlement của gói và access state vận hành của tenant", async () => {
    api.adminListPlans.mockResolvedValue([standardPlan()]);
    api.adminListSubscriptions.mockResolvedValue({
      items: [readOnlySubscription()],
      limit: 10,
      page: 1,
      total: 1,
    });
    renderPage();

    expect(
      (await screen.findAllByText("Tối đa 250 người dùng")).length,
    ).toBeGreaterThan(0);
    expect(
      (await screen.findAllByText("Tối đa 5 chi nhánh hoạt động")).length,
    ).toBeGreaterThan(0);
    expect(
      (await screen.findAllByText("Tối đa 200 học viên hoạt động")).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("tab", { name: "Thuê bao tổ chức" }));
    expect(await screen.findByText("Chỉ đọc")).toBeTruthy();
    expect(
      (await screen.findAllByText("Tối đa 25 khóa học")).length,
    ).toBeGreaterThan(0);
  });

  it("chỉ hiển thị trial tự động để đối soát, không có thao tác cấp hay gia hạn", async () => {
    api.adminListSubscriptions.mockResolvedValue({
      items: [
        {
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
        },
      ],
      limit: 10,
      page: 1,
      total: 1,
    });
    renderPage();

    fireEvent.click(
      await screen.findByRole("tab", { name: "Thuê bao tổ chức" }),
    );
    expect(await screen.findByText("Dùng thử tự động")).toBeTruthy();
    expect(screen.getByText(/Kết thúc .*2030/)).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: /cấp dùng thử|gia hạn dùng thử/i,
      }),
    ).toBeNull();
  });

  it("tạo gói và gửi null cho quota chi nhánh không giới hạn", async () => {
    const values: BillingPlanFormValues = {
      active: true,
      code: "growth",
      description: "Dành cho trung tâm đang mở rộng",
      entitlements: {
        maxActiveLearners: 320,
        maxBranches: undefined,
        maxCourses: 40,
        maxUsers: 500,
        modules: ["USERS", "COURSES", "ENROLLMENTS"],
      },
      featuresText: " Báo cáo cơ bản \n Hỗ trợ email ",
      monthlyPriceVnd: 799000,
      name: "Growth",
      tierLevel: 3,
      yearlyPriceVnd: 7990000,
    };
    planForm.validateFields.mockResolvedValue(values);
    api.adminCreatePlan.mockResolvedValue({
      ...standardPlan(),
      ...values,
      _id: "plan-growth",
      entitlements: {
        ...values.entitlements,
        maxBranches: null,
      },
      features: ["Báo cáo cơ bản", "Hỗ trợ email"],
    });
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "Thêm gói thuê bao" }),
    );
    expect(
      screen.getByLabelText("Số chi nhánh hoạt động tối đa"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Số học viên hoạt động tối đa"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tạo gói" }));

    await waitFor(() =>
      expect(api.adminCreatePlan).toHaveBeenCalledWith(
        { token: "super-token" },
        {
          active: true,
          code: "growth",
          description: "Dành cho trung tâm đang mở rộng",
          entitlements: {
            maxActiveLearners: 320,
            maxBranches: null,
            maxCourses: 40,
            maxUsers: 500,
            modules: ["USERS", "COURSES", "ENROLLMENTS"],
          },
          features: ["Báo cáo cơ bản", "Hỗ trợ email"],
          monthlyPriceVnd: 799000,
          name: "Growth",
          tierLevel: 3,
          yearlyPriceVnd: 7990000,
        },
      ),
    );
  });

  it("cập nhật gói và gửi null cho quota học viên không giới hạn", async () => {
    api.adminListPlans.mockResolvedValue([standardPlan()]);
    const values: BillingPlanFormValues = {
      active: true,
      code: "standard",
      description: "Vận hành trung tâm nhiều cơ sở",
      entitlements: {
        maxActiveLearners: undefined,
        maxBranches: 8,
        maxCourses: 25,
        maxUsers: 250,
        modules: ["USERS", "COURSES"],
      },
      featuresText: "Báo cáo cơ bản",
      monthlyPriceVnd: 549000,
      name: "Standard",
      tierLevel: 2,
      yearlyPriceVnd: 5490000,
    };
    planForm.validateFields.mockResolvedValue(values);
    api.adminUpdatePlan.mockResolvedValue({
      ...standardPlan(),
      description: values.description,
      entitlements: {
        ...values.entitlements,
        maxActiveLearners: null,
      },
      monthlyPriceVnd: values.monthlyPriceVnd,
      yearlyPriceVnd: values.yearlyPriceVnd,
    });
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "Sửa gói Standard" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() =>
      expect(api.adminUpdatePlan).toHaveBeenCalledWith(
        { token: "super-token" },
        "plan-standard",
        {
          active: true,
          code: "standard",
          description: "Vận hành trung tâm nhiều cơ sở",
          entitlements: {
            maxActiveLearners: null,
            maxBranches: 8,
            maxCourses: 25,
            maxUsers: 250,
            modules: ["USERS", "COURSES"],
          },
          features: ["Báo cáo cơ bản"],
          monthlyPriceVnd: 549000,
          name: "Standard",
          tierLevel: 2,
          yearlyPriceVnd: 5490000,
        },
      ),
    );
  });
});
