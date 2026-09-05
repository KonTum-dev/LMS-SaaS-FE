// @vitest-environment jsdom

import { App as AntdApp } from "antd";
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
import type {
  EffectiveAccess,
  TenantInvitation,
  TenantMember,
  UserRole,
} from "@/lib/types";
import type { OrgUnitTreeNode } from "@/lib/org-units-api";
import { FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";
import UsersPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  message: { error: vi.fn(), success: vi.fn() },
  readOnly: false,
  guardianModule: false,
  role: "TENANT_ADMIN" as UserRole,
  scopeMode: "GLOBAL" as "GLOBAL" | "SCOPED",
  orgUnits: [] as OrgUnitTreeNode[],
}));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: {
      graceEndsAt: mocks.readOnly ? null : "2030-10-01T00:00:00.000Z",
      limits: {
        maxActiveLearners: null,
        maxBranches: null,
        maxCourses: 25,
        maxUsers: 250,
      },
      modules: ["USERS", "COURSES", ...(mocks.guardianModule ? ["GUARDIANS" as const] : [])],
      readOnly: mocks.readOnly,
      state: mocks.readOnly ? "READ_ONLY" : "ACTIVE",
    } satisfies EffectiveAccess,
    organization: {
      _id: "tenant-1",
      enabledModules: ["USERS", "COURSES"],
      logoUrl: null,
      name: "Bright Academy",
      primaryColor: "#176BFF",
      slug: "bright-academy",
      status: "ACTIVE",
    },
    token: "tenant-token",
    user: {
      email: "owner@bright.test",
      fullName: "Bright Owner",
      membershipId: "membership-owner",
      orgUnitScopeMode: mocks.scopeMode,
      role: mocks.role,
      sub: "owner-1",
      tenantId: "tenant-1",
    },
  }),
}));
vi.mock("@/components/table/data-table", () => ({
  DataTable: ({
    ariaLabel,
    columns,
    data,
    emptyText,
    paginationResetKey,
  }: {
    ariaLabel: string;
    columns: Array<{
      accessorKey?: string;
      cell?: (context: {
        getValue: () => unknown;
        row: { original: TenantInvitation | TenantMember };
      }) => React.ReactNode;
      id?: string;
    }>;
    data: Array<TenantInvitation | TenantMember>;
    emptyText?: React.ReactNode;
    paginationResetKey?: string;
  }) => (
    <section aria-label={ariaLabel} data-filter-key={paginationResetKey}>
      {!data.length && emptyText}
      {data.map((item) => (
        <div key={item._id}>
          {columns.map((column, index) => (
            <span key={column.id ?? column.accessorKey ?? index}>
              {column.cell?.({
                getValue: () =>
                  column.accessorKey
                    ? (item as unknown as Record<string, unknown>)[
                        column.accessorKey
                      ]
                    : undefined,
                row: { original: item },
              })}
            </span>
          ))}
        </div>
      ))}
    </section>
  ),
}));
vi.mock("@ant-design/icons", () => ({
  CopyOutlined: () => null,
  MailOutlined: () => null,
  PlusOutlined: () => null,
  RedoOutlined: () => null,
  StopOutlined: () => null,
}));
vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return {
    ...actual,
    Modal: ({
      cancelButtonProps,
      confirmLoading,
      children,
      okText,
      onCancel,
      onOk,
      open,
      title,
    }: {
      cancelButtonProps?: { disabled?: boolean };
      confirmLoading?: boolean;
      children?: React.ReactNode;
      okText?: React.ReactNode;
      onCancel?: () => void;
      onOk?: () => void;
      open?: boolean;
      title?: React.ReactNode;
    }) =>
      open ? (
        <section
          aria-label={typeof title === "string" ? title : undefined}
          role="dialog"
        >
          {children}
          {onCancel && (
            <button disabled={cancelButtonProps?.disabled} onClick={onCancel} type="button">
              Hủy
            </button>
          )}
          {onOk && (
            <button aria-busy={confirmLoading} onClick={onOk} type="button">
              {okText}
            </button>
          )}
        </section>
      ) : null,
  };
});

const member: TenantMember = {
  _id: "membership-1",
  accountStatus: "ACTIVE",
  email: "learner@bright.test",
  fullName: "Learner One",
  joinedAt: "2026-08-01T00:00:00.000Z",
  membershipId: "membership-1",
  role: "LEARNER",
  status: "ACTIVE",
  tenantId: "tenant-1",
  userId: "learner-1",
};

const invitation: TenantInvitation = {
  _id: "invite-1",
  createdAt: "2026-08-01T00:00:00.000Z",
  displayName: "Invited Learner",
  email: "invited@bright.test",
  expiresAt: "2026-09-08T00:00:00.000Z",
  invitedBy: "owner-1",
  role: "LEARNER",
  status: "PENDING",
  tenantId: "tenant-1",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const orgUnitTree: OrgUnitTreeNode[] = [
  {
    _id: "root-1",
    ancestorIds: [],
    archivedAt: null,
    archivedBy: null,
    children: [
      {
        _id: "branch-1",
        ancestorIds: ["root-1"],
        archivedAt: null,
        archivedBy: null,
        children: [],
        code: "q1",
        createdBy: "owner-1",
        depth: 1,
        name: "Cơ sở Quận 1",
        parentId: "root-1",
        path: ["root-1"],
        policyOverrides: {},
        revision: 1,
        status: "ACTIVE",
        tenantId: "tenant-1",
        timezone: "Asia/Ho_Chi_Minh",
        type: "BRANCH",
        updatedBy: "owner-1",
      },
    ],
    code: "bright",
    createdBy: "owner-1",
    depth: 0,
    name: "Bright Academy",
    parentId: null,
    path: [],
    policyOverrides: {},
    revision: 1,
    status: "ACTIVE",
    tenantId: "tenant-1",
    timezone: "Asia/Ho_Chi_Minh",
    type: "ROOT",
    updatedBy: "owner-1",
  },
];

function installApi() {
  mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
    if (path === "/users" && options?.method === "POST") {
      return Promise.resolve(member);
    }
    if (path === "/users/membership-1" && options?.method === "PATCH") {
      return Promise.resolve(member);
    }
    if (
      path === "/users/membership-1/promote-global-admin" &&
      options?.method === "POST"
    ) {
      return Promise.resolve({
        ...member,
        governanceRevision: (member.governanceRevision ?? 0) + 1,
        orgUnitScopeMode: "GLOBAL",
      });
    }
    if (path === "/org-units/tree?includeArchived=false") {
      return Promise.resolve({ items: mocks.orgUnits, total: mocks.orgUnits.length });
    }
    if (path === "/users") return Promise.resolve([member]);
    if (path === "/users/invitations" && options?.method === "POST") {
      return Promise.resolve({
        acceptPath: "/invite/secret-a",
        invitation,
        token: "secret-a",
      });
    }
    if (path === "/users/invitations") return Promise.resolve([invitation]);
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });
}

function renderPage(locale: "vi" | "en" = "vi") {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      {locale === "en" ? <FeedbackLocaleProvider initialLocale="en"><UsersPage /></FeedbackLocaleProvider> : <UsersPage />}
    </QueryClientProvider>,
  );
}

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

describe("UsersPage", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.message.error.mockReset();
    mocks.message.success.mockReset();
    mocks.readOnly = false;
    mocks.guardianModule = false;
    mocks.role = "TENANT_ADMIN";
    mocks.scopeMode = "GLOBAL";
    mocks.orgUnits = [];
    delete member.orgUnitId;
    delete member.governanceRevision;
    delete member.orgUnitScopeMode;
    member.fullName = "Learner One";
    member.role = "LEARNER";
    installApi();
    vi.spyOn(AntdApp, "useApp").mockReturnValue({
      message: mocks.message,
    } as never);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows resend loading per invitation, blocks same-tick repeats and conflicting revoke, then recovers after error", async () => {
    const pending = deferred();
    const base = mocks.apiFetch.getMockImplementation()!;
    mocks.apiFetch.mockImplementation((path, options) => {
      if (path === "/users/invitations" && !options?.method) return Promise.resolve([invitation, { ...invitation, _id: "invite-2", email: "second@example.test" }]);
      if (path === "/users/invitations/invite-1/resend") return pending.promise;
      return base(path, options);
    });
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Lời mời" }));
    await screen.findByText(invitation.email);
    const [first, second] = screen.getAllByRole("button", { name: "Gửi lại" });
    act(() => { fireEvent.click(first); fireEvent.click(first); });
    expect(first.classList.contains("ant-btn-loading")).toBe(true);
    expect(second.classList.contains("ant-btn-loading")).toBe(false);
    expect(second).toHaveProperty("disabled", false);
    expect(screen.getAllByRole("button", { name: "Thu hồi" })[0]).toHaveProperty("disabled", true);
    await waitFor(() => expect(mocks.apiFetch.mock.calls.filter(([path]) => path.endsWith("/resend"))).toHaveLength(1));
    await act(async () => pending.reject(new Error("Temporary failure")));
    await waitFor(() => expect(first.classList.contains("ant-btn-loading")).toBe(false));
    expect(screen.getAllByRole("button", { name: "Thu hồi" })[0]).toHaveProperty("disabled", false);
    fireEvent.click(first);
    await waitFor(() => expect(mocks.apiFetch.mock.calls.filter(([path]) => path.endsWith("/resend"))).toHaveLength(2));
    await waitFor(() => expect(first.classList.contains("ant-btn-loading")).toBe(false));
  });

  it("keeps revoke confirmation and target action visibly pending until completion", async () => {
    const pending = deferred();
    const base = mocks.apiFetch.getMockImplementation()!;
    mocks.apiFetch.mockImplementation((path, options) => path === "/users/invitations/invite-1/revoke" ? pending.promise : base(path, options));
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Lời mời" }));
    await screen.findByText(invitation.email);
    const trigger = screen.getByRole("button", { name: "Thu hồi" });
    fireEvent.click(trigger);
    await screen.findByText("Thu hồi lời mời này?");
    const confirm = screen.getAllByRole("button", { name: "Thu hồi" }).at(-1)!;
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm); });
    await waitFor(() => expect(confirm.classList.contains("ant-btn-loading")).toBe(true));
    expect(trigger.classList.contains("ant-btn-loading")).toBe(true);
    expect(screen.getByRole("button", { name: "Gửi lại" })).toHaveProperty("disabled", true);
    await waitFor(() => expect(mocks.apiFetch.mock.calls.filter(([path]) => path.endsWith("/revoke"))).toHaveLength(1));
    await act(async () => pending.resolve({ ...invitation, status: "REVOKED" }));
    await waitFor(() => expect(trigger.classList.contains("ant-btn-loading")).toBe(false));
    expect(mocks.message.success).toHaveBeenCalledWith("Đã thu hồi lời mời");
  });

  it("shows promotion loading on only its member and leaves its confirmation pending", async () => {
    const pending = deferred();
    member.role = "TENANT_ADMIN";
    member.orgUnitScopeMode = "SCOPED";
    const base = mocks.apiFetch.getMockImplementation()!;
    mocks.apiFetch.mockImplementation((path, options) => {
      if (path === "/users") return Promise.resolve([member, { ...member, _id: "membership-2", membershipId: "membership-2", fullName: "Second manager" }]);
      if (path === "/users/membership-1/promote-global-admin") return pending.promise;
      return base(path, options);
    });
    renderPage();
    await screen.findByText(member.fullName);
    const [first, second] = screen.getAllByRole("button", { name: "Trao quyền toàn tổ chức" });
    fireEvent.click(first);
    const confirm = await screen.findByRole("button", { name: "Trao quyền" });
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm); });
    await waitFor(() => expect(confirm.classList.contains("ant-btn-loading")).toBe(true));
    expect(first.classList.contains("ant-btn-loading")).toBe(true);
    expect(second.classList.contains("ant-btn-loading")).toBe(false);
    expect(second).toHaveProperty("disabled", false);
    await waitFor(() => expect(mocks.apiFetch.mock.calls.filter(([path]) => path.endsWith("/promote-global-admin"))).toHaveLength(1));
    await act(async () => pending.reject(new Error("Revision changed")));
    await waitFor(() => expect(first.classList.contains("ant-btn-loading")).toBe(false));
    expect(mocks.message.error).toHaveBeenCalledWith("Revision changed");
  });

  it("makes member query retry visibly pending and deduplicates repeated retry clicks", async () => {
    const pending = deferred<TenantMember[]>();
    const base = mocks.apiFetch.getMockImplementation()!;
    let reads = 0;
    mocks.apiFetch.mockImplementation((path, options) => path === "/users" ? (++reads === 1 ? Promise.reject(new Error("Offline")) : pending.promise) : base(path, options));
    renderPage();
    const retry = await screen.findByRole("button", { name: "Thử lại" });
    act(() => { fireEvent.click(retry); fireEvent.click(retry); });
    await waitFor(() => expect(retry.classList.contains("ant-btn-loading")).toBe(true));
    expect(reads).toBe(2);
    await act(async () => pending.resolve([member]));
    expect(await screen.findByText(member.fullName)).toBeTruthy();
  });

  it("tìm không dấu kết hợp vai trò/trạng thái, giữ bộ lọc riêng cho từng tab", async () => {
    const teacher = { ...member, _id: "member-2", membershipId: "membership-2", fullName: "Đỗ Minh", email: "minh@example.test", role: "INSTRUCTOR", status: "INACTIVE" };
    const original = mocks.apiFetch.getMockImplementation()!;
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => path === "/users" && !options?.method ? Promise.resolve([member, teacher]) : original(path, options));
    renderPage();
    const members = await screen.findByRole("region", { name: "Danh sách thành viên" });
    expect(await within(members).findByText(teacher.fullName)).toBeTruthy();
    const search = screen.getByRole("searchbox", { name: "Tìm thành viên" });
    fireEvent.change(search, { target: { value: "  DO   MINH  " } });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Lọc vai trò" }));
    fireEvent.click(screen.getByText("Giảng viên", { selector: ".ant-select-item-option-content" }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Lọc trạng thái thành viên" }));
    fireEvent.click(screen.getByText("Tạm ngưng", { selector: ".ant-select-item-option-content" }));
    expect(within(members).getByText(teacher.fullName)).toBeTruthy();
    expect(within(members).queryByText(member.fullName)).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Lời mời" }));
    const invitations = await screen.findByRole("region", { name: "Danh sách lời mời" });
    expect(await within(invitations).findByText(invitation.email)).toBeTruthy();
    expect((screen.getByRole("searchbox", { name: "Tìm lời mời" }) as HTMLInputElement).value).toBe("");
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm lời mời" }), { target: { value: "  INVITED@BRIGHT.TEST  " } });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Lọc trạng thái lời mời" }));
    fireEvent.click(screen.getByText("Đã thu hồi", { selector: ".ant-select-item-option-content" }));
    expect(within(invitations).getByText("Không có lời mời phù hợp")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    expect(within(invitations).getByText(invitation.email)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Thành viên" }));
    expect((screen.getByRole("searchbox", { name: "Tìm thành viên" }) as HTMLInputElement).value).toBe("  DO   MINH  ");
    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    expect(within(members).getByText(member.fullName)).toBeTruthy();
    expect(mocks.apiFetch.mock.calls.filter(([path]) => path === "/users")).toHaveLength(1);
    expect(mocks.apiFetch.mock.calls.some(([, options]) => options?.method)).toBe(false);
  });

  it("có nhãn bộ lọc tiếng Anh và giữ nguyên tên thành viên", async () => {
    renderPage("en");
    expect(await screen.findByText(member.fullName)).toBeTruthy();
    expect(screen.getByRole("search", { name: "Member filters" })).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Find a member" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Filter by role" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Filter member status" })).toBeTruthy();
  });

  it("tải thành viên ngay nhưng chỉ tải lời mời khi mở tab", async () => {
    renderPage();

    expect(await screen.findByText("Learner One")).toBeTruthy();
    expect(mocks.apiFetch).toHaveBeenCalledWith("/users", {
      token: "tenant-token",
    });
    expect(
      mocks.apiFetch.mock.calls.some(([path]) => path === "/users/invitations"),
    ).toBe(false);

    fireEvent.click(screen.getByRole("tab", { name: "Lời mời" }));
    expect(await screen.findByText("Invited Learner")).toBeTruthy();
    expect(mocks.apiFetch).toHaveBeenCalledWith("/users/invitations", {
      token: "tenant-token",
    });
  });

  it.each(["vi", "en"] as const)("creates a guardian safely with pending/retry feedback (%s)", async (locale) => {
    const en = locale === "en";
    mocks.guardianModule = true;
    const pending = deferred();
    const original = mocks.apiFetch.getMockImplementation()!;
    let createCount = 0;
    mocks.apiFetch.mockImplementation((path, options) => path === "/users" && options?.method === "POST"
      ? (++createCount === 1 ? pending.promise : Promise.resolve(member)) : original(path, options));
    renderPage(locale);
    await screen.findByText("Learner One");
    expect(screen.getByRole("link", { name: en ? "Link guardians and learners" : "Liên kết phụ huynh – học viên" }).getAttribute("href")).toBe("/guardians");
    const createLabel = en ? "Create account" : "Tạo tài khoản";
    fireEvent.click(screen.getByRole("button", { name: createLabel }));
    fireEvent.change(screen.getByLabelText(en ? "Full name" : "Họ và tên"), { target: { value: "Parent One" } });
    const email = screen.getByLabelText("Email") as HTMLInputElement;
    fireEvent.change(email, { target: { value: "parent@example.com" } });
    const password = screen.getByLabelText(en ? "Initial password" : "Mật khẩu ban đầu");
    fireEvent.change(password, { target: { value: "Parent@1234" } });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: en ? "Role" : "Vai trò" }));
    fireEvent.click(await screen.findByText(en ? "Guardian" : "Phụ huynh"));
    const save = screen.getAllByRole("button", { name: createLabel }).at(-1)!;
    fireEvent.click(save);
    expect(await screen.findByText(en ? "Use at least 12 characters" : "Mật khẩu cần ít nhất 12 ký tự")).toBeTruthy();
    expect(createCount).toBe(0);
    fireEvent.change(password, { target: { value: "Parent@12345" } });
    act(() => { fireEvent.click(save); fireEvent.click(save); });
    await waitFor(() => expect(createCount).toBe(1));
    expect(email.disabled).toBe(true);
    expect(save.getAttribute("aria-busy")).toBe("true");
    expect((screen.getByRole("button", { name: "Hủy" }) as HTMLButtonElement).disabled).toBe(true);
    const request = mocks.apiFetch.mock.calls.find(([path, options]) => path === "/users" && options?.method === "POST")!;
    expect(JSON.parse(request[1].body)).toEqual({ email: "parent@example.com", fullName: "Parent One", password: "Parent@12345", role: "GUARDIAN" });
    await act(async () => { pending.reject(new Error("Offline")); });
    await waitFor(() => expect(email.disabled).toBe(false));
    expect(email.value).toBe("parent@example.com");
    fireEvent.click(save);
    await waitFor(() => expect(createCount).toBe(2));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.apiFetch.mock.calls.filter(([path, options]) => path === "/users" && !options?.method).length).toBeGreaterThan(1);
  });

  it("tạo tài khoản learner bằng payload tenant-scoped tối thiểu", async () => {
    renderPage();
    await screen.findByText("Learner One");
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    fireEvent.change(screen.getByLabelText("Họ và tên"), {
      target: { value: "  Học viên mới  " },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "NEW@BRIGHT.TEST" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu ban đầu"), {
      target: { value: "Student@1234" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Tạo tài khoản" }).at(-1)!,
    );

    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/users", {
        body: JSON.stringify({
          email: "new@bright.test",
          fullName: "Học viên mới",
          password: "Student@1234",
          role: "LEARNER",
        }),
        method: "POST",
        token: "tenant-token",
      }),
    );
    expect(mocks.message.success).toHaveBeenCalledWith("Đã tạo tài khoản mới");
  });

  it("gắn cơ sở chính khi global admin tạo tài khoản", async () => {
    mocks.orgUnits = orgUnitTree;
    renderPage();
    await screen.findByText("Learner One");
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/org-units/tree?includeArchived=false",
        expect.objectContaining({ token: "tenant-token" }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    fireEvent.change(screen.getByLabelText("Họ và tên"), {
      target: { value: "Học viên chi nhánh" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "branch@bright.test" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu ban đầu"), {
      target: { value: "Student@1234" },
    });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Cơ sở chính" }));
    fireEvent.click(
      await screen.findByText("Bright Academy / Cơ sở Quận 1 · Chi nhánh"),
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Tạo tài khoản" }).at(-1)!,
    );

    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/users", {
        body: JSON.stringify({
          email: "branch@bright.test",
          fullName: "Học viên chi nhánh",
          orgUnitId: "branch-1",
          password: "Student@1234",
          role: "LEARNER",
        }),
        method: "POST",
        token: "tenant-token",
      }),
    );
  });

  it("cho phép chuyển cơ sở chính khi cập nhật thành viên", async () => {
    mocks.orgUnits = orgUnitTree;
    member.orgUnitId = "branch-1";
    renderPage();
    await screen.findByText("Learner One");
    fireEvent.click(await screen.findByRole("button", { name: "Sửa" }));

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Cơ sở chính" }));
    fireEvent.click(await screen.findByText("Bright Academy · Trung tâm"));
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/users/membership-1", {
        body: JSON.stringify({
          displayName: "Learner One",
          orgUnitId: "root-1",
          role: "LEARNER",
          status: "ACTIVE",
        }),
        method: "PATCH",
        token: "tenant-token",
      }),
    );
  });

  it("gắn cơ sở chính vào lời mời", async () => {
    mocks.orgUnits = orgUnitTree;
    renderPage();
    await screen.findByText("Learner One");
    fireEvent.click(screen.getByRole("button", { name: "Gửi lời mời" }));

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "INVITED.BRANCH@BRIGHT.TEST" },
    });
    fireEvent.change(screen.getByLabelText("Tên hiển thị (không bắt buộc)"), {
      target: { value: " Học viên được mời " },
    });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Cơ sở chính" }));
    fireEvent.click(
      await screen.findByText("Bright Academy / Cơ sở Quận 1 · Chi nhánh"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Tạo lời mời" }));

    await waitFor(() => {
      const call = mocks.apiFetch.mock.calls.find(
        ([path, options]) =>
          path === "/users/invitations" && options?.method === "POST",
      );
      expect(call?.[1]).toMatchObject({
        method: "POST",
        token: "tenant-token",
      });
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        displayName: "Học viên được mời",
        email: "invited.branch@bright.test",
        orgUnitId: "branch-1",
        role: "LEARNER",
      });
    });
  });

  it("tự chọn cơ sở duy nhất cho scoped admin và không hiện vai trò tổ chức", async () => {
    mocks.scopeMode = "SCOPED";
    mocks.orgUnits = [orgUnitTree[0].children[0]];
    renderPage();
    await screen.findByText("Learner One");
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Vai trò" }));
    expect(screen.queryByText("Giảng viên")).toBeNull();
    expect(screen.queryByText("Quản trị tổ chức")).toBeNull();
    fireEvent.change(screen.getByLabelText("Họ và tên"), {
      target: { value: "Học viên scoped" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "scoped@bright.test" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu ban đầu"), {
      target: { value: "Student@1234" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Tạo tài khoản" }).at(-1)!,
    );

    await waitFor(() => {
      const call = mocks.apiFetch.mock.calls.find(
        ([path, options]) => path === "/users" && options?.method === "POST",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
        orgUnitId: "branch-1",
        role: "LEARNER",
      });
    });
  });

  it("scoped admin không mở biểu mẫu sửa vai trò tổ chức", async () => {
    mocks.scopeMode = "SCOPED";
    mocks.orgUnits = [orgUnitTree[0].children[0]];
    member.fullName = "Quản lý cơ sở";
    member.role = "TENANT_ADMIN";

    renderPage();

    expect(await screen.findByText("Quản lý cơ sở")).toBeTruthy();
    expect(screen.getByText("Chỉ xem")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sửa" })).toBeNull();
  });

  it("global admin có thể trao quyền toàn tổ chức cho quản lý cơ sở", async () => {
    member.governanceRevision = 3;
    member.orgUnitScopeMode = "SCOPED";
    member.role = "TENANT_ADMIN";

    renderPage();
    await screen.findByText("Learner One");
    fireEvent.click(
      screen.getByRole("button", { name: "Trao quyền toàn tổ chức" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Trao quyền" }));

    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/users/membership-1/promote-global-admin",
        {
          body: JSON.stringify({ expectedRevision: 3 }),
          method: "POST",
          token: "tenant-token",
        },
      ),
    );
    expect(mocks.message.success).toHaveBeenCalledWith(
      "Đã trao quyền quản trị toàn tổ chức",
    );
  });

  it("READ_ONLY vẫn đọc danh sách nhưng khóa mọi nút tạo", async () => {
    mocks.readOnly = true;
    renderPage();

    expect(await screen.findByText("Learner One")).toBeTruthy();
    expect(screen.getByText(/Workspace đang ở chế độ chỉ đọc/)).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Tạo tài khoản",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Gửi lời mời" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("fail closed cho người không phải quản trị tenant", async () => {
    mocks.role = "INSTRUCTOR";
    renderPage();

    expect(screen.getByRole("alert").textContent).toContain(
      "Chỉ quản trị tổ chức được quản lý người dùng",
    );
    await waitFor(() => expect(mocks.apiFetch).not.toHaveBeenCalled());
  });
});
