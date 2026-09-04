// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import {
  accountProfileApi,
  parseAccountProfile,
  validateProfileImage,
} from "./profile-api";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, apiFetch: mocks.apiFetch };
});

const profile = {
  avatarUrl:
    "http://localhost:4000/api/v1/public-assets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  email: "mai@example.test",
  fullName: "Cô Mai",
  sub: "64b000000000000000000011",
};

class MockXmlHttpRequest {
  static instances: MockXmlHttpRequest[] = [];

  body: Document | XMLHttpRequestBodyInit | null = null;
  method = "";
  onabort: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  responseText = "";
  status = 0;
  timeout = 0;
  upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  url = "";
  headers = new Map<string, string>();

  constructor() {
    MockXmlHttpRequest.instances.push(this);
  }

  abort() {
    this.onabort?.();
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body: Document | XMLHttpRequestBodyInit | null) {
    this.body = body;
  }

  setRequestHeader(name: string, value: string) {
    this.headers.set(name, value);
  }
}

beforeEach(() => {
  mocks.apiFetch.mockReset();
  MockXmlHttpRequest.instances = [];
  vi.stubGlobal(
    "XMLHttpRequest",
    MockXmlHttpRequest as unknown as typeof XMLHttpRequest,
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("profile API", () => {
  it("validate chặt response và chỉ chấp nhận public asset URL không query", () => {
    expect(parseAccountProfile(profile)).toEqual(profile);
    expect(() =>
      parseAccountProfile({
        ...profile,
        avatarUrl: `${profile.avatarUrl}?token=secret`,
      }),
    ).toThrowError(ApiError);
    expect(() =>
      parseAccountProfile({
        ...profile,
        avatarUrl: "https://tracker.test/a.png",
      }),
    ).toThrowError(ApiError);
  });

  it("kiểm tra MIME, tệp rỗng và giới hạn 5 MiB trước khi upload", () => {
    expect(
      validateProfileImage(
        new File(["x"], "avatar.svg", { type: "image/svg+xml" }),
      ),
    ).toBe("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.");
    expect(
      validateProfileImage(new File([], "empty.png", { type: "image/png" })),
    ).toBe("Tệp ảnh đang trống.");
    expect(
      validateProfileImage(
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", {
          type: "image/png",
        }),
      ),
    ).toBe("Ảnh không được vượt quá 5 MiB.");
    expect(
      validateProfileImage(
        new File(["x"], "avatar.webp", { type: "image/webp" }),
      ),
    ).toBeNull();
  });

  it("PUT raw bytes kèm Bearer/MIME và báo tiến độ thật từ trình duyệt", async () => {
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    const progress = vi.fn();
    const pending = accountProfileApi.uploadAvatar("session-token", file, {
      onProgress: progress,
    });
    const request = MockXmlHttpRequest.instances[0];

    expect(request.method).toBe("PUT");
    expect(request.url).toBe("http://localhost:4000/api/v1/users/me/avatar");
    expect(request.headers.get("Authorization")).toBe("Bearer session-token");
    expect(request.headers.get("Content-Type")).toBe("image/png");
    expect(request.headers.has("Content-Length")).toBe(false);
    expect(request.body).toBe(file);

    request.upload.onprogress?.({
      lengthComputable: true,
      loaded: 3,
      total: 6,
    } as ProgressEvent);
    request.status = 200;
    request.responseText = JSON.stringify(profile);
    request.onload?.();

    await expect(pending).resolves.toEqual(profile);
    expect(progress).toHaveBeenNthCalledWith(1, 50);
    expect(progress).toHaveBeenLastCalledWith(100);
  });

  it("không đưa URL/body nhạy cảm vào lỗi upload", async () => {
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    const pending = accountProfileApi.uploadAvatar("secret-token", file);
    const request = MockXmlHttpRequest.instances[0];
    request.status = 413;
    request.responseText = JSON.stringify({
      code: "PAYLOAD_TOO_LARGE",
      internalPath: "/srv/lms/private/avatar",
      message: "Ảnh vượt quá giới hạn",
    });
    request.onload?.();

    await expect(pending).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
      message: "Ảnh vượt quá giới hạn",
      status: 413,
    });
    await pending.catch((error: unknown) => {
      const serialized = `${String(error)} ${JSON.stringify(error)}`;
      expect(serialized).not.toContain("secret-token");
      expect(serialized).not.toContain("/srv/lms/private/avatar");
    });
  });

  it("phát tín hiệu hết phiên khi raw upload trả 401", async () => {
    const expired = vi.fn();
    window.addEventListener("auth:expired", expired);
    const pending = accountProfileApi.uploadAvatar(
      "expired-token",
      new File(["avatar"], "avatar.webp", { type: "image/webp" }),
    );
    const request = MockXmlHttpRequest.instances[0];
    request.status = 401;
    request.responseText = JSON.stringify({
      code: "UNAUTHORIZED",
      message: "Phiên đã hết hạn",
    });
    request.onload?.();

    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
    expect(expired.mock.calls[0]?.[0]).toMatchObject({
      detail: { token: "expired-token" },
    });
    window.removeEventListener("auth:expired", expired);
  });

  it("PATCH chỉ gửi fullName và DELETE dùng token phiên", async () => {
    mocks.apiFetch.mockResolvedValue(profile);

    await accountProfileApi.update("session-token", "Cô Mai");
    await accountProfileApi.removeAvatar("session-token");

    expect(mocks.apiFetch).toHaveBeenNthCalledWith(1, "/users/me/profile", {
      body: JSON.stringify({ fullName: "Cô Mai" }),
      method: "PATCH",
      token: "session-token",
    });
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(2, "/users/me/avatar", {
      method: "DELETE",
      token: "session-token",
    });
  });
});
