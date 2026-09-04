// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type {
  MyOrgUnitAccess,
  OrgUnitAssignment,
} from "@/lib/org-unit-access-api";
import type { OrgUnitTreeNode } from "@/lib/org-units-api";
import type { TenantMember, UserRole } from "@/lib/types";
import OrgUnitAccessPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  archive: vi.fn(),
  assignments: [] as OrgUnitAssignment[],
  create: vi.fn(),
  list: vi.fn(),
  me: vi.fn(),
  meResponse: null as MyOrgUnitAccess | null,
  message: { error: vi.fn(), success: vi.fn() },
  readOnly: false,
  role: "TENANT_ADMIN" as UserRole,
  tree: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: { readOnly: mocks.readOnly },
    organization: {
      _id: "tenant-1",
      enabledModules: ["USERS", "ORGANIZATION_STRUCTURE"],
      logoUrl: null,
      name: "Bright Academy",
      primaryColor: "#176BFF",
      slug: "bright-academy",
      status: "ACTIVE",
    },
    token: "tenant-token",
    user: {
      email: "viewer@bright.test",
      fullName: "Bright Viewer",
      membershipId: "membership-admin",
      role: mocks.role,
      sub: "viewer-1",
      tenantId: "tenant-1",
    },
  }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, apiFetch: mocks.apiFetch };
});

vi.mock("@/lib/org-unit-access-api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/org-unit-access-api")>();
  return {
    ...actual,
    orgUnitAccessApi: {
      archive: mocks.archive,
      create: mocks.create,
      list: mocks.list,
      me: mocks.me,
      update: mocks.update,
    },
  };
});

vi.mock("@/lib/org-units-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/org-units-api")>();
  return {
    ...actual,
    orgUnitsApi: { ...actual.orgUnitsApi, tree: mocks.tree },
  };
});

vi.mock("@ant-design/icons", () => ({
  EditOutlined: () => null,
  PlusOutlined: () => null,
  ReloadOutlined: () => null,
}));

vi.mock("antd", async () => {
  const { lightweightAntd } = await import("@/test-utils/lightweight-antd");
  const TestApp = ({ children }: { children?: ReactNode }) => <>{children}</>;
  TestApp.useApp = () => ({ message: mocks.message });

  return {
    ...lightweightAntd,
    App: TestApp,
    Select: ({
      "aria-label": ariaLabel,
      disabled,
      onChange,
      options = [],
      value,
    }: {
      "aria-label"?: string;
      disabled?: boolean;
      onChange?: (value?: string) => void;
      options?: Array<{ label?: ReactNode; value: string }>;
      value?: string;
    }) => (
      <select
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value || undefined)}
        value={value ?? ""}
      >
        <option value="">Tất cả</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
    Switch: ({
      "aria-label": ariaLabel,
      checked,
      onChange,
    }: {
      "aria-label"?: string;
      checked?: boolean;
      onChange?: (checked: boolean) => void;
    }) => (
      <button
        aria-label={ariaLabel}
        aria-pressed={checked}
        onClick={() => onChange?.(!checked)}
        type="button"
      />
    ),
  };
});

const actorId = "64b000000000000000000001";
const branch: OrgUnitTreeNode = {
  _id: "branch-hcm",
  ancestorIds: ["root-1"],
  archivedAt: null,
  archivedBy: null,
  children: [],
  code: "hcm",
  createdBy: actorId,
  depth: 1,
  name: "Chi nhánh HCM",
  parentId: "root-1",
  path: ["bright", "hcm"],
  policyOverrides: {},
  revision: 1,
  status: "ACTIVE",
  tenantId: "tenant-1",
  timezone: "Asia/Ho_Chi_Minh",
  type: "BRANCH",
  updatedBy: actorId,
};
const root: OrgUnitTreeNode = {
  ...branch,
  _id: "root-1",
  ancestorIds: [],
  children: [branch],
  code: "bright",
  depth: 0,
  name: "Bright Academy",
  parentId: null,
  path: ["bright"],
  type: "ROOT",
};
const member: TenantMember = {
  _id: "user-lan",
  accountStatus: "ACTIVE",
  email: "lan@bright.test",
  fullName: "Cô Lan",
  joinedAt: "2026-01-01T00:00:00.000Z",
  membershipId: "membership-lan",
  role: "INSTRUCTOR",
  status: "ACTIVE",
  tenantId: "tenant-1",
  userId: "user-lan",
};
const populatedAssignment: OrgUnitAssignment = {
  _id: "assignment-1",
  accessLevel: "MANAGER",
  createdAt: "2026-09-01T08:00:00.000Z",
  createdBy: actorId,
  includeDescendants: true,
  membershipId: {
    _id: "membership-lan",
    displayName: "Cô Lan",
    role: "INSTRUCTOR",
    userId: {
      _id: "user-lan",
      email: "lan@bright.test",
      fullName: "Nguyễn Thị Lan",
    },
  },
  orgUnitId: {
    _id: "branch-hcm",
    code: "hcm",
    name: "Chi nhánh HCM",
    type: "BRANCH",
  },
  revision: 3,
  status: "ACTIVE",
  tenantId: "tenant-1",
  updatedBy: actorId,
  userId: "user-lan",
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <OrgUnitAccessPage />
    </QueryClientProvider>,
  );
}

describe("OrgUnitAccessPage", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.archive.mockReset();
    mocks.create.mockReset();
    mocks.list.mockReset();
    mocks.me.mockReset();
    mocks.message.error.mockReset();
    mocks.message.success.mockReset();
    mocks.tree.mockReset();
    mocks.update.mockReset();
    mocks.assignments = [populatedAssignment];
    mocks.meResponse = {
      highestAccessLevel: null,
      orgUnitIds: null,
      scoped: false,
    };
    mocks.readOnly = false;
    mocks.role = "TENANT_ADMIN";
    mocks.apiFetch.mockResolvedValue([member]);
    mocks.list.mockImplementation(() => Promise.resolve(mocks.assignments));
    mocks.me.mockImplementation(() => Promise.resolve(mocks.meResponse));
    mocks.tree.mockResolvedValue({ items: [root], total: 2 });
    mocks.create.mockResolvedValue(populatedAssignment);
    mocks.update.mockResolvedValue(populatedAssignment);
    mocks.archive.mockResolvedValue({
      ...populatedAssignment,
      status: "ARCHIVED",
    });
  });

  afterEach(() => cleanup());

  it("admin toàn cục xem được populated references và revision", async () => {
    renderPage();

    expect(await screen.findByText("Cô Lan")).toBeTruthy();
    expect(screen.getAllByText("Chi nhánh HCM").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Quản lý").length).toBeGreaterThan(0);
    expect(screen.getByText("Bao gồm cấp dưới")).toBeTruthy();
    expect(screen.getByText("Phiên bản 3")).toBeTruthy();
    expect(screen.getByText("Toàn tổ chức")).toBeTruthy();
    expect(mocks.me).toHaveBeenCalledWith(
      { token: "tenant-token" },
      { signal: expect.any(AbortSignal) },
    );
    expect(mocks.list).toHaveBeenCalledWith(
      { token: "tenant-token" },
      {},
      { signal: expect.any(AbortSignal) },
    );
  });

  it("cấp quyền bằng membershipId và orgUnitId từ danh mục", async () => {
    renderPage();
    await screen.findByText("Cô Lan");

    fireEvent.click(screen.getByRole("button", { name: "Cấp quyền" }));
    fireEvent.change(screen.getByLabelText("Đơn vị cần cấp quyền"), {
      target: { value: "branch-hcm" },
    });
    fireEvent.change(screen.getByLabelText("Thành viên cần cấp quyền"), {
      target: { value: "membership-lan" },
    });
    fireEvent.change(screen.getByLabelText("Mức quyền chi nhánh"), {
      target: { value: "STAFF" },
    });
    fireEvent.click(screen.getByLabelText("Áp dụng cho đơn vị cấp dưới"));
    fireEvent.click(screen.getByRole("button", { name: "Lưu phân quyền" }));

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        { token: "tenant-token" },
        {
          accessLevel: "STAFF",
          includeDescendants: true,
          membershipId: "membership-lan",
          orgUnitId: "branch-hcm",
        },
      ),
    );
  });

  it("update và archive luôn gửi expectedRevision hiện tại", async () => {
    renderPage();
    await screen.findByText("Cô Lan");

    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    fireEvent.change(screen.getByLabelText("Mức quyền chi nhánh"), {
      target: { value: "VIEWER" },
    });
    fireEvent.click(screen.getByLabelText("Áp dụng cho đơn vị cấp dưới"));
    fireEvent.click(screen.getByRole("button", { name: "Lưu phân quyền" }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        { token: "tenant-token" },
        "assignment-1",
        {
          accessLevel: "VIEWER",
          expectedRevision: 3,
          includeDescendants: false,
        },
      ),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận thu hồi" }),
    );
    await waitFor(() =>
      expect(mocks.archive).toHaveBeenCalledWith(
        { token: "tenant-token" },
        "assignment-1",
        3,
      ),
    );
  });

  it("403 list khóa UI và giải thích admin không thể tự mở rộng quyền", async () => {
    mocks.meResponse = {
      highestAccessLevel: "MANAGER",
      orgUnitIds: ["branch-hcm"],
      scoped: true,
    };
    mocks.list.mockRejectedValue(
      new ApiError("Global tenant admin required", 403, "ORG_SCOPE_FORBIDDEN"),
    );
    renderPage();

    expect(
      await screen.findByText("Không thể tự mở rộng quyền chi nhánh"),
    ).toBeTruthy();
    expect(screen.getByText(/đang bị giới hạn theo chi nhánh/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Cấp quyền" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.queryByText("Bộ lọc phân quyền")).toBeNull();
  });

  it("giảng viên chỉ gọi /me và xem tên đơn vị được cấp", async () => {
    mocks.role = "INSTRUCTOR";
    mocks.meResponse = {
      highestAccessLevel: "STAFF",
      orgUnitIds: ["branch-hcm"],
      scoped: true,
    };
    renderPage();

    expect(await screen.findByText("Phạm vi chỉ đọc")).toBeTruthy();
    expect(await screen.findByText("Giới hạn theo đơn vị")).toBeTruthy();
    expect(screen.getByText("Nhân sự")).toBeTruthy();
    expect(screen.getByText("Chi nhánh HCM")).toBeTruthy();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Cấp quyền" })).toBeNull();
  });

  it("gửi đủ bốn bộ lọc vào list query", async () => {
    renderPage();
    await screen.findByText("Cô Lan");

    fireEvent.change(screen.getByLabelText("Lọc theo đơn vị"), {
      target: { value: "branch-hcm" },
    });
    fireEvent.change(screen.getByLabelText("Lọc theo thành viên"), {
      target: { value: "membership-lan" },
    });
    fireEvent.change(screen.getByLabelText("Lọc theo mức quyền"), {
      target: { value: "MANAGER" },
    });
    fireEvent.change(screen.getByLabelText("Lọc theo trạng thái"), {
      target: { value: "ACTIVE" },
    });

    await waitFor(() =>
      expect(mocks.list).toHaveBeenCalledWith(
        { token: "tenant-token" },
        {
          accessLevel: "MANAGER",
          membershipId: "membership-lan",
          orgUnitId: "branch-hcm",
          status: "ACTIVE",
        },
        { signal: expect.any(AbortSignal) },
      ),
    );
  });

  it("workspace read-only giữ danh sách nhưng khóa mutation", async () => {
    mocks.readOnly = true;
    renderPage();

    expect(await screen.findByText("Workspace chỉ đọc")).toBeTruthy();
    expect(await screen.findByText("Cô Lan")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Cấp quyền" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Chỉnh sửa" })).toBeNull();
  });

  it("hiển thị empty state khi chưa có phân quyền", async () => {
    mocks.assignments = [];
    renderPage();

    expect(
      await screen.findByText("Chưa có phân quyền phù hợp bộ lọc"),
    ).toBeTruthy();
  });
});
