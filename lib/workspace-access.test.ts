import { describe, expect, it } from "vitest";
import type {
  CurrentUser,
  EffectiveAccess,
  LmsModule,
  Organization,
  SubscriptionAccessState,
  UserRole,
} from "@/lib/types";
import {
  canPublishYouTube,
  canRevokeYouTube,
  getWorkspaceRouteAccess,
  isScopedTenantAdmin,
} from "./workspace-access";

function user(
  role: UserRole,
  orgUnitScopeMode?: "GLOBAL" | "SCOPED",
): CurrentUser {
  return {
    email: `${role.toLocaleLowerCase()}@example.test`,
    fullName: role,
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

function organization(enabledModules: LmsModule[]): Organization {
  return {
    _id: "tenant-1",
    enabledModules,
    logoUrl: null,
    name: "Tenant One",
    primaryColor: "#176BFF",
    slug: "tenant-one",
    status: "ACTIVE",
  };
}

function effectiveAccess(
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

const allModules: LmsModule[] = [
  "USERS",
  "COURSES",
  "ENROLLMENTS",
  "ASSIGNMENTS",
  "ASSESSMENTS",
  "MEDIA",
  "COHORTS",
  "GUARDIANS",
  "TUITION",
  "ORGANIZATION_STRUCTURE",
  "REPORTS",
  "COMMUNICATIONS",
];

describe("workspace route access policy", () => {
  it("tách quyền xuất bản khỏi quyền xem và thu hồi YouTube", () => {
    expect(isScopedTenantAdmin(user("TENANT_ADMIN", "SCOPED"))).toBe(true);
    expect(canPublishYouTube(user("TENANT_ADMIN", "SCOPED"))).toBe(false);
    expect(canPublishYouTube(user("TENANT_ADMIN", "GLOBAL"))).toBe(true);
    expect(canPublishYouTube(user("INSTRUCTOR", "SCOPED"))).toBe(true);
    expect(canPublishYouTube(user("LEARNER"))).toBe(false);
    expect(canPublishYouTube(user("SUPER_ADMIN"))).toBe(false);

    expect(canRevokeYouTube(user("TENANT_ADMIN", "SCOPED"))).toBe(true);
    expect(canRevokeYouTube(user("LEARNER"))).toBe(true);
    expect(canRevokeYouTube(user("GUARDIAN"))).toBe(true);
    expect(canRevokeYouTube(user("SUPER_ADMIN"))).toBe(false);
    expect(canRevokeYouTube({ ...user("LEARNER"), tenantId: undefined })).toBe(
      false,
    );
  });

  it.each<UserRole>([
    "SUPER_ADMIN",
    "TENANT_ADMIN",
    "INSTRUCTOR",
    "LEARNER",
    "GUARDIAN",
  ])(
    "cho phép %s mở hồ sơ/bảo mật/tích hợp không phụ thuộc tenant, module hay READ_ONLY",
    (role) => {
      const shared = {
        effectiveAccess:
          role === "SUPER_ADMIN" ? null : effectiveAccess([], "READ_ONLY"),
        organization: null,
        user: user(role),
      };
      expect(
        getWorkspaceRouteAccess({
          ...shared,
          pathname: "/account/security",
        }),
      ).toEqual({ allowed: true, route: "account-security" });
      expect(
        getWorkspaceRouteAccess({
          ...shared,
          pathname: "/account/profile",
        }),
      ).toEqual({ allowed: true, route: "account-profile" });
      expect(
        getWorkspaceRouteAccess({
          ...shared,
          pathname: "/account/integrations",
        }),
      ).toEqual({ allowed: true, route: "account-integrations" });
    },
  );

  it.each<UserRole>([
    "SUPER_ADMIN",
    "TENANT_ADMIN",
    "INSTRUCTOR",
    "LEARNER",
    "GUARDIAN",
  ])("cho phép %s mở dashboard", (role) => {
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess:
          role === "SUPER_ADMIN" ? null : effectiveAccess(allModules),
        organization: role === "SUPER_ADMIN" ? null : organization(allModules),
        pathname: "/dashboard",
        user: user(role),
      }),
    ).toEqual({ allowed: true, route: "dashboard" });
  });

  it("chỉ cho quản trị nền tảng mở các route nền tảng", () => {
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: null,
        organization: null,
        pathname: "/admin",
        user: user("SUPER_ADMIN"),
      }),
    ).toEqual({ allowed: true, route: "platform-crm" });
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: null,
        organization: null,
        pathname: "/admin/tenants",
        user: user("SUPER_ADMIN"),
      }).allowed,
    ).toBe(true);
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: null,
        organization: null,
        pathname: "/admin/billing/orders",
        user: user("SUPER_ADMIN"),
      }).allowed,
    ).toBe(true);
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: null,
        organization: null,
        pathname: "/admin/audit",
        user: user("SUPER_ADMIN"),
      }),
    ).toEqual({ allowed: true, route: "platform-audit" });
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: null,
        organization: null,
        pathname: "/admin/notification-events",
        user: user("SUPER_ADMIN"),
      }),
    ).toEqual({ allowed: true, route: "platform-notification-events" });
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: effectiveAccess(allModules),
        organization: organization(allModules),
        pathname: "/admin/tenants",
        user: user("TENANT_ADMIN"),
      }),
    ).toMatchObject({
      allowed: false,
      reason: "ROLE_NOT_ALLOWED",
    });
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: effectiveAccess(allModules),
        organization: organization(allModules),
        pathname: "/admin",
        user: user("TENANT_ADMIN"),
      }),
    ).toMatchObject({ allowed: false, reason: "ROLE_NOT_ALLOWED" });
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: effectiveAccess(allModules),
        organization: organization(allModules),
        pathname: "/admin/notification-events",
        user: user("TENANT_ADMIN"),
      }),
    ).toMatchObject({
      allowed: false,
      reason: "ROLE_NOT_ALLOWED",
    });
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: null,
        organization: null,
        pathname: "/courses",
        user: user("SUPER_ADMIN"),
      }),
    ).toMatchObject({
      allowed: false,
      reason: "ROLE_NOT_ALLOWED",
    });
  });

  it("audit tenant không phụ thuộc module và vẫn đọc được trong READ_ONLY", () => {
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: effectiveAccess([], "READ_ONLY"),
        organization: organization([]),
        pathname: "/audit",
        user: user("TENANT_ADMIN"),
      }),
    ).toEqual({ allowed: true, route: "tenant-audit" });
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: effectiveAccess(allModules),
        organization: organization(allModules),
        pathname: "/audit",
        user: user("INSTRUCTOR"),
      }),
    ).toEqual({
      allowed: false,
      reason: "ROLE_NOT_ALLOWED",
      route: "tenant-audit",
    });
  });

  it.each<UserRole>(["TENANT_ADMIN", "INSTRUCTOR", "LEARNER"])(
    "cho phép %s mở module học tập đang bật",
    (role) => {
      const tenant = organization(allModules);
      expect(
        getWorkspaceRouteAccess({
          effectiveAccess: effectiveAccess(allModules),
          organization: tenant,
          pathname: "/courses/course-1",
          user: user(role),
        }).allowed,
      ).toBe(true);
      expect(
        getWorkspaceRouteAccess({
          effectiveAccess: effectiveAccess(allModules),
          organization: tenant,
          pathname: "/assignments",
          user: user(role),
        }).allowed,
      ).toBe(true);
      expect(
        getWorkspaceRouteAccess({
          effectiveAccess: effectiveAccess(allModules),
          organization: tenant,
          pathname: "/assessments",
          user: user(role),
        }).allowed,
      ).toBe(true);
    },
  );

  it.each<UserRole>(["TENANT_ADMIN", "INSTRUCTOR"])(
    "cho phép %s mở route chấm bài riêng",
    (role) => {
      const tenant = organization(allModules);
      expect(
        getWorkspaceRouteAccess({
          effectiveAccess: effectiveAccess(allModules),
          organization: tenant,
          pathname: "/assignments/grading",
          user: user(role),
        }),
      ).toEqual({ allowed: true, route: "tenant-grading" });
    },
  );

  it("áp dụng đúng quyền cho vận hành lớp, phụ huynh, học phí và chi nhánh", () => {
    const tenant = organization(allModules);
    const canOpen = (role: UserRole, pathname: string) =>
      getWorkspaceRouteAccess({
        effectiveAccess: effectiveAccess(allModules),
        organization: tenant,
        pathname,
        user: user(role),
      });

    expect(canOpen("TENANT_ADMIN", "/cohorts")).toEqual({
      allowed: true,
      route: "tenant-cohorts",
    });
    expect(canOpen("INSTRUCTOR", "/cohorts/class-a/attendance").allowed).toBe(
      true,
    );
    expect(canOpen("LEARNER", "/cohorts")).toMatchObject({
      allowed: false,
      reason: "ROLE_NOT_ALLOWED",
    });

    for (const role of [
      "TENANT_ADMIN",
      "INSTRUCTOR",
      "LEARNER",
      "GUARDIAN",
    ] as const) {
      expect(canOpen(role, "/guardians").allowed).toBe(true);
    }
    for (const role of ["TENANT_ADMIN", "INSTRUCTOR"] as const) {
      expect(canOpen(role, "/organization").allowed).toBe(true);
    }
    for (const role of ["LEARNER", "GUARDIAN"] as const) {
      expect(canOpen(role, "/organization")).toMatchObject({
        allowed: false,
        reason: "ROLE_NOT_ALLOWED",
      });
    }

    for (const role of ["TENANT_ADMIN", "LEARNER", "GUARDIAN"] as const) {
      expect(canOpen(role, "/tuition").allowed).toBe(true);
    }
    expect(canOpen("INSTRUCTOR", "/tuition")).toMatchObject({
      allowed: false,
      reason: "ROLE_NOT_ALLOWED",
    });
    expect(canOpen("TENANT_ADMIN", "/reports")).toEqual({
      allowed: true,
      route: "tenant-reports",
    });
    expect(canOpen("INSTRUCTOR", "/reports").allowed).toBe(true);
    expect(canOpen("LEARNER", "/reports")).toMatchObject({
      allowed: false,
      reason: "ROLE_NOT_ALLOWED",
    });

    for (const role of [
      "TENANT_ADMIN",
      "INSTRUCTOR",
      "LEARNER",
      "GUARDIAN",
    ] as const) {
      expect(canOpen(role, "/communications")).toEqual({
        allowed: true,
        route: "tenant-communications",
      });
    }

    for (const role of ["TENANT_ADMIN", "INSTRUCTOR"] as const) {
      expect(canOpen(role, "/organization/access")).toEqual({
        allowed: true,
        route: "tenant-org-access",
      });
    }
    for (const role of ["LEARNER", "GUARDIAN"] as const) {
      expect(canOpen(role, "/organization/access")).toEqual({
        allowed: false,
        reason: "ROLE_NOT_ALLOWED",
        route: "tenant-org-access",
      });
    }
  });

  it.each([
    "/assignments",
    "/assignments/grading",
    "/assessments",
    "/assessments/manage",
    "/assessments/reports",
    "/billing",
    "/audit",
    "/settings",
  ])(
    "chặn quản lý đơn vị khỏi khu vực quản trị toàn tổ chức %s",
    (pathname) => {
      expect(
        getWorkspaceRouteAccess({
          effectiveAccess: effectiveAccess(allModules),
          organization: organization(allModules),
          pathname,
          user: user("TENANT_ADMIN", "SCOPED"),
        }),
      ).toEqual({
        allowed: false,
        reason: "GLOBAL_ADMIN_REQUIRED",
        route: expect.any(String),
      });
    },
  );

  it.each(["/billing", "/audit", "/settings"])(
    "cho quản trị viên global mở khu vực toàn tổ chức %s",
    (pathname) => {
      expect(
        getWorkspaceRouteAccess({
          effectiveAccess: effectiveAccess(allModules),
          organization: organization(allModules),
          pathname,
          user: user("TENANT_ADMIN", "GLOBAL"),
        }).allowed,
      ).toBe(true);
    },
  );

  it("không áp dụng giới hạn tenant-admin lên giảng viên đã được scope", () => {
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: effectiveAccess(allModules),
        organization: organization(allModules),
        pathname: "/assignments",
        user: user("INSTRUCTOR", "SCOPED"),
      }),
    ).toEqual({ allowed: true, route: "tenant-assignments" });
  });

  it("rule chấm bài cụ thể chặn học viên trước rule /assignments tổng quát", () => {
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: effectiveAccess(allModules),
        organization: organization(allModules),
        pathname: "/assignments/grading",
        user: user("LEARNER"),
      }),
    ).toEqual({
      allowed: false,
      reason: "ROLE_NOT_ALLOWED",
      route: "tenant-grading",
    });
  });

  it.each(["/assessments/manage/assessment-1", "/assessments/reports"])(
    "route quản lý cụ thể %s chặn learner trước rule /assessments tổng quát",
    (pathname) => {
      expect(
        getWorkspaceRouteAccess({
          effectiveAccess: effectiveAccess(allModules),
          organization: organization(allModules),
          pathname,
          user: user("LEARNER"),
        }),
      ).toMatchObject({ allowed: false, reason: "ROLE_NOT_ALLOWED" });
    },
  );

  it.each([
    "/assessments/attempts/attempt-1",
    "/assessments/results/attempt-1",
  ])(
    "route learner cụ thể %s chặn manager trước rule /assessments tổng quát",
    (pathname) => {
      expect(
        getWorkspaceRouteAccess({
          effectiveAccess: effectiveAccess(allModules),
          organization: organization(allModules),
          pathname,
          user: user("TENANT_ADMIN"),
        }),
      ).toMatchObject({ allowed: false, reason: "ROLE_NOT_ALLOWED" });
      expect(
        getWorkspaceRouteAccess({
          effectiveAccess: effectiveAccess(allModules),
          organization: organization(allModules),
          pathname,
          user: user("LEARNER"),
        }).allowed,
      ).toBe(true);
    },
  );

  it("áp dụng đúng quyền cho users, settings và billing của tenant", () => {
    const tenant = organization(allModules);
    for (const pathname of [
      "/users",
      "/settings",
      "/billing",
      "/billing/status/order-1",
    ]) {
      expect(
        getWorkspaceRouteAccess({
          effectiveAccess: effectiveAccess(allModules),
          organization: tenant,
          pathname,
          user: user("TENANT_ADMIN"),
        }).allowed,
      ).toBe(true);
      expect(
        getWorkspaceRouteAccess({
          effectiveAccess: effectiveAccess(allModules),
          organization: tenant,
          pathname,
          user: user("INSTRUCTOR"),
        }),
      ).toMatchObject({
        allowed: false,
        reason: "ROLE_NOT_ALLOWED",
      });
      expect(
        getWorkspaceRouteAccess({
          effectiveAccess: effectiveAccess(allModules),
          organization: tenant,
          pathname,
          user: user("LEARNER"),
        }),
      ).toMatchObject({
        allowed: false,
        reason: "ROLE_NOT_ALLOWED",
      });
    }
  });

  it.each([
    ["/users", "USERS"],
    ["/courses/course-1", "COURSES"],
    ["/assignments", "ASSIGNMENTS"],
    ["/assessments", "ASSESSMENTS"],
  ] as const)(
    "chặn route %s khi module %s bị tắt",
    (pathname, requiredModule) => {
      expect(
        getWorkspaceRouteAccess({
          effectiveAccess: effectiveAccess(
            allModules.filter((module) => module !== requiredModule),
          ),
          organization: organization(
            allModules.filter((module) => module !== requiredModule),
          ),
          pathname,
          user: user("TENANT_ADMIN"),
        }),
      ).toEqual({
        allowed: false,
        reason: "MODULE_DISABLED",
        requiredModule,
        route:
          requiredModule === "USERS"
            ? "tenant-users"
            : requiredModule === "COURSES"
              ? "tenant-courses"
              : requiredModule === "ASSESSMENTS"
                ? "tenant-assessments"
                : "tenant-assignments",
      });
    },
  );

  it("không nhầm route có cùng tiền tố và mặc định từ chối route chưa khai báo", () => {
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: effectiveAccess(allModules),
        organization: organization(allModules),
        pathname: "/courses-archive",
        user: user("TENANT_ADMIN"),
      }),
    ).toEqual({ allowed: false, reason: "UNKNOWN_ROUTE", route: null });
  });

  it("không lộ route phụ thuộc từ payload hiệu lực thiếu Khóa học", () => {
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: effectiveAccess(["ASSIGNMENTS"]),
        organization: organization(["ASSIGNMENTS"]),
        pathname: "/assignments",
        user: user("TENANT_ADMIN"),
      }),
    ).toMatchObject({ allowed: false, reason: "MODULE_DISABLED" });
  });

  it("không lộ Bài tập nếu payload hiệu lực thiếu Ghi danh", () => {
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: effectiveAccess(["COURSES", "ASSIGNMENTS"]),
        organization: organization(["COURSES", "ASSIGNMENTS"]),
        pathname: "/assignments",
        user: user("TENANT_ADMIN"),
      }),
    ).toMatchObject({ allowed: false, reason: "MODULE_DISABLED" });
  });

  it("không mở tenant route khi phiên thiếu cấu hình tổ chức", () => {
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: effectiveAccess(allModules),
        organization: null,
        pathname: "/settings",
        user: user("TENANT_ADMIN"),
      }),
    ).toEqual({
      allowed: false,
      reason: "ORGANIZATION_REQUIRED",
      route: "tenant-settings",
    });
  });

  it("giữ quyền đọc module khi thuê bao ở READ_ONLY", () => {
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: effectiveAccess(allModules, "READ_ONLY"),
        organization: organization(allModules),
        pathname: "/courses/course-1",
        user: user("INSTRUCTOR"),
      }),
    ).toEqual({ allowed: true, route: "tenant-courses" });
  });

  it("chặn module khi tenant chưa có thuê bao nhưng vẫn cho admin mở billing", () => {
    const tenant = organization(allModules);
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: null,
        organization: tenant,
        pathname: "/courses",
        user: user("TENANT_ADMIN"),
      }),
    ).toMatchObject({ allowed: false, reason: "SUBSCRIPTION_REQUIRED" });
    expect(
      getWorkspaceRouteAccess({
        effectiveAccess: null,
        organization: tenant,
        pathname: "/billing",
        user: user("TENANT_ADMIN"),
      }).allowed,
    ).toBe(true);
  });
});
