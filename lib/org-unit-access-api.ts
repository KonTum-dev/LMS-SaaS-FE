import { apiFetch } from "@/lib/api";
import type { OrgUnitType } from "@/lib/org-units-api";
import type { ViewerScope } from "@/lib/query-keys";
import type { UserRole } from "@/lib/types";

export type OrgUnitAccessLevel = "MANAGER" | "STAFF" | "VIEWER";
export type OrgUnitAssignmentStatus = "ACTIVE" | "ARCHIVED";

export interface OrgUnitAssignmentOrgUnit {
  _id: string;
  code: string;
  name: string;
  type: OrgUnitType;
}

export interface OrgUnitAssignmentUser {
  _id: string;
  email: string;
  fullName: string;
}

export interface OrgUnitAssignmentMembership {
  _id: string;
  displayName?: string;
  role: Exclude<UserRole, "SUPER_ADMIN">;
  userId: string | OrgUnitAssignmentUser;
}

export interface OrgUnitAssignment {
  _id: string;
  accessLevel: OrgUnitAccessLevel;
  archivedAt?: string | null;
  createdAt?: string;
  createdBy: string;
  includeDescendants: boolean;
  membershipId: string | OrgUnitAssignmentMembership;
  orgUnitId: string | OrgUnitAssignmentOrgUnit;
  revision: number;
  status: OrgUnitAssignmentStatus;
  tenantId: string;
  updatedAt?: string;
  updatedBy: string;
  userId: string;
}

export interface MyOrgUnitAccess {
  highestAccessLevel: OrgUnitAccessLevel | null;
  orgUnitIds: string[] | null;
  scoped: boolean;
}

export interface OrgUnitAssignmentQuery {
  accessLevel?: OrgUnitAccessLevel;
  membershipId?: string;
  orgUnitId?: string;
  status?: OrgUnitAssignmentStatus;
}

export interface CreateOrgUnitAssignmentInput {
  accessLevel: OrgUnitAccessLevel;
  includeDescendants?: boolean;
  membershipId: string;
  orgUnitId: string;
}

export interface UpdateOrgUnitAssignmentInput {
  accessLevel?: OrgUnitAccessLevel;
  expectedRevision: number;
  includeDescendants?: boolean;
}

export interface OrgUnitAccessApiContext {
  token: string;
}

type QueryValue = string | undefined;

export function buildOrgUnitAssignmentQuery(
  values: Readonly<Record<string, QueryValue>> = {},
): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(values).sort()) {
    const value = values[key]?.trim();
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function scopedRoot(scope: ViewerScope) {
  return [
    "lms",
    scope.tenantId,
    scope.viewerId,
    scope.membershipId,
    scope.role,
    "org-unit-assignments",
  ] as const;
}

export const orgUnitAccessQueryKeys = {
  list: (scope: ViewerScope, query: OrgUnitAssignmentQuery = {}) =>
    [
      ...scopedRoot(scope),
      "list",
      buildOrgUnitAssignmentQuery(
        query as Readonly<Record<string, QueryValue>>,
      ),
    ] as const,
  me: (scope: ViewerScope) => [...scopedRoot(scope), "me"] as const,
  root: scopedRoot,
};

const assignmentPath = (assignmentId: string) =>
  `/org-unit-assignments/${encodeURIComponent(assignmentId)}`;

export const orgUnitAccessApi = {
  list: (
    { token }: OrgUnitAccessApiContext,
    query: OrgUnitAssignmentQuery = {},
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<OrgUnitAssignment[]>(
      "/org-unit-assignments" +
        buildOrgUnitAssignmentQuery(
          query as Readonly<Record<string, QueryValue>>,
        ),
      {
        cache: "no-store",
        ...(options.signal ? { signal: options.signal } : {}),
        token,
      },
    ),
  me: (
    { token }: OrgUnitAccessApiContext,
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<MyOrgUnitAccess>("/org-unit-assignments/me", {
      cache: "no-store",
      ...(options.signal ? { signal: options.signal } : {}),
      token,
    }),
  create: (
    { token }: OrgUnitAccessApiContext,
    input: CreateOrgUnitAssignmentInput,
  ) =>
    apiFetch<OrgUnitAssignment>("/org-unit-assignments", {
      body: JSON.stringify(input),
      method: "POST",
      token,
    }),
  update: (
    { token }: OrgUnitAccessApiContext,
    assignmentId: string,
    input: UpdateOrgUnitAssignmentInput,
  ) =>
    apiFetch<OrgUnitAssignment>(assignmentPath(assignmentId), {
      body: JSON.stringify(input),
      method: "PATCH",
      token,
    }),
  archive: (
    { token }: OrgUnitAccessApiContext,
    assignmentId: string,
    expectedRevision: number,
  ) =>
    apiFetch<OrgUnitAssignment>(`${assignmentPath(assignmentId)}/archive`, {
      body: JSON.stringify({ expectedRevision }),
      method: "POST",
      token,
    }),
};
