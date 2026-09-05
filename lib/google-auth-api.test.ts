import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import {
  googleAuthApi,
  googleAuthErrorMessage,
  googleLoginRecoveryAction,
  parseGoogleAuthChallenge,
  parseGoogleLinkStatus,
} from "./google-auth-api";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiFetch: mocks.apiFetch };
});

const challenge = {
  challengeToken: "challenge-token",
  clientId: "client.apps.googleusercontent.com",
  expiresAt: "2030-08-16T00:05:00.000Z",
  nonce: "server-nonce",
};

describe("Google auth API", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
  });

  it("chỉ nhận challenge và trạng thái liên kết theo allow-list", () => {
    expect(
      parseGoogleAuthChallenge({ ...challenge, credential: "must-drop" }),
    ).toEqual(challenge);
    expect(
      parseGoogleLinkStatus({
        googleEmail: "teacher@example.test",
        linked: true,
        linkedAt: "2030-08-16T00:00:00.000Z",
        refreshToken: "must-drop",
      }),
    ).toEqual({
      email: "teacher@example.test",
      linked: true,
      linkedAt: "2030-08-16T00:00:00.000Z",
    });
    expect(() => parseGoogleAuthChallenge({ ...challenge, nonce: "" })).toThrow(
      ApiError,
    );
    expect(() => parseGoogleLinkStatus({ linked: "yes" })).toThrow(ApiError);
  });

  it("tạo challenge LOGIN không token và gửi credential chỉ trong body", async () => {
    mocks.apiFetch.mockResolvedValueOnce(challenge).mockResolvedValueOnce({
      accessToken: "lms-token",
      effectiveAccess: null,
      organization: null,
      user: {
        email: "teacher@example.test",
        fullName: "Teacher",
        role: "INSTRUCTOR",
        sub: "user-id",
      },
      workspaces: [],
    });
    const signal = new AbortController().signal;

    await googleAuthApi.createLoginChallenge(signal);
    await googleAuthApi.login({
      challengeToken: "challenge-token",
      credential: "google-id-credential",
    });

    expect(mocks.apiFetch).toHaveBeenNthCalledWith(1, "/auth/google/challenge", {
      body: JSON.stringify({ intent: "LOGIN" }),
      cache: "no-store",
      method: "POST",
      referrerPolicy: "no-referrer",
      signal,
    });
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(2, "/auth/google/login", {
      body: JSON.stringify({
        challengeToken: "challenge-token",
        credential: "google-id-credential",
      }),
      cache: "no-store",
      method: "POST",
      referrerPolicy: "no-referrer",
    });
    expect(mocks.apiFetch.mock.calls[1][0]).not.toContain(
      "google-id-credential",
    );
  });

  it("xác nhận mật khẩu khi lấy LINK challenge nhưng link chỉ gửi credential", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(challenge)
      .mockResolvedValueOnce({
        email: "teacher@example.test",
        linked: true,
        linkedAt: "2030-08-16T00:00:00.000Z",
      });
    const signal = new AbortController().signal;

    await googleAuthApi.createLinkChallenge(
      { token: "session-token" },
      "CurrentPassword123",
      signal,
    );
    await googleAuthApi.link(
      { token: "session-token" },
      {
        challengeToken: "challenge-token",
        credential: "google-id-credential",
      },
    );

    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      1,
      "/auth/google/link/challenge",
      {
        body: JSON.stringify({
          intent: "LINK",
          currentPassword: "CurrentPassword123",
        }),
        cache: "no-store",
        method: "POST",
        referrerPolicy: "no-referrer",
        signal,
        token: "session-token",
      },
    );
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(2, "/auth/google/link", {
      body: JSON.stringify({
        challengeToken: "challenge-token",
        credential: "google-id-credential",
      }),
      cache: "no-store",
      method: "POST",
      preserveSessionOnUnauthorizedCodes: [
        "GOOGLE_CHALLENGE_INVALID",
        "GOOGLE_ID_TOKEN_INVALID",
      ],
      referrerPolicy: "no-referrer",
      token: "session-token",
    });
    expect(mocks.apiFetch.mock.calls[1][1].body).not.toContain(
      "CurrentPassword123",
    );
  });

  it("đọc trạng thái và hủy liên kết với mật khẩu hiện tại", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce({ email: null, linked: false, linkedAt: null })
      .mockResolvedValueOnce(undefined);
    const signal = new AbortController().signal;

    await expect(
      googleAuthApi.getLinkStatus({ token: "session-token" }, signal),
    ).resolves.toEqual({ email: null, linked: false, linkedAt: null });
    await googleAuthApi.unlink(
      { token: "session-token" },
      "CurrentPassword123",
    );

    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      1,
      "/auth/google/link/status",
      {
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal,
        token: "session-token",
      },
    );
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(2, "/auth/google/link", {
      body: JSON.stringify({ currentPassword: "CurrentPassword123" }),
      cache: "no-store",
      method: "DELETE",
      referrerPolicy: "no-referrer",
      token: "session-token",
    });
  });

  it("map lỗi đăng nhập/liên kết mà không hiển thị message nhạy cảm", () => {
    const raw = "credential eyJhbGciOi...";
    expect(
      googleAuthErrorMessage(
        new ApiError(raw, 409, "GOOGLE_LINK_REQUIRED"),
        "LOGIN",
      ),
    ).toMatch(/đăng nhập bằng email và mật khẩu/i);
    expect(
      googleAuthErrorMessage(
        new ApiError(raw, 404, "GOOGLE_SIGNUP_REQUIRED"),
        "LOGIN",
      ),
    ).toMatch(/chưa có trên DX LMS/i);
    expect(
      googleAuthErrorMessage(
        new ApiError(raw, 403, "CURRENT_PASSWORD_INVALID"),
        "LINK",
      ),
    ).toBe("Mật khẩu hiện tại không đúng.");
    expect(
      googleAuthErrorMessage(new ApiError(raw, 500), "LOGIN"),
    ).not.toContain(raw);
    expect(
      googleAuthErrorMessage(
        new ApiError(raw, 404, "GOOGLE_ACCOUNT_UNAVAILABLE"),
        "LOGIN",
      ),
    ).toMatch(/không khả dụng/i);
  });

  it("maps backend login codes to actionable recovery without guessing", () => {
    expect(
      googleLoginRecoveryAction(
        new ApiError("raw", 409, "GOOGLE_LINK_REQUIRED"),
      ),
    ).toBe("EMAIL_LOGIN");
    expect(
      googleLoginRecoveryAction(
        new ApiError("raw", 404, "GOOGLE_SIGNUP_REQUIRED"),
      ),
    ).toBe("CREATE_WORKSPACE");
    expect(
      googleLoginRecoveryAction(
        new ApiError("raw", 404, "GOOGLE_ACCOUNT_NOT_REGISTERED"),
      ),
    ).toBe("CREATE_WORKSPACE");
    expect(
      googleLoginRecoveryAction(
        new ApiError("raw", 404, "GOOGLE_ACCOUNT_UNAVAILABLE"),
      ),
    ).toBeNull();
  });
});
