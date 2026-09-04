import { apiFetch } from "@/lib/api";

export type GuardianRelationshipStatus = "ACTIVE" | "INACTIVE";
export type GuardianRelationshipType = "PARENT" | "GUARDIAN" | "OTHER";

export interface GuardianRelationshipParty {
  _id: string;
  email: string;
  fullName: string;
}

export interface GuardianRelationship {
  _id: string;
  archivedAt?: string;
  canReceiveAcademicUpdates: boolean;
  canReceiveBillingUpdates?: boolean;
  createdAt: string;
  guardianId: GuardianRelationshipParty;
  learnerId: GuardianRelationshipParty;
  primaryContact: boolean;
  relationshipType: GuardianRelationshipType;
  status: GuardianRelationshipStatus;
  tenantId: string;
  updatedAt: string;
}

export interface GuardianRelationshipQuery {
  status?: GuardianRelationshipStatus;
}

export interface CreateGuardianRelationshipInput {
  canReceiveAcademicUpdates?: boolean;
  canReceiveBillingUpdates?: boolean;
  guardianId: string;
  learnerId: string;
  primaryContact?: boolean;
  relationshipType: GuardianRelationshipType;
}

export interface UpdateGuardianRelationshipInput {
  canReceiveAcademicUpdates?: boolean;
  canReceiveBillingUpdates?: boolean;
  primaryContact?: boolean;
  relationshipType?: GuardianRelationshipType;
  status?: GuardianRelationshipStatus;
}

export interface GuardianDirectoryEntry {
  _id: string;
  accountStatus: "ACTIVE" | "INACTIVE";
  email: string;
  fullName: string;
  membershipId: string;
  role: "TENANT_ADMIN" | "INSTRUCTOR" | "LEARNER" | "GUARDIAN";
  status: "ACTIVE" | "INACTIVE";
  tenantId: string;
  userId?: string;
}

export interface GuardianApiContext {
  token: string;
}

export function guardianDirectoryUserId(entry: GuardianDirectoryEntry): string {
  return entry.userId ?? entry._id;
}

export function buildGuardianQuery(
  values: GuardianRelationshipQuery = {},
): string {
  const params = new URLSearchParams();
  if (values.status) params.set("status", values.status);
  const query = params.toString();
  return query ? `?${query}` : "";
}

const relationshipPath = (relationshipId: string) =>
  `/guardians/${encodeURIComponent(relationshipId)}`;

export const guardianApi = {
  listForCurrentGuardian: (
    { token }: GuardianApiContext,
    query: GuardianRelationshipQuery = {},
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<GuardianRelationship[]>(
      `/guardians/me${buildGuardianQuery(query)}`,
      {
        cache: "no-store",
        ...(options.signal ? { signal: options.signal } : {}),
        token,
      },
    ),
  listByLearner: (
    { token }: GuardianApiContext,
    learnerId: string,
    query: GuardianRelationshipQuery = {},
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<GuardianRelationship[]>(
      `/guardians/learners/${encodeURIComponent(learnerId)}${buildGuardianQuery(query)}`,
      {
        cache: "no-store",
        ...(options.signal ? { signal: options.signal } : {}),
        token,
      },
    ),
  listDirectory: (
    { token }: GuardianApiContext,
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<GuardianDirectoryEntry[]>("/users", {
      cache: "no-store",
      ...(options.signal ? { signal: options.signal } : {}),
      token,
    }),
  listLearners: (
    { token }: GuardianApiContext,
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<GuardianDirectoryEntry[]>("/users/learners", {
      cache: "no-store",
      ...(options.signal ? { signal: options.signal } : {}),
      token,
    }),
  create: (
    { token }: GuardianApiContext,
    input: CreateGuardianRelationshipInput,
  ) =>
    apiFetch<GuardianRelationship>("/guardians", {
      body: JSON.stringify(input),
      method: "POST",
      token,
    }),
  update: (
    { token }: GuardianApiContext,
    relationshipId: string,
    input: UpdateGuardianRelationshipInput,
  ) =>
    apiFetch<GuardianRelationship>(relationshipPath(relationshipId), {
      body: JSON.stringify(input),
      method: "PATCH",
      token,
    }),
  archive: ({ token }: GuardianApiContext, relationshipId: string) =>
    apiFetch<GuardianRelationship>(relationshipPath(relationshipId), {
      method: "DELETE",
      token,
    }),
};
