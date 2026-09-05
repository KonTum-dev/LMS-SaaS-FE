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
import type { ReactNode } from "react";
import type {
  AdminOrderDetail,
  BillingPlan,
  LmsModule,
  PaymentOrder,
  PlanEntitlements,
  Subscription,
} from "@/lib/types";
import type { BillingPlanFormValues } from "@/lib/billing-plan";
import { ApiError } from "@/lib/api";
import { Form as LocalizedForm } from "@/components/form/localized-form";
import {
  FeedbackLanguageSwitcher,
  FeedbackLocaleProvider,
} from "@/components/feedback/feedback-locale";
import { lmsModuleOptions } from "@/lib/entitlements";
import AdminBillingPage from "./page";

const api = vi.hoisted(() => ({
  adminCreatePlan: vi.fn(),
  adminGetPlan: vi.fn(),
  adminDisablePlan: vi.fn(),
  adminRestorePlan: vi.fn(),
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
  planModal: null as null | {
    cancelButtonProps?: { disabled?: boolean };
    closable?: boolean;
    confirmLoading?: boolean;
    keyboard?: boolean;
    mask?: { closable?: boolean };
    onCancel?: () => void;
    onOk?: () => void;
  },
  message: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  billingApi: api,
}));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    organization: null,
    token: "super-token",
    user: { role: "SUPER_ADMIN", sub: "root-001" },
  }),
}));
vi.mock("antd", async () => {
  const { lightweightAntd } = await import("@/test-utils/lightweight-antd");
  return {
    ...lightweightAntd,
    Table: (props: Parameters<typeof lightweightAntd.Table>[0] & { loading?: boolean }) => (
      <div data-testid="billing-table" aria-busy={Boolean(props.loading)}>
        <lightweightAntd.Table {...props} />
      </div>
    ),
    Modal: (
      props: Parameters<typeof lightweightAntd.Modal>[0] & {
        className?: string;
      },
    ) => {
      if (props.className === "admin-form-modal") appUi.planModal = props;
      return <lightweightAntd.Modal {...props} />;
    },
  };
});

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
  scrollToField: vi.fn(),
  setFieldsValue: vi.fn(),
  validateFields: vi.fn(),
};

function validPlanValues(): BillingPlanFormValues {
  return {
    active: true,
    code: "standard",
    name: "Standard",
    tierLevel: 2,
    monthlyPriceVnd: 499000,
    yearlyPriceVnd: 4990000,
    entitlements: { ...entitlements, modules: ["COURSES"] },
  };
}

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

function renderPage(locale?: "vi" | "en") {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      {locale ? (
        <FeedbackLocaleProvider initialLocale={locale}>
          <FeedbackLanguageSwitcher />
          <AdminBillingPage />
        </FeedbackLocaleProvider>
      ) : (
        <AdminBillingPage />
      )}
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
    appUi.planModal = null;
    Object.values(appUi.message).forEach((mock) => mock.mockReset());
    vi.spyOn(AntdApp, "useApp").mockReturnValue({
      message: appUi.message,
      modal: { confirm: appUi.confirm },
    } as never);
    Object.values(planForm).forEach((mock) => mock.mockReset());
    const usePlanForm: typeof AntdForm.useForm = (providedForm) =>
      [providedForm ?? planForm] as never;
    // The wrapper exposes AntD's hook as a static alias. Keep the page and
    // wrapper on the same supplied instance, as the real hook does.
    vi.spyOn(AntdForm, "useForm").mockImplementation(usePlanForm);
    vi.spyOn(LocalizedForm, "useForm").mockImplementation(usePlanForm);
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

  it("tải chi tiết gói từ endpoint riêng và lọc theo tên hoặc mã", async () => {
    api.adminListPlans.mockResolvedValue([standardPlan()]);
    api.adminGetPlan.mockResolvedValue({
      ...standardPlan(),
      description: "Chi tiết mới nhất từ máy chủ",
    });
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Xem chi tiết gói Standard" }),
    );
    expect(
      await screen.findByText("Chi tiết mới nhất từ máy chủ"),
    ).toBeTruthy();
    expect(api.adminGetPlan).toHaveBeenCalledWith(
      { token: "super-token" },
      "plan-standard",
    );
    fireEvent.change(screen.getByLabelText("Tìm gói thuê bao"), {
      target: { value: "không tồn tại" },
    });
    expect(
      screen.queryByRole("button", { name: "Sửa gói Standard" }),
    ).toBeNull();
  });

  it.each([true, false])(
    "xác nhận trước khi đổi lifecycle gói đang bán=%s",
    async (active) => {
      api.adminListPlans.mockResolvedValue([{ ...standardPlan(), active }]);
      const lifecycle = active ? api.adminDisablePlan : api.adminRestorePlan;
      lifecycle.mockResolvedValue({ ...standardPlan(), active: !active });
      renderPage();
      fireEvent.click(
        await screen.findByRole("button", {
          name: `${active ? "Ngừng bán" : "Mở bán lại"} gói Standard`,
        }),
      );
      expect(lifecycle).not.toHaveBeenCalled();
      const confirmation = appUi.confirm.mock.calls.at(-1)![0];
      expect(confirmation.content).toContain("giữ nguyên");
      await act(async () => {
        await confirmation.onOk();
      });
      expect(lifecycle).toHaveBeenCalledWith(
        { token: "super-token" },
        "plan-standard",
      );
    },
  );

  it("giữ chi tiết an toàn khi endpoint trả lỗi", async () => {
    api.adminListPlans.mockResolvedValue([standardPlan()]);
    api.adminGetPlan.mockRejectedValue(new Error("Gói không còn tồn tại"));
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Xem chi tiết gói Standard" }),
    );
    expect(await screen.findByText("Không tải được chi tiết gói")).toBeTruthy();
    expect(screen.queryByText("Gói không còn tồn tại")).toBeNull();
  });

  it("hiển thị lỗi bảo vệ trial và không tự đánh dấu gói đã ngừng bán", async () => {
    api.adminListPlans.mockResolvedValue([standardPlan()]);
    api.adminDisablePlan.mockRejectedValue(
      new Error("Không thể ngừng bán gói Trial đang sử dụng"),
    );
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Ngừng bán gói Standard" }),
    );
    await act(async () => {
      await expect(appUi.confirm.mock.calls.at(-1)![0].onOk()).rejects.toThrow(
        "Trial",
      );
    });
    expect(appUi.message.error).toHaveBeenCalledWith(
      "Không thể ngừng bán gói Trial đang sử dụng",
    );
    expect(
      screen.getByRole("button", { name: "Ngừng bán gói Standard" }),
    ).toBeTruthy();
    expect(appUi.message.success).not.toHaveBeenCalled();
  });

  it("khóa thao tác của dòng khi cập nhật lifecycle đang chờ", async () => {
    api.adminListPlans.mockResolvedValue([standardPlan()]);
    let complete: (value: BillingPlan) => void = () => {};
    api.adminDisablePlan.mockImplementation(
      () =>
        new Promise<BillingPlan>((resolve) => {
          complete = resolve;
        }),
    );
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Ngừng bán gói Standard" }),
    );
    let pending: Promise<unknown>;
    act(() => {
      pending = appUi.confirm.mock.calls.at(-1)![0].onOk();
      expect(appUi.confirm.mock.calls.at(-1)![0].onOk()).toBe(pending);
    });
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Sửa gói Standard",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true),
    );
    expect(api.adminDisablePlan).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Ngừng bán gói Standard" }).classList.contains("ant-btn-loading")).toBe(true);
    await act(async () => {
      complete({ ...standardPlan(), active: false });
      await pending!;
    });
  });

  it("hiện tải chi tiết và refetch đơn, không gửi thêm khi bấm tải lại liên tiếp", async () => {
    let finishDetail!: (value: AdminOrderDetail) => void;
    api.adminGetOrder.mockImplementationOnce(() => new Promise<AdminOrderDetail>((resolve) => { finishDetail = resolve; }));
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "Đơn thanh toán" }));
    fireEvent.click(await screen.findByRole("button", { name: /Chi tiết/i }));
    const dialog = screen.getByRole("dialog", { name: "Chi tiết đơn thanh toán" });
    expect(within(dialog).getByText("Đang tải")).toBeTruthy();
    expect(within(dialog).queryByText("Snapshot stale")).toBeNull();
    await act(async () => finishDetail(detail()));
    await screen.findByText("Snapshot stale");
    expect(within(dialog).queryByText("Đang tải")).toBeNull();

    let finishList!: (value: { items: PaymentOrder[]; total: number }) => void;
    api.adminListOrders.mockImplementationOnce(() => new Promise<{ items: PaymentOrder[]; total: number }>((resolve) => { finishList = resolve; }));
    const refresh = screen.getByRole("button", { name: "Tải lại danh sách đơn thanh toán" });
    act(() => { fireEvent.click(refresh); fireEvent.click(refresh); });
    await waitFor(() => expect(refresh.classList.contains("ant-btn-loading")).toBe(true));
    expect(screen.getByTestId("billing-table").getAttribute("aria-busy")).toBe("true");
    expect(api.adminListOrders).toHaveBeenCalledTimes(2);
    await act(async () => finishList({ items: [reviewOrder()], total: 1 }));
    await waitFor(() => expect(refresh.classList.contains("ant-btn-loading")).toBe(false));
    expect(screen.getByTestId("billing-table").getAttribute("aria-busy")).toBe("false");
  });

  it("chỉ hiển thị loading cho thao tác đơn đang chạy và chặn xác nhận lặp", async () => {
    let complete!: (value: AdminOrderDetail) => void;
    api.adminReconcileOrder.mockImplementationOnce(() => new Promise<AdminOrderDetail>((resolve) => { complete = resolve; }));
    renderPage();
    await openReviewOrder();
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng lại giao dịch vào thuê bao" }));
    const confirmation = appUi.confirm.mock.calls.at(-1)![0];
    render(<>{confirmation.content}</>);
    fireEvent.change(screen.getByPlaceholderText(/Lý do xử lý/), { target: { value: "Đã đối soát" } });
    let pending!: Promise<unknown>;
    let duplicate!: Promise<unknown>;
    act(() => { pending = confirmation.onOk(); duplicate = confirmation.onOk(); });
    const reconcile = screen.getByRole("button", { name: "Áp dụng lại giao dịch vào thuê bao" });
    const refund = screen.getByRole("button", { name: "Đánh dấu giao dịch cần hoàn tiền" }) as HTMLButtonElement;
    await waitFor(() => expect(reconcile.classList.contains("ant-btn-loading")).toBe(true));
    expect(refund.disabled).toBe(true);
    expect(refund.classList.contains("ant-btn-loading")).toBe(false);
    expect(api.adminReconcileOrder).toHaveBeenCalledTimes(1);
    expect(api.adminMarkRefundRequired).not.toHaveBeenCalled();
    await act(async () => { complete(detail()); await Promise.all([pending, duplicate]); });
    await waitFor(() => expect(reconcile.classList.contains("ant-btn-loading")).toBe(false));
    expect(appUi.message.success).toHaveBeenCalledTimes(1);
  });

  it.each([
    new ApiError("Nhật ký chưa hoàn tất", 503),
    new ApiError("Đang chờ đối soát audit", 409, "PLAN_AUDIT_PENDING"),
    new ApiError("Không thể kết nối tới máy chủ", 0),
  ])(
    "đóng xác nhận khi kết quả chưa chắc chắn và yêu cầu tải lại: %s",
    async (error) => {
      api.adminListPlans.mockResolvedValue([standardPlan()]);
      api.adminDisablePlan.mockRejectedValue(error);
      renderPage();
      fireEvent.click(
        await screen.findByRole("button", { name: "Ngừng bán gói Standard" }),
      );
      await act(async () => {
        await expect(
          appUi.confirm.mock.calls.at(-1)![0].onOk(),
        ).resolves.toBeUndefined();
      });
      expect(
        screen.getByText("Cần kiểm tra kết quả thay đổi gói"),
      ).toBeTruthy();
      expect(
        (
          screen.getByRole("button", {
            name: "Ngừng bán gói Standard",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      expect(api.adminDisablePlan).toHaveBeenCalledTimes(1);
      fireEvent.click(
        screen.getByRole("button", { name: "Tải lại và kiểm tra" }),
      );
      await waitFor(() =>
        expect(
          screen.queryByText("Cần kiểm tra kết quả thay đổi gói"),
        ).toBeNull(),
      );
    },
  );

  it("giải thích lý do quá ngắn và không gửi thao tác thanh toán", async () => {
    renderPage();
    await openReviewOrder();
    fireEvent.click(
      screen.getByRole("button", {
        name: /Áp dụng lại giao dịch vào thuê bao/,
      }),
    );
    const confirmation = appUi.confirm.mock.calls.at(-1)![0];
    await expect(confirmation.onOk()).rejects.toThrow(
      "Vui lòng nhập lý do tối thiểu 3 ký tự",
    );
    expect(appUi.message.error).toHaveBeenCalledWith(
      "Vui lòng nhập lý do tối thiểu 3 ký tự",
    );
    expect(api.adminReconcileOrder).not.toHaveBeenCalled();
    expect(api.adminMarkRefundRequired).not.toHaveBeenCalled();
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
    api.adminGetPlan.mockResolvedValue(standardPlan());
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
    expect(screen.getByText("3 tính năng")).toBeTruthy();
    expect(screen.queryByText("Tối đa 5 chi nhánh hoạt động")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết gói Standard" }));
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
    expect(screen.getByLabelText("Số chi nhánh hoạt động tối đa")).toBeTruthy();
    expect(screen.getByLabelText("Số học viên hoạt động tối đa")).toBeTruthy();
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

  it("nhóm thông tin, giá và hạn mức đều cột mà giữ nguyên hợp đồng chọn tính năng", async () => {
    const formItem = vi.spyOn(LocalizedForm, "Item");
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Thêm gói thuê bao" }),
    );
    const editor = screen.getByRole("dialog", { name: "Tạo gói thuê bao" });
    expect(
      within(editor).getByRole("heading", { name: "Thông tin gói" }),
    ).toBeTruthy();
    expect(
      within(editor).getByRole("heading", { name: "Giá dịch vụ" }),
    ).toBeTruthy();
    expect(
      within(editor).getByRole("heading", { name: "Giới hạn sử dụng" }),
    ).toBeTruthy();
    expect(editor.querySelectorAll(".form-section")).toHaveLength(4);
    expect(
      Array.from(
        editor.querySelectorAll(".form-field-grid"),
        (grid) => grid.children.length,
      ),
    ).toEqual([2, 2, 4]);
    expect(
      within(editor).getByRole("group", { name: "Tính năng trong gói" }),
    ).toBeTruthy();
    expect(
      within(editor).getByText("Tính năng phụ thuộc sẽ được tự động chọn."),
    ).toBeTruthy();
    const field = formItem.mock.calls
      .map(([props]) => props)
      .find(
        (props) =>
          Array.isArray(props.name) &&
          props.name.join(".") === "entitlements.modules",
      );
    expect(field?.rules).toEqual([
      { required: true, message: "Chọn ít nhất một module" },
    ]);
    const normalize = field?.normalize as
      ((value: LmsModule[]) => LmsModule[]) | undefined;
    expect(normalize?.(["REPORTS", "COMMUNICATIONS"])).toEqual([
      "USERS",
      "COURSES",
      "ENROLLMENTS",
      "COHORTS",
      "REPORTS",
      "COMMUNICATIONS",
    ]);
    expect(planForm.setFieldsValue).toHaveBeenCalledWith(
      expect.objectContaining({
        entitlements: expect.objectContaining({
          modules: lmsModuleOptions.map((option) => option.value),
        }),
      }),
    );
    expect(api.adminCreatePlan).not.toHaveBeenCalled();
    expect(api.adminUpdatePlan).not.toHaveBeenCalled();
  });

  it("không gửi khi validation lỗi và đưa focus đến trường sai đầu tiên", async () => {
    planForm.validateFields.mockRejectedValue({
      errorFields: [{ name: ["name"], errors: ["Required"] }],
    });
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Thêm gói thuê bao" }),
    );
    const name = screen.getByLabelText("Tên gói");
    planForm.scrollToField.mockImplementation(() => name.focus());
    fireEvent.click(screen.getByRole("button", { name: "Tạo gói" }));
    await waitFor(() =>
      expect(planForm.scrollToField).toHaveBeenCalledWith(["name"], {
        block: "nearest",
        behavior: "auto",
        focus: true,
      }),
    );
    expect(document.activeElement).toBe(name);
    expect(api.adminCreatePlan).not.toHaveBeenCalled();
    expect(appUi.message.error).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Tạo gói thuê bao" }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Tạo gói" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
  });

  it("giữ một lượt gửi xuyên suốt validation và network, chỉ khóa sửa khi đang lưu", async () => {
    let validate!: (values: BillingPlanFormValues) => void;
    let complete!: (value: BillingPlan) => void;
    planForm.validateFields.mockImplementation(
      () =>
        new Promise<BillingPlanFormValues>((resolve) => {
          validate = resolve;
        }),
    );
    api.adminCreatePlan.mockImplementation(
      () =>
        new Promise<BillingPlan>((resolve) => {
          complete = resolve;
        }),
    );
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Thêm gói thuê bao" }),
    );
    act(() => {
      appUi.planModal?.onOk?.();
      appUi.planModal?.onOk?.();
    });
    expect(planForm.validateFields).toHaveBeenCalledTimes(1);
    expect(appUi.planModal).toMatchObject({
      cancelButtonProps: { disabled: true },
      closable: false,
      confirmLoading: true,
      keyboard: false,
      mask: { closable: false },
    });
    expect(
      (screen.getByLabelText("Tên gói") as HTMLInputElement).disabled,
    ).toBe(false);
    act(() => appUi.planModal?.onCancel?.());
    expect(
      screen.getByRole("dialog", { name: "Tạo gói thuê bao" }),
    ).toBeTruthy();
    await act(async () => validate(validPlanValues()));
    await waitFor(() => expect(api.adminCreatePlan).toHaveBeenCalledTimes(1));
    expect(
      (screen.getByLabelText("Tên gói") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      within(screen.getByRole("group", { name: "Tính năng trong gói" }))
        .getByText("Chọn tất cả")
        .closest("button")?.disabled,
    ).toBe(true);
    act(() => {
      appUi.planModal?.onOk?.();
      appUi.planModal?.onCancel?.();
    });
    expect(planForm.validateFields).toHaveBeenCalledTimes(1);
    expect(api.adminCreatePlan).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("dialog", { name: "Tạo gói thuê bao" }),
    ).toBeTruthy();
    await act(async () => complete(standardPlan()));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Tạo gói thuê bao" }),
      ).toBeNull(),
    );
    expect(appUi.message.success).toHaveBeenCalledTimes(1);
  });

  it("mở khóa sau lỗi lưu xác định, chỉ thông báo một lần và cho phép thử lại", async () => {
    planForm.validateFields.mockResolvedValue(validPlanValues());
    api.adminCreatePlan
      .mockRejectedValueOnce(new ApiError("Tên gói đã tồn tại", 400))
      .mockResolvedValueOnce(standardPlan());
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Thêm gói thuê bao" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Tạo gói" }));
    await waitFor(() => expect(appUi.message.error).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Tạo gói" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    expect(
      (screen.getByLabelText("Tên gói") as HTMLInputElement).disabled,
    ).toBe(false);
    expect(appUi.planModal).toMatchObject({
      cancelButtonProps: { disabled: false },
      closable: true,
      keyboard: true,
      mask: { closable: true },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tạo gói" }));
    await waitFor(() => expect(api.adminCreatePlan).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Tạo gói thuê bao" }),
      ).toBeNull(),
    );
    expect(appUi.message.error).toHaveBeenCalledTimes(1);
    expect(appUi.message.success).toHaveBeenCalledTimes(1);
  });

  it("đổi ngôn ngữ giữ tên gói đang nhập và không gửi biểu mẫu", async () => {
    renderPage("en");
    fireEvent.click(
      await screen.findByRole("button", { name: "Add subscription plan" }),
    );
    const editor = screen.getByRole("dialog", {
      name: "Create subscription plan",
    });
    expect(
      within(editor).getByRole("heading", { name: "Plan details" }),
    ).toBeTruthy();
    expect(
      within(editor).getByRole("heading", { name: "Pricing" }),
    ).toBeTruthy();
    expect(
      within(editor).getByRole("heading", { name: "Usage limits" }),
    ).toBeTruthy();
    expect(
      within(editor).getByRole("group", { name: "Plan features" }),
    ).toBeTruthy();
    const nameInput = within(editor).getByLabelText("Plan name");
    fireEvent.change(nameInput, { target: { value: "Gói Trung tâm Đà Nẵng" } });
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    expect(screen.getByRole("dialog", { name: "Tạo gói thuê bao" })).toBe(
      editor,
    );
    expect(within(editor).getByLabelText("Tên gói")).toBe(nameInput);
    expect((nameInput as HTMLInputElement).value).toBe("Gói Trung tâm Đà Nẵng");
    expect(
      within(editor).getByRole("group", { name: "Tính năng trong gói" }),
    ).toBeTruthy();
    expect(planForm.validateFields).not.toHaveBeenCalled();
    expect(api.adminCreatePlan).not.toHaveBeenCalled();
    expect(api.adminUpdatePlan).not.toHaveBeenCalled();
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
