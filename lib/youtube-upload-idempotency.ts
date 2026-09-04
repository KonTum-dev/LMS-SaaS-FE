import type { ViewerScope } from "@/lib/query-keys";
import type { CreateYouTubeUploadInput } from "@/lib/youtube-api";

export interface PendingYouTubeUploadMutation {
  fingerprint: string;
  id: string;
}

export type YouTubeUploadRequest = Omit<
  CreateYouTubeUploadInput,
  "clientMutationId"
>;

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function browserSessionStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function youtubeUploadMutationStorageKey(
  scope: ViewerScope,
  courseId: string,
  lessonId: string,
  assetId: string,
): string {
  return [
    "dxlms",
    "youtube-upload",
    scope.tenantId,
    scope.viewerId,
    scope.membershipId,
    courseId,
    lessonId,
    assetId,
  ]
    .map(encodeURIComponent)
    .join(":");
}

export async function fingerprintYouTubeUploadRequest(
  input: YouTubeUploadRequest,
): Promise<string> {
  const canonical = JSON.stringify({
    assetId: input.assetId,
    consentAccepted: input.consentAccepted,
    courseId: input.courseId,
    description: input.description ?? null,
    lessonId: input.lessonId,
    madeForKids: input.madeForKids,
    privacyStatus: input.privacyStatus,
    title: input.title,
  });
  if (typeof globalThis.crypto?.subtle?.digest !== "function") {
    return `memory:${canonical}`;
  }
  try {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonical),
    );
    return Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, "0"),
    ).join("");
  } catch {
    return `memory:${canonical}`;
  }
}

export function readPendingYouTubeUploadMutation(
  storageKey: string,
): PendingYouTubeUploadMutation | null {
  try {
    const raw = browserSessionStorage()?.getItem(storageKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingYouTubeUploadMutation>;
    return typeof value.fingerprint === "string" &&
      SHA256_PATTERN.test(value.fingerprint) &&
      typeof value.id === "string" &&
      UUID_V4_PATTERN.test(value.id)
      ? { fingerprint: value.fingerprint, id: value.id }
      : null;
  } catch {
    return null;
  }
}

export function persistPendingYouTubeUploadMutation(
  storageKey: string,
  mutation: PendingYouTubeUploadMutation,
): void {
  if (!SHA256_PATTERN.test(mutation.fingerprint)) return;
  try {
    browserSessionStorage()?.setItem(storageKey, JSON.stringify(mutation));
  } catch {
    // The caller keeps an in-memory reference when storage is unavailable.
  }
}

export function clearPendingYouTubeUploadMutation(
  storageKey: string,
  mutationId: string,
): void {
  try {
    const current = readPendingYouTubeUploadMutation(storageKey);
    if (current?.id === mutationId) {
      browserSessionStorage()?.removeItem(storageKey);
    }
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
