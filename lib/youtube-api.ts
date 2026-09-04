import { ApiError, apiFetch } from "@/lib/api";

const GOOGLE_OAUTH_PATH = "/o/oauth2/v2/auth";
const YOUTUBE_DISCONNECT_TIMEOUT_MS = 120_000;
const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/u;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type YouTubeConnectionState =
  "CONNECTED" | "DISCONNECTED" | "REAUTH_REQUIRED";
export type YouTubePrivacyStatus = "PRIVATE" | "UNLISTED" | "PUBLIC";
export type YouTubeUploadStatus =
  "FAILED" | "QUEUED" | "RETRY_WAIT" | "SUCCEEDED" | "UPLOADING";

export interface YouTubeChannel {
  id: string;
  title: string;
}

export interface YouTubeIntegrationStatus {
  channel: YouTubeChannel | null;
  connectedAt: string | null;
  state: YouTubeConnectionState;
  uploadEnabled: boolean;
}

export interface YouTubeUploadJob {
  assetId: string;
  attempts: number;
  courseId: string;
  createdAt: string;
  failureCode: string | null;
  failureMessage: string | null;
  jobId: string;
  lessonId: string;
  madeForKids: boolean;
  nextAttemptAt: string | null;
  privacyStatus: YouTubePrivacyStatus;
  status: YouTubeUploadStatus;
  title: string;
  totalBytes: number;
  updatedAt: string;
  uploadedBytes: number;
  videoId: string | null;
  watchUrl: string | null;
}

export interface CreateYouTubeUploadInput {
  assetId: string;
  clientMutationId: string;
  consentAccepted: true;
  courseId: string;
  description?: string;
  lessonId: string;
  madeForKids: boolean;
  privacyStatus: YouTubePrivacyStatus;
  title: string;
}

export interface YouTubeUploadListFilters {
  assetId: string;
  courseId: string;
  lessonId: string;
}

interface AuthenticatedContext {
  token: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    value === value.trim()
  );
}

function nullableTimestamp(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (
    typeof value === "string" &&
    value.length <= 64 &&
    Number.isFinite(Date.parse(value))
  ) {
    return value;
  }
  return undefined;
}

function requiredTimestamp(value: unknown): string | undefined {
  const parsed = nullableTimestamp(value);
  return parsed === null ? undefined : parsed;
}

function nullableBoundedString(
  value: unknown,
  maximum: number,
): string | null | undefined {
  if (value === null) return null;
  return boundedString(value, maximum) ? value : undefined;
}

function invalidStatus(): never {
  throw new ApiError(
    "Máy chủ trả trạng thái YouTube không hợp lệ",
    502,
    "YOUTUBE_STATUS_INVALID",
  );
}

function invalidUploadResponse(): never {
  throw new ApiError(
    "Máy chủ trả trạng thái xuất bản YouTube không hợp lệ",
    502,
    "YOUTUBE_UPLOAD_RESPONSE_INVALID",
  );
}

export function parseYouTubeAuthorizationUrl(value: unknown): string {
  if (!isRecord(value) || typeof value.authorizationUrl !== "string") {
    throw new ApiError(
      "Máy chủ trả liên kết YouTube không hợp lệ",
      502,
      "YOUTUBE_AUTHORIZATION_URL_INVALID",
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
      url.pathname !== GOOGLE_OAUTH_PATH
    ) {
      throw new Error("Unexpected Google OAuth URL");
    }
    return url.toString();
  } catch {
    throw new ApiError(
      "Máy chủ trả liên kết YouTube không hợp lệ",
      502,
      "YOUTUBE_AUTHORIZATION_URL_INVALID",
    );
  }
}

export function navigateToYouTubeAuthorization(authorizationUrl: string): void {
  const safeUrl = parseYouTubeAuthorizationUrl({ authorizationUrl });
  window.location.assign(safeUrl);
}

export function isSafeYouTubeWatchUrl(
  value: string,
  expectedVideoId?: string,
): boolean {
  if (!value || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.port ||
      url.username ||
      url.password ||
      url.hash
    ) {
      return false;
    }
    let videoId: string | null = null;
    if (
      (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") &&
      url.pathname === "/watch"
    ) {
      videoId = url.searchParams.get("v");
    } else if (url.hostname === "youtu.be") {
      const segments = url.pathname.split("/").filter(Boolean);
      videoId = segments.length === 1 ? segments[0] : null;
    }
    return Boolean(
      videoId &&
      YOUTUBE_VIDEO_ID_PATTERN.test(videoId) &&
      (!expectedVideoId || videoId === expectedVideoId),
    );
  } catch {
    return false;
  }
}

export function parseYouTubeStatus(value: unknown): YouTubeIntegrationStatus {
  if (!isRecord(value)) invalidStatus();
  const state = value.status;
  if (
    state !== "CONNECTED" &&
    state !== "DISCONNECTED" &&
    state !== "REAUTH_REQUIRED"
  ) {
    invalidStatus();
  }
  const connectedAt = nullableTimestamp(value.connectedAt);
  if (connectedAt === undefined || typeof value.uploadEnabled !== "boolean") {
    invalidStatus();
  }
  let channel: YouTubeChannel | null;
  if (value.channel === null) {
    channel = null;
  } else if (
    isRecord(value.channel) &&
    boundedString(value.channel.id, 128) &&
    boundedString(value.channel.title, 256)
  ) {
    channel = { id: value.channel.id, title: value.channel.title };
  } else {
    invalidStatus();
  }
  return { channel, connectedAt, state, uploadEnabled: value.uploadEnabled };
}

export function parseYouTubeUploadJob(value: unknown): YouTubeUploadJob {
  if (!isRecord(value)) invalidUploadResponse();
  const status = value.status;
  const privacyStatus = value.privacyStatus;
  const videoId = nullableBoundedString(value.videoId, 64);
  const rawWatchUrl = nullableBoundedString(value.watchUrl, 2_048);
  const failureCode = nullableBoundedString(value.failureCode, 128);
  const failureMessage = nullableBoundedString(value.failureMessage, 1_000);
  const nextAttemptAt = nullableTimestamp(value.nextAttemptAt);
  const createdAt = requiredTimestamp(value.createdAt);
  const updatedAt = requiredTimestamp(value.updatedAt);
  if (
    !boundedString(value.jobId, 128) ||
    !boundedString(value.courseId, 128) ||
    !boundedString(value.lessonId, 128) ||
    !boundedString(value.assetId, 128) ||
    (status !== "QUEUED" &&
      status !== "RETRY_WAIT" &&
      status !== "UPLOADING" &&
      status !== "SUCCEEDED" &&
      status !== "FAILED") ||
    (privacyStatus !== "PRIVATE" &&
      privacyStatus !== "UNLISTED" &&
      privacyStatus !== "PUBLIC") ||
    typeof value.madeForKids !== "boolean" ||
    !Number.isSafeInteger(value.attempts) ||
    Number(value.attempts) < 0 ||
    !Number.isSafeInteger(value.uploadedBytes) ||
    Number(value.uploadedBytes) < 0 ||
    !Number.isSafeInteger(value.totalBytes) ||
    Number(value.totalBytes) < 0 ||
    Number(value.uploadedBytes) > Number(value.totalBytes) ||
    !boundedString(value.title, 100) ||
    videoId === undefined ||
    (videoId !== null && !YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) ||
    rawWatchUrl === undefined ||
    failureCode === undefined ||
    (failureCode !== null && !/^[A-Z][A-Z0-9_]{1,127}$/u.test(failureCode)) ||
    failureMessage === undefined ||
    nextAttemptAt === undefined ||
    !createdAt ||
    !updatedAt
  ) {
    invalidUploadResponse();
  }
  const watchUrl =
    rawWatchUrl && videoId && isSafeYouTubeWatchUrl(rawWatchUrl, videoId)
      ? rawWatchUrl
      : null;
  return {
    assetId: value.assetId,
    attempts: value.attempts as number,
    courseId: value.courseId,
    createdAt,
    failureCode,
    failureMessage,
    jobId: value.jobId,
    lessonId: value.lessonId,
    madeForKids: value.madeForKids,
    nextAttemptAt,
    privacyStatus,
    status,
    title: value.title,
    totalBytes: value.totalBytes as number,
    updatedAt,
    uploadedBytes: value.uploadedBytes as number,
    videoId,
    watchUrl,
  };
}

export function parseYouTubeUploadList(value: unknown): YouTubeUploadJob[] {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    value.items.length > 200
  ) {
    invalidUploadResponse();
  }
  return value.items.map(parseYouTubeUploadJob);
}

function validateUploadInput(input: CreateYouTubeUploadInput): void {
  if (
    !boundedString(input.courseId, 128) ||
    !boundedString(input.lessonId, 128) ||
    !boundedString(input.assetId, 128) ||
    !UUID_V4_PATTERN.test(input.clientMutationId) ||
    !boundedString(input.title, 100) ||
    (input.description !== undefined &&
      (typeof input.description !== "string" ||
        input.description.length > 5_000)) ||
    (input.privacyStatus !== "PRIVATE" &&
      input.privacyStatus !== "UNLISTED" &&
      input.privacyStatus !== "PUBLIC") ||
    typeof input.madeForKids !== "boolean" ||
    input.consentAccepted !== true
  ) {
    throw new ApiError(
      "Thông tin xuất bản YouTube không hợp lệ",
      400,
      "YOUTUBE_UPLOAD_INPUT_INVALID",
    );
  }
}

function validateJobId(jobId: string): void {
  if (!boundedString(jobId, 128)) {
    throw new ApiError(
      "Mã tác vụ YouTube không hợp lệ",
      400,
      "YOUTUBE_UPLOAD_JOB_ID_INVALID",
    );
  }
}

function youtubeUploadListPath(filters?: YouTubeUploadListFilters): string {
  const pathname = "/integrations/youtube/uploads";
  if (!filters) return pathname;
  if (
    !boundedString(filters.courseId, 128) ||
    !boundedString(filters.lessonId, 128) ||
    !boundedString(filters.assetId, 128)
  ) {
    throw new ApiError(
      "Bộ lọc tác vụ YouTube không hợp lệ",
      400,
      "YOUTUBE_UPLOAD_FILTER_INVALID",
    );
  }
  const query = new URLSearchParams({
    courseId: filters.courseId,
    lessonId: filters.lessonId,
    assetId: filters.assetId,
  });
  return `${pathname}?${query.toString()}`;
}

export function createYouTubeMutationId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (item) =>
    item.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function youtubeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "CURRENT_PASSWORD_INVALID":
        return "Mật khẩu hiện tại không đúng.";
      case "YOUTUBE_DISABLED":
        return "Tích hợp YouTube hiện chưa được bật cho môi trường này.";
      case "YOUTUBE_NOT_CONNECTED":
        return "Hãy kết nối một kênh YouTube trước khi xuất bản.";
      case "YOUTUBE_REAUTH_REQUIRED":
        return "Quyền YouTube đã hết hiệu lực. Hãy kết nối lại để tiếp tục.";
      case "YOUTUBE_UPLOAD_DISABLED":
        return "Xuất bản video YouTube hiện chưa được bật.";
      case "YOUTUBE_GRANT_BUSY":
      case "YOUTUBE_CONNECTION_BUSY":
        return "Kết nối YouTube đang được cập nhật. Vui lòng thử lại sau.";
      case "YOUTUBE_QUOTA_EXCEEDED":
        return "Hạn mức YouTube hiện đã hết. Vui lòng thử lại sau.";
      case "YOUTUBE_ACCOUNT_MISMATCH":
        return "Tài khoản Google không khớp kênh YouTube đang kết nối. Hãy ngắt kết nối trước khi đổi tài khoản.";
      case "MEDIA_DISABLED":
      case "MEDIA_MODULE_DISABLED":
      case "MEDIA_STORAGE_UNAVAILABLE":
        return "Module Tài liệu riêng tư đang tắt nên không thể xuất bản video.";
      case "MEDIA_ASSET_NOT_AVAILABLE":
      case "MEDIA_VIDEO_SOURCE_INVALID":
        return "Video phải hoàn tất kiểm tra an toàn trước khi xuất bản.";
      case "AUTH_RATE_LIMITED":
        return "Bạn thao tác quá nhanh. Vui lòng đợi rồi thử lại.";
    }
  }
  return "Không thể hoàn tất yêu cầu YouTube lúc này. Vui lòng thử lại.";
}

export const youtubeApi = {
  getStatus: async (
    { token }: AuthenticatedContext,
    signal?: AbortSignal,
  ): Promise<YouTubeIntegrationStatus> =>
    parseYouTubeStatus(
      await apiFetch<unknown>("/integrations/youtube", {
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
    return parseYouTubeAuthorizationUrl(
      await apiFetch<unknown>("/integrations/youtube/connect", {
        body: JSON.stringify({ currentPassword }),
        cache: "no-store",
        credentials: "include",
        method: "POST",
        referrerPolicy: "no-referrer",
        token,
      }),
    );
  },

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
    await apiFetch<unknown>("/integrations/youtube", {
      body: JSON.stringify({ currentPassword }),
      cache: "no-store",
      method: "DELETE",
      referrerPolicy: "no-referrer",
      timeoutMs: YOUTUBE_DISCONNECT_TIMEOUT_MS,
      token,
    });
  },

  createUpload: async (
    { token }: AuthenticatedContext,
    input: CreateYouTubeUploadInput,
  ): Promise<YouTubeUploadJob> => {
    validateUploadInput(input);
    return parseYouTubeUploadJob(
      await apiFetch<unknown>("/integrations/youtube/uploads", {
        body: JSON.stringify(input),
        cache: "no-store",
        method: "POST",
        referrerPolicy: "no-referrer",
        token,
      }),
    );
  },

  listUploads: async (
    { token }: AuthenticatedContext,
    signal?: AbortSignal,
    filters?: YouTubeUploadListFilters,
  ): Promise<YouTubeUploadJob[]> =>
    parseYouTubeUploadList(
      await apiFetch<unknown>(youtubeUploadListPath(filters), {
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal,
        token,
      }),
    ),

  getUpload: async (
    { token }: AuthenticatedContext,
    jobId: string,
    signal?: AbortSignal,
  ): Promise<YouTubeUploadJob> => {
    validateJobId(jobId);
    return parseYouTubeUploadJob(
      await apiFetch<unknown>(
        `/integrations/youtube/uploads/${encodeURIComponent(jobId)}`,
        {
          cache: "no-store",
          referrerPolicy: "no-referrer",
          signal,
          token,
        },
      ),
    );
  },
};
