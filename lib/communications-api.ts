import { apiFetch } from "@/lib/api";
import type { ViewerScope } from "@/lib/query-keys";
import type { Paginated } from "@/lib/types";

export type AnnouncementAudience = "TENANT" | "ORG_UNIT" | "COHORT";
export type AnnouncementStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type AnnouncementRecipientRole =
  "TENANT_ADMIN" | "INSTRUCTOR" | "LEARNER" | "GUARDIAN";

export interface Announcement {
  _id: string;
  archivedAt?: string | null;
  audience: AnnouncementAudience;
  body: string;
  cohortId?: string;
  createdAt?: string;
  createdBy: string;
  orgUnitId?: string;
  publishedAt?: string | null;
  recipientRoles: AnnouncementRecipientRole[];
  resolvedCohortIds: string[];
  status: AnnouncementStatus;
  tenantId: string;
  title: string;
  updatedAt?: string;
}

export interface AnnouncementListQuery {
  audience?: AnnouncementAudience;
  status?: AnnouncementStatus;
}

export interface AnnouncementDirectoryQuery extends AnnouncementListQuery {
  page: number;
  limit: number;
  search?: string;
}

export interface CreateAnnouncementInput {
  audience: AnnouncementAudience;
  body: string;
  cohortId?: string;
  orgUnitId?: string;
  recipientRoles: AnnouncementRecipientRole[];
  title: string;
}

export interface UpdateAnnouncementInput {
  audience?: AnnouncementAudience;
  body?: string;
  cohortId?: string | null;
  orgUnitId?: string | null;
  recipientRoles?: AnnouncementRecipientRole[];
  title?: string;
}

export interface CommunicationsApiContext {
  token: string;
}

type QueryValue = string | number | undefined;

export function buildAnnouncementQuery(
  values: Readonly<Record<string, QueryValue>> = {},
): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(values).sort()) {
    const raw = values[key];
    const value = typeof raw === "number" ? String(raw) : raw?.trim();
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
    "communications",
    "announcements",
  ] as const;
}

export const communicationsQueryKeys = {
  directory: (scope: ViewerScope, query: AnnouncementDirectoryQuery) =>
    [
      ...scopedRoot(scope),
      "directory",
      buildAnnouncementQuery(
        query as unknown as Readonly<Record<string, QueryValue>>,
      ),
    ] as const,
  list: (scope: ViewerScope, query: AnnouncementListQuery = {}) =>
    [
      ...scopedRoot(scope),
      "list",
      buildAnnouncementQuery(query as Readonly<Record<string, QueryValue>>),
    ] as const,
  root: scopedRoot,
};

const announcementPath = (announcementId: string) =>
  `/communications/announcements/${encodeURIComponent(announcementId)}`;

export const communicationsApi = {
  directory: (
    { token }: CommunicationsApiContext,
    query: AnnouncementDirectoryQuery,
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<Paginated<Announcement>>(
      "/communications/announcements/directory" +
        buildAnnouncementQuery(
          query as unknown as Readonly<Record<string, QueryValue>>,
        ),
      {
        cache: "no-store",
        ...(options.signal ? { signal: options.signal } : {}),
        token,
      },
    ),
  list: (
    { token }: CommunicationsApiContext,
    query: AnnouncementListQuery = {},
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<Announcement[]>(
      "/communications/announcements" +
        buildAnnouncementQuery(query as Readonly<Record<string, QueryValue>>),
      {
        cache: "no-store",
        ...(options.signal ? { signal: options.signal } : {}),
        token,
      },
    ),
  create: (
    { token }: CommunicationsApiContext,
    input: CreateAnnouncementInput,
  ) =>
    apiFetch<Announcement>("/communications/announcements", {
      body: JSON.stringify(input),
      method: "POST",
      token,
    }),
  update: (
    { token }: CommunicationsApiContext,
    announcementId: string,
    input: UpdateAnnouncementInput,
  ) =>
    apiFetch<Announcement>(announcementPath(announcementId), {
      body: JSON.stringify(input),
      method: "PATCH",
      token,
    }),
  publish: ({ token }: CommunicationsApiContext, announcementId: string) =>
    apiFetch<Announcement>(`${announcementPath(announcementId)}/publish`, {
      method: "POST",
      token,
    }),
  archive: ({ token }: CommunicationsApiContext, announcementId: string) =>
    apiFetch<Announcement>(`${announcementPath(announcementId)}/archive`, {
      method: "POST",
      token,
    }),
};
