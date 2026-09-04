import { ApiError, apiFetch } from "@/lib/api";

export const LESSON_MEDIA_CONTENT_TYPES = [
  "application/pdf",
  "audio/mpeg",
  "image/jpeg",
  "image/png",
  "video/mp4",
] as const;

export const SUBMISSION_MEDIA_CONTENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "text/plain",
] as const;

export const DEFAULT_LESSON_MEDIA_MAX_BYTES = 100 * 1024 * 1024;
export const DEFAULT_SUBMISSION_MEDIA_MAX_BYTES = 25 * 1024 * 1024;
export const MAX_LESSON_ATTACHMENTS = 10;
export const MAX_SUBMISSION_ATTACHMENTS = 5;

export type MediaPurpose = "LESSON_CONTENT" | "SUBMISSION_ATTACHMENT";
export type MediaStatus =
  | "PENDING_UPLOAD"
  | "QUARANTINED"
  | "AVAILABLE"
  | "REJECTED"
  | "DELETING"
  | "DELETED";

export interface MediaAsset {
  _id: string;
  availableAt?: string;
  contentType: string;
  originalFileName: string;
  purpose: MediaPurpose;
  rejectionCode?: string;
  revision: number;
  sizeBytes: number;
  status: MediaStatus;
  uploadExpiresAt?: string;
}

interface MediaUploadTicket {
  expiresAt: string;
  headers: Record<string, string>;
  method: "PUT";
  url: string;
}

interface InitiatedMediaUpload {
  asset: MediaAsset;
  upload: MediaUploadTicket | null;
}

interface MediaDownloadTicket {
  expiresAt: string;
  url: string;
}

export interface LessonMediaTarget {
  courseId: string;
  kind: "LESSON";
  lessonId: string;
}

export interface LearnerSubmissionMediaTarget {
  assignmentId: string;
  kind: "LEARNER_SUBMISSION";
}

export interface GradingMediaTarget {
  kind: "GRADING";
  submissionId: string;
}

export type MediaTarget =
  GradingMediaTarget | LearnerSubmissionMediaTarget | LessonMediaTarget;
export type UploadableMediaTarget =
  LearnerSubmissionMediaTarget | LessonMediaTarget;

export interface MediaApiContext {
  token: string;
}

export type MediaUploadStage =
  | "HASHING"
  | "INITIATING"
  | "UPLOADING"
  | "FINALIZING"
  | "SCANNING"
  | "AVAILABLE";

export interface MediaUploadProgress {
  assetId?: string;
  stage: MediaUploadStage;
}

export class MediaWorkflowError extends Error {
  constructor(
    message: string,
    public readonly stage: MediaUploadStage,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "MediaWorkflowError";
  }
}

const MEDIA_STATUSES = new Set<MediaStatus>([
  "PENDING_UPLOAD",
  "QUARANTINED",
  "AVAILABLE",
  "REJECTED",
  "DELETING",
  "DELETED",
]);
const MEDIA_PURPOSES = new Set<MediaPurpose>([
  "LESSON_CONTENT",
  "SUBMISSION_ATTACHMENT",
]);
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/iu;
const CONTENT_TYPE_PATTERN = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/iu;
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/u;
const FORBIDDEN_UPLOAD_HEADERS = new Set([
  "authorization",
  "cookie",
  "host",
  "origin",
  "proxy-authorization",
  "referer",
  "user-agent",
]);
const UPLOAD_EXPIRY_SAFETY_MARGIN_MS = 1_000;

function invalidMediaResponse(): never {
  throw new ApiError(
    "Máy chủ trả dữ liệu tệp không hợp lệ",
    502,
    "MEDIA_RESPONSE_INVALID",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validOptionalDate(value: unknown) {
  return (
    value === undefined ||
    (typeof value === "string" && Number.isFinite(Date.parse(value)))
  );
}

export function parseMediaAsset(value: unknown): MediaAsset {
  if (!isRecord(value)) invalidMediaResponse();
  const asset = value as Record<string, unknown>;
  if (
    typeof asset._id !== "string" ||
    !OBJECT_ID_PATTERN.test(asset._id) ||
    typeof asset.contentType !== "string" ||
    !CONTENT_TYPE_PATTERN.test(asset.contentType) ||
    typeof asset.originalFileName !== "string" ||
    !asset.originalFileName.trim() ||
    asset.originalFileName.length > 512 ||
    typeof asset.purpose !== "string" ||
    !MEDIA_PURPOSES.has(asset.purpose as MediaPurpose) ||
    !Number.isSafeInteger(asset.revision) ||
    Number(asset.revision) < 0 ||
    !Number.isSafeInteger(asset.sizeBytes) ||
    Number(asset.sizeBytes) < 1 ||
    typeof asset.status !== "string" ||
    !MEDIA_STATUSES.has(asset.status as MediaStatus) ||
    (asset.rejectionCode !== undefined &&
      typeof asset.rejectionCode !== "string") ||
    !validOptionalDate(asset.uploadExpiresAt) ||
    !validOptionalDate(asset.availableAt)
  ) {
    invalidMediaResponse();
  }
  return {
    _id: asset._id,
    ...(typeof asset.availableAt === "string"
      ? { availableAt: asset.availableAt }
      : {}),
    contentType: asset.contentType,
    originalFileName: asset.originalFileName,
    purpose: asset.purpose as MediaPurpose,
    ...(typeof asset.rejectionCode === "string"
      ? { rejectionCode: asset.rejectionCode }
      : {}),
    revision: asset.revision as number,
    sizeBytes: asset.sizeBytes as number,
    status: asset.status as MediaStatus,
    ...(typeof asset.uploadExpiresAt === "string"
      ? { uploadExpiresAt: asset.uploadExpiresAt }
      : {}),
  };
}

function assertSafeTicketUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 16_384)
    invalidMediaResponse();
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    invalidMediaResponse();
  }
  const host = parsed.hostname.toLowerCase();
  const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/u.test(host);
  const ipv6 = host.includes(":");
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    ipv4 ||
    ipv6
  ) {
    invalidMediaResponse();
  }
  return parsed.toString();
}

function assertBoundedExpiry(value: unknown, maximumTtlMs: number): string {
  if (typeof value !== "string") invalidMediaResponse();
  const expiresAt = Date.parse(value);
  const now = Date.now();
  if (
    !Number.isFinite(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + maximumTtlMs
  ) {
    invalidMediaResponse();
  }
  return new Date(expiresAt).toISOString();
}

function parseUploadHeaders(value: unknown): Record<string, string> {
  if (!isRecord(value) || Object.keys(value).length > 32)
    invalidMediaResponse();
  const headers: Record<string, string> = {};
  for (const [name, raw] of Object.entries(value)) {
    const normalizedName = name.toLowerCase();
    if (
      !HEADER_NAME_PATTERN.test(name) ||
      FORBIDDEN_UPLOAD_HEADERS.has(normalizedName) ||
      normalizedName.startsWith("sec-") ||
      typeof raw !== "string" ||
      raw.length > 8_192 ||
      /[\r\n]/u.test(raw)
    ) {
      invalidMediaResponse();
    }
    headers[name] = raw;
  }
  return headers;
}

function expectedPurpose(target: MediaTarget): MediaPurpose {
  return target.kind === "LESSON" ? "LESSON_CONTENT" : "SUBMISSION_ATTACHMENT";
}

function parseTargetAsset(value: unknown, target: MediaTarget): MediaAsset {
  const asset = parseMediaAsset(value);
  if (asset.purpose !== expectedPurpose(target)) invalidMediaResponse();
  return asset;
}

function parseInitiatedUpload(
  value: unknown,
  target: UploadableMediaTarget,
): InitiatedMediaUpload {
  if (!isRecord(value) || !("asset" in value) || !("upload" in value)) {
    invalidMediaResponse();
  }
  const asset = parseTargetAsset(value.asset, target);
  if (value.upload === null) return { asset, upload: null };
  if (
    asset.status !== "PENDING_UPLOAD" ||
    !isRecord(value.upload) ||
    value.upload.method !== "PUT"
  ) {
    invalidMediaResponse();
  }
  return {
    asset,
    upload: {
      expiresAt: assertBoundedExpiry(value.upload.expiresAt, 3_605_000),
      headers: parseUploadHeaders(value.upload.headers),
      method: "PUT",
      url: assertSafeTicketUrl(value.upload.url),
    },
  };
}

function parseDownloadTicket(value: unknown): MediaDownloadTicket {
  if (!isRecord(value)) invalidMediaResponse();
  return {
    expiresAt: assertBoundedExpiry(value.expiresAt, 305_000),
    url: assertSafeTicketUrl(value.url),
  };
}

const encoded = (value: string) => encodeURIComponent(value);

function targetRoot(target: MediaTarget): string {
  switch (target.kind) {
    case "LESSON":
      return `/courses/${encoded(target.courseId)}/lessons/${encoded(target.lessonId)}/assets`;
    case "LEARNER_SUBMISSION":
      return `/assignments/${encoded(target.assignmentId)}/my-submission/attachments`;
    case "GRADING":
      return `/grading/submissions/${encoded(target.submissionId)}/attachments`;
  }
}

function secureTicketRequest(token: string): RequestInit & { token: string } {
  return {
    cache: "no-store",
    credentials: "same-origin",
    referrerPolicy: "no-referrer",
    token,
  };
}

async function boundedMediaFetch<T>(
  path: string,
  options: RequestInit & { token: string },
  externalSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abort();
  else externalSignal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(
    () =>
      controller.abort(
        new DOMException("Media request timeout", "TimeoutError"),
      ),
    15_000,
  );
  try {
    return await apiFetch<T>(path, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abort);
  }
}

export const mediaApi = {
  getAsset: async (
    { token }: MediaApiContext,
    target: MediaTarget,
    assetId: string,
    signal?: AbortSignal,
  ) =>
    parseTargetAsset(
      await boundedMediaFetch<unknown>(
        `${targetRoot(target)}/${encoded(assetId)}`,
        secureTicketRequest(token),
        signal,
      ),
      target,
    ),
  initiateUpload: async (
    { token }: MediaApiContext,
    target: UploadableMediaTarget,
    input: {
      clientMutationId: string;
      contentType: string;
      originalFileName: string;
      sha256Base64: string;
      sizeBytes: number;
    },
    signal?: AbortSignal,
  ) => {
    const response = await boundedMediaFetch<unknown>(
      `${targetRoot(target)}/uploads`,
      {
        ...secureTicketRequest(token),
        body: JSON.stringify(input),
        method: "POST",
      },
      signal,
    );
    return parseInitiatedUpload(response, target);
  },
  finalizeUpload: async (
    { token }: MediaApiContext,
    target: UploadableMediaTarget,
    assetId: string,
    signal?: AbortSignal,
  ) =>
    parseTargetAsset(
      await boundedMediaFetch<unknown>(
        `${targetRoot(target)}/${encoded(assetId)}/finalize`,
        { ...secureTicketRequest(token), method: "POST" },
        signal,
      ),
      target,
    ),
  cancelAsset: async (
    { token }: MediaApiContext,
    target: UploadableMediaTarget,
    assetId: string,
    signal?: AbortSignal,
  ) =>
    parseTargetAsset(
      await boundedMediaFetch<unknown>(
        `${targetRoot(target)}/${encoded(assetId)}`,
        { ...secureTicketRequest(token), method: "DELETE" },
        signal,
      ),
      target,
    ),
  requestDownload: async (
    { token }: MediaApiContext,
    target: MediaTarget,
    assetId: string,
    signal?: AbortSignal,
  ) =>
    parseDownloadTicket(
      await boundedMediaFetch<unknown>(
        `${targetRoot(target)}/${encoded(assetId)}/download`,
        secureTicketRequest(token),
        signal,
      ),
    ),
};

export function createMediaMutationId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Upload aborted", "AbortError");
  }
}

export async function sha256Base64(
  file: Blob,
  signal?: AbortSignal,
): Promise<string> {
  throwIfAborted(signal);
  if (!globalThis.crypto?.subtle) {
    throw new MediaWorkflowError(
      "Trình duyệt không hỗ trợ kiểm tra SHA-256 an toàn.",
      "HASHING",
      "MEDIA_BROWSER_CRYPTO_UNAVAILABLE",
    );
  }
  const bytes = await file.arrayBuffer();
  throwIfAborted(signal);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  throwIfAborted(signal);
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

async function directPut(
  ticket: MediaUploadTicket,
  file: File,
  signal?: AbortSignal,
) {
  throwIfAborted(signal);
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener("abort", abortFromCaller, { once: true });
  const remainingTicketMs = Date.parse(ticket.expiresAt) - Date.now();
  const deadlineMs = Math.max(
    1,
    remainingTicketMs > UPLOAD_EXPIRY_SAFETY_MARGIN_MS
      ? remainingTicketMs - UPLOAD_EXPIRY_SAFETY_MARGIN_MS
      : remainingTicketMs,
  );
  let deadlineReached = false;
  const deadline = setTimeout(() => {
    deadlineReached = true;
    controller.abort(
      new DOMException("Media upload ticket expired", "TimeoutError"),
    );
  }, deadlineMs);
  let response: Response;
  try {
    response = await fetch(ticket.url, {
      body: file,
      cache: "no-store",
      credentials: "omit",
      headers: ticket.headers,
      method: "PUT",
      mode: "cors",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (deadlineReached) {
      throw new MediaWorkflowError(
        "Tải tệp vượt quá thời gian hiệu lực; hãy thử lại.",
        "UPLOADING",
        "MEDIA_DIRECT_UPLOAD_TIMEOUT",
      );
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    if (deadlineReached) {
      throw new MediaWorkflowError(
        "Tải tệp vượt quá thời gian hiệu lực; hãy thử lại.",
        "UPLOADING",
        "MEDIA_DIRECT_UPLOAD_TIMEOUT",
      );
    }
    if (error instanceof MediaWorkflowError) throw error;
    throw new MediaWorkflowError(
      "Không thể tải tệp lên kho lưu trữ riêng tư.",
      "UPLOADING",
      "MEDIA_DIRECT_UPLOAD_FAILED",
    );
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener("abort", abortFromCaller);
  }
  if (!response.ok) {
    throw new MediaWorkflowError(
      "Kho lưu trữ từ chối tệp; hãy thử tải lại.",
      "UPLOADING",
      "MEDIA_DIRECT_UPLOAD_REJECTED",
    );
  }
}

function stageError(
  error: unknown,
  stage: MediaUploadStage,
): MediaWorkflowError {
  if (error instanceof MediaWorkflowError) return error;
  if (error instanceof ApiError)
    return new MediaWorkflowError(error.message, stage, error.code);
  return new MediaWorkflowError(
    error instanceof Error ? error.message : "Không thể hoàn tất tải tệp.",
    stage,
  );
}

function rejectionMessage(asset: MediaAsset) {
  return asset.rejectionCode
    ? `Tệp không vượt qua kiểm tra an toàn (${asset.rejectionCode}).`
    : "Tệp không vượt qua kiểm tra an toàn.";
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(new DOMException("Upload aborted", "AbortError"));
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function runMediaUpload({
  clientMutationId = createMediaMutationId(),
  context,
  file,
  maxPollAttempts = 30,
  onProgress,
  pollIntervalMs = 2_000,
  signal,
  target,
}: {
  clientMutationId?: string;
  context: MediaApiContext;
  file: File;
  maxPollAttempts?: number;
  onProgress?: (progress: MediaUploadProgress) => void;
  pollIntervalMs?: number;
  signal?: AbortSignal;
  target: UploadableMediaTarget;
}): Promise<MediaAsset> {
  let assetId: string | undefined;
  let stage: MediaUploadStage = "HASHING";
  const progress = (next: MediaUploadStage) => {
    stage = next;
    onProgress?.({ ...(assetId ? { assetId } : {}), stage: next });
  };
  try {
    progress("HASHING");
    const checksum = await sha256Base64(file, signal);
    progress("INITIATING");
    const initiated = await mediaApi.initiateUpload(
      context,
      target,
      {
        clientMutationId,
        contentType: file.type.trim().toLowerCase(),
        originalFileName: file.name,
        sha256Base64: checksum,
        sizeBytes: file.size,
      },
      signal,
    );
    assetId = initiated.asset._id;
    let asset = initiated.asset;
    if (asset.status === "REJECTED") {
      throw new MediaWorkflowError(
        rejectionMessage(asset),
        "INITIATING",
        asset.rejectionCode,
      );
    }
    if (asset.status === "AVAILABLE") {
      progress("AVAILABLE");
      return asset;
    }
    if (initiated.upload) {
      progress("UPLOADING");
      await directPut(initiated.upload, file, signal);
      progress("FINALIZING");
      asset = await mediaApi.finalizeUpload(context, target, assetId, signal);
    }
    if (asset.status === "REJECTED") {
      throw new MediaWorkflowError(
        rejectionMessage(asset),
        "FINALIZING",
        asset.rejectionCode,
      );
    }
    if (asset.status === "AVAILABLE") {
      progress("AVAILABLE");
      return asset;
    }
    progress("SCANNING");
    for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
      await sleep(pollIntervalMs, signal);
      asset = await mediaApi.getAsset(context, target, assetId, signal);
      if (asset.status === "AVAILABLE") {
        progress("AVAILABLE");
        return asset;
      }
      if (asset.status === "REJECTED") {
        throw new MediaWorkflowError(
          rejectionMessage(asset),
          "SCANNING",
          asset.rejectionCode,
        );
      }
      if (asset.status === "DELETING" || asset.status === "DELETED") {
        throw new MediaWorkflowError(
          "Tệp đã bị hủy trước khi kiểm tra hoàn tất.",
          "SCANNING",
          "MEDIA_ASSET_CANCELLED",
        );
      }
    }
    throw new MediaWorkflowError(
      "Kiểm tra an toàn mất nhiều thời gian hơn dự kiến. Bạn có thể thử lại sau.",
      "SCANNING",
      "MEDIA_SCAN_TIMEOUT",
    );
  } catch (error) {
    if (
      signal?.aborted ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      if (assetId) {
        await mediaApi
          .cancelAsset(context, target, assetId)
          .catch(() => undefined);
      }
      throw new MediaWorkflowError(
        "Đã hủy tải tệp.",
        stage,
        "MEDIA_UPLOAD_CANCELLED",
      );
    }
    throw stageError(error, stage);
  }
}

export function openMediaDownload(ticket: MediaDownloadTicket) {
  const safeTicket = parseDownloadTicket(ticket);
  if (typeof document === "undefined") {
    throw new ApiError("Tải tệp chỉ khả dụng trong trình duyệt", 0);
  }
  const link = document.createElement("a");
  link.href = safeTicket.url;
  link.rel = "noopener noreferrer";
  link.referrerPolicy = "no-referrer";
  link.target = "_blank";
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.removeAttribute("href");
    link.remove();
  }
}

export async function requestAndOpenMediaDownload(
  context: MediaApiContext,
  target: MediaTarget,
  assetId: string,
  signal?: AbortSignal,
) {
  const ticket = await mediaApi.requestDownload(
    context,
    target,
    assetId,
    signal,
  );
  openMediaDownload(ticket);
}

export function mediaFileFingerprint(file: File) {
  return `${file.name.normalize("NFC")}\u0000${file.type.toLowerCase()}\u0000${file.size}\u0000${file.lastModified}`;
}

export function validateMediaFiles({
  allowedContentTypes,
  currentCount,
  existingFingerprints = new Set<string>(),
  files,
  maxBytes,
  maxCount,
}: {
  allowedContentTypes: readonly string[];
  currentCount: number;
  existingFingerprints?: ReadonlySet<string>;
  files: readonly File[];
  maxBytes: number;
  maxCount: number;
}): string | null {
  if (files.length === 0) return "Chọn ít nhất một tệp.";
  if (currentCount + files.length > maxCount) {
    return `Chỉ được đính kèm tối đa ${maxCount} tệp.`;
  }
  const fingerprints = new Set(existingFingerprints);
  for (const file of files) {
    if (file.size < 1 || file.size > maxBytes) {
      return `Mỗi tệp phải lớn hơn 0 byte và không vượt quá ${Math.round(maxBytes / 1024 / 1024)} MiB.`;
    }
    if (!allowedContentTypes.includes(file.type.trim().toLowerCase())) {
      return "Có tệp thuộc định dạng không được phép.";
    }
    const fingerprint = mediaFileFingerprint(file);
    if (fingerprints.has(fingerprint))
      return "Không thể chọn cùng một tệp nhiều lần.";
    fingerprints.add(fingerprint);
  }
  return null;
}
