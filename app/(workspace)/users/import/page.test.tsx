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
import type { UserRole } from "@/lib/types";
import type { OrgUnitTreeNode } from "@/lib/org-units-api";
import UserImportPage from "./page";

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
      graceEndsAt: null,
      limits: { maxCourses: 25, maxUsers: 250 },
      modules: ["USERS"],
      readOnly: mocks.readOnly,
      state: mocks.readOnly ? "READ_ONLY" : "ACTIVE",
    },
    organization: {
      _id: "tenant-1",
      enabledModules: ["USERS"],
      logoUrl: null,
      name: "Bright Academy",
      primaryColor: "#176BFF",
      slug: "bright-academy",
      status: "ACTIVE",
    },
    token: "tenant-token",
    user: {
      email: "owner@example.test",
      fullName: "Owner",
      membershipId: "membership-1",
      orgUnitScopeMode: mocks.scopeMode,
      role: mocks.role,
      sub: "owner-1",
      tenantId: "tenant-1",
    },
  }),
}));

const branch: OrgUnitTreeNode = {
  _id: "branch-1",
  ancestorIds: [],
  archivedAt: null,
  archivedBy: null,
  children: [],
  code: "q1",
  createdBy: "owner-1",
  depth: 0,
  name: "Cơ sở Quận 1",
  parentId: null,
  path: [],
  policyOverrides: {},
  revision: 1,
  status: "ACTIVE",
  tenantId: "tenant-1",
  timezone: "Asia/Ho_Chi_Minh",
  type: "BRANCH",
  updatedBy: "owner-1",
};
vi.mock("@ant-design/icons", () => ({
  ArrowLeftOutlined: () => null,
  CopyOutlined: () => null,
  DownloadOutlined: () => null,
}));

function renderPage() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
          },
        })
      }
    >
      <UserImportPage />
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
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

describe("UserImportPage", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockImplementation((path: string) =>
      path === "/org-units/tree?includeArchived=false"
        ? Promise.resolve({
            items: mocks.orgUnits,
            total: mocks.orgUnits.length,
          })
        : Promise.resolve({
            acceptPath: "/invite/secret-a",
            invitation: { _id: "invite-a" },
            token: "secret-a",
          }),
    );
    mocks.message.error.mockReset();
    mocks.message.success.mockReset();
    mocks.readOnly = false;
    mocks.role = "TENANT_ADMIN";
    mocks.scopeMode = "GLOBAL";
    mocks.orgUnits = [];
    vi.spyOn(AntdApp, "useApp").mockReturnValue({
      message: mocks.message,
    } as never);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("previews valid CSV before creating invitations", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Nội dung CSV"), {
      target: {
        value: "email,fullName,role\nan@example.com,Nguyễn Văn An,LEARNER",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra dữ liệu" }));

    expect(await screen.findByText("Nguyễn Văn An")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tạo 1 lời mời" }));
    await waitFor(() =>
      expect(
        mocks.apiFetch.mock.calls.filter(
          ([path, options]) =>
            path === "/users/invitations" && options?.method === "POST",
        ),
      ).toHaveLength(1),
    );
    expect(await screen.findByText("Đã tạo")).toBeTruthy();
  });

  it("áp dụng một cơ sở chung cho toàn bộ batch invitation", async () => {
    mocks.orgUnits = [branch];
    renderPage();
    const orgUnitSelect = await screen.findByRole("combobox", {
      name: "Cơ sở áp dụng cho cả lô",
    });
    fireEvent.mouseDown(orgUnitSelect);
    fireEvent.click(await screen.findByText("Cơ sở Quận 1 · Chi nhánh"));
    fireEvent.change(screen.getByLabelText("Nội dung CSV"), {
      target: {
        value: "email,fullName,role\nan@example.com,Nguyễn Văn An,LEARNER",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra dữ liệu" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Tạo 1 lời mời" }),
    );

    await waitFor(() => {
      const invitationCall = mocks.apiFetch.mock.calls.find(
        ([path, options]) =>
          path === "/users/invitations" && options?.method === "POST",
      );
      expect(invitationCall).toBeTruthy();
      expect(JSON.parse(String(invitationCall?.[1]?.body))).toMatchObject({
        orgUnitId: "branch-1",
      });
    });
  });

  it("khóa import scoped khi chưa chọn một trong nhiều cơ sở được giao", async () => {
    mocks.scopeMode = "SCOPED";
    mocks.orgUnits = [
      branch,
      { ...branch, _id: "branch-2", code: "q3", name: "Cơ sở Quận 3" },
    ];
    renderPage();
    await screen.findByRole("combobox", { name: "Cơ sở áp dụng cho cả lô" });
    fireEvent.change(screen.getByLabelText("Nội dung CSV"), {
      target: {
        value: "email,fullName,role\nan@example.com,Nguyễn Văn An,LEARNER",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra dữ liệu" }));

    expect(
      (await screen.findByRole("button", {
        name: "Tạo 1 lời mời",
      })) as HTMLButtonElement,
    ).toHaveProperty("disabled", true);
  });

  it("locks import in read-only mode", () => {
    mocks.readOnly = true;
    renderPage();
    expect(screen.getByText(/Workspace chỉ đọc/)).toBeTruthy();
  });

  it("fails closed for non-admin roles", () => {
    mocks.role = "INSTRUCTOR";
    renderPage();
    expect(screen.getByRole("alert").textContent).toContain(
      "Chỉ quản trị tổ chức",
    );
  });
});
