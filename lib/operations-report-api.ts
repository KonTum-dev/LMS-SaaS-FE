import { apiFetch } from "@/lib/api";
import type { OrgUnitType } from "@/lib/org-units-api";
import type { ViewerScope } from "@/lib/query-keys";

export interface OperationsReportQuery {
  from?: string;
  orgUnitId?: string;
  to?: string;
}

export interface OperationsMetrics {
  activeCohorts: number;
  activeLearners: number;
  completedSessions: number;
  scheduledSessions: number;
}

export interface AttendanceMetrics {
  absent: number;
  attendanceRatePercent: number;
  excused: number;
  late: number;
  marked: number;
  present: number;
}

export interface TuitionMetrics {
  collectedAmountVnd: number;
  invoiceCount: number;
  issuedAmountVnd: number;
  outstandingAmountVnd: number;
  overdueAmountVnd: number;
}

export interface OperationsReportScope {
  from: string;
  orgUnitId: string | null;
  tenantId: string;
  to: string;
}

export interface OperationsReportUnit {
  attendance: AttendanceMetrics;
  code: string;
  name: string;
  operations: OperationsMetrics;
  orgUnitId: string | null;
  tuition: TuitionMetrics | null;
  type: OrgUnitType | null;
}

export interface OperationsReportOverview {
  attendance: AttendanceMetrics;
  generatedAt: string;
  operations: OperationsMetrics;
  scope: OperationsReportScope;
  tuition: TuitionMetrics | null;
  units: OperationsReportUnit[];
}

export interface OperationsReportApiContext {
  token: string;
}

type QueryValue = string | undefined;

export function buildOperationsReportQuery(
  values: Readonly<Record<string, QueryValue>> = {},
): string {
  const params = new URLSearchParams();
  const hasCompleteRange = Boolean(values.from?.trim() && values.to?.trim());
  for (const key of Object.keys(values).sort()) {
    if ((key === "from" || key === "to") && !hasCompleteRange) continue;
    const value = values[key]?.trim();
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? "?" + query : "";
}

function scopedRoot(scope: ViewerScope) {
  return [
    "lms",
    scope.tenantId,
    scope.viewerId,
    scope.membershipId,
    scope.role,
    "operations-reports",
  ] as const;
}

export const operationsReportQueryKeys = {
  overview: (scope: ViewerScope, query: OperationsReportQuery = {}) =>
    [
      ...scopedRoot(scope),
      "overview",
      buildOperationsReportQuery(
        query as Readonly<Record<string, QueryValue>>,
      ),
    ] as const,
  root: scopedRoot,
};

export const operationsReportApi = {
  overview: (
    { token }: OperationsReportApiContext,
    query: OperationsReportQuery = {},
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<OperationsReportOverview>(
      "/operations/reports/overview" +
        buildOperationsReportQuery(
          query as Readonly<Record<string, QueryValue>>,
        ),
      {
        cache: "no-store",
        ...(options.signal ? { signal: options.signal } : {}),
        token,
      },
    ),
};
