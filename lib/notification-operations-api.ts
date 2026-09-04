import { ApiError, apiFetch } from "@/lib/api";
import type { NotificationType } from "@/lib/types";

export const notificationEventTypes = [
  "COURSE_ENROLLED",
  "COURSE_WITHDRAWN",
  "ASSIGNMENT_PUBLISHED",
  "SUBMISSION_RETURNED",
  "SUBMISSION_GRADED",
] as const satisfies readonly NotificationType[];

export const notificationSourceKinds = [
  "ENROLLMENT",
  "ASSIGNMENT",
  "SUBMISSION",
] as const;

export type NotificationEventPipeline = "DISPATCH" | "SOURCE_RELAY";
export type NotificationSourceKind = (typeof notificationSourceKinds)[number];
export const notificationRetryReasonCodes = [
  "CONFIGURATION_CORRECTED",
  "DATA_RECONCILED",
  "DEPENDENCY_RECOVERED",
  "TRANSIENT_FAILURE_RESOLVED",
] as const;
export type NotificationRetryReasonCode =
  (typeof notificationRetryReasonCodes)[number];

export interface AdminNotificationEvent {
  _id: string;
  availableAt: string | null;
  createdAt: string;
  deadLetteredAt: string | null;
  deliveredCount: number;
  eventId: string;
  failureCount: number;
  lastErrorCode: string | null;
  occurredAt: string;
  pipeline: NotificationEventPipeline;
  retryToken: string;
  sourceId: string;
  sourceKind: NotificationSourceKind;
  status: "DEAD_LETTER";
  tenantId: string;
  type: NotificationType;
}

export interface AdminNotificationEventsPage {
  items: AdminNotificationEvent[];
  limit: number;
  page: number;
  total: number;
}

export interface AdminNotificationEventsQuery {
  limit: number;
  page: number;
  tenantId?: string;
  type?: NotificationType;
}

interface AdminNotificationEventsContext {
  signal?: AbortSignal;
  token: string;
}

const OBJECT_ID = /^[a-f\d]{24}$/i;
const ERROR_CODE = /^[A-Z][A-Z0-9_]{1,127}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const EVENT_TYPE_SET = new Set<string>(notificationEventTypes);
const SOURCE_KIND_SET = new Set<string>(notificationSourceKinds);
const PIPELINE_SET = new Set<string>(["DISPATCH", "SOURCE_RELAY"]);
const RETRY_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const RETRY_REASON_SET = new Set<string>(notificationRetryReasonCodes);
const OPERATION_STATUS_SET = new Set<string>([
  "FAILED",
  "PENDING",
  "SUCCEEDED",
]);
const OPERATION_PHASE_SET = new Set<string>([
  "RESERVED",
  "TARGET_CLAIMED",
  "TARGET_REQUEUED",
  "SUCCEEDED",
]);

function invalidResponse(): never {
  throw new ApiError(
    "Máy chủ trả metadata sự kiện thông báo không hợp lệ",
    502,
    "NOTIFICATION_EVENTS_RESPONSE_INVALID",
  );
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalidResponse();
  }
  return value as Record<string, unknown>;
}

function objectId(value: unknown): string {
  if (typeof value !== "string" || !OBJECT_ID.test(value)) {
    return invalidResponse();
  }
  return value.toLowerCase();
}

function integer(
  value: unknown,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < minimum ||
    Number(value) > maximum
  ) {
    return invalidResponse();
  }
  return Number(value);
}

function dateTime(value: unknown, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || !ISO_UTC.test(value)) {
    return invalidResponse();
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    return invalidResponse();
  }
  return value;
}

function enumValue<T extends string>(value: unknown, values: Set<string>): T {
  if (typeof value !== "string" || !values.has(value)) return invalidResponse();
  return value as T;
}

function parseItem(value: unknown): AdminNotificationEvent {
  const candidate = record(value);
  const status = candidate.status;
  if (status !== "DEAD_LETTER") return invalidResponse();
  const lastErrorCode = candidate.lastErrorCode;
  if (
    lastErrorCode !== null &&
    (typeof lastErrorCode !== "string" || !ERROR_CODE.test(lastErrorCode))
  ) {
    return invalidResponse();
  }

  // Build a new allow-listed object so accidental backend payload fields never
  // enter React Query's cache or the rendered operator surface.
  return {
    _id: objectId(candidate._id),
    availableAt: dateTime(candidate.availableAt, true),
    createdAt: dateTime(candidate.createdAt) as string,
    deadLetteredAt: dateTime(candidate.deadLetteredAt, true),
    deliveredCount: integer(candidate.deliveredCount, 0),
    eventId: objectId(candidate.eventId),
    failureCount: integer(candidate.failureCount, 0),
    lastErrorCode,
    occurredAt: dateTime(candidate.occurredAt) as string,
    pipeline: enumValue<NotificationEventPipeline>(
      candidate.pipeline,
      PIPELINE_SET,
    ),
    retryToken:
      typeof candidate.retryToken === "string" &&
      candidate.retryToken.length >= 32 &&
      candidate.retryToken.length <= 2048 &&
      RETRY_TOKEN.test(candidate.retryToken)
        ? candidate.retryToken
        : invalidResponse(),
    sourceId: objectId(candidate.sourceId),
    sourceKind: enumValue<NotificationSourceKind>(
      candidate.sourceKind,
      SOURCE_KIND_SET,
    ),
    status,
    tenantId: objectId(candidate.tenantId),
    type: enumValue<NotificationType>(candidate.type, EVENT_TYPE_SET),
  };
}

export interface AdminNotificationRetryOperation {
  attemptCount: number;
  completedAt: string | null;
  eventId: string;
  failureCode: string | null;
  operationId: string;
  phase: "RESERVED" | "TARGET_CLAIMED" | "TARGET_REQUEUED" | "SUCCEEDED";
  pipeline: NotificationEventPipeline;
  result: "REQUEUED" | null;
  status: "FAILED" | "PENDING" | "SUCCEEDED";
  tenantId: string;
}

function parseRetryOperation(value: unknown): AdminNotificationRetryOperation {
  const candidate = record(value);
  const status = enumValue<AdminNotificationRetryOperation["status"]>(
    candidate.status,
    OPERATION_STATUS_SET,
  );
  const phase = enumValue<AdminNotificationRetryOperation["phase"]>(
    candidate.phase,
    OPERATION_PHASE_SET,
  );
  const result =
    candidate.result === null
      ? null
      : candidate.result === "REQUEUED"
        ? "REQUEUED"
        : invalidResponse();
  const failureCode =
    candidate.failureCode === null
      ? null
      : typeof candidate.failureCode === "string" &&
          /^[A-Z][A-Z0-9_]{1,63}$/.test(candidate.failureCode)
        ? candidate.failureCode
        : invalidResponse();
  const completedAt = dateTime(candidate.completedAt, true);
  if (
    status === "SUCCEEDED" &&
    (phase !== "SUCCEEDED" ||
      result !== "REQUEUED" ||
      !completedAt ||
      failureCode !== null)
  )
    return invalidResponse();
  if (status === "FAILED" && (!completedAt || !failureCode || result !== null))
    return invalidResponse();
  if (
    status === "PENDING" &&
    (phase === "SUCCEEDED" ||
      result !== null ||
      failureCode !== null ||
      completedAt !== null)
  )
    return invalidResponse();
  return {
    attemptCount: integer(candidate.attemptCount, 0),
    completedAt,
    eventId: objectId(candidate.eventId),
    failureCode,
    operationId: objectId(candidate.operationId),
    phase,
    pipeline: enumValue<NotificationEventPipeline>(
      candidate.pipeline,
      PIPELINE_SET,
    ),
    result,
    status,
    tenantId: objectId(candidate.tenantId),
  };
}

export function parseAdminNotificationEventsPage(
  value: unknown,
  expected?: AdminNotificationEventsQuery,
): AdminNotificationEventsPage {
  const candidate = record(value);
  if (!Array.isArray(candidate.items)) return invalidResponse();
  const page = integer(candidate.page, 1, 100);
  const limit = integer(candidate.limit, 1, 100);
  const total = integer(candidate.total, 0);
  if (
    candidate.items.length > limit ||
    (expected && (page !== expected.page || limit !== expected.limit))
  ) {
    return invalidResponse();
  }
  const items = candidate.items.map(parseItem);
  if (
    expected?.tenantId &&
    items.some((item) => item.tenantId !== expected.tenantId?.toLowerCase())
  ) {
    return invalidResponse();
  }
  if (expected?.type && items.some((item) => item.type !== expected.type)) {
    return invalidResponse();
  }
  return {
    items,
    limit,
    page,
    total,
  };
}

function validateQuery(query: AdminNotificationEventsQuery) {
  if (!Number.isSafeInteger(query.page) || query.page < 1 || query.page > 100) {
    throw new ApiError(
      "Trang sự kiện phải từ 1 đến 100",
      400,
      "NOTIFICATION_EVENTS_PAGE_INVALID",
    );
  }
  if (
    !Number.isSafeInteger(query.limit) ||
    query.limit < 1 ||
    query.limit > 100
  ) {
    throw new ApiError(
      "Số sự kiện mỗi trang phải từ 1 đến 100",
      400,
      "NOTIFICATION_EVENTS_LIMIT_INVALID",
    );
  }
  if (query.tenantId && !OBJECT_ID.test(query.tenantId)) {
    throw new ApiError(
      "Mã tổ chức phải là ObjectId gồm 24 ký tự hex",
      400,
      "NOTIFICATION_EVENTS_TENANT_ID_INVALID",
    );
  }
  if (query.type && !EVENT_TYPE_SET.has(query.type)) {
    throw new ApiError(
      "Loại sự kiện thông báo không hợp lệ",
      400,
      "NOTIFICATION_EVENTS_TYPE_INVALID",
    );
  }
}

export function buildAdminNotificationEventsPath(
  query: AdminNotificationEventsQuery,
): string {
  validateQuery(query);
  const params = new URLSearchParams({
    status: "DEAD_LETTER",
    page: String(query.page),
    limit: String(query.limit),
  });
  if (query.tenantId) params.set("tenantId", query.tenantId.toLowerCase());
  if (query.type) params.set("type", query.type);
  return `/admin/notification-events?${params.toString()}`;
}

function privateOptions(
  { signal, token }: AdminNotificationEventsContext,
  request: RequestInit = {},
): RequestInit & { token: string } {
  return {
    ...request,
    cache: "no-store",
    referrerPolicy: "no-referrer",
    ...(signal ? { signal } : {}),
    token,
  };
}

export const adminNotificationEventsApi = {
  list: async (
    context: AdminNotificationEventsContext,
    query: AdminNotificationEventsQuery,
  ) => {
    const response = await apiFetch<unknown>(
      buildAdminNotificationEventsPath(query),
      privateOptions(context),
    );
    return parseAdminNotificationEventsPage(response, query);
  },

  retry: async (
    context: AdminNotificationEventsContext,
    eventId: string,
    retryToken: string,
    reasonCode: NotificationRetryReasonCode,
    idempotencyKey: string,
  ): Promise<AdminNotificationRetryOperation> => {
    if (!OBJECT_ID.test(eventId)) {
      throw new ApiError(
        "Mã sự kiện thông báo không hợp lệ",
        400,
        "NOTIFICATION_EVENT_ID_INVALID",
      );
    }
    if (
      typeof retryToken !== "string" ||
      retryToken.length < 32 ||
      retryToken.length > 2048 ||
      !RETRY_TOKEN.test(retryToken)
    ) {
      throw new ApiError(
        "Retry token không hợp lệ",
        400,
        "NOTIFICATION_RETRY_TOKEN_INVALID",
      );
    }
    if (!RETRY_REASON_SET.has(reasonCode)) {
      throw new ApiError(
        "Mã lý do retry không hợp lệ",
        400,
        "NOTIFICATION_RETRY_REASON_INVALID",
      );
    }
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      throw new ApiError(
        "Idempotency-Key không hợp lệ",
        400,
        "IDEMPOTENCY_KEY_INVALID",
      );
    }
    const response = await apiFetch<unknown>(
      `/admin/notification-events/${eventId.toLowerCase()}/retry`,
      privateOptions(context, {
        body: JSON.stringify({ reasonCode, retryToken }),
        headers: { "Idempotency-Key": idempotencyKey },
        method: "POST",
      }),
    );
    return parseRetryOperation(response);
  },

  getRetryOperation: async (
    context: AdminNotificationEventsContext,
    operationId: string,
  ): Promise<AdminNotificationRetryOperation> => {
    if (!OBJECT_ID.test(operationId))
      throw new ApiError(
        "Mã operation không hợp lệ",
        400,
        "NOTIFICATION_OPERATION_ID_INVALID",
      );
    const response = await apiFetch<unknown>(
      `/admin/notification-events/retries/${operationId.toLowerCase()}`,
      privateOptions(context),
    );
    return parseRetryOperation(response);
  },
};
