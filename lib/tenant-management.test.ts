import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildTenantCreatePayload,
  buildTenantSettingsPayload,
  buildTenantUpdatePayload,
  clearTenantProvisioningAttempt,
  createTenantProvisioningIdempotencyKey,
  loadTenantProvisioningAttempt,
  parseTenantProvisioningOperation,
  rememberTenantProvisioningAttempt,
  TENANT_PROVISIONING_ATTEMPT_TTL_MS,
} from "./tenant-management";
import { ALL_LMS_MODULES } from "./entitlements";

const base = {
  adminEmail: " owner@bright.local ",
  adminFullName: " Bright Owner ",
  adminPassword: "Owner@123",
  enabledModules: ["USERS", "COURSES"] as const,
  logoUrl: " ",
  name: " Bright Academy ",
  primaryColor: { toHexString: () => "#176bff" },
  slug: "bright-academy",
};

describe("tenant management payloads", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("gửi thông tin admin đầu tiên khi tạo tenant", () => {
    expect(
      buildTenantCreatePayload({
        ...base,
        enabledModules: [...base.enabledModules],
      }),
    ).toEqual({
      adminEmail: "owner@bright.local",
      adminFullName: "Bright Owner",
      adminPassword: "Owner@123",
      enabledModules: ["USERS", "COURSES"],
      logoUrl: undefined,
      name: "Bright Academy",
      primaryColor: "#176bff",
      slug: "bright-academy",
    });
  });

  it("không làm rò trường admin ẩn từ form tạo sang payload chỉnh sửa", () => {
    expect(
      buildTenantUpdatePayload({
        ...base,
        enabledModules: [...base.enabledModules],
        status: "SUSPENDED",
      }),
    ).toEqual({
      enabledModules: ["USERS", "COURSES"],
      logoUrl: null,
      name: "Bright Academy",
      primaryColor: "#176bff",
      slug: "bright-academy",
      status: "SUSPENDED",
    });
  });

  it("tenant tự cập nhật workspace chỉ gửi nhận diện, không thể gửi module", () => {
    expect(
      buildTenantSettingsPayload({
        logoUrl: " https://cdn.example.com/logo.png ",
        name: " Bright Academy ",
        primaryColor: "#5B5BD6",
      }),
    ).toEqual({
      logoUrl: "https://cdn.example.com/logo.png",
      name: "Bright Academy",
      primaryColor: "#5B5BD6",
    });
  });

  it("tự thêm Khóa học khi cấu hình tenant bật Ghi danh", () => {
    expect(
      buildTenantUpdatePayload({
        ...base,
        enabledModules: ["ENROLLMENTS"],
      }).enabledModules,
    ).toEqual(["COURSES", "ENROLLMENTS"]);
  });

  it("tạo UUID v4 bằng CSPRNG và fail closed khi browser không hỗ trợ", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xab);
        return bytes;
      },
    });
    expect(createTenantProvisioningIdempotencyKey()).toBe(
      "abababab-abab-4bab-abab-abababababab",
    );

    vi.stubGlobal("crypto", undefined);
    expect(() => createTenantProvisioningIdempotencyKey()).toThrow(
      "không hỗ trợ tạo khóa retry an toàn",
    );
  });

  it("chỉ lưu retry key/operation scope trong session và không nhận thêm payload", () => {
    const values = new Map<string, string>();
    const storage = {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: () => null,
      get length() {
        return values.size;
      },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } as Storage;
    vi.stubGlobal("window", { sessionStorage: storage });
    const now = Date.now();
    const attempt = {
      actorId: "platform-admin-1",
      expiresAt: now + TENANT_PROVISIONING_ATTEMPT_TTL_MS,
      idempotencyKey: "abababab-abab-4bab-abab-abababababab",
      operationId: "64b000000000000000000042",
      version: 1 as const,
    };

    expect(rememberTenantProvisioningAttempt(attempt)).toBe(true);
    expect(loadTenantProvisioningAttempt("platform-admin-1", now)).toEqual(
      attempt,
    );
    expect([...values.values()].join(" ")).not.toMatch(
      /password|email|token|payload|Owner@123/i,
    );

    const key = [...values.keys()][0];
    storage.setItem(key, JSON.stringify({ ...attempt, adminPassword: "x" }));
    expect(loadTenantProvisioningAttempt("platform-admin-1", now)).toBeNull();
    expect(storage.length).toBe(0);

    expect(rememberTenantProvisioningAttempt(attempt)).toBe(true);
    clearTenantProvisioningAttempt("platform-admin-1");
    expect(storage.length).toBe(0);
  });

  it("chuẩn hóa UUID và ObjectId recovery về chữ thường", () => {
    const values = new Map<string, string>();
    const storage = {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: () => null,
      get length() {
        return values.size;
      },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } as Storage;
    vi.stubGlobal("window", { sessionStorage: storage });
    const now = Date.now();

    expect(
      rememberTenantProvisioningAttempt({
        actorId: "platform-admin-1",
        expiresAt: now + TENANT_PROVISIONING_ATTEMPT_TTL_MS,
        idempotencyKey: "ABABABAB-ABAB-4BAB-ABAB-ABABABABABAB",
        operationId: "64B000000000000000000042",
        version: 1,
      }),
    ).toBe(true);
    expect(
      loadTenantProvisioningAttempt("platform-admin-1", now),
    ).toMatchObject({
      idempotencyKey: "abababab-abab-4bab-abab-abababababab",
      operationId: "64b000000000000000000042",
    });
  });

  it.each([
    [
      "hết hạn",
      (attempt: Record<string, unknown>, now: number) => ({
        ...attempt,
        expiresAt: now - 1,
      }),
    ],
    [
      "quá xa tương lai",
      (attempt: Record<string, unknown>, now: number) => ({
        ...attempt,
        expiresAt:
          now + TENANT_PROVISIONING_ATTEMPT_TTL_MS + 5 * 60 * 1_000 + 1,
      }),
    ],
    [
      "sai actor",
      (attempt: Record<string, unknown>) => ({
        ...attempt,
        actorId: "other-admin",
      }),
    ],
    [
      "UUID không phải v4",
      (attempt: Record<string, unknown>) => ({
        ...attempt,
        idempotencyKey: "abababab-abab-5bab-abab-abababababab",
      }),
    ],
    [
      "operation ID không hợp lệ",
      (attempt: Record<string, unknown>) => ({
        ...attempt,
        operationId: "unsafe",
      }),
    ],
    [
      "field thừa",
      (attempt: Record<string, unknown>) => ({
        ...attempt,
        payload: { adminPassword: "secret" },
      }),
    ],
  ])("xóa recovery %s theo hướng fail-closed", (_label, mutate) => {
    const values = new Map<string, string>();
    const storage = {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: () => null,
      get length() {
        return values.size;
      },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } as Storage;
    vi.stubGlobal("window", { sessionStorage: storage });
    const now = Date.now();
    const attempt = {
      actorId: "platform-admin-1",
      expiresAt: now + TENANT_PROVISIONING_ATTEMPT_TTL_MS,
      idempotencyKey: "abababab-abab-4bab-abab-abababababab",
      operationId: "64b000000000000000000042",
      version: 1,
    };
    storage.setItem(
      "lms:tenant-provisioning-attempt:v1",
      JSON.stringify(mutate(attempt, now)),
    );

    expect(loadTenantProvisioningAttempt("platform-admin-1", now)).toBeNull();
    expect(storage.length).toBe(0);
  });

  it("chỉ chấp nhận success envelope có organization đầy đủ", () => {
    const success = {
      attemptCount: 1,
      completedAt: "2030-01-02T03:04:05.000Z",
      operationId: "64b000000000000000000042",
      organization: {
        _id: "64b000000000000000000043",
        enabledModules: ["USERS", "COURSES"],
        logoUrl: null,
        name: "Bright Academy",
        primaryColor: "#176BFF",
        slug: "bright-academy",
        status: "ACTIVE",
      },
      phase: "SUCCEEDED",
      status: "SUCCEEDED",
    };

    expect(parseTenantProvisioningOperation(success)).toEqual(success);
    expect(
      parseTenantProvisioningOperation({
        ...success,
        internalMarker: "must-not-leak",
        organization: {
          ...success.organization,
          updatedAt: "2030-01-02T03:04:05.000Z",
        },
      }),
    ).toEqual(success);
    expect(() =>
      parseTenantProvisioningOperation({ ...success, organization: null }),
    ).toThrow("trạng thái tạo tenant không hợp lệ");
    expect(() =>
      parseTenantProvisioningOperation({
        ...success,
        phase: "MEMBERSHIP_CREATED",
      }),
    ).toThrow("trạng thái tạo tenant không hợp lệ");
    expect(() =>
      parseTenantProvisioningOperation({
        ...success,
        attemptCount: 1.5,
      }),
    ).toThrow("trạng thái tạo tenant không hợp lệ");
    expect(() =>
      parseTenantProvisioningOperation({
        ...success,
        organization: {
          ...success.organization,
          logoUrl: "javascript:alert(1)",
        },
      }),
    ).toThrow("trạng thái tạo tenant không hợp lệ");
    expect(() =>
      parseTenantProvisioningOperation({
        ...success,
        organization: { ...success.organization, name: "a".repeat(161) },
      }),
    ).toThrow("trạng thái tạo tenant không hợp lệ");
    expect(() =>
      parseTenantProvisioningOperation({
        ...success,
        organization: { ...success.organization, slug: "a".repeat(101) },
      }),
    ).toThrow("trạng thái tạo tenant không hợp lệ");
    const logoPrefix = "https://cdn.example.test/";
    expect(
      parseTenantProvisioningOperation({
        ...success,
        organization: {
          ...success.organization,
          logoUrl: `${logoPrefix}${"a".repeat(2048 - logoPrefix.length)}`,
          name: "a".repeat(160),
        },
      }).organization,
    ).toMatchObject({ name: "a".repeat(160) });
    expect(() =>
      parseTenantProvisioningOperation({
        ...success,
        organization: {
          ...success.organization,
          logoUrl: `${logoPrefix}${"a".repeat(2049 - logoPrefix.length)}`,
        },
      }),
    ).toThrow("trạng thái tạo tenant không hợp lệ");
    expect(() =>
      parseTenantProvisioningOperation({
        ...success,
        organization: {
          ...success.organization,
          enabledModules: ["ASSIGNMENTS"],
        },
      }),
    ).toThrow("trạng thái tạo tenant không hợp lệ");
  });

  it("chấp nhận organization đã bật đủ 12 module hiện hành", () => {
    const success = {
      attemptCount: 1,
      completedAt: "2030-01-02T03:04:05.000Z",
      operationId: "64b000000000000000000042",
      organization: {
        _id: "64b000000000000000000043",
        enabledModules: [...ALL_LMS_MODULES],
        logoUrl: null,
        name: "Bright Academy",
        primaryColor: "#176BFF",
        slug: "bright-academy",
        status: "ACTIVE",
      },
      phase: "SUCCEEDED",
      status: "SUCCEEDED",
    } as const;

    expect(parseTenantProvisioningOperation(success).organization).toMatchObject({
      enabledModules: [...ALL_LMS_MODULES],
    });
    expect(ALL_LMS_MODULES).toHaveLength(12);
  });

  it("validate chặt trạng thái PENDING và FAILED", () => {
    const pending = {
      attemptCount: 2,
      operationId: "64b000000000000000000042",
      organization: null,
      phase: "IDENTITY_CREATED",
      status: "PENDING",
    };
    const failed = {
      ...pending,
      completedAt: "2030-01-02T03:04:05.000Z",
      failureCode: "ADMIN_EMAIL_CONFLICT",
      status: "FAILED",
    };

    expect(parseTenantProvisioningOperation(pending)).toEqual(pending);
    expect(parseTenantProvisioningOperation(failed)).toEqual(failed);
    expect(() =>
      parseTenantProvisioningOperation({
        ...pending,
        completedAt: "2030-01-02T03:04:05.000Z",
      }),
    ).toThrow("trạng thái tạo tenant không hợp lệ");
    expect(() =>
      parseTenantProvisioningOperation({
        ...failed,
        phase: "SUCCEEDED",
      }),
    ).toThrow("trạng thái tạo tenant không hợp lệ");
  });
});
