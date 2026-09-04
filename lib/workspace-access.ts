import type {
  CurrentUser,
  EffectiveAccess,
  LmsModule,
  Organization,
  UserRole,
} from "@/lib/types";
import { effectiveModuleEnabled } from "@/lib/entitlements";

export type WorkspaceRouteKey =
  | "dashboard"
  | "account-integrations"
  | "account-profile"
  | "account-security"
  | "platform-crm"
  | "platform-audit"
  | "platform-tenants"
  | "platform-billing"
  | "platform-notification-events"
  | "tenant-users"
  | "tenant-organization"
  | "tenant-org-access"
  | "tenant-cohorts"
  | "tenant-guardians"
  | "tenant-tuition"
  | "tenant-reports"
  | "tenant-communications"
  | "tenant-courses"
  | "tenant-assessment-manage"
  | "tenant-assessment-attempt"
  | "tenant-assessment-result"
  | "tenant-assessment-reports"
  | "tenant-assessments"
  | "tenant-grading"
  | "tenant-assignments"
  | "tenant-billing"
  | "tenant-audit"
  | "tenant-settings";

export type WorkspaceAccessDeniedReason =
  | "SIGNED_OUT"
  | "UNKNOWN_ROUTE"
  | "ROLE_NOT_ALLOWED"
  | "ORGANIZATION_REQUIRED"
  | "GLOBAL_ADMIN_REQUIRED"
  | "SUBSCRIPTION_REQUIRED"
  | "MODULE_DISABLED";

export interface WorkspaceAccessAllowed {
  allowed: true;
  route: WorkspaceRouteKey;
}

export interface WorkspaceAccessDenied {
  allowed: false;
  reason: WorkspaceAccessDeniedReason;
  requiredModule?: LmsModule;
  route: WorkspaceRouteKey | null;
}

export type WorkspaceAccessDecision =
  WorkspaceAccessAllowed | WorkspaceAccessDenied;

interface WorkspaceRouteRule {
  denyScopedTenantAdmin?: boolean;
  module?: LmsModule;
  path: string;
  requiresOrganization?: boolean;
  roles: readonly UserRole[];
  route: WorkspaceRouteKey;
}

const ALL_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "TENANT_ADMIN",
  "INSTRUCTOR",
  "LEARNER",
  "GUARDIAN",
];
const TENANT_ROLES: readonly UserRole[] = [
  "TENANT_ADMIN",
  "INSTRUCTOR",
  "LEARNER",
];
const ALL_TENANT_ROLES: readonly UserRole[] = [
  "TENANT_ADMIN",
  "INSTRUCTOR",
  "LEARNER",
  "GUARDIAN",
];

const WORKSPACE_ROUTE_RULES: readonly WorkspaceRouteRule[] = [
  { path: "/dashboard", roles: ALL_ROLES, route: "dashboard" },
  {
    path: "/account/integrations",
    roles: ALL_ROLES,
    route: "account-integrations",
  },
  { path: "/account/profile", roles: ALL_ROLES, route: "account-profile" },
  { path: "/account/security", roles: ALL_ROLES, route: "account-security" },
  { path: "/admin/audit", roles: ["SUPER_ADMIN"], route: "platform-audit" },
  { path: "/admin/tenants", roles: ["SUPER_ADMIN"], route: "platform-tenants" },
  { path: "/admin/billing", roles: ["SUPER_ADMIN"], route: "platform-billing" },
  {
    path: "/admin/notification-events",
    roles: ["SUPER_ADMIN"],
    route: "platform-notification-events",
  },
  { path: "/admin", roles: ["SUPER_ADMIN"], route: "platform-crm" },
  {
    module: "USERS",
    path: "/users",
    requiresOrganization: true,
    roles: ["TENANT_ADMIN"],
    route: "tenant-users",
  },
  {
    module: "ORGANIZATION_STRUCTURE",
    path: "/organization/access",
    requiresOrganization: true,
    roles: ["TENANT_ADMIN", "INSTRUCTOR"],
    route: "tenant-org-access",
  },
  {
    module: "ORGANIZATION_STRUCTURE",
    path: "/organization",
    requiresOrganization: true,
    roles: ["TENANT_ADMIN", "INSTRUCTOR"],
    route: "tenant-organization",
  },
  {
    module: "COHORTS",
    path: "/cohorts",
    requiresOrganization: true,
    roles: ["TENANT_ADMIN", "INSTRUCTOR"],
    route: "tenant-cohorts",
  },
  {
    module: "GUARDIANS",
    path: "/guardians",
    requiresOrganization: true,
    roles: ALL_TENANT_ROLES,
    route: "tenant-guardians",
  },
  {
    module: "TUITION",
    path: "/tuition",
    requiresOrganization: true,
    roles: ["TENANT_ADMIN", "LEARNER", "GUARDIAN"],
    route: "tenant-tuition",
  },
  {
    module: "REPORTS",
    path: "/reports",
    requiresOrganization: true,
    roles: ["TENANT_ADMIN", "INSTRUCTOR"],
    route: "tenant-reports",
  },
  {
    module: "COMMUNICATIONS",
    path: "/communications",
    requiresOrganization: true,
    roles: ALL_TENANT_ROLES,
    route: "tenant-communications",
  },
  {
    module: "COURSES",
    path: "/courses",
    requiresOrganization: true,
    roles: TENANT_ROLES,
    route: "tenant-courses",
  },
  {
    denyScopedTenantAdmin: true,
    module: "ASSESSMENTS",
    path: "/assessments/manage",
    requiresOrganization: true,
    roles: ["TENANT_ADMIN", "INSTRUCTOR"],
    route: "tenant-assessment-manage",
  },
  {
    denyScopedTenantAdmin: true,
    module: "ASSESSMENTS",
    path: "/assessments/reports",
    requiresOrganization: true,
    roles: ["TENANT_ADMIN", "INSTRUCTOR"],
    route: "tenant-assessment-reports",
  },
  {
    module: "ASSESSMENTS",
    path: "/assessments/attempts",
    requiresOrganization: true,
    roles: ["LEARNER"],
    route: "tenant-assessment-attempt",
  },
  {
    module: "ASSESSMENTS",
    path: "/assessments/results",
    requiresOrganization: true,
    roles: ["LEARNER"],
    route: "tenant-assessment-result",
  },
  {
    denyScopedTenantAdmin: true,
    module: "ASSESSMENTS",
    path: "/assessments",
    requiresOrganization: true,
    roles: TENANT_ROLES,
    route: "tenant-assessments",
  },
  {
    denyScopedTenantAdmin: true,
    module: "ASSIGNMENTS",
    path: "/assignments/grading",
    requiresOrganization: true,
    roles: ["TENANT_ADMIN", "INSTRUCTOR"],
    route: "tenant-grading",
  },
  {
    denyScopedTenantAdmin: true,
    module: "ASSIGNMENTS",
    path: "/assignments",
    requiresOrganization: true,
    roles: TENANT_ROLES,
    route: "tenant-assignments",
  },
  {
    denyScopedTenantAdmin: true,
    path: "/billing",
    requiresOrganization: true,
    roles: ["TENANT_ADMIN"],
    route: "tenant-billing",
  },
  {
    denyScopedTenantAdmin: true,
    path: "/audit",
    requiresOrganization: true,
    roles: ["TENANT_ADMIN"],
    route: "tenant-audit",
  },
  {
    denyScopedTenantAdmin: true,
    path: "/settings",
    requiresOrganization: true,
    roles: ["TENANT_ADMIN"],
    route: "tenant-settings",
  },
];

interface WorkspaceAccessInput {
  effectiveAccess: EffectiveAccess | null;
  organization: Organization | null;
  pathname: string;
  user: CurrentUser | null;
}

function normalizePathname(pathname: string): string {
  const pathOnly = pathname.split(/[?#]/, 1)[0] || "/";
  const normalized = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

function isRouteMatch(pathname: string, routePath: string): boolean {
  return pathname === routePath || pathname.startsWith(`${routePath}/`);
}

export function isScopedTenantAdmin(
  user: Pick<CurrentUser, "orgUnitScopeMode" | "role"> | null,
): boolean {
  return Boolean(
    user?.role === "TENANT_ADMIN" && user.orgUnitScopeMode === "SCOPED",
  );
}

function hasTenantMembership(user: CurrentUser | null): user is CurrentUser & {
  membershipId: string;
  tenantId: string;
} {
  return Boolean(
    user &&
      user.role !== "SUPER_ADMIN" &&
      user.tenantId &&
      user.membershipId,
  );
}

export function canPublishYouTube(user: CurrentUser | null): boolean {
  return Boolean(
    hasTenantMembership(user) &&
      (user.role === "INSTRUCTOR" || user.role === "TENANT_ADMIN") &&
      !isScopedTenantAdmin(user),
  );
}

export function canRevokeYouTube(user: CurrentUser | null): boolean {
  return hasTenantMembership(user);
}

export function getWorkspaceRouteAccess({
  effectiveAccess,
  organization,
  pathname,
  user,
}: WorkspaceAccessInput): WorkspaceAccessDecision {
  if (!user) return { allowed: false, reason: "SIGNED_OUT", route: null };

  const normalizedPathname = normalizePathname(pathname);
  const rule = WORKSPACE_ROUTE_RULES.find((candidate) =>
    isRouteMatch(normalizedPathname, candidate.path),
  );
  if (!rule) return { allowed: false, reason: "UNKNOWN_ROUTE", route: null };
  if (!rule.roles.includes(user.role)) {
    return { allowed: false, reason: "ROLE_NOT_ALLOWED", route: rule.route };
  }
  if (
    rule.denyScopedTenantAdmin &&
    isScopedTenantAdmin(user)
  ) {
    return {
      allowed: false,
      reason: "GLOBAL_ADMIN_REQUIRED",
      route: rule.route,
    };
  }
  if (rule.requiresOrganization && !organization) {
    return {
      allowed: false,
      reason: "ORGANIZATION_REQUIRED",
      route: rule.route,
    };
  }
  if (rule.module && !effectiveAccess) {
    return {
      allowed: false,
      reason: "SUBSCRIPTION_REQUIRED",
      requiredModule: rule.module,
      route: rule.route,
    };
  }
  if (rule.module && !effectiveModuleEnabled(effectiveAccess, rule.module)) {
    return {
      allowed: false,
      reason: "MODULE_DISABLED",
      requiredModule: rule.module,
      route: rule.route,
    };
  }

  return { allowed: true, route: rule.route };
}

export function canAccessWorkspaceRoute(input: WorkspaceAccessInput): boolean {
  return getWorkspaceRouteAccess(input).allowed;
}
