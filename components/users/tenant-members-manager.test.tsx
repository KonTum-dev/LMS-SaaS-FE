// @vitest-environment jsdom

import { App as AntdApp } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Organization, TenantMember } from "@/lib/types";
import { TenantMembersManager } from "./tenant-members-manager";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
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
  DataTable: ({ ariaLabel, data }: { ariaLabel: string; data: TenantMember[] }) => (
    <section aria-label={ariaLabel}>
      {data.map((member) => <span key={member._id}>{member.fullName}</span>)}
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
    }) => open ? (
      <section aria-label={typeof title === "string" ? title : undefined} role="dialog">
        {children}
        {onOk && <button onClick={onOk} type="button">{okText}</button>}
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
  mocks.message.error.mockReset();
  mocks.message.success.mockReset();
  vi.spyOn(AntdApp, "useApp").mockReturnValue({
    message: mocks.message,
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
  it("tải đúng danh sách tenant-scoped cho super admin", async () => {
    renderManager();

    expect(await screen.findByText("Bright Owner")).toBeTruthy();
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/users/tenants/tenant-1",
      { token: "platform-token" },
    );
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
      target: { value: "Student@123" },
    });
    const createButtons = screen.getAllByRole("button", {
      name: /Thêm thành viên/,
    });
    fireEvent.click(createButtons.at(-1)!);

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/users/tenants/tenant-1",
      {
        body: JSON.stringify({
          email: "learner@bright.test",
          fullName: "Học viên mới",
          password: "Student@123",
          role: "LEARNER",
        }),
        method: "POST",
        token: "platform-token",
      },
    ));
    expect(mocks.message.success).toHaveBeenCalledWith("Đã thêm thành viên");
  });
});
