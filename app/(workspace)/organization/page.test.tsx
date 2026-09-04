// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Key, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrgUnitTreeNode } from "@/lib/org-units-api";
import type { UserRole } from "@/lib/types";
import OrganizationPage from "./page";

const mocks = vi.hoisted(() => ({
  archive: vi.fn(),
  create: vi.fn(),
  formApi: {
    resetFields: vi.fn(),
    setFieldsValue: vi.fn(),
    validateFields: vi.fn(),
  },
  formValues: {} as Record<string, unknown>,
  message: {
    error: vi.fn(),
    success: vi.fn(),
  },
  role: "TENANT_ADMIN" as UserRole,
  scopeMode: undefined as "GLOBAL" | "SCOPED" | undefined,
  tree: vi.fn(),
  treeResponse: { items: [], total: 0 } as {
    items: OrgUnitTreeNode[];
    total: number;
  },
  update: vi.fn(),
}));

vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
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
      email: "viewer@bright.test",
      fullName: "Bright Viewer",
      membershipId: "membership-1",
      orgUnitScopeMode: mocks.scopeMode,
      role: mocks.role,
      sub: "viewer-1",
      tenantId: "tenant-1",
    },
  }),
}));

vi.mock("@/lib/org-units-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/org-units-api")>();
  return {
    ...actual,
    orgUnitsApi: {
      archive: mocks.archive,
      create: mocks.create,
      get: vi.fn(),
      list: vi.fn(),
      tree: mocks.tree,
      update: mocks.update,
    },
  };
});

vi.mock("@ant-design/icons", () => ({
  ApartmentOutlined: () => null,
  EditOutlined: () => null,
  PlusOutlined: () => null,
}));

vi.mock("antd", async () => {
  const { lightweightAntd } = await import("@/test-utils/lightweight-antd");
  const TestApp = ({ children }: { children?: ReactNode }) => <>{children}</>;
  TestApp.useApp = () => ({ message: mocks.message });

  const TestForm = ({ children }: { children?: ReactNode }) => (
    <form>{children}</form>
  );
  const Form = Object.assign(TestForm, {
    Item: lightweightAntd.Form.Item,
    useForm: () => [mocks.formApi],
  });

  interface TestTreeNode {
    children?: TestTreeNode[];
    key: Key;
    title?: ReactNode;
  }
  const renderNodes = (
    nodes: TestTreeNode[],
    onSelect?: (keys: Key[]) => void,
  ): ReactNode => (
    <ul>
      {nodes.map((node) => (
        <li key={node.key}>
          <button onClick={() => onSelect?.([node.key])} type="button">
            {node.title}
          </button>
          {node.children?.length ? renderNodes(node.children, onSelect) : null}
        </li>
      ))}
    </ul>
  );

  return {
    ...lightweightAntd,
    App: TestApp,
    Form,
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
    Tree: ({
      onSelect,
      treeData = [],
    }: {
      onSelect?: (keys: Key[]) => void;
      treeData?: TestTreeNode[];
    }) => <nav aria-label="Cây cơ cấu">{renderNodes(treeData, onSelect)}</nav>,
  };
});

const actorId = "64b000000000000000000001";

function node(
  values: Partial<OrgUnitTreeNode> &
    Pick<OrgUnitTreeNode, "_id" | "code" | "name" | "type">,
): OrgUnitTreeNode {
  return {
    _id: values._id,
    ancestorIds: values.ancestorIds ?? [],
    archivedAt: values.archivedAt ?? null,
    archivedBy: values.archivedBy ?? null,
    children: values.children ?? [],
    code: values.code,
    createdBy: actorId,
    depth: values.depth ?? 0,
    name: values.name,
    parentId: values.parentId ?? null,
    path: values.path ?? [values.code],
    policyOverrides: values.policyOverrides ?? {},
    revision: values.revision ?? 1,
    status: values.status ?? "ACTIVE",
    tenantId: "tenant-1",
    timezone: values.timezone ?? "Asia/Ho_Chi_Minh",
    type: values.type,
    updatedBy: actorId,
  };
}

const sales = node({
  _id: "department-sales",
  ancestorIds: ["root-1", "branch-a"],
  code: "sales",
  depth: 2,
  name: "Kinh doanh",
  parentId: "branch-a",
  path: ["bright", "hcm", "sales"],
  policyOverrides: { attendance: { graceMinutes: 10 } },
  revision: 5,
  type: "DEPARTMENT",
});
const branchA = node({
  _id: "branch-a",
  ancestorIds: ["root-1"],
  children: [sales],
  code: "hcm",
  depth: 1,
  name: "Chi nhánh HCM",
  parentId: "root-1",
  path: ["bright", "hcm"],
  revision: 3,
  type: "BRANCH",
});
const branchB = node({
  _id: "branch-b",
  ancestorIds: ["root-1"],
  code: "hn",
  depth: 1,
  name: "Chi nhánh Hà Nội",
  parentId: "root-1",
  path: ["bright", "hn"],
  revision: 2,
  type: "BRANCH",
});
const root = node({
  _id: "root-1",
  children: [branchA, branchB],
  code: "bright",
  name: "Bright Academy",
  path: ["bright"],
  revision: 4,
  type: "ROOT",
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <OrganizationPage />
    </QueryClientProvider>,
  );
}

describe("OrganizationPage", () => {
  beforeEach(() => {
    mocks.archive.mockReset();
    mocks.create.mockReset();
    mocks.update.mockReset();
    mocks.tree.mockReset();
    mocks.message.error.mockReset();
    mocks.message.success.mockReset();
    mocks.formApi.resetFields.mockReset();
    mocks.formApi.setFieldsValue.mockReset();
    mocks.formApi.validateFields.mockReset();
    mocks.role = "TENANT_ADMIN";
    mocks.scopeMode = undefined;
    mocks.treeResponse = { items: [root], total: 4 };
    mocks.formValues = {};
    mocks.tree.mockImplementation(() => Promise.resolve(mocks.treeResponse));
    mocks.formApi.setFieldsValue.mockImplementation((values) => {
      mocks.formValues = { ...mocks.formValues, ...values };
    });
    mocks.formApi.validateFields.mockImplementation(() =>
      Promise.resolve(mocks.formValues),
    );
    mocks.create.mockImplementation((_context, input) =>
      Promise.resolve({
        ...root,
        _id: "created-unit",
        ...input,
        archivedAt: null,
        archivedBy: null,
        parentId: input.parentId ?? null,
        revision: 1,
        status: "ACTIVE",
      }),
    );
    mocks.update.mockImplementation((_context, _id, input) =>
      Promise.resolve({ ...sales, ...input, revision: sales.revision + 1 }),
    );
    mocks.archive.mockResolvedValue({ ...sales, status: "ARCHIVED" });
  });

  afterEach(cleanup);

  it.each<UserRole>(["INSTRUCTOR"])(
    "cho %s đọc cây nhưng không hiện thao tác quản trị",
    async (role) => {
      mocks.role = role;
      renderPage();

      expect(await screen.findByText("Chế độ xem")).toBeTruthy();
      expect(
        await screen.findByRole("button", { name: /Bright Academy/ }),
      ).toBeTruthy();
      expect(mocks.tree).toHaveBeenCalledWith(
        { token: "tenant-token" },
        false,
        { signal: expect.any(AbortSignal) },
      );
      expect(screen.queryByRole("button", { name: "Thêm đơn vị" })).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Chỉnh sửa / di chuyển" }),
      ).toBeNull();
    },
  );

  it.each<UserRole>(["LEARNER", "GUARDIAN"])(
    "không gọi org-unit API cho vai trò %s",
    async (role) => {
      mocks.role = role;
      renderPage();

      expect(
        await screen.findByText(
          "Không tìm thấy workspace để tải cơ cấu tổ chức.",
        ),
      ).toBeTruthy();
      expect(mocks.tree).not.toHaveBeenCalled();
    },
  );

  it("cho quản lý đơn vị xem cây nhưng không tự thay đổi cơ cấu", async () => {
    mocks.scopeMode = "SCOPED";
    renderPage();

    expect(await screen.findByText("Cơ cấu ở chế độ chỉ xem")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Thêm đơn vị" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Chỉnh sửa / di chuyển" }),
    ).toBeNull();
  });

  it("tạo ROOT đầu tiên từ empty state", async () => {
    mocks.treeResponse = { items: [], total: 0 };
    mocks.formValues = {
      code: "BRIGHT",
      name: " Bright Academy ",
      policyOverridesText: "{}",
      timezone: "Asia/Ho_Chi_Minh",
      type: "ROOT",
    };
    renderPage();

    expect(await screen.findByText("Chưa có cơ cấu tổ chức")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tạo ROOT" }));
    expect(screen.getByRole("dialog", { name: "Tạo ROOT" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tạo đơn vị" }));

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        { token: "tenant-token" },
        expect.objectContaining({
          code: "BRIGHT",
          name: " Bright Academy ",
          policyOverrides: {},
          timezone: "Asia/Ho_Chi_Minh",
          type: "ROOT",
        }),
      ),
    );
  });

  it("cập nhật và di chuyển phòng ban bằng revision đang hiển thị", async () => {
    renderPage();
    await screen.findByRole("navigation", { name: "Cây cơ cấu" });
    fireEvent.click(screen.getByRole("button", { name: /Kinh doanh/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Chỉnh sửa / di chuyển" }),
    );
    mocks.formValues = {
      ...mocks.formValues,
      code: "sales",
      name: "Kinh doanh miền Bắc",
      parentId: "branch-b",
      policyOverridesText: '{"attendance":{"graceMinutes":15}}',
      timezone: "Asia/Ho_Chi_Minh",
      type: "DEPARTMENT",
    };
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        { token: "tenant-token" },
        "department-sales",
        expect.objectContaining({
          expectedRevision: 5,
          name: "Kinh doanh miền Bắc",
          parentId: "branch-b",
          policyOverrides: { attendance: { graceMinutes: 15 } },
          type: "DEPARTMENT",
        }),
      ),
    );
  });

  it("archive leaf bằng expected revision nhưng chặn đơn vị còn con hoạt động", async () => {
    renderPage();
    await screen.findByRole("navigation", { name: "Cây cơ cấu" });

    fireEvent.click(screen.getByRole("button", { name: /Chi nhánh HCM/ }));
    expect(
      screen.getByText("Hãy di chuyển hoặc lưu trữ các đơn vị con trước."),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Lưu trữ" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Kinh doanh/ }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận lưu trữ" }));
    await waitFor(() =>
      expect(mocks.archive).toHaveBeenCalledWith(
        { token: "tenant-token" },
        "department-sales",
        5,
      ),
    );
  });

  it("đổi sang cây có đơn vị đã lưu trữ bằng query-key riêng", async () => {
    renderPage();
    await screen.findByRole("navigation", { name: "Cây cơ cấu" });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Hiển thị đơn vị đã lưu trữ",
      }),
    );

    await waitFor(() =>
      expect(mocks.tree).toHaveBeenCalledWith({ token: "tenant-token" }, true, {
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
