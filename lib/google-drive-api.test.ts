import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import {
  googleDriveApi,
  googleDriveErrorMessage,
  isSafeGoogleDriveFileUrl,
  parseGoogleDriveAuthorizationUrl,
  parseGoogleDriveStatus,
} from "./google-drive-api";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiFetch: mocks.apiFetch };
});

describe("Google Drive API", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
  });

  it("chuẩn hóa đúng safe status DTO và bỏ metadata ngoài allow-list", () => {
    expect(
      parseGoogleDriveStatus({
        connectedAt: "2030-08-16T00:00:00.000Z",
        file: {
          id: "drive-file-id",
          name: "DX-LMS-backup.json",
          webViewLink:
            "https://drive.google.com/file/d/drive-file-id/view?usp=drivesdk",
        },
        lastSyncedAt: "2030-08-16T00:05:00.000Z",
        linkedEmail: "owner@example.test",
        refreshToken: "must-drop",
        status: "CONNECTED",
        syncInProgress: false,
      }),
    ).toEqual({
      accountEmail: "owner@example.test",
      connectedAt: "2030-08-16T00:00:00.000Z",
      lastSync: {
        completedAt: "2030-08-16T00:05:00.000Z",
        file: {
          name: "DX-LMS-backup.json",
          url: "https://drive.google.com/file/d/drive-file-id/view?usp=drivesdk",
        },
        state: "SUCCEEDED",
      },
      state: "CONNECTED",
      syncInProgress: false,
    });
    expect(
      parseGoogleDriveStatus({
        connectedAt: null,
        file: null,
        lastSyncedAt: null,
        linkedEmail: null,
        status: "DISCONNECTED",
        syncInProgress: false,
      }),
    ).toEqual({
      accountEmail: null,
      connectedAt: null,
      lastSync: null,
      state: "DISCONNECTED",
      syncInProgress: false,
    });
  });

  it("loại bỏ file URL không an toàn nhưng vẫn giữ metadata an toàn", () => {
    expect(
      parseGoogleDriveStatus({
        connectedAt: null,
        file: {
          id: "drive-file-id",
          name: "backup.json",
          webViewLink: "https://evil.example/backup.json",
        },
        lastSyncedAt: "2030-08-16T00:05:00.000Z",
        linkedEmail: "owner@example.test",
        status: "CONNECTED",
        syncInProgress: false,
      }),
    ).toMatchObject({
      lastSync: { file: { name: "backup.json", url: null } },
    });
    expect(isSafeGoogleDriveFileUrl("https://drive.google.com/file/d/1/view"))
      .toBe(true);
    expect(isSafeGoogleDriveFileUrl("https://drive.google.com.evil.test/1"))
      .toBe(false);
  });

  it.each([
    "http://accounts.google.com/o/oauth2/v2/auth",
    "https://accounts.google.com.evil.test/o/oauth2/v2/auth",
    "https://accounts.google.com/o/oauth2/auth",
    "https://user@accounts.google.com/o/oauth2/v2/auth",
    "https://accounts.google.com/o/oauth2/v2/auth#token",
  ])("từ chối authorizationUrl ngoài allow-list: %s", (authorizationUrl) => {
    expect(() => parseGoogleDriveAuthorizationUrl({ authorizationUrl })).toThrow(
      ApiError,
    );
  });

  it("chỉ chấp nhận đúng Google OAuth authorization URL", () => {
    expect(
      parseGoogleDriveAuthorizationUrl({
        authorizationUrl:
          "https://accounts.google.com/o/oauth2/v2/auth?client_id=public-client&scope=drive.file",
      }),
    ).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth?client_id=public-client&scope=drive.file",
    );
  });

  it("gọi status/connect/sync/disconnect với token và password đúng chỗ", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce({
        connectedAt: null,
        file: null,
        lastSyncedAt: null,
        linkedEmail: null,
        status: "DISCONNECTED",
        syncInProgress: false,
      })
      .mockResolvedValueOnce({
        authorizationUrl:
          "https://accounts.google.com/o/oauth2/v2/auth?client_id=public-client",
      })
      .mockResolvedValueOnce({
        connectedAt: "2030-08-16T00:00:00.000Z",
        file: null,
        lastSyncedAt: "2030-08-16T00:05:00.000Z",
        linkedEmail: "owner@example.test",
        status: "CONNECTED",
        syncInProgress: false,
      })
      .mockResolvedValueOnce(undefined);
    const signal = new AbortController().signal;

    await googleDriveApi.getStatus({ token: "session-token" }, signal);
    await googleDriveApi.connect(
      { token: "session-token" },
      "CurrentPassword123",
    );
    await googleDriveApi.sync({ token: "session-token" });
    await googleDriveApi.disconnect(
      { token: "session-token" },
      "CurrentPassword123",
    );

    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      1,
      "/integrations/google-drive",
      {
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal,
        token: "session-token",
      },
    );
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      2,
      "/integrations/google-drive/connect",
      {
        body: JSON.stringify({ currentPassword: "CurrentPassword123" }),
        cache: "no-store",
        credentials: "include",
        method: "POST",
        referrerPolicy: "no-referrer",
        token: "session-token",
      },
    );
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      3,
      "/integrations/google-drive/sync",
      {
        cache: "no-store",
        method: "POST",
        referrerPolicy: "no-referrer",
        timeoutMs: 120_000,
        token: "session-token",
      },
    );
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      4,
      "/integrations/google-drive",
      {
        body: JSON.stringify({ currentPassword: "CurrentPassword123" }),
        cache: "no-store",
        method: "DELETE",
        referrerPolicy: "no-referrer",
        timeoutMs: 120_000,
        token: "session-token",
      },
    );
  });

  it("không làm lộ lỗi provider thô ra UI", () => {
    const raw = "refresh_token=secret-provider-value";
    expect(
      googleDriveErrorMessage(
        new ApiError(raw, 401, "GOOGLE_DRIVE_REAUTH_REQUIRED"),
      ),
    ).toMatch(/kết nối lại/i);
    expect(googleDriveErrorMessage(new ApiError(raw, 500))).not.toContain(raw);
  });
});
