import { ApiError, apiFetch } from "@/lib/api";
import type { UserRole } from "@/lib/types";

export const auditActions = [
  "TENANT_SETTINGS_UPDATED",
  "TENANT_MODULES_UPDATED",
  "TENANT_UPDATED_BY_SUPER_ADMIN",
  "MEMBERSHIP_CREATED",
  "MEMBERSHIP_ROLE_CHANGED",
  "MEMBERSHIP_STATUS_CHANGED",
  "INVITATION_CREATED",
  "INVITATION_RESENT",
  "INVITATION_REVOKED",
] as const;

export const auditTargetTypes = ["TENANT", "MEMBERSHIP", "INVITATION"] as const;

export type AuditAction = (typeof auditActions)[number];
export type AuditOutcome = "NO_CHANGE" | "SUCCEEDED";
export type AuditTargetType = (typeof auditTargetTypes)[number];

export interface AuditActor {
  kind: "PROVIDER" | "SYSTEM" | "USER";
  membershipId?: string;
  role?: UserRole;
  source?: string;
  userId?: string;
}

export interface AuditActionDetails {
  afterModules?: string[];
  afterRole?: UserRole;
  afterStatus?: string;
  beforeModules?: string[];
  beforeRole?: UserRole;
  beforeStatus?: string;
  membershipId?: string;
  revision?: number;
  tenantId?: string;
}

export interface AuditEvent {
  action: AuditAction;
  actor: AuditActor;
  changedFields: string[];
  details: AuditActionDetails;
  eventHash: string;
  id: string;
  keyId: string;
  outcome: AuditOutcome;
  previousHash: string;
  recordedAt: string;
  sequence: number;
  target: { id: string; type: AuditTargetType };
}

export interface AuditSnapshot {
  chainId: string;
  checkpoint: string;
  throughHash: string;
  throughSequence: number;
}

export interface AuditEventsResponse {
  items: AuditEvent[];
  nextCursor: string | null;
  snapshot: AuditSnapshot;
}

export type AuditIntegrityIssueCode =
  | "EVENT_HASH_MISMATCH"
  | "HEAD_MISMATCH"
  | "PREVIOUS_HASH_MISMATCH"
  | "ROLLBACK_OR_DIVERGENCE"
  | "SEQUENCE_GAP"
  | "UNKNOWN_KEY";

export interface AuditIntegrityResponse {
  checkpoint: string | null;
  complete: boolean;
  continuation: string | null;
  headSequence: number;
  issue: { code: AuditIntegrityIssueCode; sequence?: number } | null;
  valid: boolean;
  verifiedFromSequence: number;
  verifiedThroughSequence: number;
}

export type AuditLedgerScope =
  | { kind: "CURRENT_TENANT" }
  | { kind: "PLATFORM_TENANT"; tenantId: string };

export interface AuditEventFilters {
  action?: AuditAction;
  actorId?: string;
  from?: string;
  outcome?: AuditOutcome;
  targetId?: string;
  targetType?: AuditTargetType;
  to?: string;
}

export interface AuditEventsQuery extends AuditEventFilters {
  cursor?: string;
  limit?: number;
}

interface AuditRequestContext {
  token: string;
}

const OBJECT_ID = /^[a-f\d]{24}$/i;

function auditBasePath(scope: AuditLedgerScope): string {
  if (scope.kind === "CURRENT_TENANT") return "/audit";
  if (!OBJECT_ID.test(scope.tenantId)) {
    throw new ApiError("Mã tổ chức không hợp lệ", 400, "TENANT_ID_INVALID");
  }
  return `/admin/audit/tenants/${scope.tenantId}`;
}

function append(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value !== undefined && value !== "") params.set(key, String(value));
}

export function buildAuditEventsPath(
  scope: AuditLedgerScope,
  query: AuditEventsQuery = {},
): string {
  const limit = query.limit ?? 50;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError("Giới hạn sự kiện phải từ 1 đến 100", 400, "AUDIT_LIMIT_INVALID");
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (query.cursor) {
    append(params, "cursor", query.cursor);
  } else {
    append(params, "action", query.action);
    append(params, "actorId", query.actorId?.trim());
    append(params, "from", query.from);
    append(params, "outcome", query.outcome);
    append(params, "targetId", query.targetId?.trim());
    append(params, "targetType", query.targetType);
    append(params, "to", query.to);
  }
  return `${auditBasePath(scope)}/events?${params.toString()}`;
}

export const auditApi = {
  listEvents: (
    { token }: AuditRequestContext,
    scope: AuditLedgerScope,
    query: AuditEventsQuery = {},
  ) => apiFetch<AuditEventsResponse>(buildAuditEventsPath(scope, query), { token }),

  verifyIntegrity: (
    { token }: AuditRequestContext,
    scope: AuditLedgerScope,
    input: { checkpoint?: string; continuation?: string; maxEvents?: number } = {},
  ) => apiFetch<AuditIntegrityResponse>(`${auditBasePath(scope)}/integrity/verify`, {
    body: JSON.stringify(input),
    method: "POST",
    token,
  }),
};
