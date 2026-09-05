import { apiFetch } from "@/lib/api";
import type { ViewerScope } from "@/lib/query-keys";

export type CohortStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "COMPLETED"
  | "ARCHIVED";
export type EditableCohortStatus = Exclude<CohortStatus, "ARCHIVED">;
export type ClassSessionStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";
export type EditableClassSessionStatus = Exclude<
  ClassSessionStatus,
  "CANCELLED"
>;
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface CohortPersonSummary {
  _id: string;
  email: string;
  fullName: string;
}

export interface CohortInstructorDirectoryEntry {
  email: string;
  fullName: string;
  userId: string;
}

export interface CohortCourseSummary {
  _id: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  title: string;
}

export interface Cohort {
  _id: string;
  archivedAt?: string | null;
  archivedBy?: string;
  capacity: number;
  code: string;
  courseId: string | CohortCourseSummary;
  createdAt?: string;
  endDate?: string | null;
  instructorIds: Array<string | CohortPersonSummary>;
  name: string;
  orgUnitId?: string;
  startDate?: string | null;
  status: CohortStatus;
  tenantId: string;
  timezone: string;
  updatedAt?: string;
}

export interface ClassSession {
  _id: string;
  cancellationReason?: string;
  cancelledAt?: string;
  cohortId: string;
  createdAt?: string;
  endAt: string;
  location?: string;
  meetingUrl?: string;
  startAt: string;
  status: ClassSessionStatus;
  tenantId: string;
  updatedAt?: string;
}

export interface AttendanceRosterItem {
  attendanceId: string | null;
  enrollmentId: string | null;
  learnerId: string | CohortPersonSummary;
  markedAt: string | null;
  markedBy: string | CohortPersonSummary | null;
  note: string | null;
  status: AttendanceStatus | null;
  updatedAt: string | null;
}

export interface AttendanceSnapshot {
  items: AttendanceRosterItem[];
  markedCount: number;
  session: ClassSession;
  total: number;
  unmarkedCount: number;
}

export interface CohortListQuery {
  courseId?: string;
  orgUnitId?: string;
  search?: string;
  status?: CohortStatus;
}

export interface ClassSessionListQuery {
  from?: string;
  status?: ClassSessionStatus;
  to?: string;
}

export interface CohortEnrollment {
  _id: string;
  cohortId: string;
  courseId: string;
  joinedAt: string;
  learnerId: string | CohortPersonSummary;
  status: "ACTIVE" | "WITHDRAWN";
  tenantId: string;
  withdrawnAt?: string | null;
}

export interface CourseLearnerRosterItem {
  _id: string;
  status: "ACTIVE";
  userId: CohortPersonSummary;
}

export interface CourseLearnerRosterResponse {
  items: CourseLearnerRosterItem[];
  limit: number;
  page: number;
  total: number;
}

export interface CourseLearnerRosterQuery {
  limit?: number;
  page?: number;
  search?: string;
}

export interface CreateCohortInput {
  capacity?: number;
  code: string;
  courseId: string;
  endDate?: string;
  instructorIds?: string[];
  name: string;
  orgUnitId?: string;
  startDate?: string;
  status?: EditableCohortStatus;
  timezone?: string;
}

export interface UpdateCohortInput {
  capacity?: number;
  code?: string;
  endDate?: string | null;
  instructorIds?: string[];
  name?: string;
  orgUnitId?: string | null;
  startDate?: string | null;
  status?: EditableCohortStatus;
  timezone?: string;
}

export interface CreateClassSessionInput {
  endAt: string;
  location?: string;
  meetingUrl?: string;
  startAt: string;
  status?: EditableClassSessionStatus;
}

export interface UpdateClassSessionInput {
  endAt?: string;
  location?: string | null;
  meetingUrl?: string | null;
  startAt?: string;
  status?: EditableClassSessionStatus;
}

export interface AttendanceMarkInput {
  learnerId: string;
  note?: string | null;
  status: AttendanceStatus;
}

export interface CohortDirectoryResponse {
  items: CohortInstructorDirectoryEntry[];
  limit: number;
  page: number;
  total: number;
}

export interface CohortInstructorDirectoryQuery {
  limit?: number;
  orgUnitId?: string;
  page?: number;
  search?: string;
}

export interface CohortApiContext {
  token: string;
}

type QueryValue = number | string | undefined;

export function buildCohortQuery(
  values: object = {},
): string {
  const record = values as Readonly<Record<string, QueryValue>>;
  const params = new URLSearchParams();
  for (const key of Object.keys(record).sort()) {
    const raw = record[key];
    if (typeof raw === "string") {
      const value = raw.trim();
      if (value) params.set(key, value);
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      params.set(key, String(raw));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function normalizedFilters(
  values: object,
): ReadonlyArray<readonly [string, number | string]> {
  const record = values as Readonly<Record<string, QueryValue>>;
  const filters: Array<readonly [string, number | string]> = [];
  for (const key of Object.keys(record).sort()) {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim()) {
      filters.push([key, raw.trim()]);
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      filters.push([key, raw]);
    }
  }
  return filters;
}

function scopedRoot(scope: ViewerScope) {
  return [
    "lms",
    scope.tenantId,
    scope.viewerId,
    scope.membershipId,
    scope.role,
    "cohorts",
  ] as const;
}

export const cohortQueryKeys = {
  root: scopedRoot,
  lists: (scope: ViewerScope) => [...scopedRoot(scope), "list"] as const,
  list: (scope: ViewerScope, query: CohortListQuery = {}) =>
    [
      ...cohortQueryKeys.lists(scope),
      normalizedFilters(query),
    ] as const,
  sessionsRoot: (scope: ViewerScope, cohortId: string) =>
    [...scopedRoot(scope), cohortId, "sessions"] as const,
  sessions: (
    scope: ViewerScope,
    cohortId: string,
    query: ClassSessionListQuery = {},
  ) =>
    [
      ...cohortQueryKeys.sessionsRoot(scope, cohortId),
      normalizedFilters(query),
    ] as const,
  attendanceRoot: (scope: ViewerScope, cohortId: string) =>
    [...scopedRoot(scope), cohortId, "attendance"] as const,
  attendance: (scope: ViewerScope, cohortId: string, sessionId: string) =>
    [
      ...cohortQueryKeys.attendanceRoot(scope, cohortId),
      sessionId,
    ] as const,
  learnersRoot: (scope: ViewerScope, cohortId: string) =>
    [...scopedRoot(scope), cohortId, "learners"] as const,
  learners: (scope: ViewerScope, cohortId: string) =>
    [...cohortQueryKeys.learnersRoot(scope, cohortId), "active"] as const,
  courseLearners: (
    scope: ViewerScope,
    cohortId: string,
    courseId: string,
    query: CourseLearnerRosterQuery = {},
  ) =>
    [
      ...cohortQueryKeys.learnersRoot(scope, cohortId),
      "course-roster",
      courseId,
      normalizedFilters(query),
    ] as const,
};

const cohortPath = (cohortId: string) =>
  `/cohorts/${encodeURIComponent(cohortId)}`;
const sessionsPath = (cohortId: string) => `${cohortPath(cohortId)}/sessions`;
const sessionPath = (cohortId: string, sessionId: string) =>
  `${sessionsPath(cohortId)}/${encodeURIComponent(sessionId)}`;
const learnersPath = (cohortId: string) => `${cohortPath(cohortId)}/learners`;

export const cohortApi = {
  listCourses: (
    { token }: CohortApiContext,
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<CohortCourseSummary[]>("/courses", {
      cache: "no-store",
      ...(options.signal ? { signal: options.signal } : {}),
      token,
    }),
  listEligibleInstructors: (
    { token }: CohortApiContext,
    query: CohortInstructorDirectoryQuery = {},
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<CohortDirectoryResponse>(
      `/cohorts/eligible-instructors${buildCohortQuery({
        limit: query.limit ?? 100,
        orgUnitId: query.orgUnitId,
        page: query.page ?? 1,
        search: query.search,
      })}`,
      {
        cache: "no-store",
        ...(options.signal ? { signal: options.signal } : {}),
        token,
      },
    ),
  listCohorts: (
    { token }: CohortApiContext,
    query: CohortListQuery = {},
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<Cohort[]>(`/cohorts${buildCohortQuery(query)}`, {
      cache: "no-store",
      ...(options.signal ? { signal: options.signal } : {}),
      token,
    }),
  createCohort: (
    { token }: CohortApiContext,
    input: CreateCohortInput,
  ) =>
    apiFetch<Cohort>("/cohorts", {
      body: JSON.stringify(input),
      method: "POST",
      token,
    }),
  updateCohort: (
    { token }: CohortApiContext,
    cohortId: string,
    input: UpdateCohortInput,
  ) =>
    apiFetch<Cohort>(cohortPath(cohortId), {
      body: JSON.stringify(input),
      method: "PATCH",
      token,
    }),
  archiveCohort: ({ token }: CohortApiContext, cohortId: string) =>
    apiFetch<Cohort>(cohortPath(cohortId), {
      method: "DELETE",
      token,
    }),
  listLearners: (
    { token }: CohortApiContext,
    cohortId: string,
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<CohortEnrollment[]>(learnersPath(cohortId), {
      cache: "no-store",
      ...(options.signal ? { signal: options.signal } : {}),
      token,
    }),
  listCourseLearners: (
    { token }: CohortApiContext,
    courseId: string,
    query: CourseLearnerRosterQuery = {},
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<CourseLearnerRosterResponse>(
      `/enrollments/courses/${encodeURIComponent(
        courseId,
      )}/roster${buildCohortQuery(query)}`,
      {
        cache: "no-store",
        ...(options.signal ? { signal: options.signal } : {}),
        token,
      },
    ),
  addLearners: (
    { token }: CohortApiContext,
    cohortId: string,
    learnerIds: string[],
  ) =>
    apiFetch<CohortEnrollment[]>(learnersPath(cohortId), {
      body: JSON.stringify({ learnerIds }),
      method: "POST",
      token,
    }),
  removeLearner: (
    { token }: CohortApiContext,
    cohortId: string,
    learnerId: string,
  ) =>
    apiFetch<CohortEnrollment>(
      `${learnersPath(cohortId)}/${encodeURIComponent(learnerId)}`,
      { method: "DELETE", token },
    ),
  listSessions: (
    { token }: CohortApiContext,
    cohortId: string,
    query: ClassSessionListQuery = {},
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<ClassSession[]>(
      `${sessionsPath(cohortId)}${buildCohortQuery(query)}`,
      {
        cache: "no-store",
        ...(options.signal ? { signal: options.signal } : {}),
        token,
      },
    ),
  createSession: (
    { token }: CohortApiContext,
    cohortId: string,
    input: CreateClassSessionInput,
  ) =>
    apiFetch<ClassSession>(sessionsPath(cohortId), {
      body: JSON.stringify(input),
      method: "POST",
      token,
    }),
  updateSession: (
    { token }: CohortApiContext,
    cohortId: string,
    sessionId: string,
    input: UpdateClassSessionInput,
  ) =>
    apiFetch<ClassSession>(sessionPath(cohortId, sessionId), {
      body: JSON.stringify(input),
      method: "PATCH",
      token,
    }),
  cancelSession: (
    { token }: CohortApiContext,
    cohortId: string,
    sessionId: string,
    input: { reason?: string } = {},
  ) =>
    apiFetch<ClassSession>(`${sessionPath(cohortId, sessionId)}/cancel`, {
      body: JSON.stringify(input),
      method: "POST",
      token,
    }),
  getAttendance: (
    { token }: CohortApiContext,
    cohortId: string,
    sessionId: string,
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<AttendanceSnapshot>(
      `${sessionPath(cohortId, sessionId)}/attendance`,
      {
        cache: "no-store",
        referrerPolicy: "no-referrer",
        ...(options.signal ? { signal: options.signal } : {}),
        token,
      },
    ),
  bulkMarkAttendance: (
    { token }: CohortApiContext,
    cohortId: string,
    sessionId: string,
    records: AttendanceMarkInput[],
  ) =>
    apiFetch<AttendanceSnapshot>(
      `${sessionPath(cohortId, sessionId)}/attendance`,
      {
        body: JSON.stringify({ records }),
        method: "PUT",
        referrerPolicy: "no-referrer",
        token,
      },
    ),
};
