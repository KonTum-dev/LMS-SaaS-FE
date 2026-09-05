import { ApiError, apiFetch } from "@/lib/api";
import type { AuthResponse } from "@/lib/types";

export interface GoogleAuthChallenge {
  challengeToken: string;
  clientId: string;
  expiresAt: string;
  nonce: string;
}

export interface GoogleLinkStatus {
  email: string | null;
  linked: boolean;
  linkedAt: string | null;
}

export type GoogleLoginRecoveryAction = "EMAIL_LOGIN" | "CREATE_WORKSPACE";

interface AuthenticatedContext {
  token: string;
}

interface GoogleCredentialInput {
  challengeToken: string;
  credential: string;
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
  if (value === undefined) return undefined;
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

export function parseGoogleAuthChallenge(
  value: unknown,
): GoogleAuthChallenge {
  if (
    !isRecord(value) ||
    !boundedString(value.clientId, 512) ||
    !boundedString(value.challengeToken, 4_096) ||
    !boundedString(value.nonce, 512) ||
    !boundedString(value.expiresAt, 64) ||
    !Number.isFinite(Date.parse(value.expiresAt))
  ) {
    throw new ApiError(
      "Máy chủ trả cấu hình đăng nhập Google không hợp lệ",
      502,
      "GOOGLE_CHALLENGE_RESPONSE_INVALID",
    );
  }

  return {
    challengeToken: value.challengeToken,
    clientId: value.clientId,
    expiresAt: value.expiresAt,
    nonce: value.nonce,
  };
}

export function parseGoogleLinkStatus(value: unknown): GoogleLinkStatus {
  if (!isRecord(value) || typeof value.linked !== "boolean") {
    throw new ApiError(
      "Máy chủ trả trạng thái liên kết Google không hợp lệ",
      502,
      "GOOGLE_LINK_STATUS_INVALID",
    );
  }

  const emailValue = value.email ?? value.googleEmail;
  const email =
    emailValue === undefined || emailValue === null
      ? null
      : typeof emailValue === "string" &&
          emailValue.length <= 320 &&
          emailValue === emailValue.trim()
        ? emailValue
        : undefined;
  const linkedAt = nullableTimestamp(value.linkedAt);
  if (email === undefined || linkedAt === undefined) {
    throw new ApiError(
      "Máy chủ trả trạng thái liên kết Google không hợp lệ",
      502,
      "GOOGLE_LINK_STATUS_INVALID",
    );
  }

  return { email, linked: value.linked, linkedAt };
}

function validCredentialInput(input: GoogleCredentialInput): boolean {
  return (
    boundedString(input.credential, 16_384) &&
    boundedString(input.challengeToken, 4_096)
  );
}

function requireCredentialInput(input: GoogleCredentialInput): void {
  if (!validCredentialInput(input)) {
    throw new ApiError(
      "Phản hồi Google không hợp lệ, vui lòng thử lại",
      400,
      "GOOGLE_CREDENTIAL_INVALID",
    );
  }
}

export function googleAuthErrorMessage(
  error: unknown,
  intent: "LINK" | "LOGIN",
): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "GOOGLE_LINK_REQUIRED":
        return "Email này đã có tài khoản. Hãy đăng nhập bằng email và mật khẩu, sau đó liên kết Google trong Bảo mật tài khoản.";
      case "GOOGLE_ACCOUNT_NOT_REGISTERED":
      case "GOOGLE_SIGNUP_REQUIRED":
        return "Tài khoản Google này chưa có trên DX LMS. Hãy tạo workspace bằng email trước, sau đó liên kết Google trong Bảo mật tài khoản.";
      case "GOOGLE_ACCOUNT_UNAVAILABLE":
        return "Tài khoản DX LMS đã liên kết với Google hiện không khả dụng. Hãy liên hệ quản trị viên để được hỗ trợ.";
      case "GOOGLE_AUTH_NOT_CONFIGURED":
      case "GOOGLE_LOGIN_DISABLED":
      case "GOOGLE_INTEGRATION_DISABLED":
        return "Đăng nhập Google hiện chưa được cấu hình. Bạn vẫn có thể đăng nhập bằng mật khẩu.";
      case "GOOGLE_CHALLENGE_EXPIRED":
      case "GOOGLE_CHALLENGE_INVALID":
      case "GOOGLE_CREDENTIAL_INVALID":
      case "GOOGLE_ID_TOKEN_INVALID":
        return "Phiên xác minh Google đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.";
      case "GOOGLE_ACCOUNT_ALREADY_LINKED":
      case "GOOGLE_IDENTITY_IN_USE":
        return "Tài khoản Google này đã được liên kết với một tài khoản DX LMS khác.";
      case "GOOGLE_ALREADY_LINKED":
        return "Tài khoản DX LMS này đã liên kết với Google.";
      case "GOOGLE_EMAIL_MISMATCH":
        return "Hãy chọn tài khoản Google có cùng email với tài khoản DX LMS hiện tại.";
      case "GOOGLE_SUPER_ADMIN_FORBIDDEN":
        return intent === "LOGIN"
          ? "Tài khoản quản trị nền tảng không hỗ trợ đăng nhập bằng Google. Hãy dùng email và mật khẩu."
          : "Tài khoản quản trị nền tảng không hỗ trợ liên kết đăng nhập Google.";
      case "GOOGLE_LINK_NOT_FOUND":
        return "Tài khoản hiện chưa liên kết với Google.";
      case "CURRENT_PASSWORD_INVALID":
        return "Mật khẩu hiện tại không đúng.";
    }
  }

  return intent === "LOGIN"
    ? "Không thể đăng nhập bằng Google lúc này. Vui lòng thử lại hoặc dùng mật khẩu."
    : "Không thể liên kết tài khoản Google lúc này. Vui lòng thử lại.";
}

export function googleLoginRecoveryAction(
  error: unknown,
): GoogleLoginRecoveryAction | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === "GOOGLE_LINK_REQUIRED") return "EMAIL_LOGIN";
  if (
    error.code === "GOOGLE_ACCOUNT_NOT_REGISTERED" ||
    error.code === "GOOGLE_SIGNUP_REQUIRED"
  ) {
    return "CREATE_WORKSPACE";
  }
  return null;
}

export const googleAuthApi = {
  createLoginChallenge: async (
    signal?: AbortSignal,
  ): Promise<GoogleAuthChallenge> =>
    parseGoogleAuthChallenge(
      await apiFetch<unknown>("/auth/google/challenge", {
        body: JSON.stringify({ intent: "LOGIN" }),
        cache: "no-store",
        method: "POST",
        referrerPolicy: "no-referrer",
        signal,
      }),
    ),

  login: async (input: GoogleCredentialInput): Promise<AuthResponse> => {
    requireCredentialInput(input);
    return apiFetch<AuthResponse>("/auth/google/login", {
      body: JSON.stringify(input),
      cache: "no-store",
      method: "POST",
      referrerPolicy: "no-referrer",
    });
  },

  createLinkChallenge: async (
    { token }: AuthenticatedContext,
    currentPassword: string,
    signal?: AbortSignal,
  ): Promise<GoogleAuthChallenge> => {
    if (!currentPassword) {
      throw new ApiError(
        "Nhập mật khẩu hiện tại",
        400,
        "CURRENT_PASSWORD_REQUIRED",
      );
    }
    return parseGoogleAuthChallenge(
      await apiFetch<unknown>("/auth/google/link/challenge", {
        body: JSON.stringify({ intent: "LINK", currentPassword }),
        cache: "no-store",
        method: "POST",
        referrerPolicy: "no-referrer",
        signal,
        token,
      }),
    );
  },

  getLinkStatus: async (
    { token }: AuthenticatedContext,
    signal?: AbortSignal,
  ): Promise<GoogleLinkStatus> =>
    parseGoogleLinkStatus(
      await apiFetch<unknown>("/auth/google/link/status", {
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal,
        token,
      }),
    ),

  link: async (
    { token }: AuthenticatedContext,
    input: GoogleCredentialInput,
  ): Promise<GoogleLinkStatus> => {
    requireCredentialInput(input);
    return parseGoogleLinkStatus(
      await apiFetch<unknown>("/auth/google/link", {
        body: JSON.stringify(input),
        cache: "no-store",
        method: "POST",
        preserveSessionOnUnauthorizedCodes: [
          "GOOGLE_CHALLENGE_INVALID",
          "GOOGLE_ID_TOKEN_INVALID",
        ],
        referrerPolicy: "no-referrer",
        token,
      }),
    );
  },

  unlink: async (
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
    await apiFetch<unknown>("/auth/google/link", {
      body: JSON.stringify({ currentPassword }),
      cache: "no-store",
      method: "DELETE",
      referrerPolicy: "no-referrer",
      token,
    });
  },
};
