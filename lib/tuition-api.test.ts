import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import {
  buildTuitionQuery,
  createTuitionPaymentIdempotencyKey,
  tuitionApi,
} from "@/lib/tuition-api";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

const mockedApiFetch = vi.mocked(apiFetch);
const context = { token: "tenant-token" };

beforeEach(() => {
  mockedApiFetch.mockReset();
});

describe("tuitionApi", () => {
  it("chuẩn hóa query có thứ tự và bỏ giá trị rỗng", () => {
    expect(
      buildTuitionQuery({
        cohortId: "  cohort-1  ",
        learnerId: " ",
        limit: 20,
        page: 2,
        status: "OVERDUE",
      }),
    ).toBe("?cohortId=cohort-1&limit=20&page=2&status=OVERDUE");
  });

  it("liệt kê hóa đơn bằng API_URL client convention và truyền abort signal", async () => {
    const signal = new AbortController().signal;
    mockedApiFetch.mockResolvedValueOnce({
      items: [],
      limit: 20,
      page: 1,
      total: 0,
    });

    await tuitionApi.listInvoices(
      context,
      { limit: 20, page: 1, status: "ISSUED" },
      { signal },
    );

    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/tuition/invoices?limit=20&page=1&status=ISSUED",
      { cache: "no-store", signal, token: "tenant-token" },
    );
  });

  it("tải danh mục lập hóa đơn đã giới hạn theo quyền chi nhánh", async () => {
    const signal = new AbortController().signal;
    mockedApiFetch.mockResolvedValueOnce({
      cohorts: [],
      learners: [],
      orgUnits: [],
      scoped: true,
    });

    await tuitionApi.getInvoiceOptions(context, { signal });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/tuition/invoice-options",
      { cache: "no-store", signal, token: "tenant-token" },
    );
  });

  it("tạo, phát hành và hủy hóa đơn đúng contract", async () => {
    mockedApiFetch.mockResolvedValue({});
    const input = {
      amountVnd: 2_500_000,
      description: "Học phí đợt một",
      dueAt: "2030-09-10T00:00:00.000Z",
      learnerId: "learner-1",
      title: "Học phí khóa Data",
    };

    await tuitionApi.createInvoice(context, input);
    await tuitionApi.issueInvoice(context, "invoice/one");
    await tuitionApi.voidInvoice(context, "invoice/one");

    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      1,
      "/tuition/invoices",
      {
        body: JSON.stringify(input),
        method: "POST",
        token: "tenant-token",
      },
    );
    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      2,
      "/tuition/invoices/invoice%2Fone/issue",
      { method: "POST", token: "tenant-token" },
    );
    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      3,
      "/tuition/invoices/invoice%2Fone/void",
      { method: "POST", token: "tenant-token" },
    );
  });

  it("đặt idempotency key trong body thanh toán và giữ nguyên dữ liệu giao dịch", async () => {
    mockedApiFetch.mockResolvedValueOnce({});
    const input = {
      amountVnd: 500_000,
      idempotencyKey: "tuition-payment:stable-attempt-01",
      method: "BANK_TRANSFER" as const,
      note: "Đợt 1",
      paidAt: "2030-09-01T08:00:00.000Z",
      providerReference: "VCB-001",
    };

    await tuitionApi.recordPayment(context, "invoice-1", input);

    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/tuition/invoices/invoice-1/payments",
      {
        body: JSON.stringify(input),
        method: "POST",
        token: "tenant-token",
      },
    );
  });

  it("sinh khóa thanh toán hợp lệ với backend", () => {
    expect(createTuitionPaymentIdempotencyKey()).toMatch(
      /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/,
    );
  });
});
