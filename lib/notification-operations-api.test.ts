import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import {
  adminNotificationEventsApi,
  buildAdminNotificationEventsPath,
  parseAdminNotificationEventsPage,
} from "./notification-operations-api";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiFetch: mocks.apiFetch };
});

const eventId = "64b000000000000000000001";
const tenantId = "64b000000000000000000002";
const sourceId = "64b000000000000000000003";
const sensitivePayload = "student-private-body";

function response(overrides: Record<string, unknown> = {}) {
  return {
    items: [
      {
        _id: eventId,
        availableAt: "2030-08-16T00:05:00.000Z",
        createdAt: "2030-08-16T00:00:00.000Z",
        deadLetteredAt: "2030-08-16T00:04:00.000Z",
        deliveredCount: 0,
        eventId,
        failureCount: 10,
        lastErrorCode: "NOTIFICATION_DELIVERY_FAILED",
        occurredAt: "2030-08-16T00:00:00.000Z",
        payload: { body: sensitivePayload },
        pipeline: "DISPATCH",
        retryToken: "a".repeat(32) + ".b",
        recipientEmail: sensitivePayload,
        sourceId,
        sourceKind: "ASSIGNMENT",
        status: "DEAD_LETTER",
        tenantId,
        type: "ASSIGNMENT_PUBLISHED",
        ...overrides,
      },
    ],
    limit: 20,
    page: 1,
    secret: sensitivePayload,
    total: 1,
  };
}

describe("admin notification events API", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
  });

  it("tạo query ổn định và kiểm tra chặt pagination, tenant, type", () => {
    expect(
      buildAdminNotificationEventsPath({
        limit: 50,
        page: 2,
        tenantId: tenantId.toUpperCase(),
        type: "ASSIGNMENT_PUBLISHED",
      }),
    ).toBe(
      `/admin/notification-events?status=DEAD_LETTER&page=2&limit=50&tenantId=${tenantId}&type=ASSIGNMENT_PUBLISHED`,
    );

    expect(() =>
      buildAdminNotificationEventsPath({ limit: 0, page: 1 }),
    ).toThrow(ApiError);
    expect(() =>
      buildAdminNotificationEventsPath({
        limit: 20,
        page: 1,
        tenantId: "tenant-one",
      }),
    ).toThrow(ApiError);
    expect(() =>
      buildAdminNotificationEventsPath({
        limit: 20,
        page: 101,
      }),
    ).toThrow(ApiError);
  });

  it("allow-list metadata và loại bỏ payload/PII thừa trước khi cache", () => {
    const parsed = parseAdminNotificationEventsPage(response(), {
      limit: 20,
      page: 1,
    });

    expect(parsed.items[0]).toEqual({
      _id: eventId,
      availableAt: "2030-08-16T00:05:00.000Z",
      createdAt: "2030-08-16T00:00:00.000Z",
      deadLetteredAt: "2030-08-16T00:04:00.000Z",
      deliveredCount: 0,
      eventId,
      failureCount: 10,
      lastErrorCode: "NOTIFICATION_DELIVERY_FAILED",
      occurredAt: "2030-08-16T00:00:00.000Z",
      pipeline: "DISPATCH",
      retryToken: "a".repeat(32) + ".b",
      sourceId,
      sourceKind: "ASSIGNMENT",
      status: "DEAD_LETTER",
      tenantId,
      type: "ASSIGNMENT_PUBLISHED",
    });
    expect(JSON.stringify(parsed)).not.toContain(sensitivePayload);
    expect(parsed).not.toHaveProperty("secret");
  });

  it.each([
    response({ _id: "bad-id" }),
    response({ failureCount: -1 }),
    response({ lastErrorCode: "raw database message" }),
    response({ occurredAt: "yesterday" }),
    response({ occurredAt: "2030-02-31T00:00:00.000Z" }),
    response({ pipeline: "PRIVATE_PAYLOAD" }),
    response({ status: "PENDING" }),
    response({ type: "PASSWORD_RESET" }),
    { ...response(), page: 2 },
  ])("từ chối response sai schema hoặc sai snapshot query %#", (payload) => {
    expect(() =>
      parseAdminNotificationEventsPage(payload, { limit: 20, page: 1 }),
    ).toThrowError(
      expect.objectContaining({
        code: "NOTIFICATION_EVENTS_RESPONSE_INVALID",
        status: 502,
      }),
    );
  });

  it("từ chối item lệch tenant hoặc type so với bộ lọc yêu cầu", () => {
    expect(() =>
      parseAdminNotificationEventsPage(response(), {
        limit: 20,
        page: 1,
        tenantId: "64b000000000000000000099",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "NOTIFICATION_EVENTS_RESPONSE_INVALID",
      }),
    );
    expect(() =>
      parseAdminNotificationEventsPage(response(), {
        limit: 20,
        page: 1,
        type: "COURSE_ENROLLED",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "NOTIFICATION_EVENTS_RESPONSE_INVALID",
      }),
    );
  });

  it("GET dùng abort, no-store và no-referrer rồi chỉ trả dữ liệu đã parse", async () => {
    const controller = new AbortController();
    mocks.apiFetch.mockResolvedValue(response());

    const result = await adminNotificationEventsApi.list(
      { signal: controller.signal, token: "platform-token" },
      { limit: 20, page: 1 },
    );

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/admin/notification-events?status=DEAD_LETTER&page=1&limit=20",
      {
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
        token: "platform-token",
      },
    );
    expect(JSON.stringify(result)).not.toContain(sensitivePayload);
  });

  it("POST retry gửi token, reason code và idempotency key, không đưa dữ liệu vào URL", async () => {
    const controller = new AbortController();
    mocks.apiFetch.mockResolvedValue({
      attemptCount: 1,
      completedAt: "2030-08-16T00:06:00.000Z",
      eventId,
      failureCode: null,
      operationId: eventId,
      phase: "SUCCEEDED",
      pipeline: "DISPATCH",
      result: "REQUEUED",
      status: "SUCCEEDED",
      tenantId,
    });

    await expect(
      adminNotificationEventsApi.retry(
        { signal: controller.signal, token: "platform-token" },
        eventId.toUpperCase(),
        "a".repeat(32) + ".b",
        "CONFIGURATION_CORRECTED",
        "retry-key-1",
      ),
    ).resolves.toMatchObject({ status: "SUCCEEDED", operationId: eventId });
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      `/admin/notification-events/${eventId}/retry`,
      {
        body: JSON.stringify({ reasonCode: "CONFIGURATION_CORRECTED", retryToken: "a".repeat(32) + ".b" }),
        cache: "no-store",
        headers: { "Idempotency-Key": "retry-key-1" },
        method: "POST",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
        token: "platform-token",
      },
    );
    expect(mocks.apiFetch.mock.calls[0][0]).not.toContain("Đã kiểm tra");
  });

  it("chặn ID/token/reason sai trước network và fail closed nếu response giả", async () => {
    await expect(
      adminNotificationEventsApi.retry(
        { token: "platform-token" },
        "bad-id",
        "a".repeat(32) + ".b",
        "CONFIGURATION_CORRECTED",
        "retry-key-1",
      ),
    ).rejects.toMatchObject({ code: "NOTIFICATION_EVENT_ID_INVALID" });
    await expect(
      adminNotificationEventsApi.retry(
        { token: "platform-token" },
        eventId,
        "bad-token",
        "CONFIGURATION_CORRECTED",
        "retry-key-1",
      ),
    ).rejects.toMatchObject({ code: "NOTIFICATION_RETRY_TOKEN_INVALID" });
    expect(mocks.apiFetch).not.toHaveBeenCalled();

    mocks.apiFetch.mockResolvedValue({ accepted: "yes" });
    await expect(
      adminNotificationEventsApi.retry(
        { token: "platform-token" },
        eventId,
        "a".repeat(32) + ".b",
        "CONFIGURATION_CORRECTED",
        "retry-key-1",
      ),
    ).rejects.toMatchObject({
      code: "NOTIFICATION_EVENTS_RESPONSE_INVALID",
    });
  });
});
