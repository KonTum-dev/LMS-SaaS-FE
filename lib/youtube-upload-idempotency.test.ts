// @vitest-environment jsdom

import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ViewerScope } from "@/lib/query-keys";
import {
  clearPendingYouTubeUploadMutation,
  fingerprintYouTubeUploadRequest,
  persistPendingYouTubeUploadMutation,
  readPendingYouTubeUploadMutation,
  youtubeUploadMutationStorageKey,
  type YouTubeUploadRequest,
} from "./youtube-upload-idempotency";

const scope: ViewerScope = {
  membershipId: "membership-1",
  role: "INSTRUCTOR",
  tenantId: "tenant-1",
  viewerId: "teacher-1",
};
const request: YouTubeUploadRequest = {
  assetId: "asset-1",
  consentAccepted: true,
  courseId: "course-1",
  description: "Nội dung riêng của bài học",
  lessonId: "lesson-1",
  madeForKids: false,
  privacyStatus: "PRIVATE",
  title: "Bài học Một",
};

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("YouTube upload idempotency", () => {
  it("cô lập storage key theo authority và asset", () => {
    const first = youtubeUploadMutationStorageKey(
      scope,
      "course-1",
      "lesson-1",
      "asset-1",
    );
    const second = youtubeUploadMutationStorageKey(
      { ...scope, viewerId: "teacher-2" },
      "course-1",
      "lesson-1",
      "asset-1",
    );

    expect(first).not.toBe(second);
    expect(first).not.toContain("session-token");
  });

  it("hash toàn bộ request và thay fingerprint khi description đổi", async () => {
    vi.stubGlobal("crypto", webcrypto);

    const first = await fingerprintYouTubeUploadRequest(request);
    const second = await fingerprintYouTubeUploadRequest({
      ...request,
      description: "Nội dung khác",
    });

    expect(first).toMatch(/^[0-9a-f]{64}$/u);
    expect(second).toMatch(/^[0-9a-f]{64}$/u);
    expect(first).not.toBe(second);
  });

  it("chỉ persist UUID và SHA-256, không lưu request thô", () => {
    const key = youtubeUploadMutationStorageKey(
      scope,
      request.courseId,
      request.lessonId,
      request.assetId,
    );
    const mutation = {
      fingerprint: "a".repeat(64),
      id: "11111111-1111-4111-8111-111111111111",
    };

    persistPendingYouTubeUploadMutation(key, mutation);

    expect(readPendingYouTubeUploadMutation(key)).toEqual(mutation);
    const raw = sessionStorage.getItem(key) ?? "";
    expect(raw).not.toContain(request.description!);
    expect(raw).not.toContain(request.title);
    clearPendingYouTubeUploadMutation(key, mutation.id);
    expect(readPendingYouTubeUploadMutation(key)).toBeNull();
  });

  it("không persist fingerprint memory có chứa canonical request", () => {
    const key = "youtube-memory-only";
    persistPendingYouTubeUploadMutation(key, {
      fingerprint: "memory:private lesson description",
      id: "11111111-1111-4111-8111-111111111111",
    });

    expect(sessionStorage.getItem(key)).toBeNull();
  });
});
