// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
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
  CurrentUser,
  EffectiveAccess,
  LmsModule,
  Organization,
  SubscriptionAccessState,
  UserRole,
} from "@/lib/types";
import { WorkspaceShell } from "./workspace-shell";
import { FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";

const mocks = vi.hoisted(() => ({
  childRender: vi.fn(),
  logout: vi.fn(),
  pathname: "/dashboard",
  push: vi.fn(),
  replace: vi.fn(),
  switchWorkspace: vi.fn(),
  session: {
    effectiveAccess: null as EffectiveAccess | null,
    loading: false,
    organization: null as Organization | null,
    token: "tenant-token",
    user: null as CurrentUser | null,
    workspaces: [] as Array<{
      membershipId: string;
      tenantId: string;
      name: string;
      slug: string;
      role: Exclude<UserRole, "SUPER_ADMIN">;
      orgUnitScopeMode?: "GLOBAL" | "SCOPED";
      logoUrl: null;
      primaryColor: string;
    }>,
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));

vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    ...mocks.session,
    logout: mocks.logout,
    switchWorkspace: mocks.switchWorkspace,
  }),
}));

vi.mock("@/components/notifications/notification-center", () => ({
  NotificationCenter: ({ scope }: { scope: { membershipId: string } }) => (
    <button
      aria-label={`Trung tâm thông báo ${scope.membershipId}`}
      type="button"
    />
  ),
}));

function currentUser(
  role: UserRole,
  orgUnitScopeMode?: "GLOBAL" | "SCOPED",
): CurrentUser {
  return {
    email: `${role.toLocaleLowerCase()}@example.test`,
    fullName: role === "SUPER_ADMIN" ? "Quản trị nền tảng" : "Nguyễn Minh An",
    role,
    sub: role,
    ...(role === "SUPER_ADMIN"
      ? {}
      : {
          membershipId: "membership-1",
          orgUnitScopeMode,
          tenantId: "tenant-1",
        }),
  };
}

function tenant(enabledModules: LmsModule[]): Organization {
  return {
    _id: "tenant-1",
    enabledModules,
    logoUrl: null,
    name: "Bright Academy",
    primaryColor: "#176BFF",
    slug: "bright-academy",
    status: "ACTIVE",
  };
}

function access(
  modules: LmsModule[],
  state: SubscriptionAccessState = "ACTIVE",
): EffectiveAccess {
  return {
    graceEndsAt: state === "GRACE" ? "2030-09-08T00:00:00.000Z" : null,
    limits: {
      maxActiveLearners: null,
      maxBranches: null,
      maxCourses: 100,
      maxUsers: 1000,
    },
    modules,
    readOnly: state === "READ_ONLY",
    state,
  };
}

function QueryPage() {
  mocks.childRender();
  return <div>Nội dung trang có truy vấn</div>;
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

beforeEach(() => {
  mocks.pathname = "/dashboard";
  mocks.session.loading = false;
  mocks.session.token = "tenant-token";
  mocks.session.effectiveAccess = access(["USERS", "COURSES", "ASSIGNMENTS"]);
  mocks.session.organization = tenant(["USERS", "COURSES", "ASSIGNMENTS"]);
  mocks.session.user = currentUser("TENANT_ADMIN");
  mocks.session.workspaces = [];
  mocks.childRender.mockClear();
  mocks.logout.mockClear();
  mocks.push.mockClear();
  mocks.replace.mockClear();
  mocks.switchWorkspace.mockReset();
  mocks.switchWorkspace.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("WorkspaceShell route access boundary", () => {
  it("shows tenant CRM to scoped admins and allows direct read-only navigation", () => {
    mocks.pathname = "/crm";
    mocks.session.user = currentUser("TENANT_ADMIN", "SCOPED");
    mocks.session.organization = tenant(["USERS"]);
    mocks.session.effectiveAccess = access(["USERS"], "READ_ONLY");
    render(<WorkspaceShell><QueryPage /></WorkspaceShell>);
    expect(screen.getByText("Nội dung trang có truy vấn")).toBeTruthy();
    const crm = screen.getByRole("menuitem", { name: /CRM \/ Khách hàng/ });
    fireEvent.click(crm);
    expect(mocks.push).toHaveBeenCalledWith("/crm");
    expect(screen.queryByRole("menuitem", { name: /CRM nền tảng/ })).toBeNull();
  });
  it("translates the tenant CRM sidebar label into English", () => {
    render(<FeedbackLocaleProvider initialLocale="en"><WorkspaceShell><QueryPage /></WorkspaceShell></FeedbackLocaleProvider>);
    expect(screen.getByRole("menuitem", { name: /CRM \/ Contacts/ })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /CRM \/ Khách hàng/ })).toBeNull();
  });
  it.each(["SUPER_ADMIN", "INSTRUCTOR", "LEARNER", "GUARDIAN"] as const)("hides tenant CRM and blocks its child queries for %s", (role) => {
    mocks.pathname = "/crm";
    mocks.session.user = currentUser(role);
    render(<WorkspaceShell><QueryPage /></WorkspaceShell>);
    expect(screen.queryByRole("menuitem", { name: /CRM \/ Khách hàng/ })).toBeNull();
    expect(mocks.childRender).not.toHaveBeenCalled();
  });
  it("removes CRM and unmounts its child page when USERS is revoked", () => {
    mocks.pathname = "/crm";
    const view = render(<WorkspaceShell><QueryPage /></WorkspaceShell>);
    expect(screen.getByRole("menuitem", { name: /CRM \/ Khách hàng/ })).toBeTruthy();
    mocks.childRender.mockClear();
    mocks.session.effectiveAccess = access([]);
    view.rerender(<WorkspaceShell><QueryPage /></WorkspaceShell>);
    expect(screen.queryByRole("menuitem", { name: /CRM \/ Khách hàng/ })).toBeNull();
    expect(screen.queryByText("Nội dung trang có truy vấn")).toBeNull();
    expect(mocks.childRender).not.toHaveBeenCalled();
  });
  it.each([
    ["/account/security", "/account/security"],
    ["/family", "/family"],
    ["https://evil.example/steal", "/dashboard"],
    ["//evil.example/steal", "/dashboard"],
    ["/%252f%252fevil.example", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
  ])("keeps only a safe internal return page when signed out: %s", async (pathname, destination) => {
    mocks.pathname = pathname;
    mocks.session.user = null;
    render(<WorkspaceShell><QueryPage /></WorkspaceShell>);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(`/login?next=${encodeURIComponent(destination)}`));
    expect(mocks.childRender).not.toHaveBeenCalled();
  });

  it("waits for session restoration before redirecting the protected security page", () => {
    mocks.pathname = "/account/security";
    mocks.session.user = null;
    mocks.session.loading = true;
    render(<WorkspaceShell><QueryPage /></WorkspaceShell>);
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.childRender).not.toHaveBeenCalled();
  });

  it("allows a signed-in guardian to return to account security without granting admin routes", () => {
    mocks.pathname = "/account/security";
    mocks.session.user = currentUser("GUARDIAN");
    const { rerender } = render(<WorkspaceShell><QueryPage /></WorkspaceShell>);
    expect(screen.getByText("Nội dung trang có truy vấn")).toBeTruthy();
    mocks.childRender.mockClear();
    mocks.pathname = "/admin/accounts";
    rerender(<WorkspaceShell><QueryPage /></WorkspaceShell>);
    expect(screen.queryByText("Nội dung trang có truy vấn")).toBeNull();
    expect(mocks.childRender).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("giữ nền biểu tượng workspace trung tính và không áp kiểu chữ lên mọi span trong avatar", () => {
    const css = readFileSync(resolve(process.cwd(), "app/lms-theme.css"), "utf8");
    const globals = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
    const avatar = css.match(/\.sider-tenant-avatar[^{}]*\{([^}]*)\}/)?.[1];
    expect(avatar).toBeDefined();
    expect(avatar).toContain("background: transparent");
    expect(avatar).toContain("color: var(--muted)");
    expect(avatar).toContain("border: 0");
    expect(avatar).not.toContain("var(--primary)");
    expect(`${globals}\n${css}`).not.toMatch(/\.sider-tenant\s+span\s*[,\{]/);
  });

  it("dùng biểu tượng nền tảng trung tính thay DX ở sidebar và menu di động", async () => {
    mocks.session.user = currentUser("SUPER_ADMIN");
    mocks.session.organization = null;
    mocks.session.effectiveAccess = null;
    const { container } = render(<WorkspaceShell><QueryPage /></WorkspaceShell>);

    const expectPlatformIdentity = (scope: HTMLElement) => {
      const identity = scope.querySelector<HTMLElement>('[data-workspace-identity="platform"]');
      expect(identity).not.toBeNull();
      expect(identity!.classList.contains("sider-tenant-avatar")).toBe(true);
      expect(identity!.getAttribute("aria-hidden")).toBe("true");
      expect(identity!.querySelector('[data-icon="appstore"]')).not.toBeNull();
      expect(identity!.textContent).toBe("");
      expect(identity!.style.background).toBe("");
      expect(identity!.style.width).toBe("34px");
      expect(identity!.style.height).toBe("34px");
      expect(within(scope).getByText("Toàn nền tảng")).toBeTruthy();
      expect(within(scope).queryByText("DX", { exact: true })).toBeNull();
    };

    const desktop = container.querySelector<HTMLElement>(".desktop-sider")!;
    expectPlatformIdentity(desktop);
    expect(within(desktop).queryByRole("button", { name: "Chọn không gian làm việc" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mở menu điều hướng" }));
    expectPlatformIdentity(await screen.findByRole("dialog"));
    expect(mocks.switchWorkspace).not.toHaveBeenCalled();
  });

  it("dùng biểu tượng tổ chức trang trí khi tenant chưa có logo và giữ tên workspace", () => {
    const { container } = render(<WorkspaceShell><QueryPage /></WorkspaceShell>);
    const identity = container.querySelector<HTMLElement>('[data-workspace-identity="organization"]');
    expect(identity).not.toBeNull();
    expect(identity!.classList.contains("sider-tenant-avatar")).toBe(true);
    expect(identity!.getAttribute("aria-hidden")).toBe("true");
    expect(identity!.querySelector('[data-icon="apartment"]')).not.toBeNull();
    expect(identity!.querySelector("img")).toBeNull();
    expect(identity!.textContent).toBe("");
    expect(identity!.style.background).toBe("");
    const copy = identity!.parentElement!.querySelector<HTMLElement>(".sider-tenant-copy")!;
    expect(within(copy).getByText("Bright Academy")).toBeTruthy();
    expect(within(copy).queryByText("Quản trị tổ chức")).toBeNull();
  });

  it.each([false, true])(
    "giữ logo tenant thật trong sidebar và menu di động (có chuyển workspace: %s)",
    async (switchable) => {
      const logoUrl = "https://assets.example.test/bright-academy-logo.png";
      mocks.session.organization = { ...tenant(["USERS", "COURSES", "ASSIGNMENTS"]), logoUrl };
      if (switchable) {
        mocks.session.workspaces = [
          { membershipId: "membership-1", tenantId: "tenant-1", name: "Bright Academy", slug: "bright", role: "TENANT_ADMIN", logoUrl: null, primaryColor: "#176BFF" },
          { membershipId: "membership-2", tenantId: "tenant-2", name: "Lumen School", slug: "lumen", role: "INSTRUCTOR", logoUrl: null, primaryColor: "#5B5BD6" },
        ];
      }
      const { container } = render(<WorkspaceShell><QueryPage /></WorkspaceShell>);

      const expectTenantLogo = (scope: HTMLElement) => {
        const identity = scope.querySelector<HTMLElement>('[data-workspace-identity="organization"]');
        const logo = identity?.querySelector("img");
        expect(logo?.getAttribute("src")).toBe(logoUrl);
        expect(identity!.getAttribute("aria-hidden")).toBe("true");
        expect(identity!.querySelector('[data-icon="apartment"]')).toBeNull();
        expect(identity!.textContent).toBe("");
        expect(identity!.style.background).toBe("");
        expect(within(scope).getByText("Bright Academy")).toBeTruthy();
        const switcher = within(scope).queryByRole("button", { name: "Chọn không gian làm việc" });
        if (switchable) {
          expect(switcher?.getAttribute("type")).toBe("button");
          expect((switcher as HTMLButtonElement).disabled).toBe(false);
        } else {
          expect(switcher).toBeNull();
        }
      };

      expectTenantLogo(container.querySelector<HTMLElement>(".desktop-sider")!);
      fireEvent.click(screen.getByRole("button", { name: "Mở menu điều hướng" }));
      expectTenantLogo(await screen.findByRole("dialog"));
      expect(mocks.switchWorkspace).not.toHaveBeenCalled();
    },
  );

  it("shows platform accounts only to SUPER_ADMIN and navigates to the account route", () => {
    mocks.pathname = "/admin/accounts";
    mocks.session.user = currentUser("SUPER_ADMIN");
    mocks.session.organization = null;
    mocks.session.effectiveAccess = null;
    const view = render(<WorkspaceShell><QueryPage /></WorkspaceShell>);
    fireEvent.click(screen.getByRole("menuitem", { name: /Tài khoản nền tảng/ }));
    expect(mocks.push).toHaveBeenCalledWith("/admin/accounts");
    mocks.session.user = currentUser("TENANT_ADMIN");
    mocks.session.organization = tenant(["USERS"]);
    mocks.session.effectiveAccess = access(["USERS"]);
    view.rerender(<WorkspaceShell><QueryPage /></WorkspaceShell>);
    expect(screen.queryByRole("menuitem", { name: /Tài khoản nền tảng/ })).toBeNull();
    expect(screen.queryByText("Nội dung trang có truy vấn")).toBeNull();
  });
  it.each<Exclude<UserRole, "SUPER_ADMIN">>([
    "TENANT_ADMIN",
    "INSTRUCTOR",
    "LEARNER",
    "GUARDIAN",
  ])(
    "hiện notification center cho %s dù module tắt và thuê bao READ_ONLY",
    (role) => {
      mocks.session.effectiveAccess = access([], "READ_ONLY");
      mocks.session.organization = tenant([]);
      mocks.session.user = currentUser(role);
      render(
        <WorkspaceShell>
          <QueryPage />
        </WorkspaceShell>,
      );

      expect(
        screen.getByRole("button", {
          name: "Trung tâm thông báo membership-1",
        }),
      ).toBeTruthy();
    },
  );

  it("không tạo tenant inbox cho SUPER_ADMIN không có workspace", () => {
    mocks.session.effectiveAccess = null;
    mocks.session.organization = null;
    mocks.session.user = currentUser("SUPER_ADMIN");
    render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    expect(
      screen.queryByRole("button", { name: /Trung tâm thông báo/ }),
    ).toBeNull();
  });

  it("hiện audit nền tảng cho SUPER_ADMIN và mount trực tiếp route không cần tenant", () => {
    mocks.pathname = "/admin/audit";
    mocks.session.effectiveAccess = null;
    mocks.session.organization = null;
    mocks.session.user = currentUser("SUPER_ADMIN");
    render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    expect(screen.getByText("Nội dung trang có truy vấn")).toBeTruthy();
    const audit = screen.getByRole("menuitem", { name: /Nhật ký audit/ });
    fireEvent.click(audit);
    expect(mocks.push).toHaveBeenCalledWith("/admin/audit");
  });

  it("hiện CRM nền tảng ở đầu khu vực quản trị và mở trực tiếp không cần tenant", () => {
    mocks.pathname = "/admin";
    mocks.session.effectiveAccess = null;
    mocks.session.organization = null;
    mocks.session.user = currentUser("SUPER_ADMIN");
    render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    expect(screen.getByText("Nội dung trang có truy vấn")).toBeTruthy();
    const crm = screen.getByRole("menuitem", { name: /CRM nền tảng/ });
    fireEvent.click(crm);
    expect(mocks.push).toHaveBeenCalledWith("/admin");
  });

  it("chỉ hiện vận hành notification events cho SUPER_ADMIN", () => {
    mocks.pathname = "/admin/notification-events";
    mocks.session.effectiveAccess = null;
    mocks.session.organization = null;
    mocks.session.user = currentUser("SUPER_ADMIN");
    const view = render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    expect(screen.getByText("Nội dung trang có truy vấn")).toBeTruthy();
    const events = screen.getByRole("menuitem", { name: /Sự kiện thông báo/ });
    fireEvent.click(events);
    expect(mocks.push).toHaveBeenCalledWith("/admin/notification-events");

    mocks.session.user = currentUser("TENANT_ADMIN");
    mocks.session.organization = tenant(["USERS"]);
    mocks.session.effectiveAccess = access(["USERS"]);
    view.rerender(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );
    expect(
      screen.queryByRole("menuitem", { name: /Sự kiện thông báo/ }),
    ).toBeNull();
    expect(screen.queryByText("Nội dung trang có truy vấn")).toBeNull();
  });

  it("hiện audit tenant cho TENANT_ADMIN trong READ_ONLY không module và không lộ cho vai trò khác", () => {
    mocks.pathname = "/audit";
    mocks.session.effectiveAccess = access([], "READ_ONLY");
    mocks.session.organization = tenant([]);
    mocks.session.user = currentUser("TENANT_ADMIN");
    const view = render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    expect(screen.getByText("Nội dung trang có truy vấn")).toBeTruthy();
    const audit = screen.getByRole("menuitem", { name: /Nhật ký audit/ });
    fireEvent.click(audit);
    expect(mocks.push).toHaveBeenCalledWith("/audit");

    mocks.session.user = currentUser("INSTRUCTOR");
    view.rerender(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );
    expect(
      screen.queryByRole("menuitem", { name: /Nhật ký audit/ }),
    ).toBeNull();
  });

  it("ẩn khu vực toàn tổ chức và nhận diện đúng quản lý đơn vị trong menu tài khoản", async () => {
    mocks.session.effectiveAccess = access([], "READ_ONLY");
    mocks.session.organization = tenant([]);
    mocks.session.user = currentUser("TENANT_ADMIN", "SCOPED");
    render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mở menu tài khoản" }));
    expect(await screen.findByRole("menuitem", { name: "Quản lý đơn vị" })).toBeTruthy();
    expect(
      screen.queryByRole("menuitem", { name: /Gói & thanh toán/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("menuitem", { name: /Nhật ký audit/ }),
    ).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /Tùy biến/ })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /^Bài tập$/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Gia hạn thuê bao" }),
    ).toBeNull();
  });

  it.each<UserRole>([
    "SUPER_ADMIN",
    "TENANT_ADMIN",
    "INSTRUCTOR",
    "LEARNER",
    "GUARDIAN",
  ])(
    "hiện lối vào hồ sơ, bảo mật và tích hợp cho %s, không gate theo thuê bao",
    async (role) => {
      mocks.pathname = "/account/security";
      mocks.session.effectiveAccess =
        role === "SUPER_ADMIN" ? null : access([], "READ_ONLY");
      mocks.session.organization = null;
      mocks.session.user = currentUser(role);
      render(
        <WorkspaceShell>
          <QueryPage />
        </WorkspaceShell>,
      );

      expect(screen.getByText("Nội dung trang có truy vấn")).toBeTruthy();
      fireEvent.click(
        screen.getByRole("button", { name: "Mở menu tài khoản" }),
      );
      fireEvent.click(await screen.findByText("Hồ sơ cá nhân"));
      expect(mocks.push).toHaveBeenCalledWith("/account/profile");
      fireEvent.click(
        screen.getByRole("button", { name: "Mở menu tài khoản" }),
      );
      fireEvent.click(await screen.findByText("Bảo mật tài khoản"));
      expect(mocks.push).toHaveBeenCalledWith("/account/security");
      fireEvent.click(
        screen.getByRole("button", { name: "Mở menu tài khoản" }),
      );
      fireEvent.click(await screen.findByText("Kết nối dữ liệu"));
      expect(mocks.push).toHaveBeenCalledWith("/account/integrations");
    },
  );

  it("mount trang dashboard cho mọi vai trò", () => {
    mocks.session.user = currentUser("LEARNER");
    render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    expect(screen.getByText("Nội dung trang có truy vấn")).toBeTruthy();
    expect(mocks.childRender).toHaveBeenCalledOnce();
  });

  it("hiện đúng lối vào theo scope vai trò phụ huynh", () => {
    const modules: LmsModule[] = [
      "USERS",
      "COURSES",
      "ENROLLMENTS",
      "COHORTS",
      "GUARDIANS",
      "TUITION",
      "ORGANIZATION_STRUCTURE",
      "REPORTS",
      "COMMUNICATIONS",
    ];
    mocks.session.effectiveAccess = access(modules);
    mocks.session.organization = tenant(modules);
    mocks.session.user = currentUser("GUARDIAN");
    render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    expect(
      screen.queryByRole("menuitem", { name: /Cơ cấu trung tâm/ }),
    ).toBeNull();
    expect(
      screen.getByRole("menuitem", { name: /Học viên của tôi/ }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: /Học viên của tôi/ }));
    expect(mocks.push).toHaveBeenCalledWith("/family");
    expect(screen.getByRole("menuitem", { name: /Học phí/ })).toBeTruthy();
    expect(
      screen.getByRole("menuitem", { name: /Thông báo trung tâm/ }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("menuitem", { name: /Phân quyền chi nhánh/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("menuitem", { name: /Lớp & điểm danh/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("menuitem", { name: /Báo cáo vận hành/ }),
    ).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /Khóa học/ })).toBeNull();
  });

  it.each<UserRole>(["TENANT_ADMIN", "INSTRUCTOR"])(
    "hiện phân quyền chi nhánh và thông báo phù hợp cho %s",
    (role) => {
      const modules: LmsModule[] = [
        "USERS",
        "ORGANIZATION_STRUCTURE",
        "COMMUNICATIONS",
      ];
      mocks.session.effectiveAccess = access(modules);
      mocks.session.organization = tenant(modules);
      mocks.session.user = currentUser(role);
      render(
        <WorkspaceShell>
          <QueryPage />
        </WorkspaceShell>,
      );

      expect(
        screen.getByRole("menuitem", { name: /Phân quyền chi nhánh/ }),
      ).toBeTruthy();
      expect(
        screen.getByRole("menuitem", { name: /Thông báo trung tâm/ }),
      ).toBeTruthy();
    },
  );

  it("không mount trang query khi truy cập trực tiếp module đang tắt", () => {
    mocks.pathname = "/courses/course-1";
    mocks.session.effectiveAccess = access(["USERS", "ASSIGNMENTS"]);
    mocks.session.organization = tenant(["USERS", "ASSIGNMENTS"]);
    render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    expect(screen.getByText("Không thể mở trang này")).toBeTruthy();
    expect(
      screen.getByText(
        "Tính năng Khóa học không nằm trong quyền truy cập hiệu lực của tổ chức.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Nội dung trang có truy vấn")).toBeNull();
    expect(mocks.childRender).not.toHaveBeenCalled();
    expect(screen.queryByRole("menuitem", { name: /Khóa học/ })).toBeNull();
  });

  it("không mount tenant page khi quản trị nền tảng mở URL trực tiếp", () => {
    mocks.pathname = "/settings";
    mocks.session.effectiveAccess = null;
    mocks.session.organization = null;
    mocks.session.user = currentUser("SUPER_ADMIN");
    render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    expect(
      screen.getByText("Vai trò của bạn không được phép truy cập khu vực này."),
    ).toBeTruthy();
    expect(screen.queryByText("Nội dung trang có truy vấn")).toBeNull();
    expect(mocks.childRender).not.toHaveBeenCalled();
    expect(screen.getByRole("menuitem", { name: /Tổ chức/ })).toBeTruthy();
  });

  it("không mount trang quản trị tenant cho học viên", () => {
    mocks.pathname = "/users";
    mocks.session.user = currentUser("LEARNER");
    render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    expect(
      screen.getByText("Vai trò của bạn không được phép truy cập khu vực này."),
    ).toBeTruthy();
    expect(mocks.childRender).not.toHaveBeenCalled();
  });

  it("READ_ONLY vẫn mount nội dung đọc và hiện banner không có CTA billing cho giảng viên", () => {
    mocks.pathname = "/courses/course-1";
    mocks.session.effectiveAccess = access(["COURSES"], "READ_ONLY");
    mocks.session.user = currentUser("INSTRUCTOR");
    render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    expect(screen.getByText("Nội dung trang có truy vấn")).toBeTruthy();
    expect(screen.getByText("Chỉ đọc")).toBeTruthy();
    expect(
      screen.getByText(/các thao tác tạo, sửa và xóa đã tạm khóa/),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Gia hạn thuê bao" }),
    ).toBeNull();
  });

  it("GRACE giữ module và cho tenant admin mở billing từ banner", () => {
    mocks.session.effectiveAccess = access(
      ["USERS", "COURSES", "ASSIGNMENTS"],
      "GRACE",
    );
    render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    expect(screen.getByText("Thời gian gia hạn")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Gia hạn thuê bao" }),
    ).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Khóa học/ })).toBeTruthy();
  });

  it("hiện banner free trial và CTA nâng cấp cho tenant admin", () => {
    mocks.session.effectiveAccess = {
      ...access(["USERS", "COURSES", "ASSIGNMENTS"]),
      trial: true,
      trialEndsAt: "2030-08-24T00:00:00.000Z",
    };
    render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    expect(screen.getByText(/Dùng thử đến .*2030/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Xem gói trả phí" }),
    ).toBeTruthy();
    expect(screen.getByText(/đến .*2030/)).toBeTruthy();
    expect(
      screen.queryByText(/quyền truy cập hiện được cấp cho workspace/),
    ).toBeNull();
    expect(screen.queryByText(/đầy đủ quyền/i)).toBeNull();
  });

  it.each<UserRole>(["TENANT_ADMIN", "INSTRUCTOR"])(
    "hiện Chấm bài cho %s khi module bật",
    (role) => {
      mocks.session.effectiveAccess = access([
        "COURSES",
        "ENROLLMENTS",
        "ASSIGNMENTS",
      ]);
      mocks.session.organization = tenant([
        "COURSES",
        "ENROLLMENTS",
        "ASSIGNMENTS",
      ]);
      mocks.session.user = currentUser(role);
      render(
        <WorkspaceShell>
          <QueryPage />
        </WorkspaceShell>,
      );

      expect(screen.getByRole("menuitem", { name: /Chấm bài/ })).toBeTruthy();
    },
  );

  it("không hiện Chấm bài cho học viên", () => {
    mocks.session.effectiveAccess = access([
      "COURSES",
      "ENROLLMENTS",
      "ASSIGNMENTS",
    ]);
    mocks.session.organization = tenant([
      "COURSES",
      "ENROLLMENTS",
      "ASSIGNMENTS",
    ]);
    mocks.session.user = currentUser("LEARNER");
    render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    expect(screen.queryByRole("menuitem", { name: /Chấm bài/ })).toBeNull();
  });

  it.each<UserRole>(["TENANT_ADMIN", "INSTRUCTOR", "LEARNER"])(
    "hiện menu Bài kiểm tra phù hợp cho %s khi module bật",
    (role) => {
      const modules: LmsModule[] = ["COURSES", "ENROLLMENTS", "ASSESSMENTS"];
      mocks.session.effectiveAccess = access(modules);
      mocks.session.organization = tenant(modules);
      mocks.session.user = currentUser(role);
      render(
        <WorkspaceShell>
          <QueryPage />
        </WorkspaceShell>,
      );

      expect(
        screen.getByRole("menuitem", {
          name: role === "LEARNER" ? /Bài kiểm tra của tôi/ : /Bài kiểm tra$/,
        }),
      ).toBeTruthy();
    },
  );

  it("ẩn menu và chặn trực tiếp Bài kiểm tra khi ASSESSMENTS tắt", () => {
    mocks.pathname = "/assessments";
    mocks.session.effectiveAccess = access(["COURSES", "ENROLLMENTS"]);
    mocks.session.organization = tenant(["COURSES", "ENROLLMENTS"]);
    render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    expect(screen.queryByRole("menuitem", { name: /Bài kiểm tra/ })).toBeNull();
    expect(
      screen.getByText(
        "Tính năng Bài kiểm tra không nằm trong quyền truy cập hiệu lực của tổ chức.",
      ),
    ).toBeTruthy();
    expect(mocks.childRender).not.toHaveBeenCalled();
  });

  it("cho người dùng đa workspace chuyển tenant một lần rồi về dashboard", async () => {
    mocks.session.workspaces = [
      {
        membershipId: "membership-1",
        tenantId: "tenant-1",
        name: "Bright Academy",
        slug: "bright",
        role: "TENANT_ADMIN",
        logoUrl: null,
        primaryColor: "#176BFF",
      },
      {
        membershipId: "membership-2",
        tenantId: "tenant-2",
        name: "Lumen School",
        slug: "lumen",
        role: "INSTRUCTOR",
        logoUrl: null,
        primaryColor: "#5B5BD6",
      },
    ];
    let resolveSwitch: (() => void) | undefined;
    mocks.switchWorkspace.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSwitch = resolve;
        }),
    );
    render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    const switcher = screen.getByRole<HTMLButtonElement>("button", { name: "Chọn không gian làm việc" });
    expect(switcher.type).toBe("button");
    expect(switcher.disabled).toBe(false);
    fireEvent.click(switcher);
    expect((await screen.findByRole("menuitem", { name: /Bright Academy/ })).getAttribute("aria-disabled")).toBe("true");
    const option = await screen.findByRole("menuitem", { name: /Lumen School/ });
    fireEvent.click(option);
    fireEvent.click(option);

    expect(mocks.switchWorkspace).toHaveBeenCalledTimes(1);
    expect(mocks.switchWorkspace).toHaveBeenCalledWith("tenant-2");
    expect(switcher.disabled).toBe(true);
    resolveSwitch?.();
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/dashboard"),
    );
    expect(switcher.disabled).toBe(false);
  });

  it("giữ trang hiện tại và hiện lỗi khi chuyển workspace thất bại", async () => {
    mocks.session.workspaces = [
      {
        membershipId: "membership-1",
        tenantId: "tenant-1",
        name: "Bright Academy",
        slug: "bright",
        role: "TENANT_ADMIN",
        logoUrl: null,
        primaryColor: "#176BFF",
      },
      {
        membershipId: "membership-2",
        tenantId: "tenant-2",
        name: "Lumen School",
        slug: "lumen",
        role: "INSTRUCTOR",
        logoUrl: null,
        primaryColor: "#5B5BD6",
      },
    ];
    mocks.switchWorkspace.mockRejectedValue(new Error("Workspace đã bị khóa"));
    render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Chọn không gian làm việc" }),
    );
    fireEvent.click(await screen.findByText("Lumen School"));

    // Only reviewed local copy is rendered for an unstructured backend failure.
    expect(await screen.findByText("Không thể chuyển không gian làm việc")).toBeTruthy();
    expect(screen.queryByText("Workspace đã bị khóa")).toBeNull();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByText("Nội dung trang có truy vấn")).toBeTruthy();
  });
});
