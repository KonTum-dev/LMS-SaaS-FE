// @vitest-environment jsdom

import { App as AntdApp } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
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
import type {
  EffectiveAccess,
  TenantInvitation,
  TenantMember,
  UserRole,
} from "@/lib/types";
import type { OrgUnitTreeNode } from "@/lib/org-units-api";
import UsersPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  message: { error: vi.fn(), success: vi.fn() },
  readOnly: false,
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
      modules: ["USERS", "COURSES"],
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
  }) => (
    <section aria-label={ariaLabel}>
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
      children,
      okText,
      onCancel,
      onOk,
      open,
      title,
    }: {
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
            <button onClick={onCancel} type="button">
              Hủy
            </button>
          )}
          {onOk && (
            <button onClick={onOk} type="button">
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

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <UsersPage />
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
      target: { value: "Student@123" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Tạo tài khoản" }).at(-1)!,
    );

    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/users", {
        body: JSON.stringify({
          email: "new@bright.test",
          fullName: "Học viên mới",
          password: "Student@123",
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
      target: { value: "Student@123" },
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
          password: "Student@123",
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
      target: { value: "Student@123" },
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
