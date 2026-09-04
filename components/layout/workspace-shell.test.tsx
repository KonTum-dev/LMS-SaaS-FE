// @vitest-environment jsdom

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
  CurrentUser,
  EffectiveAccess,
  LmsModule,
  Organization,
  SubscriptionAccessState,
  UserRole,
} from "@/lib/types";
import { WorkspaceShell } from "./workspace-shell";

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

  it("ẩn khu vực toàn tổ chức và nhận diện đúng quản lý đơn vị", () => {
    mocks.session.effectiveAccess = access([], "READ_ONLY");
    mocks.session.organization = tenant([]);
    mocks.session.user = currentUser("TENANT_ADMIN", "SCOPED");
    render(
      <WorkspaceShell>
        <QueryPage />
      </WorkspaceShell>,
    );

    expect(screen.getAllByText("Quản lý đơn vị").length).toBeGreaterThan(0);
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
      fireEvent.click(await screen.findByText("Ứng dụng kết nối"));
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

    expect(screen.getByText("Dùng thử miễn phí")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Xem gói trả phí" }),
    ).toBeTruthy();
    expect(screen.getByText(/đến .*2030/)).toBeTruthy();
    expect(
      screen.getByText(/quyền truy cập hiện được cấp cho workspace/),
    ).toBeTruthy();
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

    fireEvent.click(
      screen.getByRole("button", { name: "Chọn không gian làm việc" }),
    );
    const option = await screen.findByText("Lumen School");
    fireEvent.click(option);
    fireEvent.click(option);

    expect(mocks.switchWorkspace).toHaveBeenCalledTimes(1);
    expect(mocks.switchWorkspace).toHaveBeenCalledWith("tenant-2");
    resolveSwitch?.();
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/dashboard"),
    );
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

    expect(await screen.findByText("Workspace đã bị khóa")).toBeTruthy();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByText("Nội dung trang có truy vấn")).toBeTruthy();
  });
});
