// @vitest-environment jsdom

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
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import {
  FeedbackLanguageSwitcher,
  FeedbackLocaleProvider,
} from "@/components/feedback/feedback-locale";
import type {
  AdminAccountDetail,
  AdminAccountsQuery,
} from "@/lib/admin-accounts-api";
import type { CurrentUser } from "@/lib/types";
import AdminAccountsPage from "./page";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  disable: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  restore: vi.fn(),
  update: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  updateUserProfile: vi.fn(),
  generation: 1,
  session: {
    token: "platform-token",
    user: {
      sub: "64b000000000000000000002",
      role: "SUPER_ADMIN",
      email: "root@example.test",
      fullName: "Root",
    } as CurrentUser | null,
  },
}));
vi.mock("@/lib/admin-accounts-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin-accounts-api")>()),
  adminAccountsApi: mocks,
}));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    ...mocks.session,
    captureAuthGeneration: () => mocks.generation,
    updateUserProfile: mocks.updateUserProfile,
  }),
}));
vi.mock("antd", async () => {
  const { lightweightAntd } = await import("@/test-utils/lightweight-antd");
  return {
    ...lightweightAntd,
    App: Object.assign(
      ({ children }: { children?: ReactNode }) => <>{children}</>,
      {
        useApp: () => ({
          message: { error: mocks.error, success: mocks.success },
        }),
      },
    ),
    Select: ({
      "aria-label": label,
      disabled,
      onChange,
      options,
      value,
    }: {
      "aria-label"?: string;
      disabled?: boolean;
      onChange: (value: string) => void;
      options: { value: string; label: string }[];
      value: string;
    }) => (
      <select
        aria-label={label}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  };
});

const accountId = "64b000000000000000000001";
function account(
  overrides: Partial<AdminAccountDetail> = {},
): AdminAccountDetail {
  return {
    _id: accountId,
    email: "member@example.test",
    fullName: "Nguyễn An",
    status: "ACTIVE",
    platformRole: null,
    createdAt: "2030-08-16T00:00:00.000Z",
    updatedAt: "2030-08-16T00:00:00.000Z",
    memberships: [],
    audit: [],
    ...overrides,
  };
}
function renderPage(locale?: "vi" | "en") {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      {locale ? (
        <FeedbackLocaleProvider initialLocale={locale}>
          <FeedbackLanguageSwitcher />
          {children}
        </FeedbackLocaleProvider>
      ) : (
        children
      )}
    </QueryClientProvider>
  );
  return { ...render(<AdminAccountsPage />, { wrapper }), client };
}
async function openDetail() {
  fireEvent.click(
    await screen.findByRole("button", { name: "Chi tiết member@example.test" }),
  );
  await screen.findByRole("button", { name: "Chỉnh sửa tài khoản" });
}
function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  vi.clearAllMocks();
  mocks.generation = 1;
  mocks.session.token = "platform-token";
  mocks.session.user = {
    sub: "64b000000000000000000002",
    role: "SUPER_ADMIN",
    email: "root@example.test",
    fullName: "Root",
  };
  mocks.list.mockImplementation((_context, query: AdminAccountsQuery) =>
    Promise.resolve({ items: [account()], total: 41, ...query }),
  );
  mocks.get.mockResolvedValue(account());
  for (const method of [
    mocks.create,
    mocks.update,
    mocks.disable,
    mocks.restore,
  ])
    method.mockResolvedValue(account());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("platform accounts CRUD", () => {
  it("switches English account controls without translating names or filter values", async () => {
    renderPage("en");
    expect(await screen.findByText("Nguyễn An")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 1, name: "Platform accounts" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Manage sign-in accounts across the platform."),
    ).toBeTruthy();
    const main = screen.getByRole("main");
    expect(main.classList.contains("page-shell")).toBe(true);
    expect(
      main.querySelector("header.page-heading .page-toolbar-action"),
    ).toBeTruthy();
    expect(main.querySelector("form.admin-accounts-filter")).toBeTruthy();
    expect(main.querySelector(".page-inline-note")?.textContent).toContain(
      "Disabling an account prevents sign-in to every organization.",
    );
    fireEvent.change(screen.getByLabelText("Filter platform roles"), {
      target: { value: "SUPER_ADMIN" },
    });
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ token: "platform-token" }),
        expect.objectContaining({ platformRole: "SUPER_ADMIN" }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(
      screen.getByRole("dialog", { name: "Create platform account" }),
    ).toBeTruthy();
    fill("Account full name", "Nguyễn Văn Học");
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    expect(
      screen.getByRole("dialog", { name: "Tạo tài khoản nền tảng" }),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText("Họ tên tài khoản") as HTMLInputElement).value,
    ).toBe("Nguyễn Văn Học");
    expect(screen.getByText("Nguyễn An")).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not query or expose controls to tenant admins", () => {
    mocks.session.user = { ...mocks.session.user!, role: "TENANT_ADMIN" };
    renderPage();
    expect(screen.getByText(/Chỉ quản trị nền tảng/)).toBeTruthy();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Tạo tài khoản" })).toBeNull();
  });

  it("uses server pagination and resets page on search or filters", async () => {
    renderPage();
    await screen.findByText("Nguyễn An");
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          token: "platform-token",
          signal: expect.any(AbortSignal),
        }),
        { page: 2, limit: 20 },
      ),
    );
    fill("Tìm tài khoản theo tên hoặc email", "  Nguyễn  ");
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(expect.anything(), {
        page: 1,
        limit: 20,
        search: "Nguyễn",
      }),
    );
    fill("Lọc trạng thái tài khoản", "INACTIVE");
    fill("Lọc quyền nền tảng", "SUPER_ADMIN");
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(expect.anything(), {
        page: 1,
        limit: 20,
        search: "Nguyễn",
        status: "INACTIVE",
        platformRole: "SUPER_ADMIN",
      }),
    );
  });

  it("waits for explicit search and resets immediately when the input is cleared", async () => {
    renderPage();
    await screen.findByText("Nguyễn An");
    fill("Tìm tài khoản theo tên hoặc email", "N");
    fill("Tìm tài khoản theo tên hoặc email", "  Nguyễn  ");
    expect(mocks.list).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.anything(), {
      page: 1, limit: 20, search: "Nguyễn",
    }));
    await screen.findByText("Nguyễn An");
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.anything(), {
      page: 2, limit: 20, search: "Nguyễn",
    }));
    fill("Tìm tài khoản theo tên hoặc email", "");
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.anything(), {
      page: 1, limit: 20, search: undefined,
    }));
    expect(screen.queryByRole("button", { name: "Xóa bộ lọc" })).toBeNull();
  });

  it("resets page for a new size and clears search/status/role while preserving that size", async () => {
    renderPage("en");
    await screen.findByText("Nguyễn An");
    fill("Find accounts by name or email", " Nguyễn ");
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fill("Filter account status", "INACTIVE");
    fill("Filter platform roles", "USER");
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.anything(), {
      page: 1, limit: 20, search: "Nguyễn", status: "INACTIVE", platformRole: "USER",
    }));
    await screen.findByText("Nguyễn An");
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() => expect(screen.getByText("Trang 2")).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Rows per page|Số dòng mỗi trang/), { target: { value: "50" } });
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.anything(), {
      page: 1, limit: 50, search: "Nguyễn", status: "INACTIVE", platformRole: "USER",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.anything(), { page: 1, limit: 50 }));
    expect((screen.getByLabelText("Find accounts by name or email") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Filter account status") as HTMLSelectElement).value).toBe("ALL");
    expect((screen.getByLabelText("Filter platform roles") as HTMLSelectElement).value).toBe("ALL");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("creates an account with explicit role/reason then clears the password", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    fill("Email tài khoản", "new@example.test");
    fill("Họ tên tài khoản", "New User");
    fill("Mật khẩu ban đầu", "SecurePassword!123");
    fill("Quyền nền tảng của tài khoản", "SUPER_ADMIN");
    fill("Lý do thay đổi tài khoản", "Approved new admin");
    const dialog = screen.getByRole("dialog", {
      name: "Tạo tài khoản nền tảng",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Tạo tài khoản" }),
    );
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({ token: "platform-token" }),
        {
          email: "new@example.test",
          fullName: "New User",
          password: "SecurePassword!123",
          platformRole: "SUPER_ADMIN",
          reason: "Approved new admin",
        },
      ),
    );
    await waitFor(() =>
      expect(screen.queryByLabelText("Mật khẩu ban đầu")).toBeNull(),
    );
    expect(mocks.success).toHaveBeenCalledOnce();
    expect(mocks.success).toHaveBeenCalledWith({
      key: "admin-account-mutation",
      content: "Đã tạo tài khoản nền tảng.",
    });
  });

  it("shows membership/audit, edits name without exposing password or editable email", async () => {
    mocks.get.mockResolvedValue(
      account({
        memberships: [
          {
            membershipId: "64b000000000000000000004",
            tenantId: "64b000000000000000000003",
            tenantName: "Bright Academy",
            tenantSlug: "bright",
            role: "LEARNER",
            status: "INACTIVE",
          },
        ],
        audit: [
          {
            _id: "64b000000000000000000005",
            action: "ACCOUNT_UPDATED",
            actorId: "64b000000000000000000002",
            reason: "Approved correction",
            status: "SUCCEEDED",
            createdAt: "2030-08-16T00:00:00.000Z",
          },
        ],
      }),
    );
    renderPage();
    await openDetail();
    expect(screen.getByText("Bright Academy")).toBeTruthy();
    expect(screen.getByText("Approved correction")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Chỉnh sửa tài khoản" }),
    );
    expect(
      (screen.getByLabelText("Email tài khoản") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(screen.queryByLabelText("Mật khẩu ban đầu")).toBeNull();
    expect(
      (
        screen.getByLabelText(
          "Quyền nền tảng của tài khoản",
        ) as HTMLSelectElement
      ).disabled,
    ).toBe(true);
    fill("Họ tên tài khoản", "Corrected Name");
    fill("Lý do thay đổi tài khoản", "Correct display name");
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(expect.anything(), accountId, {
        fullName: "Corrected Name",
        platformRole: null,
        reason: "Correct display name",
      }),
    );
  });

  it("requires explicit global disable confirmation and supports restoration", async () => {
    renderPage();
    await openDetail();
    fireEvent.click(
      screen.getByRole("button", { name: "Vô hiệu hóa toàn hệ thống" }),
    );
    expect(mocks.disable).not.toHaveBeenCalled();
    expect(screen.getByText(/Chặn đăng nhập ở tất cả tổ chức/)).toBeTruthy();
    fill("Lý do vô hiệu hóa hoặc khôi phục", "Disable insecure demo");
    mocks.get.mockResolvedValue(account({ status: "INACTIVE" }));
    mocks.disable.mockResolvedValue(account({ status: "INACTIVE" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận vô hiệu hóa" }),
    );
    await waitFor(() =>
      expect(mocks.disable).toHaveBeenCalledWith(
        expect.anything(),
        accountId,
        "Disable insecure demo",
      ),
    );
    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith({
        key: "admin-account-mutation",
        content:
          "Đã vô hiệu hóa tài khoản trên toàn hệ thống. Các phiên đăng nhập cũ đã bị thu hồi.",
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Khôi phục tài khoản" }),
    );
    fill("Lý do vô hiệu hóa hoặc khôi phục", "Approved restoration");
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận khôi phục" }));
    await waitFor(() =>
      expect(mocks.restore).toHaveBeenCalledWith(
        expect.anything(),
        accountId,
        "Approved restoration",
      ),
    );
    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith({
        key: "admin-account-mutation",
        content:
          "Đã khôi phục tài khoản. Người dùng cần đăng nhập lại để tiếp tục.",
      }),
    );
  });

  it("blocks self-disable and self-demotion", async () => {
    mocks.session.user = { ...mocks.session.user!, sub: accountId };
    mocks.get.mockResolvedValue(account({ platformRole: "SUPER_ADMIN" }));
    renderPage();
    await openDetail();
    expect(
      (
        screen.getByRole("button", {
          name: "Vô hiệu hóa toàn hệ thống",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Chỉnh sửa tài khoản" }),
    );
    expect(
      (
        screen.getByLabelText(
          "Quyền nền tảng của tài khoản",
        ) as HTMLSelectElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.getByText("Không thể tự hạ quyền tài khoản đang đăng nhập."),
    ).toBeTruthy();
    fill("Họ tên tài khoản", "Updated administrator");
    fill("Lý do thay đổi tài khoản", "Correct own display name");
    mocks.update.mockResolvedValue(
      account({
        fullName: "Updated administrator",
        platformRole: "SUPER_ADMIN",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() =>
      expect(mocks.updateUserProfile).toHaveBeenCalledWith({
        sub: accountId,
        fullName: "Updated administrator",
        avatarUrl: undefined,
      }),
    );
  });

  it("prevents retry of uncertain mutations until the operator reloads and reconciles", async () => {
    mocks.disable.mockRejectedValue(
      new ApiError(
        "Chưa xác định kết quả thay đổi",
        503,
        "ACCOUNT_MUTATION_UNCERTAIN",
      ),
    );
    renderPage();
    await openDetail();
    fireEvent.click(
      screen.getByRole("button", { name: "Vô hiệu hóa toàn hệ thống" }),
    );
    fill("Lý do vô hiệu hóa hoặc khôi phục", "Security policy update");
    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận vô hiệu hóa" }),
    );
    await screen.findByText("Không gửi lại thao tác khi chưa đối soát");
    expect(mocks.error).toHaveBeenCalledWith("Chưa xác định kết quả thay đổi");
    const submit = screen.getByRole("button", { name: "Xác nhận vô hiệu hóa" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(submit);
    expect(mocks.disable).toHaveBeenCalledOnce();
    const calls = mocks.list.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    await waitFor(() =>
      expect(mocks.list.mock.calls.length).toBeGreaterThan(calls),
    );
  });

  it("keeps dialog and values on server validation/conflict errors", async () => {
    mocks.update.mockRejectedValue(
      new ApiError("Lý do phải có từ 5 đến 500 ký tự", 400),
    );
    renderPage();
    await openDetail();
    fireEvent.click(
      screen.getByRole("button", { name: "Chỉnh sửa tài khoản" }),
    );
    fill("Họ tên tài khoản", "Still here");
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await screen.findByText(
      "Lý do cần từ 5 đến 500 ký tự, không tính khoảng trắng ở hai đầu.",
    );
    expect(screen.queryByText("Lý do phải có từ 5 đến 500 ký tự")).toBeNull();
    expect(
      (screen.getByLabelText("Họ tên tài khoản") as HTMLInputElement).value,
    ).toBe("Still here");
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(
      "Lý do phải có từ 5 đến 500 ký tự",
    );
  });

  it("prevents duplicate submits/cancel and ignores late responses after auth change", async () => {
    let finish!: (value: AdminAccountDetail) => void;
    mocks.create.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    fill("Email tài khoản", "new@example.test");
    fill("Họ tên tài khoản", "New User");
    fill("Mật khẩu ban đầu", "SecurePassword!123");
    fill("Lý do thay đổi tài khoản", "Approved new account");
    const dialog = screen.getByRole("dialog", {
      name: "Tạo tài khoản nền tảng",
    });
    const submit = within(dialog).getByRole("button", {
      name: "Tạo tài khoản",
    });
    fireEvent.click(submit);
    fireEvent.click(submit);
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("dialog", { name: "Tạo tài khoản nền tảng" }),
    ).toBeTruthy();
    const signal = mocks.create.mock.calls[0][0].signal as AbortSignal;
    mocks.generation += 1;
    mocks.session.token = "another-token";
    view.rerender(<AdminAccountsPage />);
    expect(signal.aborted).toBe(true);
    await act(async () => finish(account()));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows pending detail retry and clears it after the request completes", async () => {
    mocks.get.mockRejectedValueOnce(new Error("Unavailable"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Chi tiết member@example.test" }));
    await screen.findByText("Không tải được chi tiết");
    let complete!: (value: AdminAccountDetail) => void;
    mocks.get.mockImplementationOnce(() => new Promise<AdminAccountDetail>((resolve) => { complete = resolve; }));
    const retry = screen.getByRole("button", { name: "Thử lại" });
    act(() => { fireEvent.click(retry); fireEvent.click(retry); });
    await waitFor(() => expect(within(screen.getByRole("dialog", { name: "Chi tiết tài khoản" })).getByText("Đang tải")).toBeTruthy());
    expect(mocks.get).toHaveBeenCalledTimes(2);
    await act(async () => complete(account()));
    await screen.findByRole("button", { name: "Chỉnh sửa tài khoản" });
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
  });

  it("shows list errors instead of stale mutation controls", async () => {
    mocks.list.mockRejectedValue(new Error("Unavailable"));
    renderPage();
    await screen.findByText("Không tải được danh sách tài khoản");
    expect(screen.getByLabelText("Tìm tài khoản theo tên hoặc email")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tải lại" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Danh sách tài khoản nền tảng" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Chi tiết member/ }),
    ).toBeNull();
  });
});
