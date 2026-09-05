import { apiFetch } from "@/lib/api";
import type { Locale } from "@/lib/i18n/locale";

export interface ForgotPasswordInput {
  email: string;
  locale?: Locale;
}

export interface ForgotPasswordResponse {
  accepted: true;
}

export interface ResetPasswordInput {
  newPassword: string;
  token: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

interface AccountSecurityApiContext {
  token: string;
}

export const accountSecurityApi = {
  forgotPassword: (input: ForgotPasswordInput) =>
    apiFetch<ForgotPasswordResponse>("/auth/password/forgot", {
      body: JSON.stringify(input),
      method: "POST",
    }),
  resetPassword: (input: ResetPasswordInput) =>
    apiFetch<void>("/auth/password/reset", {
      body: JSON.stringify(input),
      method: "POST",
    }),
  changePassword: ({ token }: AccountSecurityApiContext, input: ChangePasswordInput) =>
    apiFetch<void>("/auth/password/change", {
      body: JSON.stringify(input),
      method: "POST",
      token,
    }),
};
