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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Organization, TenantMember } from "@/lib/types";
import { TenantMembersManager } from "./tenant-members-manager";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  confirm: vi.fn(),
  message: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    organization: null,
    token: "platform-token",
    user: {
      email: "admin@dx.test",
      fullName: "Platform Admin",
      role: "SUPER_ADMIN",
      sub: "platform-admin",
    },
  }),
}));
vi.mock("@/components/table/data-table", () => ({
  DataTable: ({
    ariaLabel,
    data,
    columns,
  }: {
    ariaLabel: string;
    data: TenantMember[];
    columns: Array<{
      id?: string;
      accessorKey?: keyof TenantMember;
      cell?: (context: {
        row: { original: TenantMember };
        getValue: () => unknown;
      }) => React.ReactNode;
    }>;
  }) => (
    <section aria-label={ariaLabel}>
      {data.map((member) => (
        <article key={member._id}>
          <span>{member.fullName}</span>
          {columns
            .filter(
              (column) =>
                column.id === "actions" ||
                column.accessorKey === "accountStatus",
            )
            .map((column) => (
              <div key={column.id ?? column.accessorKey}>
                {column.cell?.({
                  row: { original: member },
                  getValue: () =>
                    column.accessorKey ? member[column.accessorKey] : undefined,
                })}
              </div>
            ))}
        </article>
      ))}
    </section>
  ),
}));
vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return {
    ...actual,
    Modal: ({
      children,
      okText,
      onOk,
      open,
      title,
    }: {
      children?: React.ReactNode;
      okText?: React.ReactNode;
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
          {onOk && (
            <button onClick={onOk} type="button">
              {okText}
            </button>
          )}
        </section>
      ) : null,
  };
});

const tenant: Organization = {
  _id: "tenant-1",
  enabledModules: ["USERS", "COURSES"],
  logoUrl: null,
  name: "Bright Academy",
  primaryColor: "#176BFF",
  slug: "bright-academy",
  status: "ACTIVE",
};
const member: TenantMember = {
  _id: "membership-1",
  membershipId: "membership-1",
  userId: "user-1",
  tenantId: "tenant-1",
  email: "owner@bright.test",
  fullName: "Bright Owner",
  role: "TENANT_ADMIN",
  status: "ACTIVE",
  accountStatus: "ACTIVE",
  joinedAt: "2026-08-01T00:00:00.000Z",
};

function renderManager() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TenantMembersManager onClose={vi.fn()} tenant={tenant} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
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
  mocks.apiFetch.mockReset();
  mocks.confirm.mockReset();
  mocks.message.error.mockReset();
  mocks.message.success.mockReset();
  vi.spyOn(AntdApp, "useApp").mockReturnValue({
    message: mocks.message,
    modal: { confirm: mocks.confirm },
  } as never);
  mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
    if (path === "/users/tenants/tenant-1" && options?.method === "POST") {
      return Promise.resolve(member);
    }
    return Promise.resolve([member]);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TenantMembersManager", () => {
  it("tải chi tiết theo membership ID, không dùng user ID", async () => {
    mocks.apiFetch.mockImplementation((path: string) =>
      Promise.resolve(
        path.endsWith("/membership-1")
          ? { ...member, accountStatus: "INACTIVE" }
          : [member],
      ),
    );
    renderManager();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Xem chi tiết thành viên Bright Owner",
      }),
    );
    expect(await screen.findByText("Bị vô hiệu hóa")).toBeTruthy();
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/users/tenants/tenant-1/membership-1",
      { token: "platform-token" },
    );
    expect(screen.getByText("Tài khoản toàn cục")).toBeTruthy();
  });

  it.each(["ACTIVE", "INACTIVE"] as const)(
    "xác nhận lifecycle thành viên %s không đổi tài khoản toàn cục",
    async (status) => {
      mocks.apiFetch.mockImplementation(
        (_path: string, options?: RequestInit) =>
          Promise.resolve(
            options?.method
              ? {
                  ...member,
                  status: status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                }
              : [{ ...member, status }],
          ),
      );
      renderManager();
      fireEvent.click(
        await screen.findByRole("button", {
          name: `${status === "ACTIVE" ? "Vô hiệu hóa" : "Khôi phục"} thành viên Bright Owner`,
        }),
      );
      expect(
        mocks.apiFetch.mock.calls.some(([, options]) => options?.method),
      ).toBe(false);
      const confirmation = mocks.confirm.mock.calls.at(-1)![0];
      expect(confirmation.content).toMatch(/toàn cục/);
      await act(async () => {
        await confirmation.onOk();
      });
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        `/users/tenants/tenant-1/membership-1${status === "ACTIVE" ? "" : "/restore"}`,
        {
          method: status === "ACTIVE" ? "DELETE" : "POST",
          token: "platform-token",
        },
      );
    },
  );

  it("lọc thành viên theo email", async () => {
    renderManager();
    await screen.findByText("Bright Owner");
    fireEvent.change(screen.getByLabelText("Tìm thành viên"), {
      target: { value: "different@test.com" },
    });
    expect(screen.queryByText("Bright Owner")).toBeNull();
  });

  it("giữ thành viên khi backend chặn vô hiệu hóa quản trị viên cuối cùng", async () => {
    mocks.apiFetch.mockImplementation((_path: string, options?: RequestInit) =>
      options?.method
        ? Promise.reject(
            new Error("Không thể vô hiệu hóa quản trị viên cuối cùng"),
          )
        : Promise.resolve([member]),
    );
    renderManager();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Vô hiệu hóa thành viên Bright Owner",
      }),
    );
    await act(async () => {
      await expect(mocks.confirm.mock.calls.at(-1)![0].onOk()).rejects.toThrow(
        "cuối cùng",
      );
    });
    expect(mocks.message.error).toHaveBeenCalledWith(
      "Không thể vô hiệu hóa quản trị viên cuối cùng",
    );
    expect(screen.getByText("Bright Owner")).toBeTruthy();
    expect(mocks.message.success).not.toHaveBeenCalled();
  });

  it("tải đúng danh sách tenant-scoped cho super admin", async () => {
    renderManager();

    expect(await screen.findByText("Bright Owner")).toBeTruthy();
    expect(mocks.apiFetch).toHaveBeenCalledWith("/users/tenants/tenant-1", {
      token: "platform-token",
    });
  });

  it("tạo học viên qua endpoint của tenant và không gửi field thừa", async () => {
    renderManager();
    await screen.findByText("Bright Owner");
    fireEvent.click(screen.getByRole("button", { name: /Thêm thành viên/ }));

    fireEvent.change(screen.getByLabelText("Họ và tên"), {
      target: { value: "  Học viên mới  " },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "LEARNER@BRIGHT.TEST" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu ban đầu"), {
      target: { value: "Student@1234" },
    });
    const createButtons = screen.getAllByRole("button", {
      name: /Thêm thành viên/,
    });
    fireEvent.click(createButtons.at(-1)!);

    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/users/tenants/tenant-1", {
        body: JSON.stringify({
          email: "learner@bright.test",
          fullName: "Học viên mới",
          password: "Student@1234",
          role: "LEARNER",
        }),
        method: "POST",
        token: "platform-token",
      }),
    );
    expect(mocks.message.success).toHaveBeenCalledWith("Đã thêm thành viên");
  });

  it("blocks same-tick repeated creation and keeps fields locked until the request settles", async () => {
    let resolve!: (value: TenantMember) => void;
    const pending = new Promise<TenantMember>((done) => { resolve = done; });
    mocks.apiFetch.mockImplementation((_path, options) => options?.method === "POST" ? pending : Promise.resolve([member]));
    renderManager();
    await screen.findByText("Bright Owner");
    fireEvent.click(screen.getByRole("button", { name: /Thêm thành viên/ }));
    fireEvent.change(screen.getByLabelText("Họ và tên"), { target: { value: "Parent Account" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "parent@example.com" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu ban đầu"), { target: { value: "Parent@12345" } });
    const save = screen.getAllByRole("button", { name: /Thêm thành viên/ }).at(-1)!;
    act(() => { fireEvent.click(save); fireEvent.click(save); });
    await waitFor(() => expect(mocks.apiFetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1));
    expect((screen.getByLabelText("Email") as HTMLInputElement).disabled).toBe(true);
    await act(async () => { resolve(member); });
    await waitFor(() => expect(screen.queryByLabelText("Mật khẩu ban đầu")).toBeNull());
  });

  it("giải thích lỗi trường bắt buộc thay vì báo lỗi máy chủ", async () => {
    renderManager();
    await screen.findByText("Bright Owner");
    fireEvent.click(screen.getByRole("button", { name: /Thêm thành viên/ }));
    fireEvent.click(
      screen.getAllByRole("button", { name: /Thêm thành viên/ }).at(-1)!,
    );
    await waitFor(() =>
      expect(mocks.message.error).toHaveBeenCalledWith(
        "Vui lòng kiểm tra các trường được đánh dấu trước khi lưu thành viên",
      ),
    );
    expect(
      mocks.apiFetch.mock.calls.some(
        ([, options]) => options?.method === "POST",
      ),
    ).toBe(false);
    expect(mocks.message.success).not.toHaveBeenCalled();
  });
});
