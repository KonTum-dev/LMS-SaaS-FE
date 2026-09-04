import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import {
  isSafeYouTubeWatchUrl,
  parseYouTubeAuthorizationUrl,
  parseYouTubeStatus,
  parseYouTubeUploadJob,
  youtubeApi,
  youtubeErrorMessage,
  type CreateYouTubeUploadInput,
} from "./youtube-api";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiFetch: mocks.apiFetch };
});

const job = {
  assetId: "64b000000000000000000003",
  attempts: 1,
  courseId: "64b000000000000000000001",
  createdAt: "2030-08-16T00:00:00.000Z",
  failureCode: null,
  failureMessage: null,
  jobId: "64b000000000000000000004",
  lessonId: "64b000000000000000000002",
  madeForKids: false,
  nextAttemptAt: null,
  privacyStatus: "PRIVATE",
  status: "UPLOADING",
  title: "Bài học an toàn",
  totalBytes: 1_000,
  updatedAt: "2030-08-16T00:01:00.000Z",
  uploadedBytes: 400,
  videoId: null,
  watchUrl: null,
};

describe("YouTube API", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
  });

  it("parse status chỉ giữ metadata kênh công khai", () => {
    expect(
      parseYouTubeStatus({
        accessToken: "must-drop",
        channel: { id: "UC_safe_channel", title: "Kênh đào tạo" },
        connectedAt: "2030-08-16T00:00:00.000Z",
        refreshToken: "must-drop",
        status: "CONNECTED",
        uploadEnabled: true,
      }),
    ).toEqual({
      channel: { id: "UC_safe_channel", title: "Kênh đào tạo" },
      connectedAt: "2030-08-16T00:00:00.000Z",
      state: "CONNECTED",
      uploadEnabled: true,
    });
  });

  it.each([
    "http://accounts.google.com/o/oauth2/v2/auth",
    "https://accounts.google.com.evil.test/o/oauth2/v2/auth",
    "https://accounts.google.com/o/oauth2/auth",
    "https://user@accounts.google.com/o/oauth2/v2/auth",
    "https://accounts.google.com/o/oauth2/v2/auth#token",
  ])("từ chối OAuth URL ngoài allow-list: %s", (authorizationUrl) => {
    expect(() => parseYouTubeAuthorizationUrl({ authorizationUrl })).toThrow(
      ApiError,
    );
  });

  it("chỉ giữ watch URL khớp videoId trên host YouTube", () => {
    expect(
      parseYouTubeUploadJob({
        ...job,
        status: "SUCCEEDED",
        uploadedBytes: 1_000,
        videoId: "abcDEF_123-",
        watchUrl: "https://evil.example/watch?v=abcDEF_123-",
      }).watchUrl,
    ).toBeNull();
    expect(
      isSafeYouTubeWatchUrl(
        "https://www.youtube.com/watch?v=abcDEF_123-",
        "abcDEF_123-",
      ),
    ).toBe(true);
    expect(
      parseYouTubeUploadJob({
        ...job,
        status: "SUCCEEDED",
        uploadedBytes: 1_000,
        videoId: null,
        watchUrl: "https://www.youtube.com/watch?v=abcDEF_123-",
      }).watchUrl,
    ).toBeNull();
  });

  it("gọi status/connect/disconnect đúng contract và chỉ connect nhận cookie", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce({
        channel: null,
        connectedAt: null,
        status: "DISCONNECTED",
        uploadEnabled: false,
      })
      .mockResolvedValueOnce({
        authorizationUrl:
          "https://accounts.google.com/o/oauth2/v2/auth?client_id=youtube-client",
      })
      .mockResolvedValueOnce(undefined);
    const signal = new AbortController().signal;

    await youtubeApi.getStatus({ token: "session-token" }, signal);
    await youtubeApi.connect({ token: "session-token" }, "Password123");
    await youtubeApi.disconnect({ token: "session-token" }, "Password123");

    expect(mocks.apiFetch.mock.calls).toEqual([
      [
        "/integrations/youtube",
        {
          cache: "no-store",
          referrerPolicy: "no-referrer",
          signal,
          token: "session-token",
        },
      ],
      [
        "/integrations/youtube/connect",
        {
          body: JSON.stringify({ currentPassword: "Password123" }),
          cache: "no-store",
          credentials: "include",
          method: "POST",
          referrerPolicy: "no-referrer",
          token: "session-token",
        },
      ],
      [
        "/integrations/youtube",
        {
          body: JSON.stringify({ currentPassword: "Password123" }),
          cache: "no-store",
          method: "DELETE",
          referrerPolicy: "no-referrer",
          timeoutMs: 120_000,
          token: "session-token",
        },
      ],
    ]);
  });

  it("tạo/list/đọc upload job bằng body và route đã encode", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce({ items: [job] })
      .mockResolvedValueOnce(job);
    const input: CreateYouTubeUploadInput = {
      assetId: job.assetId,
      clientMutationId: "11111111-1111-4111-8111-111111111111",
      consentAccepted: true,
      courseId: job.courseId,
      description: "Mô tả",
      lessonId: job.lessonId,
      madeForKids: false,
      privacyStatus: "PRIVATE",
      title: job.title,
    };

    await youtubeApi.createUpload({ token: "session-token" }, input);
    await youtubeApi.listUploads({ token: "session-token" }, undefined, {
      assetId: job.assetId,
      courseId: job.courseId,
      lessonId: job.lessonId,
    });
    await youtubeApi.getUpload({ token: "session-token" }, "job/one");

    expect(mocks.apiFetch.mock.calls).toEqual([
      [
        "/integrations/youtube/uploads",
        {
          body: JSON.stringify(input),
          cache: "no-store",
          method: "POST",
          referrerPolicy: "no-referrer",
          token: "session-token",
        },
      ],
      [
        `/integrations/youtube/uploads?courseId=${job.courseId}&lessonId=${job.lessonId}&assetId=${job.assetId}`,
        {
          cache: "no-store",
          referrerPolicy: "no-referrer",
          signal: undefined,
          token: "session-token",
        },
      ],
      [
        "/integrations/youtube/uploads/job%2Fone",
        {
          cache: "no-store",
          referrerPolicy: "no-referrer",
          signal: undefined,
          token: "session-token",
        },
      ],
    ]);
  });

  it("không làm lộ provider error thô ra UI", () => {
    const raw = "refresh_token=secret-provider-value";
    expect(
      youtubeErrorMessage(new ApiError(raw, 401, "YOUTUBE_REAUTH_REQUIRED")),
    ).toMatch(/kết nối lại/i);
    expect(youtubeErrorMessage(new ApiError(raw, 500))).not.toContain(raw);
    expect(
      youtubeErrorMessage(new ApiError(raw, 409, "MEDIA_VIDEO_SOURCE_INVALID")),
    ).toMatch(/kiểm tra an toàn/i);
  });

  it.each([
    ["YOUTUBE_GRANT_BUSY", /đang được cập nhật/i],
    ["YOUTUBE_CONNECTION_BUSY", /đang được cập nhật/i],
    ["YOUTUBE_QUOTA_EXCEEDED", /hạn mức/i],
    ["YOUTUBE_ACCOUNT_MISMATCH", /không khớp/i],
  ])("map lỗi an toàn %s", (code, expected) => {
    expect(
      youtubeErrorMessage(new ApiError("provider details", 409, code)),
    ).toMatch(expected);
  });
});
