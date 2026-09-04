import { ApiError, apiFetch } from "@/lib/api";

const GOOGLE_DRIVE_MUTATION_TIMEOUT_MS = 120_000;

export type GoogleDriveConnectionState =
  | "CONNECTED"
  | "DISCONNECTED"
  | "REAUTH_REQUIRED";
export type GoogleDriveSyncState =
  | "FAILED"
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED";

export interface GoogleDriveFile {
  name: string;
  url: string | null;
}

export interface GoogleDriveLastSync {
  completedAt: string | null;
  file: GoogleDriveFile | null;
  state: GoogleDriveSyncState;
}

export interface GoogleDriveStatus {
  accountEmail: string | null;
  connectedAt: string | null;
  lastSync: GoogleDriveLastSync | null;
  state: GoogleDriveConnectionState;
  syncInProgress: boolean;
}

interface AuthenticatedContext {
  token: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNullableTimestamp(
  value: unknown,
  fieldPresent: boolean,
): string | null | undefined {
  if (!fieldPresent || value === null) return null;
  if (
    typeof value === "string" &&
    value.length <= 64 &&
    Number.isFinite(Date.parse(value))
  ) {
    return value;
  }
  return undefined;
}

function parseNullableEmail(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (
    typeof value === "string" &&
    value.length <= 320 &&
    value === value.trim() &&
    value.includes("@")
  ) {
    return value;
  }
  return undefined;
}

export function parseGoogleDriveAuthorizationUrl(value: unknown): string {
  if (!isRecord(value) || typeof value.authorizationUrl !== "string") {
    throw new ApiError(
      "Máy chủ trả liên kết Google Drive không hợp lệ",
      502,
      "GOOGLE_DRIVE_AUTHORIZATION_URL_INVALID",
    );
  }
  try {
    const url = new URL(value.authorizationUrl);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "accounts.google.com" ||
      url.port ||
      url.username ||
      url.password ||
      url.hash ||
      url.pathname !== "/o/oauth2/v2/auth"
    ) {
      throw new Error("Unexpected Google OAuth URL");
    }
    return url.toString();
  } catch {
    throw new ApiError(
      "Máy chủ trả liên kết Google Drive không hợp lệ",
      502,
      "GOOGLE_DRIVE_AUTHORIZATION_URL_INVALID",
    );
  }
}

export function navigateToGoogleDriveAuthorization(
  authorizationUrl: string,
): void {
  const safeUrl = parseGoogleDriveAuthorizationUrl({ authorizationUrl });
  window.location.assign(safeUrl);
}

export function isSafeGoogleDriveFileUrl(value: string): boolean {
  if (!value || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "drive.google.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function parseFile(value: unknown): GoogleDriveFile | null | undefined {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) return undefined;
  const name = value.name ?? value.fileName;
  const id = value.id;
  const rawUrl = value.url ?? value.webViewLink;
  if (
    typeof id !== "string" ||
    !id.trim() ||
    id.length > 512 ||
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 255 ||
    (rawUrl !== null && rawUrl !== undefined && typeof rawUrl !== "string")
  ) {
    return undefined;
  }
  const url =
    typeof rawUrl === "string" && isSafeGoogleDriveFileUrl(rawUrl)
      ? rawUrl
      : null;
  return { name: name.trim(), url };
}

function parseLastSync(value: unknown): GoogleDriveLastSync | null | undefined {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) return undefined;
  const state = value.state ?? value.status;
  if (
    state !== "FAILED" &&
    state !== "QUEUED" &&
    state !== "RUNNING" &&
    state !== "SUCCEEDED"
  ) {
    return undefined;
  }
  const completedAt = parseNullableTimestamp(
    value.completedAt ?? value.syncedAt,
    "completedAt" in value || "syncedAt" in value,
  );
  const file = parseFile(value.file);
  if (completedAt === undefined || file === undefined) return undefined;
  return { completedAt, file, state };
}

export function parseGoogleDriveStatus(value: unknown): GoogleDriveStatus {
  if (!isRecord(value)) {
    throw new ApiError(
      "Máy chủ trả trạng thái Google Drive không hợp lệ",
      502,
      "GOOGLE_DRIVE_STATUS_INVALID",
    );
  }

  let state = value.state ?? value.status;
  if (state === undefined && typeof value.connected === "boolean") {
    state = value.connected ? "CONNECTED" : "DISCONNECTED";
  }
  if (
    state !== "CONNECTED" &&
    state !== "DISCONNECTED" &&
    state !== "REAUTH_REQUIRED"
  ) {
    throw new ApiError(
      "Máy chủ trả trạng thái Google Drive không hợp lệ",
      502,
      "GOOGLE_DRIVE_STATUS_INVALID",
    );
  }

  const accountEmail = parseNullableEmail(
    value.accountEmail ?? value.linkedEmail ?? value.googleEmail ?? value.email,
  );
  const connectedAt = parseNullableTimestamp(
    value.connectedAt,
    "connectedAt" in value,
  );
  let lastSync = parseLastSync(value.lastSync);
  if (lastSync === null && ("lastSyncedAt" in value || "file" in value)) {
    if (value.lastSyncedAt === null && value.file === null) {
      lastSync = null;
    } else {
      lastSync = parseLastSync({
        completedAt: value.lastSyncedAt,
        file: value.file,
        state: "SUCCEEDED",
      });
    }
  }
  const syncInProgress = value.syncInProgress;
  if (
    accountEmail === undefined ||
    connectedAt === undefined ||
    lastSync === undefined ||
    typeof syncInProgress !== "boolean"
  ) {
    throw new ApiError(
      "Máy chủ trả trạng thái Google Drive không hợp lệ",
      502,
      "GOOGLE_DRIVE_STATUS_INVALID",
    );
  }

  return { accountEmail, connectedAt, lastSync, state, syncInProgress };
}

export function googleDriveErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "GOOGLE_DRIVE_REAUTH_REQUIRED":
      case "GOOGLE_DRIVE_CREDENTIAL_REVOKED":
        return "Quyền Google Drive đã hết hiệu lực. Hãy kết nối lại để tiếp tục sao lưu.";
      case "GOOGLE_DRIVE_SYNC_IN_PROGRESS":
        return "Một bản sao lưu đang được xử lý. Vui lòng đợi hoàn tất.";
      case "GOOGLE_DRIVE_NOT_CONNECTED":
        return "Hãy kết nối Google Drive trước khi sao lưu.";
      case "CURRENT_PASSWORD_INVALID":
        return "Mật khẩu hiện tại không đúng.";
      case "GOOGLE_DRIVE_QUOTA_EXCEEDED":
        return "Google Drive không còn đủ dung lượng để tạo bản sao lưu.";
      case "GOOGLE_DRIVE_DISABLED":
        return "Sao lưu Google Drive hiện chưa được bật cho môi trường này.";
    }
  }
  return "Không thể hoàn tất yêu cầu Google Drive lúc này. Vui lòng thử lại.";
}

export const googleDriveApi = {
  getStatus: async (
    { token }: AuthenticatedContext,
    signal?: AbortSignal,
  ): Promise<GoogleDriveStatus> =>
    parseGoogleDriveStatus(
      await apiFetch<unknown>("/integrations/google-drive", {
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal,
        token,
      }),
    ),

  connect: async (
    { token }: AuthenticatedContext,
    currentPassword: string,
  ): Promise<string> => {
    if (!currentPassword) {
      throw new ApiError(
        "Nhập mật khẩu hiện tại",
        400,
        "CURRENT_PASSWORD_REQUIRED",
      );
    }
    return parseGoogleDriveAuthorizationUrl(
      await apiFetch<unknown>("/integrations/google-drive/connect", {
        body: JSON.stringify({ currentPassword }),
        cache: "no-store",
        credentials: "include",
        method: "POST",
        referrerPolicy: "no-referrer",
        token,
      }),
    );
  },

  sync: async ({ token }: AuthenticatedContext): Promise<GoogleDriveStatus> =>
    parseGoogleDriveStatus(
      await apiFetch<unknown>("/integrations/google-drive/sync", {
        cache: "no-store",
        method: "POST",
        referrerPolicy: "no-referrer",
        timeoutMs: GOOGLE_DRIVE_MUTATION_TIMEOUT_MS,
        token,
      }),
    ),

  disconnect: async (
    { token }: AuthenticatedContext,
    currentPassword: string,
  ): Promise<void> => {
    if (!currentPassword) {
      throw new ApiError(
        "Nhập mật khẩu hiện tại",
        400,
        "CURRENT_PASSWORD_REQUIRED",
      );
    }
    await apiFetch<unknown>("/integrations/google-drive", {
      body: JSON.stringify({ currentPassword }),
      cache: "no-store",
      method: "DELETE",
      referrerPolicy: "no-referrer",
      timeoutMs: GOOGLE_DRIVE_MUTATION_TIMEOUT_MS,
      token,
    });
  },
};
