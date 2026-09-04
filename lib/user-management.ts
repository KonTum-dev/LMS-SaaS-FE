import type {
  AppUser,
  InvitationIssueResponse,
  InvitationStatus,
  TenantInvitation,
} from "@/lib/types";
import type { OrgUnitTreeNode, OrgUnitType } from "@/lib/org-units-api";

export interface UserFormValues {
  email: string;
  password?: string;
  fullName: string;
  orgUnitId?: string | null;
  role: AppUser["role"];
  status?: AppUser["status"];
}

export interface InvitationFormValues {
  displayName?: string;
  email: string;
  orgUnitId?: string;
  role: AppUser["role"];
}

export interface UserOrgUnitOption {
  label: string;
  value: string;
}

const orgUnitTypeLabels: Record<OrgUnitType, string> = {
  BRANCH: "Chi nhánh",
  DEPARTMENT: "Phòng ban",
  ROOT: "Trung tâm",
};

export const userRoleOptions: Array<{
  label: string;
  value: AppUser["role"];
}> = [
  { label: "Quản trị tổ chức", value: "TENANT_ADMIN" },
  { label: "Giảng viên", value: "INSTRUCTOR" },
  { label: "Học viên", value: "LEARNER" },
  { label: "Phụ huynh", value: "GUARDIAN" },
];

export const userRoleLabels = Object.fromEntries(
  userRoleOptions.map((item) => [item.value, item.label]),
) as Record<AppUser["role"], string>;

export function buildCreateUserPayload(values: UserFormValues) {
  if (!values.password) {
    throw new Error("Mật khẩu ban đầu là bắt buộc");
  }

  const orgUnitId = normalizeOrgUnitId(values.orgUnitId);
  return {
    email: values.email.trim().toLocaleLowerCase("en"),
    fullName: values.fullName.trim(),
    ...(orgUnitId ? { orgUnitId } : {}),
    password: values.password,
    role: values.role,
  };
}

export function buildUpdateUserPayload(values: UserFormValues) {
  const orgUnitId = normalizeOrgUnitId(values.orgUnitId);
  return {
    displayName: values.fullName.trim(),
    ...(values.orgUnitId !== undefined
      ? { orgUnitId: orgUnitId ?? null }
      : {}),
    role: values.role,
    ...(values.status ? { status: values.status } : {}),
  };
}

export function userIdentityId(user: { _id: string; userId?: string }) {
  return user.userId ?? user._id;
}

export function buildInvitationPayload(values: InvitationFormValues) {
  const displayName = values.displayName?.trim();
  const orgUnitId = normalizeOrgUnitId(values.orgUnitId);
  return {
    email: values.email.trim().toLocaleLowerCase("en"),
    role: values.role,
    ...(displayName ? { displayName } : {}),
    ...(orgUnitId ? { orgUnitId } : {}),
  };
}

export function buildUserOrgUnitOptions(
  roots: readonly OrgUnitTreeNode[],
): UserOrgUnitOption[] {
  const options: UserOrgUnitOption[] = [];
  const visit = (units: readonly OrgUnitTreeNode[], ancestors: string[]) => {
    for (const unit of units) {
      const path = [...ancestors, unit.name];
      if (unit.status === "ACTIVE") {
        options.push({
          label: `${path.join(" / ")} · ${orgUnitTypeLabels[unit.type]}`,
          value: unit._id,
        });
      }
      visit(unit.children, path);
    }
  };
  visit(roots, []);
  return options;
}

export function buildInvitationAcceptUrl(
  response: InvitationIssueResponse,
  origin: string,
) {
  try {
    const parsed = new URL(response.acceptPath, origin);
    if (parsed.origin === origin && parsed.pathname.startsWith("/invite/")) {
      return parsed.toString();
    }
  } catch {
    // Fall back to the server-issued token below.
  }
  return `${origin}/invite/${encodeURIComponent(response.token)}`;
}

export function canManageInvitation(status: InvitationStatus) {
  return status === "PENDING" || status === "EXPIRED";
}

export function adminTenantMemberEndpoint(tenantId: string, membershipId?: string) {
  const root = `/users/tenants/${tenantId}`;
  return membershipId ? `${root}/${membershipId}` : root;
}

export function sanitizeInvitationList(items: TenantInvitation[]): TenantInvitation[] {
  return items.map((item) => ({
    _id: item._id,
    acceptedAt: item.acceptedAt,
    acceptedBy: item.acceptedBy,
    claimedAt: item.claimedAt,
    createdAt: item.createdAt,
    displayName: item.displayName,
    email: item.email,
    expiresAt: item.expiresAt,
    invitedBy: item.invitedBy,
    orgUnitId: item.orgUnitId,
    role: item.role,
    status: item.status,
    tenantId: item.tenantId,
    updatedAt: item.updatedAt,
  }));
}

function normalizeOrgUnitId(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}
