// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AdminNotificationEvent,
  AdminNotificationEventsQuery,
  AdminNotificationRetryOperation,
} from "@/lib/notification-operations-api";
import type { UserRole } from "@/lib/types";
import { ApiError } from "@/lib/api";
import AdminNotificationEventsPage from "./page";

const mocks = vi.hoisted(() => ({
  actorId: "platform-admin-a",
  list: vi.fn(),
  retry: vi.fn(),
  getRetryOperation: vi.fn(),
  role: "SUPER_ADMIN" as UserRole,
}));

vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    captureAuthGeneration: () => 0,
    organization: null,
    token: "platform-secret-token",
    user: {
      email: `${mocks.actorId}@example.test`,
      fullName: "Platform Admin",
      role: mocks.role,
      sub: mocks.actorId,
      ...(mocks.role === "SUPER_ADMIN"
        ? {}
        : { membershipId: "membership-1", tenantId: "tenant-1" }),
    },
  }),
}));
vi.mock("@/lib/notification-operations-api", () => ({
  adminNotificationEventsApi: {
    list: mocks.list,
    retry: mocks.retry,
    getRetryOperation: mocks.getRetryOperation,
  },
  notificationEventTypes: [
    "COURSE_ENROLLED",
    "COURSE_WITHDRAWN",
    "ASSIGNMENT_PUBLISHED",
    "SUBMISSION_RETURNED",
    "SUBMISSION_GRADED",
  ],
  notificationRetryReasonCodes: [
    "CONFIGURATION_CORRECTED",
    "DATA_RECONCILED",
    "DEPENDENCY_RECOVERED",
    "TRANSIENT_FAILURE_RESOLVED",
  ],
}));
vi.mock(
  "antd",
  async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

const eventId = "64b000000000000000000001";
const tenantId = "64b000000000000000000002";
const sourceId = "64b000000000000000000003";
const retryReasonCode = "CONFIGURATION_CORRECTED" as const;
const retryButtonName = `Retry sự kiện ${eventId} của tổ chức ${tenantId} (Phân phối)`;

function event(): AdminNotificationEvent {
  return {
    _id: eventId,
    availableAt: "2030-08-16T00:05:00.000Z",
    createdAt: "2030-08-16T00:00:00.000Z",
    deadLetteredAt: "2030-08-16T00:04:00.000Z",
    deliveredCount: 0,
    eventId,
    failureCount: 10,
    lastErrorCode: "NOTIFICATION_DELIVERY_FAILED",
    occurredAt: "2030-08-16T00:00:00.000Z",
    pipeline: "DISPATCH",
    retryToken: "a".repeat(32) + ".b",
    sourceId,
    sourceKind: "ASSIGNMENT",
    status: "DEAD_LETTER",
    tenantId,
    type: "ASSIGNMENT_PUBLISHED",
  };
}

function operation(
  overrides: Partial<AdminNotificationRetryOperation> = {},
): AdminNotificationRetryOperation {
  return {
    attemptCount: 1,
    completedAt: "2030-08-16T00:10:00.000Z",
    eventId,
    failureCode: null,
    operationId: "64b000000000000000000004",
    phase: "SUCCEEDED",
    pipeline: "DISPATCH",
    result: "REQUEUED",
    status: "SUCCEEDED",
    tenantId,
    ...overrides,
  };
}

function page(query: AdminNotificationEventsQuery, total = 1) {
  return {
    items: total ? [event()] : [],
    limit: query.limit,
    page: query.page,
    total,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

function renderPage(
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  }),
) {
  const view = render(
    <QueryClientProvider client={client}>
      <AdminNotificationEventsPage />
    </QueryClientProvider>,
  );
  return { client, ...view };
}

describe("AdminNotificationEventsPage", () => {
  beforeEach(() => {
    mocks.actorId = "platform-admin-a";
    mocks.role = "SUPER_ADMIN";
    mocks.list.mockReset();
    mocks.retry.mockReset();
    mocks.getRetryOperation.mockReset();
    mocks.list.mockImplementation(
      (_context: unknown, query: AdminNotificationEventsQuery) =>
        Promise.resolve(page(query)),
    );
    mocks.retry.mockResolvedValue(operation());
    mocks.getRetryOperation.mockResolvedValue(operation());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each<UserRole>(["TENANT_ADMIN", "INSTRUCTOR", "LEARNER"])(
    "fail closed cho %s và không tạo request vận hành",
    async (role) => {
      mocks.role = role;
      renderPage();

      expect(
        screen.getByText(
          "Chỉ quản trị viên nền tảng được vận hành sự kiện thông báo.",
        ),
      ).toBeTruthy();
      await act(async () => Promise.resolve());
      expect(mocks.list).not.toHaveBeenCalled();
    },
  );

  it("hiện loading, lỗi bền vững, retry tải và empty state", async () => {
    const first = deferred<ReturnType<typeof page>>();
    mocks.list.mockReturnValueOnce(first.promise);
    renderPage();

    expect(screen.getByRole("status").textContent).toContain(
      "Đang tải metadata sự kiện thông báo",
    );

    await act(async () => first.reject(new Error("Worker API chưa sẵn sàng")));
    expect(await screen.findByText("Không tải được dead-letter")).toBeTruthy();
    expect(screen.getByText("Không tải được danh sách sự kiện thông báo.")).toBeTruthy();
    expect(screen.queryByText("Worker API chưa sẵn sàng")).toBeNull();

    const retry = deferred<ReturnType<typeof page>>();
    mocks.list.mockReturnValueOnce(retry.promise);
    const retryButton = screen.getByRole("button", { name: "Thử lại" });
    act(() => { fireEvent.click(retryButton); fireEvent.click(retryButton); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Tải lại sự kiện thông báo" }).classList.contains("ant-btn-loading")).toBe(true));
    expect(screen.getByRole("status").textContent).toContain("Đang tải metadata sự kiện thông báo");
    expect(mocks.list).toHaveBeenCalledTimes(2);
    await act(async () => retry.resolve(page({ page: 1, limit: 20 }, 0)));
    expect(
      await screen.findByText("Không có sự kiện dead-letter phù hợp bộ lọc."),
    ).toBeTruthy();
  });

  it("áp dụng tenant/type, reset page và phân trang đúng contract backend", async () => {
    mocks.list.mockImplementation(
      (_context: unknown, query: AdminNotificationEventsQuery) =>
        Promise.resolve(page(query, 45)),
    );
    renderPage();
    await screen.findByRole("button", { name: retryButtonName });

    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Lọc sự kiện theo mã tổ chức",
      }),
      { target: { value: tenantId.toUpperCase() } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ token: "platform-secret-token" }),
        expect.objectContaining({ page: 1, tenantId }),
      ),
    );

    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Lọc theo loại sự kiện thông báo",
      }),
      { target: { value: "ASSIGNMENT_PUBLISHED" } },
    );
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(expect.anything(), {
        limit: 20,
        page: 1,
        tenantId,
        type: "ASSIGNMENT_PUBLISHED",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ page: 2 }),
      ),
    );
  });

  it("chặn tenant filter sai mà không gọi network", async () => {
    renderPage();
    await screen.findByRole("button", { name: retryButtonName });
    const before = mocks.list.mock.calls.length;

    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Lọc sự kiện theo mã tổ chức",
      }),
      { target: { value: "tenant-private-name" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));

    expect(
      screen.getByText("Mã tổ chức phải gồm đúng 24 ký tự hex."),
    ).toBeTruthy();
    expect(mocks.list).toHaveBeenCalledTimes(before);
  });

  it("retry thành công chỉ gửi một lần, invalidate đúng root và không cache/log reason hoặc token", async () => {
    const pending = deferred<AdminNotificationRetryOperation>();
    mocks.retry.mockReturnValue(pending.promise);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    const consoleLog = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const { client } = renderPage();
    await screen.findByRole("button", { name: retryButtonName });

    fireEvent.click(screen.getByRole("button", { name: retryButtonName }));
    const dialog = screen.getByRole("dialog", {
      name: "Retry sự kiện thông báo",
    });
    expect(dialog.textContent).toContain(tenantId);
    expect(dialog.textContent).toContain(sourceId);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Chọn mã lý do retry" }),
      { target: { value: retryReasonCode } },
    );
    const submit = screen.getByRole("button", {
      name: "Đưa vào hàng đợi lại",
    });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(mocks.retry).toHaveBeenCalledTimes(1);
    expect(mocks.retry).toHaveBeenCalledWith(
      expect.objectContaining({ token: "platform-secret-token" }),
      eventId,
      event().retryToken,
      retryReasonCode,
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
    );
    await act(async () => pending.resolve(operation()));

    expect(
      await screen.findByText("Đã đưa sự kiện vào hàng đợi lại."),
    ).toBeTruthy();
    await waitFor(() =>
      expect(mocks.list.mock.calls.length).toBeGreaterThan(1),
    );
    const cache = JSON.stringify({
      mutations: client.getMutationCache().getAll(),
      queries: client
        .getQueryCache()
        .getAll()
        .map((item) => ({ data: item.state.data, key: item.queryKey })),
    });
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(cache).not.toContain(retryReasonCode);
    expect(cache).not.toContain("platform-secret-token");
    expect(
      JSON.stringify([
        ...consoleError.mock.calls,
        ...consoleInfo.mock.calls,
        ...consoleLog.mock.calls,
        ...consoleWarn.mock.calls,
      ]),
    ).not.toContain(retryReasonCode);
  });

  it("cảnh báo và giới hạn pagination theo trần 100 trang của backend", async () => {
    mocks.list.mockImplementation(
      (_context: unknown, query: AdminNotificationEventsQuery) =>
        Promise.resolve(page(query, 2_500)),
    );
    renderPage();

    expect(await screen.findByText("Có 2.500 sự kiện phù hợp")).toBeTruthy();
    expect(
      screen.getByText(/API chỉ cho duyệt tối đa 100 trang/u),
    ).toBeTruthy();
  });

  it("giữ điều hướng để quay lại khi trang hiện tại rỗng sau retry", async () => {
    let retried = false;
    mocks.list.mockImplementation(
      (_context: unknown, query: AdminNotificationEventsQuery) =>
        Promise.resolve(
          retried && query.page === 2
            ? { ...page(query, 0), total: 1 }
            : page(query, retried ? 1 : 45),
        ),
    );
    mocks.retry.mockImplementation(async () => {
      retried = true;
      return operation();
    });
    renderPage();
    await screen.findByRole("button", { name: retryButtonName });

    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ page: 2 }),
      ),
    );
    await screen.findByRole("button", { name: retryButtonName });
    fireEvent.click(screen.getByRole("button", { name: retryButtonName }));
    fireEvent.change(
      screen.getByRole("combobox", { name: "Chọn mã lý do retry" }),
      { target: { value: retryReasonCode } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Đưa vào hàng đợi lại" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("Không có sự kiện dead-letter phù hợp bộ lọc."),
      ).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Trang trước" }));
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ page: 1 }),
      ),
    );
  });

  it("giữ dialog và lỗi truy cập được khi retry thất bại", async () => {
    mocks.retry.mockRejectedValue(new Error("Pipeline vẫn chưa sẵn sàng"));
    renderPage();
    await screen.findByRole("button", { name: retryButtonName });

    fireEvent.click(screen.getByRole("button", { name: retryButtonName }));
    fireEvent.change(
      screen.getByRole("combobox", { name: "Chọn mã lý do retry" }),
      { target: { value: retryReasonCode } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Đưa vào hàng đợi lại" }),
    );

    expect(
      (await screen.findAllByText("Retry sự kiện thất bại")).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Không thể đưa sự kiện vào hàng đợi lại.").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("dialog", { name: "Retry sự kiện thông báo" }),
    ).toBeTruthy();
  });

  it("cho phép đối soát operation khi retry trả kết quả chưa rõ", async () => {
    const operationId = operation().operationId;
    mocks.retry.mockRejectedValue(
      new ApiError(
        "Chưa xác định được retry đã hoàn tất",
        503,
        "NOTIFICATION_RETRY_RETRYABLE",
        operationId,
      ),
    );
    const check = deferred<AdminNotificationRetryOperation>();
    mocks.getRetryOperation.mockReturnValueOnce(check.promise);
    renderPage();
    await screen.findByRole("button", { name: retryButtonName });

    fireEvent.click(screen.getByRole("button", { name: retryButtonName }));
    fireEvent.change(
      screen.getByRole("combobox", { name: "Chọn mã lý do retry" }),
      { target: { value: retryReasonCode } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Đưa vào hàng đợi lại" }),
    );

    expect(
      await screen.findByText("Cần kiểm tra trạng thái retry"),
    ).toBeTruthy();
    const checkButton = screen.getByRole("button", { name: "Kiểm tra operation" });
    act(() => { fireEvent.click(checkButton); fireEvent.click(checkButton); });
    expect(checkButton.classList.contains("ant-btn-loading")).toBe(true);
    expect(mocks.getRetryOperation).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("combobox", { name: "Chọn mã lý do retry" }) as HTMLSelectElement).disabled).toBe(true);
    await act(async () => check.resolve(operation()));
    expect(await screen.findByText("Retry đã hoàn tất")).toBeTruthy();
    expect(mocks.getRetryOperation).toHaveBeenCalledWith(
      expect.objectContaining({ token: "platform-secret-token" }),
      operationId,
    );
  });

  it("abort retry khi unmount và không cập nhật UI muộn", async () => {
    const pending = deferred<AdminNotificationRetryOperation>();
    mocks.retry.mockReturnValue(pending.promise);
    const { unmount } = renderPage();
    await screen.findByRole("button", { name: retryButtonName });
    fireEvent.click(screen.getByRole("button", { name: retryButtonName }));
    fireEvent.change(
      screen.getByRole("combobox", { name: "Chọn mã lý do retry" }),
      { target: { value: retryReasonCode } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Đưa vào hàng đợi lại" }),
    );
    const context = mocks.retry.mock.calls[0][0] as { signal: AbortSignal };

    unmount();
    expect(context.signal.aborted).toBe(true);
    await act(async () => pending.resolve(operation()));
  });

  it("cô lập cache theo platform actor và filter", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    const first = renderPage(client);
    await screen.findByRole("button", { name: retryButtonName });
    const firstKeys = client
      .getQueryCache()
      .getAll()
      .map((item) => item.queryKey);

    mocks.actorId = "platform-admin-b";
    first.rerender(
      <QueryClientProvider client={client}>
        <AdminNotificationEventsPage />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(mocks.list.mock.calls.length).toBeGreaterThan(1),
    );
    const keys = client
      .getQueryCache()
      .getAll()
      .map((item) => item.queryKey);

    expect(keys.length).toBeGreaterThan(firstKeys.length);
    expect(JSON.stringify(keys)).toContain("platform-admin-a");
    expect(JSON.stringify(keys)).toContain("platform-admin-b");
    expect(keys.at(-1)).not.toEqual(keys[0]);
  });
});
