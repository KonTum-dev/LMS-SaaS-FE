import { apiFetch } from "@/lib/api";
import type { ViewerScope } from "@/lib/query-keys";

export type OrgUnitType = "ROOT" | "BRANCH" | "DEPARTMENT";
export type OrgUnitStatus = "ACTIVE" | "ARCHIVED";

export interface OrgUnitAddress {
  line1?: string;
  line2?: string;
  ward?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  countryCode?: string;
}

export interface OrgUnitContact {
  email?: string;
  phone?: string;
  websiteUrl?: string;
}

export interface OrgUnit {
  _id: string;
  tenantId: string;
  parentId: string | null;
  type: OrgUnitType;
  code: string;
  name: string;
  status: OrgUnitStatus;
  timezone: string;
  address?: OrgUnitAddress | null;
  contact?: OrgUnitContact | null;
  policyOverrides: Record<string, unknown>;
  revision: number;
  createdBy: string;
  updatedBy: string;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrgUnitTreeNode extends OrgUnit {
  ancestorIds: string[];
  children: OrgUnitTreeNode[];
  depth: number;
  path: string[];
}

export interface OrgUnitListResponse {
  items: OrgUnit[];
  limit: number;
  page: number;
  total: number;
}

export interface OrgUnitTreeResponse {
  items: OrgUnitTreeNode[];
  total: number;
}

export interface OrgUnitListQuery {
  limit?: number;
  page?: number;
  parentId?: string;
  search?: string;
  status?: OrgUnitStatus;
  type?: OrgUnitType;
}

export interface CreateOrgUnitInput {
  address?: OrgUnitAddress;
  code: string;
  contact?: OrgUnitContact;
  name: string;
  parentId?: string;
  policyOverrides?: Record<string, unknown>;
  timezone?: string;
  type: OrgUnitType;
}

export interface UpdateOrgUnitInput {
  address?: OrgUnitAddress;
  code?: string;
  contact?: OrgUnitContact;
  expectedRevision: number;
  name?: string;
  parentId?: string;
  policyOverrides?: Record<string, unknown>;
  timezone?: string;
  type?: OrgUnitType;
}

export interface OrgUnitApiContext {
  token: string;
}

interface RequestOptions {
  signal?: AbortSignal;
}

type QueryValue = boolean | number | string | undefined;

export function buildOrgUnitQuery(
  values: Readonly<Record<string, QueryValue>> = {},
): string {
  const query = new URLSearchParams();
  for (const key of Object.keys(values).sort()) {
    const raw = values[key];
    if (typeof raw === "string") {
      const value = raw.trim();
      if (value) query.set(key, value);
    } else if (typeof raw === "boolean") {
      query.set(key, String(raw));
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      query.set(key, String(raw));
    }
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

function scopedRoot(scope: ViewerScope) {
  return [
    "lms",
    scope.tenantId,
    scope.viewerId,
    scope.membershipId,
    scope.role,
    "org-units",
  ] as const;
}

export const orgUnitQueryKeys = {
  root: scopedRoot,
  list: (scope: ViewerScope, query: OrgUnitListQuery = {}) =>
    [
      ...scopedRoot(scope),
      "list",
      buildOrgUnitQuery(query as Readonly<Record<string, QueryValue>>),
    ] as const,
  tree: (scope: ViewerScope, includeArchived: boolean) =>
    [...scopedRoot(scope), "tree", { includeArchived }] as const,
};

const unitPath = (orgUnitId: string) =>
  `/org-units/${encodeURIComponent(orgUnitId)}`;

function requestOptions(
  token: string,
  options: RequestOptions,
): RequestInit & { token: string } {
  return {
    cache: "no-store",
    ...(options.signal ? { signal: options.signal } : {}),
    token,
  };
}

export const orgUnitsApi = {
  list: (
    { token }: OrgUnitApiContext,
    query: OrgUnitListQuery = {},
    options: RequestOptions = {},
  ) =>
    apiFetch<OrgUnitListResponse>(
      `/org-units${buildOrgUnitQuery(query as Readonly<Record<string, QueryValue>>)}`,
      requestOptions(token, options),
    ),
  tree: (
    { token }: OrgUnitApiContext,
    includeArchived = false,
    options: RequestOptions = {},
  ) =>
    apiFetch<OrgUnitTreeResponse>(
      `/org-units/tree${buildOrgUnitQuery({ includeArchived })}`,
      requestOptions(token, options),
    ),
  get: (
    { token }: OrgUnitApiContext,
    orgUnitId: string,
    options: RequestOptions = {},
  ) =>
    apiFetch<OrgUnit>(unitPath(orgUnitId), requestOptions(token, options)),
  create: ({ token }: OrgUnitApiContext, input: CreateOrgUnitInput) =>
    apiFetch<OrgUnit>("/org-units", {
      body: JSON.stringify(createPayload(input)),
      method: "POST",
      token,
    }),
  update: (
    { token }: OrgUnitApiContext,
    orgUnitId: string,
    input: UpdateOrgUnitInput,
  ) =>
    apiFetch<OrgUnit>(unitPath(orgUnitId), {
      body: JSON.stringify(updatePayload(input)),
      method: "PATCH",
      token,
    }),
  archive: (
    { token }: OrgUnitApiContext,
    orgUnitId: string,
    expectedRevision: number,
  ) =>
    apiFetch<OrgUnit>(`${unitPath(orgUnitId)}/archive`, {
      body: JSON.stringify({ expectedRevision }),
      method: "POST",
      token,
    }),
};

function createPayload(input: CreateOrgUnitInput): CreateOrgUnitInput {
  return {
    ...(normalizedDetails(input.address)
      ? { address: normalizedDetails(input.address) }
      : {}),
    code: input.code.trim().toLowerCase(),
    ...(normalizedDetails(input.contact)
      ? { contact: normalizedDetails(input.contact) }
      : {}),
    name: input.name.trim(),
    ...(trimmed(input.parentId) ? { parentId: trimmed(input.parentId) } : {}),
    ...(input.policyOverrides
      ? { policyOverrides: structuredClone(input.policyOverrides) }
      : {}),
    ...(trimmed(input.timezone) ? { timezone: trimmed(input.timezone) } : {}),
    type: input.type,
  };
}

function updatePayload(input: UpdateOrgUnitInput): UpdateOrgUnitInput {
  return {
    ...(normalizedDetails(input.address)
      ? { address: normalizedDetails(input.address) }
      : {}),
    ...(input.code !== undefined
      ? { code: input.code.trim().toLowerCase() }
      : {}),
    ...(normalizedDetails(input.contact)
      ? { contact: normalizedDetails(input.contact) }
      : {}),
    expectedRevision: input.expectedRevision,
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(trimmed(input.parentId) ? { parentId: trimmed(input.parentId) } : {}),
    ...(input.policyOverrides !== undefined
      ? { policyOverrides: structuredClone(input.policyOverrides) }
      : {}),
    ...(input.timezone !== undefined
      ? { timezone: input.timezone.trim() }
      : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
  };
}

function normalizedDetails<T extends object>(
  details: T | undefined,
): T | undefined {
  if (!details) return undefined;
  const normalized = Object.fromEntries(
    Object.entries(details)
      .map(([key, value]) => [key, trimmed(value)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  ) as T;
  return Object.keys(normalized).length ? normalized : undefined;
}

function trimmed(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
