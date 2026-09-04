import { ApiError, apiFetch, apiRequestUrl } from "@/lib/api";
import type { Organization } from "@/lib/types";

export const PROFILE_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export interface AccountProfile {
  avatarUrl: string | null;
  email: string;
  fullName: string;
  sub: string;
}

interface UploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validPublicAssetUrl(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const parsed = new URL(value);
    const apiUrl = new URL(apiRequestUrl(""));
    const publicAssetPrefix = `${apiUrl.pathname.replace(/\/+$/u, "")}/public-assets/`;
    const host = parsed.hostname.toLowerCase();
    const localHost =
      host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    const safeProtocol =
      parsed.protocol === "https:" ||
      (process.env.NODE_ENV !== "production" &&
        parsed.protocol === "http:" &&
        localHost);
    return (
      safeProtocol &&
      !parsed.username &&
      !parsed.password &&
      parsed.origin === apiUrl.origin &&
      !parsed.search &&
      !parsed.hash &&
      parsed.pathname.startsWith(publicAssetPrefix) &&
      /^[0-9a-f]{64}$/u.test(parsed.pathname.slice(publicAssetPrefix.length))
    );
  } catch {
    return false;
  }
}

export function parseAccountProfile(value: unknown): AccountProfile {
  if (
    !isRecord(value) ||
    typeof value.sub !== "string" ||
    !/^[0-9a-f]{24}$/iu.test(value.sub) ||
    typeof value.email !== "string" ||
    !value.email.trim() ||
    typeof value.fullName !== "string" ||
    !value.fullName.trim() ||
    value.fullName.length > 160 ||
    !validPublicAssetUrl(value.avatarUrl)
  ) {
    throw new ApiError(
      "Máy chủ trả dữ liệu hồ sơ không hợp lệ",
      502,
      "PROFILE_RESPONSE_INVALID",
    );
  }
  return {
    avatarUrl: value.avatarUrl,
    email: value.email,
    fullName: value.fullName,
    sub: value.sub.toLowerCase(),
  };
}

export function validateProfileImage(file: File): string | null {
  if (
    !PROFILE_IMAGE_CONTENT_TYPES.includes(
      file.type as (typeof PROFILE_IMAGE_CONTENT_TYPES)[number],
    )
  ) {
    return "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.";
  }
  if (file.size < 1) return "Tệp ảnh đang trống.";
  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    return "Ảnh không được vượt quá 5 MiB.";
  }
  return null;
}

function readApiError(xhr: XMLHttpRequest): ApiError {
  let message = "Không thể hoàn tất yêu cầu";
  let code: string | undefined;
  try {
    const payload: unknown = JSON.parse(xhr.responseText);
    if (isRecord(payload)) {
      message = Array.isArray(payload.message)
        ? payload.message
            .filter((item): item is string => typeof item === "string")
            .join(". ") || message
        : typeof payload.message === "string"
          ? payload.message
          : message;
      code =
        typeof payload.code === "string" &&
        /^[A-Z][A-Z0-9_]{1,63}$/u.test(payload.code)
          ? payload.code
          : undefined;
    }
  } catch {
    // Keep the generic message when the response is not trusted JSON.
  }
  return new ApiError(message, xhr.status, code);
}

function uploadImage<T>(
  path: string,
  token: string,
  file: File,
  parse: (value: unknown) => T,
  { onProgress, signal }: UploadOptions = {},
): Promise<T> {
  const validation = validateProfileImage(file);
  if (validation) return Promise.reject(new Error(validation));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      callback();
    };
    const abort = () => xhr.abort();

    xhr.open("PUT", apiRequestUrl(path));
    xhr.timeout = 30_000;
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total < 1) return;
      onProgress?.(
        Math.min(
          99,
          Math.max(1, Math.round((event.loaded / event.total) * 100)),
        ),
      );
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        if (xhr.status === 401 && typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("auth:expired", { detail: { token } }),
          );
        }
        settle(() => reject(readApiError(xhr)));
        return;
      }
      try {
        const payload: unknown = JSON.parse(xhr.responseText);
        const parsed = parse(payload);
        onProgress?.(100);
        settle(() => resolve(parsed));
      } catch (error) {
        settle(() =>
          reject(
            error instanceof ApiError
              ? error
              : new ApiError("Máy chủ trả dữ liệu không hợp lệ", 502),
          ),
        );
      }
    };
    xhr.onerror = () =>
      settle(() => reject(new ApiError("Không thể kết nối tới máy chủ", 0)));
    xhr.ontimeout = () =>
      settle(() =>
        reject(new ApiError("Máy chủ phản hồi quá lâu, vui lòng thử lại", 0)),
      );
    xhr.onabort = () =>
      settle(() =>
        reject(new ApiError("Đã hủy tải ảnh", 0, "UPLOAD_CANCELLED")),
      );

    if (signal?.aborted) {
      xhr.abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    xhr.send(file);
  });
}

function parseOrganization(value: unknown): Organization {
  if (
    !isRecord(value) ||
    typeof value._id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.slug !== "string" ||
    typeof value.primaryColor !== "string" ||
    !Array.isArray(value.enabledModules) ||
    (value.logoUrl !== null && !validPublicAssetUrl(value.logoUrl))
  ) {
    throw new ApiError(
      "Máy chủ trả dữ liệu tổ chức không hợp lệ",
      502,
      "ORGANIZATION_RESPONSE_INVALID",
    );
  }
  return value as unknown as Organization;
}

export const accountProfileApi = {
  update: async (token: string, fullName: string) =>
    parseAccountProfile(
      await apiFetch<unknown>("/users/me/profile", {
        body: JSON.stringify({ fullName }),
        method: "PATCH",
        token,
      }),
    ),
  uploadAvatar: (token: string, file: File, options?: UploadOptions) =>
    uploadImage("/users/me/avatar", token, file, parseAccountProfile, options),
  removeAvatar: async (token: string) =>
    parseAccountProfile(
      await apiFetch<unknown>("/users/me/avatar", {
        method: "DELETE",
        token,
      }),
    ),
};

export const organizationLogoApi = {
  uploadCurrent: (token: string, file: File, options?: UploadOptions) =>
    uploadImage(
      "/organizations/current/logo",
      token,
      file,
      parseOrganization,
      options,
    ),
  removeCurrent: async (token: string) =>
    parseOrganization(
      await apiFetch<unknown>("/organizations/current/logo", {
        method: "DELETE",
        token,
      }),
    ),
  uploadTenant: (
    token: string,
    tenantId: string,
    file: File,
    options?: UploadOptions,
  ) =>
    uploadImage(
      `/organizations/${encodeURIComponent(tenantId)}/logo`,
      token,
      file,
      parseOrganization,
      options,
    ),
  removeTenant: async (token: string, tenantId: string) =>
    parseOrganization(
      await apiFetch<unknown>(
        `/organizations/${encodeURIComponent(tenantId)}/logo`,
        { method: "DELETE", token },
      ),
    ),
};
