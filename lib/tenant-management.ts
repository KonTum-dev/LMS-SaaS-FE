import type {
  LmsModule,
  Organization,
  OrganizationStatus,
  TenantProvisioningOperation,
  TenantProvisioningPhase,
  TenantProvisioningStatus,
} from "@/lib/types";
import {
  ALL_LMS_MODULES,
  includeLmsModulePrerequisites,
} from "@/lib/entitlements";

export type ColorValue = string | { toHexString: () => string };

export interface TenantFormValues {
  name: string;
  slug: string;
  status?: OrganizationStatus;
  primaryColor: ColorValue;
  enabledModules: LmsModule[];
  adminEmail?: string;
  adminFullName?: string;
  adminPassword?: string;
}

export interface TenantSettingsFormValues {
  name: string;
  primaryColor: ColorValue;
}

export interface TenantProvisioningAttempt {
  actorId: string;
  expiresAt: number;
  idempotencyKey: string;
  operationId?: string;
  version: 1;
}

const TENANT_PROVISIONING_ATTEMPT_STORAGE_KEY =
  "lms:tenant-provisioning-attempt:v1";
export const TENANT_PROVISIONING_ATTEMPT_TTL_MS = 24 * 60 * 60 * 1_000;
const TENANT_PROVISIONING_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

export function normalizeColor(value: ColorValue) {
  return typeof value === "string" ? value : value.toHexString();
}

export function createTenantProvisioningIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("Trình duyệt không hỗ trợ tạo khóa retry an toàn");
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export function loadTenantProvisioningAttempt(
  actorId: string,
  now = Date.now(),
): TenantProvisioningAttempt | null {
  const storage = tenantProvisioningStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(TENANT_PROVISIONING_ATTEMPT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isTenantProvisioningAttempt(parsed, actorId, now)) {
      storage.removeItem(TENANT_PROVISIONING_ATTEMPT_STORAGE_KEY);
      return null;
    }
    return normalizeTenantProvisioningAttempt(parsed);
  } catch {
    try {
      storage.removeItem(TENANT_PROVISIONING_ATTEMPT_STORAGE_KEY);
    } catch {
      // Storage is optional; in-memory retry remains available.
    }
    return null;
  }
}

export function rememberTenantProvisioningAttempt(
  attempt: TenantProvisioningAttempt,
): boolean {
  const storage = tenantProvisioningStorage();
  if (
    !storage ||
    !isTenantProvisioningAttempt(attempt, attempt.actorId, Date.now())
  ) {
    return false;
  }
  try {
    storage.setItem(
      TENANT_PROVISIONING_ATTEMPT_STORAGE_KEY,
      JSON.stringify(normalizeTenantProvisioningAttempt(attempt)),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearTenantProvisioningAttempt(actorId: string): void {
  const storage = tenantProvisioningStorage();
  if (!storage) return;
  try {
    const raw = storage.getItem(TENANT_PROVISIONING_ATTEMPT_STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("actorId" in parsed) ||
      parsed.actorId === actorId
    ) {
      storage.removeItem(TENANT_PROVISIONING_ATTEMPT_STORAGE_KEY);
    }
  } catch {
    try {
      storage.removeItem(TENANT_PROVISIONING_ATTEMPT_STORAGE_KEY);
    } catch {
      // Storage is optional; the caller also clears its in-memory key.
    }
  }
}

function tenantProvisioningStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function normalizeTenantProvisioningAttempt(
  attempt: TenantProvisioningAttempt,
): TenantProvisioningAttempt {
  return {
    actorId: attempt.actorId,
    expiresAt: attempt.expiresAt,
    idempotencyKey: attempt.idempotencyKey.toLowerCase(),
    ...(attempt.operationId
      ? { operationId: attempt.operationId.toLowerCase() }
      : {}),
    version: 1,
  };
}

function isTenantProvisioningAttempt(
  value: unknown,
  actorId: string,
  now: number,
): value is TenantProvisioningAttempt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const expectedKeys = candidate.operationId
    ? ["actorId", "expiresAt", "idempotencyKey", "operationId", "version"]
    : ["actorId", "expiresAt", "idempotencyKey", "version"];
  if (
    Object.keys(candidate).sort().join("|") !== expectedKeys.sort().join("|") ||
    candidate.version !== 1 ||
    candidate.actorId !== actorId ||
    typeof candidate.expiresAt !== "number" ||
    !Number.isSafeInteger(candidate.expiresAt) ||
    candidate.expiresAt <= now ||
    candidate.expiresAt >
      now + TENANT_PROVISIONING_ATTEMPT_TTL_MS + 5 * 60 * 1_000 ||
    typeof candidate.idempotencyKey !== "string" ||
    !TENANT_PROVISIONING_UUID_PATTERN.test(candidate.idempotencyKey) ||
    (candidate.operationId !== undefined &&
      (typeof candidate.operationId !== "string" ||
        !OBJECT_ID_PATTERN.test(candidate.operationId)))
  ) {
    return false;
  }
  return true;
}

export function parseTenantProvisioningOperation(
  value: unknown,
): TenantProvisioningOperation {
  if (!isRecord(value)) throw invalidProvisioningResponse();
  const status = value.status;
  const phase = value.phase;
  const failureCode = value.failureCode;
  const organization = parseProvisionedOrganization(value.organization);
  if (
    typeof value.attemptCount !== "number" ||
    !Number.isSafeInteger(value.attemptCount) ||
    value.attemptCount < 0 ||
    typeof value.operationId !== "string" ||
    !OBJECT_ID_PATTERN.test(value.operationId) ||
    !isProvisioningStatus(status) ||
    !isProvisioningPhase(phase) ||
    (value.completedAt !== undefined && !isIsoDate(value.completedAt)) ||
    (failureCode !== undefined && !isProvisioningFailureCode(failureCode))
  ) {
    throw invalidProvisioningResponse();
  }
  if ((phase === "SUCCEEDED") !== (status === "SUCCEEDED")) {
    throw invalidProvisioningResponse();
  }
  if (
    status === "SUCCEEDED" &&
    (phase !== "SUCCEEDED" ||
      !organization ||
      failureCode !== undefined ||
      !isIsoDate(value.completedAt))
  ) {
    throw invalidProvisioningResponse();
  }
  if (
    status === "FAILED" &&
    (organization !== null ||
      !isProvisioningFailureCode(failureCode) ||
      !isIsoDate(value.completedAt))
  ) {
    throw invalidProvisioningResponse();
  }
  if (
    status === "PENDING" &&
    (organization !== null ||
      failureCode !== undefined ||
      value.completedAt !== undefined ||
      phase === "SUCCEEDED")
  ) {
    throw invalidProvisioningResponse();
  }

  return {
    attemptCount: value.attemptCount,
    ...(typeof value.completedAt === "string"
      ? { completedAt: value.completedAt }
      : {}),
    ...(isProvisioningFailureCode(failureCode) ? { failureCode } : {}),
    operationId: value.operationId.toLowerCase(),
    organization,
    phase,
    status,
  };
}

function parseProvisionedOrganization(value: unknown): Organization | null {
  if (value === null) return null;
  if (!isRecord(value)) throw invalidProvisioningResponse();
  if (
    typeof value._id !== "string" ||
    !OBJECT_ID_PATTERN.test(value._id) ||
    typeof value.name !== "string" ||
    value.name.length < 2 ||
    value.name.length > 160 ||
    typeof value.slug !== "string" ||
    value.slug.length > 100 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) ||
    (value.status !== "ACTIVE" && value.status !== "SUSPENDED") ||
    typeof value.primaryColor !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(value.primaryColor) ||
    (value.logoUrl !== null && !isSafeHttpUrl(value.logoUrl)) ||
    !Array.isArray(value.enabledModules) ||
    value.enabledModules.length < 1 ||
    !value.enabledModules.every(isLmsModule) ||
    new Set(value.enabledModules).size !== value.enabledModules.length ||
    includeLmsModulePrerequisites(value.enabledModules).length !==
      value.enabledModules.length ||
    (value.createdAt !== undefined && !isIsoDate(value.createdAt))
  ) {
    throw invalidProvisioningResponse();
  }
  return {
    _id: value._id.toLowerCase(),
    ...(typeof value.createdAt === "string"
      ? { createdAt: value.createdAt }
      : {}),
    enabledModules: [...value.enabledModules],
    logoUrl: value.logoUrl,
    name: value.name,
    primaryColor: value.primaryColor,
    slug: value.slug,
    status: value.status,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isLmsModule(value: unknown): value is LmsModule {
  return (
    typeof value === "string" && ALL_LMS_MODULES.includes(value as LmsModule)
  );
}

function isProvisioningStatus(
  value: unknown,
): value is TenantProvisioningStatus {
  return value === "PENDING" || value === "SUCCEEDED" || value === "FAILED";
}

function isProvisioningPhase(value: unknown): value is TenantProvisioningPhase {
  return [
    "RESERVED",
    "ORGANIZATION_CREATED",
    "IDENTITY_CREATED",
    "MEMBERSHIP_CREATED",
    "SUCCEEDED",
  ].includes(String(value));
}

function isProvisioningFailureCode(
  value: unknown,
): value is NonNullable<TenantProvisioningOperation["failureCode"]> {
  return [
    "ADMIN_EMAIL_CONFLICT",
    "RESOURCE_INTEGRITY_CONFLICT",
    "TENANT_SLUG_CONFLICT",
  ].includes(String(value));
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    !Number.isNaN(Date.parse(value))
  );
}

function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function invalidProvisioningResponse() {
  return new Error("Máy chủ trả trạng thái tạo tenant không hợp lệ");
}

export function buildTenantCreatePayload(values: TenantFormValues) {
  if (!values.adminEmail || !values.adminFullName || !values.adminPassword) {
    throw new Error("Cần đầy đủ thông tin quản trị viên đầu tiên");
  }

  return {
    adminEmail: values.adminEmail.trim().toLocaleLowerCase("en"),
    adminFullName: values.adminFullName.trim(),
    adminPassword: values.adminPassword,
    enabledModules: includeLmsModulePrerequisites(values.enabledModules),
    name: values.name.trim(),
    primaryColor: normalizeColor(values.primaryColor),
    slug: values.slug.trim(),
  };
}

export function buildTenantUpdatePayload(values: TenantFormValues) {
  return {
    enabledModules: includeLmsModulePrerequisites(values.enabledModules),
    name: values.name.trim(),
    primaryColor: normalizeColor(values.primaryColor),
    slug: values.slug.trim(),
    ...(values.status ? { status: values.status } : {}),
  };
}

export function buildTenantSettingsPayload(values: TenantSettingsFormValues) {
  return {
    name: values.name.trim(),
    primaryColor: normalizeColor(values.primaryColor),
  };
}
