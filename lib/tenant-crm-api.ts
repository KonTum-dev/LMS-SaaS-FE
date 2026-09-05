import { ApiError, apiFetch } from "@/lib/api";

export type CrmKind = "LEAD" | "LEARNER" | "GUARDIAN";
export type CrmStage = "NEW" | "CONTACTED" | "QUALIFIED" | "ENROLLED" | "LOST";
export type CrmSource = "MANUAL" | "ZALO_MINI_APP";
export interface CrmZaloProfile {
  displayName: string;
  avatarUrl: string | null;
  phone: string | null;
  phoneShared: boolean;
  consentVersion: string;
  syncedAt: string;
}
export interface CrmContact {
  _id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  kind: CrmKind;
  stage: CrmStage;
  source: CrmSource;
  orgUnitId: string | null;
  userId: string | null;
  nextFollowUpAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  zalo: CrmZaloProfile | null;
  canEdit: boolean;
  history?: {
    id: string;
    type: "CREATED" | "UPDATED" | "NOTE" | "ZALO_SYNCED";
    at: string;
    actorId: string;
    fields: string[];
    note: string | null;
  }[];
}
export interface CrmOptions {
  orgUnits: { _id: string; name: string; canWrite: boolean }[];
  scoped: boolean;
  canCreate: boolean;
}
export interface CrmContactInput {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  kind?: CrmKind;
  stage?: CrmStage;
  orgUnitId?: string | null;
  nextFollowUpAt?: string | null;
}
export interface CrmQuery {
  page?: number;
  limit?: number;
  search?: string;
  kind?: string;
  stage?: string;
  source?: string;
  followUp?: string;
  orgUnitId?: string;
}
interface Context {
  token: string;
}
interface RequestOptions {
  signal?: AbortSignal;
}
const fields = [
  "fullName",
  "phone",
  "email",
  "kind",
  "stage",
  "orgUnitId",
  "nextFollowUpAt",
] as const;
function body(input: Partial<CrmContactInput>) {
  return Object.fromEntries(
    fields
      .filter((key) => input[key] !== undefined)
      .map((key) => [key, input[key]]),
  );
}
function id(value: string) {
  if (!/^[a-f\d]{24}$/i.test(value))
    throw new ApiError(
      "Invalid contact identifier",
      400,
      "CRM_CONTACT_INVALID",
    );
  return value;
}
export function buildCrmQuery(query: CrmQuery = {}) {
  const params = new URLSearchParams();
  for (const key of [
    "page",
    "limit",
    "search",
    "kind",
    "stage",
    "source",
    "followUp",
    "orgUnitId",
  ] as const) {
    const value = query[key];
    if (value !== undefined && String(value).trim())
      params.set(key, String(value).trim());
  }
  return params.size ? `?${params}` : "";
}
export const tenantCrmApi = {
  options: (ctx: Context, options: RequestOptions = {}) =>
    apiFetch<CrmOptions>("/crm/options", {
      ...ctx,
      ...options,
      cache: "no-store",
    }),
  list: (ctx: Context, query: CrmQuery = {}, options: RequestOptions = {}) =>
    apiFetch<{
      items: CrmContact[];
      page: number;
      limit: number;
      total: number;
    }>(`/crm/contacts${buildCrmQuery(query)}`, {
      ...ctx,
      ...options,
      cache: "no-store",
    }),
  get: (ctx: Context, contactId: string, options: RequestOptions = {}) =>
    apiFetch<CrmContact>(`/crm/contacts/${id(contactId)}`, {
      ...ctx,
      ...options,
      cache: "no-store",
    }),
  create: (
    ctx: Context,
    input: CrmContactInput,
    options: RequestOptions = {},
  ) =>
    apiFetch<CrmContact>("/crm/contacts", {
      ...ctx,
      ...options,
      method: "POST",
      body: JSON.stringify(body(input)),
    }),
  update: (
    ctx: Context,
    contactId: string,
    input: Partial<CrmContactInput> & { revision: number },
    options: RequestOptions = {},
  ) =>
    apiFetch<CrmContact>(`/crm/contacts/${id(contactId)}`, {
      ...ctx,
      ...options,
      method: "PATCH",
      body: JSON.stringify({ ...body(input), revision: input.revision }),
    }),
  addNote: (
    ctx: Context,
    contactId: string,
    input: { revision: number; body: string },
    options: RequestOptions = {},
  ) =>
    apiFetch<CrmContact>(`/crm/contacts/${id(contactId)}/notes`, {
      ...ctx,
      ...options,
      method: "POST",
      body: JSON.stringify({ revision: input.revision, body: input.body }),
    }),
};
