// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import LoginPage from "./page";

const mocks = vi.hoisted(() => ({
  auth: {
    captureAuthGeneration: vi.fn(),
    consumeAuthResponse: vi.fn(),
    loading: false,
    login: vi.fn(),
    user: null as null | { email: string; sub: string },
  },
  getSearchParam: vi.fn(),
  googleLogin: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => ({ get: mocks.getSearchParam }),
}));

vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => mocks.auth,
}));
vi.mock("@/components/account-security/google-identity-button", () => ({
  GoogleIdentityButton: ({
    accessibleLabel,
    disabled,
    onCredential,
    onError,
  }: {
    accessibleLabel: string;
    disabled?: boolean;
    onCredential: (credential: string, challengeToken: string) => Promise<void>;
    onError?: (error: unknown) => void;
  }) => (
    <button
      disabled={disabled}
      onClick={() =>
        void onCredential("google-id-credential-secret", "challenge-token").catch(
          (caught) => onError?.(caught),
        )
      }
      type="button"
    >
      {accessibleLabel}
    </button>
  ),
}));
vi.mock("@/lib/google-auth-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/google-auth-api")>();
  return {
    ...original,
    googleAuthApi: {
      ...original.googleAuthApi,
      login: mocks.googleLogin,
    },
  };
});

const googleAuthResponse = {
  accessToken: "google-session-token",
  effectiveAccess: null,
  organization: null,
  user: {
    email: "owner@example.com",
    fullName: "Owner",
    role: "TENANT_ADMIN" as const,
    sub: "owner-id",
  },
  workspaces: [],
};

beforeEach(() => {
  mocks.auth.loading = false;
  mocks.auth.user = null;
  mocks.auth.captureAuthGeneration.mockReset();
  mocks.auth.captureAuthGeneration.mockReturnValue(7);
  mocks.auth.consumeAuthResponse.mockReset();
  mocks.auth.consumeAuthResponse.mockResolvedValue(undefined);
  mocks.auth.login.mockResolvedValue(undefined);
  mocks.googleLogin.mockReset();
  mocks.googleLogin.mockResolvedValue(googleAuthResponse);
  mocks.getSearchParam.mockReturnValue(null);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(), addListener: vi.fn(), matches: false,
      removeEventListener: vi.fn(), removeListener: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DX LMS login", () => {
  it("hiển thị lockup và thông điệp DX LMS trên cả hai panel", () => {
    render(<LoginPage />);

    const brandLockups = screen
      .getAllByRole("img", { name: "DX LMS" })
      .filter((node) => node.tagName === "SPAN");
    expect(brandLockups).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Vận hành đào tạo. Đúng người, đúng việc." })).toBeTruthy();
    expect(screen.getByText(/không gian riêng mang bản sắc của tổ chức/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Đăng nhập bằng Google" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Quên mật khẩu?" }).getAttribute("href")).toBe("/forgot-password");
    expect(screen.getByRole("link", { name: "Tạo workspace dùng thử" }).getAttribute("href")).toBe("/register");
  });

  it("khóa submit trong lúc đang xác minh phiên lưu cũ", () => {
    mocks.auth.loading = true;
    render(<LoginPage />);

    expect((screen.getByRole("button", { name: /Đăng nhập$/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Đăng nhập bằng Google" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("đăng nhập GIS bằng challenge rồi consume session theo auth generation", async () => {
    mocks.getSearchParam.mockReturnValue("/invite/invite-token");
    render(<LoginPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Đăng nhập bằng Google" }),
    );

    await waitFor(() =>
      expect(mocks.googleLogin).toHaveBeenCalledWith({
        challengeToken: "challenge-token",
        credential: "google-id-credential-secret",
      }),
    );
    expect(mocks.auth.captureAuthGeneration).toHaveBeenCalledOnce();
    expect(mocks.auth.consumeAuthResponse).toHaveBeenCalledWith(
      googleAuthResponse,
      7,
    );
    expect(mocks.replace).toHaveBeenCalledWith("/invite/invite-token");
    expect(document.body.textContent).not.toContain("google-id-credential-secret");
  });

  it.each([
    [
      "GOOGLE_LINK_REQUIRED",
      "Email này đã có tài khoản. Hãy đăng nhập bằng mật khẩu",
    ],
    [
      "GOOGLE_ACCOUNT_NOT_REGISTERED",
      "Tài khoản Google này chưa có trên DX LMS",
    ],
  ])("hiện lỗi Google thân thiện cho %s", async (code, expected) => {
    mocks.googleLogin.mockRejectedValue(
      new ApiError("raw credential provider error", 409, code),
    );
    render(<LoginPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Đăng nhập bằng Google" }),
    );

    expect(await screen.findByText(new RegExp(expected))).toBeTruthy();
    expect(document.body.textContent).not.toContain("raw credential provider error");
  });

  it("đi tiếp tới đường dẫn nội bộ sau khi đăng nhập", async () => {
    mocks.getSearchParam.mockReturnValue("/invite/invite-token");
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "Owner@123" } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() => expect(mocks.auth.login).toHaveBeenCalledWith("owner@example.com", "Owner@123"));
    expect(mocks.replace).toHaveBeenCalledWith("/invite/invite-token");
  });

  it.each([
    ["https://evil.example/steal", "/dashboard"],
    ["//evil.example/steal", "/dashboard"],
    ["/%2f%2fevil.example/steal", "/dashboard"],
    ["/\\\\evil.example/steal", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    [" /invite/token", "/dashboard"],
    ["/courses?tab=mine#active", "/courses?tab=mine#active"],
  ])("chỉ điều hướng next nội bộ: %s thành %s", async (value, expected) => {
    mocks.getSearchParam.mockReturnValue(value);
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "Owner@123" } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(expected));
  });
});
