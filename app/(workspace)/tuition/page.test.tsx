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
import type { EffectiveAccess, UserRole } from "@/lib/types";
import type { TuitionInvoice } from "@/lib/tuition-api";
import TuitionPage from "./page";

const mocks = vi.hoisted(() => ({
  createInvoice: vi.fn(),
  getInvoiceOptions: vi.fn(),
  issueInvoice: vi.fn(),
  listInvoices: vi.fn(),
  membershipId: "membership-1" as string | undefined,
  readOnly: false,
  recordPayment: vi.fn(),
  role: "TENANT_ADMIN" as UserRole,
  voidInvoice: vi.fn(),
}));

vi.mock("@/lib/tuition-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tuition-api")>()),
  createTuitionPaymentIdempotencyKey: () =>
    "tuition-payment:test-attempt-0001",
  tuitionApi: {
    createInvoice: mocks.createInvoice,
    getInvoiceOptions: mocks.getInvoiceOptions,
    issueInvoice: mocks.issueInvoice,
    listInvoices: mocks.listInvoices,
    recordPayment: mocks.recordPayment,
    voidInvoice: mocks.voidInvoice,
  },
}));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: {
      graceEndsAt: null,
      limits: {
        maxActiveLearners: null,
        maxBranches: null,
        maxCourses: 10,
        maxUsers: 100,
      },
      modules: ["USERS", "COURSES", "ENROLLMENTS"],
      readOnly: mocks.readOnly,
      state: mocks.readOnly ? "READ_ONLY" : "ACTIVE",
    } satisfies EffectiveAccess,
    organization: { _id: "tenant-1" },
    token: "tenant-token",
    user: {
      email: "viewer@example.test",
      fullName: "Viewer",
      membershipId: mocks.membershipId,
      role: mocks.role,
      sub: mocks.role === "LEARNER" ? "learner-1" : "viewer-1",
      tenantId: "tenant-1",
    },
  }),
}));
vi.mock("@ant-design/icons", () => ({
  BankOutlined: () => null,
  DollarOutlined: () => null,
  PlusOutlined: () => null,
  SendOutlined: () => null,
  StopOutlined: () => null,
}));
vi.mock("antd", async () =>
  (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

const draftInvoice: TuitionInvoice = {
  _id: "invoice-draft",
  amountVnd: 2_000_000,
  balanceVnd: 2_000_000,
  createdBy: "admin-1",
  currency: "VND",
  description: "Đợt đầu",
  dueAt: "2030-09-10T08:00:00.000Z",
  invoiceNumber: "HP-20300901-DRAFT",
  learnerId: "learner-1",
  lifecycle: "DRAFT",
  paidAmountVnd: 0,
  payments: [],
  status: "DRAFT",
  tenantId: "tenant-1",
  title: "Học phí Data đợt 1",
};

const issuedInvoice: TuitionInvoice = {
  ...draftInvoice,
  _id: "invoice-issued",
  amountVnd: 3_000_000,
  balanceVnd: 2_500_000,
  invoiceNumber: "HP-20300901-ISSUED",
  issuedAt: "2030-09-01T08:00:00.000Z",
  lifecycle: "ISSUED",
  paidAmountVnd: 500_000,
  payments: [
    {
      _id: "payment-1",
      amountVnd: 500_000,
      idempotencyKey: "previous-payment-0001",
      method: "CASH",
      paidAt: "2030-09-02T08:00:00.000Z",
      recordedBy: "admin-1",
    },
  ],
  status: "PARTIALLY_PAID",
  title: "Học phí Data đợt 2",
};

function invoicePage(items = [draftInvoice, issuedInvoice]) {
  return { items, limit: 20, page: 1, total: items.length };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TuitionPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.createInvoice.mockReset();
  mocks.createInvoice.mockResolvedValue(draftInvoice);
  mocks.issueInvoice.mockReset();
  mocks.issueInvoice.mockResolvedValue({
    ...draftInvoice,
    lifecycle: "ISSUED",
    status: "ISSUED",
  });
  mocks.listInvoices.mockReset();
  mocks.listInvoices.mockResolvedValue(invoicePage());
  mocks.getInvoiceOptions.mockReset();
  mocks.getInvoiceOptions.mockResolvedValue({
    cohorts: [
      {
        _id: "cohort-1",
        code: "REACT-01",
        name: "React căn bản",
        orgUnitId: "branch-1",
      },
    ],
    learners: [
      {
        cohortIds: ["cohort-1"],
        email: "learner@example.test",
        fullName: "Nguyễn Học Viên",
        membershipId: "learner-membership-1",
        orgUnitId: "branch-1",
        userId: "learner-1",
      },
    ],
    orgUnits: [
      {
        _id: "branch-1",
        code: "hcm",
        name: "Chi nhánh TP.HCM",
        type: "BRANCH",
      },
    ],
    scoped: false,
  });
  mocks.membershipId = "membership-1";
  mocks.readOnly = false;
  mocks.recordPayment.mockReset();
  mocks.recordPayment.mockResolvedValue({
    ...issuedInvoice,
    balanceVnd: 0,
    paidAmountVnd: 3_000_000,
    status: "PAID",
  });
  mocks.role = "TENANT_ADMIN";
  mocks.voidInvoice.mockReset();
  mocks.voidInvoice.mockResolvedValue({
    ...draftInvoice,
    lifecycle: "VOID",
    status: "VOID",
  });
});

afterEach(cleanup);

describe("TuitionPage", () => {
  it("tenant admin thấy tổng quan, bộ lọc và các thao tác quản lý", async () => {
    renderPage();

    expect(await screen.findByText("HP-20300901-DRAFT")).toBeTruthy();
    expect(mocks.listInvoices).toHaveBeenCalledWith(
      { token: "tenant-token" },
      { limit: 20, page: 1 },
      { signal: expect.any(AbortSignal) },
    );
    expect(mocks.getInvoiceOptions).toHaveBeenCalled();
    expect(screen.getByText("Hóa đơn theo bộ lọc")).toBeTruthy();
    expect(screen.getByText("Đã thu (trang này)")).toBeTruthy();
    expect(screen.getByText("Còn phải thu (trang này)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tạo hóa đơn" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Phát hành" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Ghi nhận thanh toán" }),
    ).toBeTruthy();
  });

  it("learner chỉ tải hóa đơn của mình và không thấy mutation", async () => {
    mocks.role = "LEARNER";
    renderPage();

    expect(await screen.findByText("HP-20300901-DRAFT")).toBeTruthy();
    expect(mocks.listInvoices).toHaveBeenCalledWith(
      { token: "tenant-token" },
      { limit: 20, page: 1 },
      { signal: expect.any(AbortSignal) },
    );
    expect(mocks.getInvoiceOptions).not.toHaveBeenCalled();
    expect(screen.getByText("Thông tin học phí cá nhân")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tạo hóa đơn" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Phát hành" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Ghi nhận thanh toán" }),
    ).toBeNull();
  });

  it("guardian đọc hóa đơn của học viên được liên kết và không thấy mutation", async () => {
    mocks.role = "GUARDIAN";
    renderPage();

    expect(await screen.findByText("HP-20300901-DRAFT")).toBeTruthy();
    expect(mocks.listInvoices).toHaveBeenCalled();
    expect(mocks.getInvoiceOptions).not.toHaveBeenCalled();
    expect(screen.getAllByText("Học viên được liên kết").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Tạo hóa đơn" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Phát hành" })).toBeNull();
  });

  it("fail closed với role không được hỗ trợ", () => {
    mocks.role = "INSTRUCTOR";
    renderPage();

    expect(
      screen.getByText(
        "Học phí chỉ dành cho quản trị tổ chức, học viên và phụ huynh.",
      ),
    ).toBeTruthy();
    expect(mocks.listInvoices).not.toHaveBeenCalled();
    expect(mocks.getInvoiceOptions).not.toHaveBeenCalled();
  });

  it("fail closed khi tenant user thiếu membership authority", () => {
    mocks.membershipId = undefined;
    renderPage();

    expect(
      screen.getByText("Phiên làm việc thiếu phạm vi thành viên hợp lệ."),
    ).toBeTruthy();
    expect(mocks.listInvoices).not.toHaveBeenCalled();
  });

  it("workspace READ_ONLY vẫn đọc nhưng khóa toàn bộ thao tác ghi", async () => {
    mocks.readOnly = true;
    renderPage();

    await screen.findByText("HP-20300901-DRAFT");
    expect(screen.getByText("Workspace đang ở chế độ chỉ đọc")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Tạo hóa đơn" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Phát hành" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Ghi nhận thanh toán",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("đưa trạng thái vào server-side filter và quay về trang đầu", async () => {
    renderPage();
    await screen.findByText("HP-20300901-DRAFT");

    fireEvent.change(screen.getByLabelText("Lọc theo trạng thái"), {
      target: { value: "OVERDUE" },
    });

    await waitFor(() =>
      expect(mocks.listInvoices).toHaveBeenCalledWith(
        { token: "tenant-token" },
        { limit: 20, page: 1, status: "OVERDUE" },
        { signal: expect.any(AbortSignal) },
      ),
    );
  });

  it("tạo hóa đơn nháp từ learner id đã chọn", async () => {
    renderPage();
    await screen.findByText("HP-20300901-DRAFT");
    fireEvent.click(screen.getByRole("button", { name: "Tạo hóa đơn" }));

    fireEvent.change(screen.getByLabelText("Học viên"), {
      target: { value: "learner-1" },
    });
    fireEvent.change(screen.getByLabelText("Lớp áp dụng"), {
      target: { value: "cohort-1" },
    });
    fireEvent.change(screen.getByLabelText("Nội dung thu"), {
      target: { value: "Học phí khóa React" },
    });
    fireEvent.change(screen.getByLabelText("Số tiền"), {
      target: { value: "2500000" },
    });
    fireEvent.change(screen.getByLabelText("Hạn thanh toán"), {
      target: { value: "2030-09-15T17:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu hóa đơn nháp" }));

    await waitFor(() =>
      expect(mocks.createInvoice).toHaveBeenCalledWith(
        { token: "tenant-token" },
        expect.objectContaining({
          amountVnd: 2_500_000,
          cohortId: "cohort-1",
          dueAt: expect.stringMatching(/^2030-09-15T/),
          learnerId: "learner-1",
          title: "Học phí khóa React",
        }),
      ),
    );
    expect(mocks.createInvoice.mock.calls.at(-1)?.[1]).not.toHaveProperty(
      "orgUnitId",
    );
  });

  it("lập hóa đơn ngoài lớp bằng đúng đơn vị của học viên", async () => {
    mocks.getInvoiceOptions.mockResolvedValueOnce({
      cohorts: [],
      learners: [
        {
          cohortIds: [],
          email: "learner@example.test",
          fullName: "Nguyễn Học Viên",
          membershipId: "learner-membership-1",
          orgUnitId: "branch-1",
          userId: "learner-1",
        },
      ],
      orgUnits: [
        {
          _id: "branch-1",
          code: "hcm",
          name: "Chi nhánh TP.HCM",
          type: "BRANCH",
        },
        {
          _id: "branch-2",
          code: "hn",
          name: "Chi nhánh Hà Nội",
          type: "BRANCH",
        },
      ],
      scoped: true,
    });
    renderPage();
    await screen.findByText("HP-20300901-DRAFT");
    fireEvent.click(screen.getByRole("button", { name: "Tạo hóa đơn" }));

    fireEvent.change(screen.getByLabelText("Học viên"), {
      target: { value: "learner-1" },
    });
    expect(screen.getByText("Chi nhánh TP.HCM · HCM")).toBeTruthy();
    expect(screen.queryByText("Chi nhánh Hà Nội · HN")).toBeNull();
    fireEvent.change(screen.getByLabelText("Đơn vị thu học phí"), {
      target: { value: "branch-1" },
    });
    fireEvent.change(screen.getByLabelText("Nội dung thu"), {
      target: { value: "Phí tài liệu" },
    });
    fireEvent.change(screen.getByLabelText("Số tiền"), {
      target: { value: "300000" },
    });
    fireEvent.change(screen.getByLabelText("Hạn thanh toán"), {
      target: { value: "2030-09-15T17:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu hóa đơn nháp" }));

    await waitFor(() =>
      expect(mocks.createInvoice).toHaveBeenCalledWith(
        { token: "tenant-token" },
        expect.objectContaining({
          learnerId: "learner-1",
          orgUnitId: "branch-1",
          title: "Phí tài liệu",
        }),
      ),
    );
  });

  it("giữ luồng đơn giản cho giáo viên độc lập chưa dùng cơ cấu đơn vị", async () => {
    mocks.getInvoiceOptions.mockResolvedValueOnce({
      cohorts: [],
      learners: [
        {
          cohortIds: [],
          email: "learner@example.test",
          fullName: "Nguyễn Học Viên",
          membershipId: "learner-membership-1",
          userId: "learner-1",
        },
      ],
      orgUnits: [],
      scoped: false,
    });
    renderPage();
    await screen.findByText("HP-20300901-DRAFT");
    fireEvent.click(screen.getByRole("button", { name: "Tạo hóa đơn" }));
    fireEvent.change(screen.getByLabelText("Học viên"), {
      target: { value: "learner-1" },
    });

    expect(screen.getByText("Mô hình giáo viên độc lập")).toBeTruthy();
    expect(screen.queryByLabelText("Đơn vị thu học phí")).toBeNull();
  });

  it("phát hành và hủy hóa đơn theo lifecycle", async () => {
    renderPage();
    await screen.findByText("HP-20300901-DRAFT");

    fireEvent.click(screen.getByRole("button", { name: "Phát hành" }));
    await waitFor(() =>
      expect(mocks.issueInvoice).toHaveBeenCalledWith(
        { token: "tenant-token" },
        "invoice-draft",
      ),
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: "Xác nhận hủy" })[0],
    );
    await waitFor(() =>
      expect(mocks.voidInvoice).toHaveBeenCalledWith(
        { token: "tenant-token" },
        "invoice-draft",
      ),
    );
  });

  it("retry thanh toán dùng lại cùng idempotency key", async () => {
    mocks.recordPayment
      .mockRejectedValueOnce(new Error("Mạng tạm gián đoạn"))
      .mockResolvedValueOnce({
        ...issuedInvoice,
        balanceVnd: 0,
        paidAmountVnd: 3_000_000,
        status: "PAID",
      });
    renderPage();
    await screen.findByText("HP-20300901-ISSUED");
    fireEvent.click(
      screen.getByRole("button", { name: "Ghi nhận thanh toán" }),
    );

    fireEvent.change(screen.getByLabelText("Số tiền thanh toán"), {
      target: { value: "2500000" },
    });
    fireEvent.change(screen.getByLabelText("Phương thức"), {
      target: { value: "BANK_TRANSFER" },
    });
    fireEvent.change(screen.getByLabelText("Mã giao dịch"), {
      target: { value: "VCB-2030-001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thanh toán" }));
    await waitFor(() => expect(mocks.recordPayment).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Lưu thanh toán" }));
    await waitFor(() => expect(mocks.recordPayment).toHaveBeenCalledTimes(2));

    const firstInput = mocks.recordPayment.mock.calls[0][2];
    const secondInput = mocks.recordPayment.mock.calls[1][2];
    expect(firstInput).toMatchObject({
      amountVnd: 2_500_000,
      idempotencyKey: "tuition-payment:test-attempt-0001",
      method: "BANK_TRANSFER",
      providerReference: "VCB-2030-001",
    });
    expect(secondInput.idempotencyKey).toBe(firstInput.idempotencyKey);
  });
});
