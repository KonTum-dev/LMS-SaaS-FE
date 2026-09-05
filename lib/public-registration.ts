import { apiFetch, ApiError } from "@/lib/api";
import type { AuthResponse } from "@/lib/types";

export interface PublicRegistrationValues {
  email: string;
  fullName: string;
  password: string;
  workspaceName: string;
  workspaceSlug: string;
}

export interface PublicRegistrationRequest {
  owner: {
    email: string;
    fullName: string;
    password: string;
  };
  workspace: {
    name: string;
    slug: string;
  };
}

export interface RegistrationErrorPresentation {
  description: string;
  title: string;
  type: "error" | "warning";
}

export interface PublicRegistrationAttempt {
  createdAt: number;
  fingerprint: string;
  idempotencyKey: string;
  version: 1;
}

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA_256_PATTERN = /^[0-9a-f]{64}$/;
const REGISTRATION_ATTEMPT_STORAGE_KEY = "dx-lms:public-registration:v1";
export const PUBLIC_REGISTRATION_ATTEMPT_TTL_MS = 24 * 60 * 60 * 1_000;

export function buildPublicRegistrationRequest(
  values: PublicRegistrationValues,
): PublicRegistrationRequest {
  return {
    owner: {
      email: values.email.trim().toLocaleLowerCase("en"),
      fullName: values.fullName.trim(),
      password: values.password,
    },
    workspace: {
      name: values.workspaceName.trim(),
      slug: values.workspaceSlug.trim().toLocaleLowerCase("en"),
    },
  };
}

export function createPublicRegistrationIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    const key = globalThis.crypto.randomUUID().toLowerCase();
    if (UUID_V4_PATTERN.test(key)) return key;
  }
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("Trình duyệt không hỗ trợ tạo khóa đăng ký an toàn");
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export async function publicRegistrationFingerprint(
  input: PublicRegistrationRequest,
): Promise<string> {
  const canonical = JSON.stringify(input);
  if (typeof globalThis.crypto?.subtle?.digest !== "function") {
    // This fallback is kept in memory only; storage helpers reject non-digests.
    return `memory:${canonical}`;
  }
  try {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonical),
    );
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  } catch {
    return `memory:${canonical}`;
  }
}

export function loadPublicRegistrationAttempt(
  fingerprint: string,
  now = Date.now(),
): PublicRegistrationAttempt | null {
  const storage = registrationStorage();
  if (!storage || !SHA_256_PATTERN.test(fingerprint)) return null;
  try {
    const raw = storage.getItem(REGISTRATION_ATTEMPT_STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isPublicRegistrationAttempt(value, now)) {
      storage.removeItem(REGISTRATION_ATTEMPT_STORAGE_KEY);
      return null;
    }
    if (value.fingerprint !== fingerprint) return null;
    return {
      createdAt: value.createdAt,
      fingerprint: value.fingerprint,
      idempotencyKey: value.idempotencyKey.toLowerCase(),
      version: 1,
    };
  } catch {
    try { storage.removeItem(REGISTRATION_ATTEMPT_STORAGE_KEY); } catch { /* Optional recovery only. */ }
    return null;
  }
}

export function rememberPublicRegistrationAttempt(
  attempt: PublicRegistrationAttempt,
): boolean {
  const storage = registrationStorage();
  if (!storage || !isPublicRegistrationAttempt(attempt, Date.now())) {
    return false;
  }
  try {
    storage.setItem(
      REGISTRATION_ATTEMPT_STORAGE_KEY,
      JSON.stringify({ ...attempt, idempotencyKey: attempt.idempotencyKey.toLowerCase() }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearPublicRegistrationAttempt(): void {
  const storage = registrationStorage();
  try { storage?.removeItem(REGISTRATION_ATTEMPT_STORAGE_KEY); } catch { /* In-memory state still clears. */ }
}

function registrationStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try { return window.sessionStorage; } catch { return null; }
}

function isPublicRegistrationAttempt(
  value: unknown,
  now: number,
): value is PublicRegistrationAttempt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const attempt = value as Record<string, unknown>;
  return (
    Object.keys(attempt).sort().join("|") ===
      "createdAt|fingerprint|idempotencyKey|version" &&
    attempt.version === 1 &&
    typeof attempt.createdAt === "number" &&
    Number.isSafeInteger(attempt.createdAt) &&
    attempt.createdAt <= now + 5 * 60 * 1_000 &&
    attempt.createdAt > now - PUBLIC_REGISTRATION_ATTEMPT_TTL_MS &&
    typeof attempt.fingerprint === "string" &&
    SHA_256_PATTERN.test(attempt.fingerprint) &&
    typeof attempt.idempotencyKey === "string" &&
    UUID_V4_PATTERN.test(attempt.idempotencyKey)
  );
}

export function workspaceSlugFromName(name: string): string {
  return name
    .trim()
    .replace(/[đĐ]/g, (character) => (character === "đ" ? "d" : "D"))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

export function registrationErrorPresentation(
  error: unknown,
  t: (source: string, values?: Record<string, string | number>) => string = (source, values) => values ? source.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (token, key) => Object.hasOwn(values, key) ? String(values[key]) : token) : source,
): RegistrationErrorPresentation {
  if (error instanceof ApiError) {
    if (error.code === "SIGNUP_UNAVAILABLE") {
      return {
        description:
          "Hãy kiểm tra lại email và mã workspace, sau đó thay đổi thông tin trước khi thử lại.",
        title: "Không thể dùng thông tin đăng ký này",
        type: "error",
      };
    }
    if (error.code === "SIGNUP_IN_PROGRESS") {
      const retry = error.retryAfterSeconds
        ? t(" sau khoảng {seconds} giây", { seconds: error.retryAfterSeconds })
        : t(" sau ít phút");
      return {
        description: t("Workspace đang được khởi tạo. Giữ nguyên thông tin và thử lại{retry}; hệ thống sẽ không tạo trùng.", { retry }),
        title: "Đăng ký đang được xử lý",
        type: "warning",
      };
    }
    if (error.code === "SIGNUP_RETRYABLE" || error.status === 0) {
      return {
        description:
          "Giữ nguyên biểu mẫu và bấm thử lại. Hệ thống sẽ dùng cùng khóa an toàn để tránh tạo hai workspace.",
        title: "Chưa xác nhận được kết quả đăng ký",
        type: "warning",
      };
    }
    if (error.code === "PUBLIC_SIGNUP_DISABLED") {
      return {
        description:
          "Hệ thống chưa nhận workspace mới vào lúc này. Tài khoản của bạn chưa được tạo; vui lòng quay lại sau.",
        title: "Đăng ký đang tạm đóng",
        type: "warning",
      };
    }
    if (error.status === 429) {
      const retry = error.retryAfterSeconds
        ? t(" Vui lòng chờ {seconds} giây.", { seconds: error.retryAfterSeconds })
        : t(" Vui lòng chờ một lát.");
      return {
        description: t("Có quá nhiều yêu cầu đăng ký.{retry}", { retry }),
        title: "Bạn đang thao tác quá nhanh",
        type: "warning",
      };
    }
    return {
      description: error.message,
      title: "Không thể hoàn tất đăng ký",
      type: "error",
    };
  }
  return {
    description:
      error instanceof Error
        ? error.message
        : "Vui lòng kiểm tra kết nối và thử lại.",
    title: "Không thể hoàn tất đăng ký",
    type: "error",
  };
}

export const publicRegistrationApi = {
  register: (
    input: PublicRegistrationRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ) =>
    apiFetch<AuthResponse>("/auth/register", {
      body: JSON.stringify(input),
      cache: "no-store",
      headers: { "Idempotency-Key": idempotencyKey },
      method: "POST",
      referrerPolicy: "no-referrer",
      signal,
    }),
};
