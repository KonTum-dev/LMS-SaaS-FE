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
import { FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  message: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
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

function renderPage(locale?: "vi" | "en") {
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
      {locale ? (
        <FeedbackLocaleProvider initialLocale={locale}>
          <UserImportPage />
        </FeedbackLocaleProvider>
      ) : (
        <UserImportPage />
      )}
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
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
    mocks.message.info.mockReset();
    mocks.message.success.mockReset();
    mocks.message.warning.mockReset();
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
    expect(mocks.message.success).toHaveBeenCalledWith("Đã tạo 1 lời mời");
  });

  it("renders CSV validation in English without translating source names or role tokens", async () => {
    renderPage("en");
    const source =
      "email,fullName,role\ninvalid,A,UNKNOWN\nan@example.com,Nguyễn Văn An,LEARNER\nan@example.com,Trần Mai,GUARDIAN";
    fireEvent.change(screen.getByLabelText("CSV content"), {
      target: { value: source },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate data" }));
    expect(
      await screen.findByText(
        /Invalid email; The full name must have 2 to 160 characters; Invalid role/,
      ),
    ).toBeTruthy();
    expect(screen.getByText("Duplicate email in the file")).toBeTruthy();
    expect(screen.getByText("Nguyễn Văn An")).toBeTruthy();
    expect(
      (screen.getByLabelText("CSV content") as HTMLTextAreaElement).value,
    ).toBe(source);
    expect(
      mocks.apiFetch.mock.calls.filter(
        ([path]) => path === "/users/invitations",
      ),
    ).toHaveLength(0);
  });

  it("shows a safe English per-row error when an invitation response contains raw debug text", async () => {
    mocks.apiFetch.mockImplementation((path: string) =>
      path.startsWith("/org-units/")
        ? Promise.resolve({ items: [], total: 0 })
        : Promise.reject(
            new Error("password=server-secret; at createInvitation(api.ts:1)"),
          ),
    );
    renderPage("en");
    fireEvent.change(screen.getByLabelText("CSV content"), {
      target: {
        value: "email,fullName,role\nan@example.com,Nguyễn Văn An,LEARNER",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate data" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Create 1 invitations" }),
    );
    expect(
      await screen.findByText("Could not create the invitation"),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain("server-secret");
    expect(document.body.textContent).not.toContain("api.ts");
    const request = mocks.apiFetch.mock.calls.find(
      ([path]) => path === "/users/invitations",
    );
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      displayName: "Nguyễn Văn An",
      email: "an@example.com",
      role: "LEARNER",
    });
  });

  it.each([false, true])(
    "báo đúng mức độ khi batch có lỗi, thành công một phần=%s",
    async (partial) => {
      mocks.apiFetch.mockImplementation(
        (path: string, options?: RequestInit) => {
          if (path.startsWith("/org-units/"))
            return Promise.resolve({ items: [], total: 0 });
          const email = JSON.parse(String(options?.body)).email;
          return partial && email === "an@example.com"
            ? Promise.resolve({
                acceptPath: "/invite/secret-a",
                invitation: { _id: "invite-a" },
                token: "secret-a",
              })
            : Promise.reject(new Error("Lời mời chưa tạo được"));
        },
      );
      renderPage();
      fireEvent.change(screen.getByLabelText("Nội dung CSV"), {
        target: {
          value:
            "email,fullName,role\nan@example.com,Nguyễn Văn An,LEARNER\nmai@example.com,Nguyễn Thị Mai,LEARNER",
        },
      });
      fireEvent.click(screen.getByRole("button", { name: "Kiểm tra dữ liệu" }));
      fireEvent.click(screen.getByRole("button", { name: "Tạo 2 lời mời" }));
      await screen.findByText("3. Kết quả nhập");
      expect(mocks.message.success).not.toHaveBeenCalled();
      if (partial) {
        expect(mocks.message.warning).toHaveBeenCalledWith(
          "Đã tạo 1 lời mời; 1 lời mời chưa tạo được. Hãy xem chi tiết từng dòng trước khi thử lại.",
        );
        expect(mocks.message.error).not.toHaveBeenCalled();
      } else {
        expect(mocks.message.error).toHaveBeenCalledWith(
          "Không tạo được 2 lời mời. Hãy xem chi tiết từng dòng trước khi thử lại.",
        );
        fireEvent.click(
          screen.getByRole("button", { name: "Sao chép liên kết thành công" }),
        );
        expect(mocks.message.info).toHaveBeenCalledWith(
          "Chưa có liên kết lời mời thành công để sao chép",
        );
      }
    },
  );

  it("giữ nội dung khi không đọc được tệp CSV và hiển thị hướng dẫn", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Nội dung CSV"), {
      target: { value: "Giữ nội dung này" },
    });
    const file = new File(["sample"], "users.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
      value: vi.fn().mockRejectedValue(new Error("Not readable")),
    });
    fireEvent.change(screen.getByLabelText("Chọn tệp CSV"), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(mocks.message.error).toHaveBeenCalledWith(
        "Không thể đọc tệp CSV. Hãy chọn lại tệp hoặc dán nội dung trực tiếp.",
      ),
    );
    expect(
      (screen.getByLabelText("Nội dung CSV") as HTMLTextAreaElement).value,
    ).toBe("Giữ nội dung này");
  });

  it("hiển thị loading và tránh sao chép lặp khi clipboard đang xử lý", async () => {
    let completeCopy!: () => void;
    const writeText = vi.fn(() => new Promise<void>((resolve) => { completeCopy = resolve; }));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderPage();
    fireEvent.change(screen.getByLabelText("Nội dung CSV"), {
      target: { value: "email,fullName,role\nan@example.com,Nguyễn Văn An,LEARNER" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra dữ liệu" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo 1 lời mời" }));
    const copyButton = await screen.findByRole("button", { name: "Sao chép liên kết thành công" });
    fireEvent.click(copyButton);
    expect(copyButton.className).toContain("ant-btn-loading");
    fireEvent.click(copyButton);
    expect(writeText).toHaveBeenCalledTimes(1);
    await act(async () => completeCopy());
    expect(copyButton.className).not.toContain("ant-btn-loading");
    expect(mocks.message.success).toHaveBeenCalledWith("Đã sao chép danh sách liên kết mời");
  });

  it("hướng dẫn tải CSV khi trình duyệt từ chối sao chép", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Not allowed"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderPage();
    fireEvent.change(screen.getByLabelText("Nội dung CSV"), {
      target: {
        value: "email,fullName,role\nan@example.com,Nguyễn Văn An,LEARNER",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra dữ liệu" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo 1 lời mời" }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Sao chép liên kết thành công",
      }),
    );
    await waitFor(() =>
      expect(mocks.message.error).toHaveBeenCalledWith(
        "Trình duyệt không cho phép sao chép. Hãy tải CSV kết quả để lưu liên kết mời.",
      ),
    );
    expect(mocks.message.success).not.toHaveBeenCalledWith(
      "Đã sao chép danh sách liên kết mời",
    );
    expect(
      screen.getByRole("button", { name: "Tải CSV kết quả" }),
    ).toBeTruthy();
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

  it("separates the role column name from the CSV help text", () => {
    renderPage();
    const roleCode = [...document.querySelectorAll("code")].find((element) => element.textContent === "role");
    expect(roleCode?.parentElement?.textContent).toContain("role có thể bỏ trống");
  });

  it("fails closed for non-admin roles", () => {
    mocks.role = "INSTRUCTOR";
    renderPage();
    expect(screen.getByRole("alert").textContent).toContain(
      "Chỉ quản trị tổ chức",
    );
  });
});
