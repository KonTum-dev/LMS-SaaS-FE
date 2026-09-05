// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import LoginPage from "./page";
import { FeedbackLanguageSwitcher, FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";

const mocks = vi.hoisted(() => ({
  auth: {
    captureAuthGeneration: vi.fn(),
    consumeAuthResponse: vi.fn(),
    loading: false,
    login: vi.fn(),
    user: null as null | { email: string; sub: string },
  },
  getSearchParam: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  googleLogin: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => ({ get: mocks.getSearchParam }),
}));

vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => mocks.auth,
}));
vi.mock("@/components/feedback/feedback-provider", () => ({
  useFeedback: () => ({
    message: { success: mocks.toastSuccess },
    reportError: mocks.toastError,
    formatError: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
  }),
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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mocks.auth.loading = false;
  mocks.auth.user = null;
  mocks.auth.captureAuthGeneration.mockReset();
  mocks.auth.captureAuthGeneration.mockReturnValue(7);
  mocks.auth.consumeAuthResponse.mockReset();
  mocks.auth.consumeAuthResponse.mockResolvedValue(undefined);
  mocks.auth.login.mockReset();
  mocks.auth.login.mockResolvedValue(undefined);
  mocks.googleLogin.mockReset();
  mocks.googleLogin.mockResolvedValue(googleAuthResponse);
  mocks.getSearchParam.mockReturnValue(null);
  mocks.push.mockReset();
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
  vi.unstubAllGlobals();
});

describe("DX LMS login", () => {
  it("translates visible validation errors VI→EN without submitting or replacing inputs", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
    render(<FeedbackLocaleProvider><FeedbackLanguageSwitcher /><LoginPage /></FeedbackLocaleProvider>);
    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Mật khẩu");
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(await screen.findByText("Nhập email", { exact: true })).toBeTruthy();
    expect(await screen.findByText("Nhập mật khẩu", { exact: true })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(await screen.findByText("Enter your email", { exact: true })).toBeTruthy();
    expect(await screen.findByText("Enter your password", { exact: true })).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Nhập email", { exact: true })).toBeNull());
    expect(screen.getByLabelText("Email")).toBe(email);
    expect(screen.getByLabelText("Password")).toBe(password);
    fireEvent.change(email, { target: { value: "owner@example.com" } });
    fireEvent.change(password, { target: { value: "Draft-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    expect(email).toHaveProperty("value", "owner@example.com");
    expect(password).toHaveProperty("value", "Draft-password-123");
    expect(mocks.auth.login).not.toHaveBeenCalled();
    expect(mocks.googleLogin).not.toHaveBeenCalled();
    expect(mocks.auth.consumeAuthResponse).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("keeps one brand and a focused sign-in form with recovery and registration", () => {
    render(<LoginPage />);

    const brandLockups = screen
      .getAllByRole("img", { name: "DX LMS" })
      .filter((node) => node.tagName === "SPAN");
    expect(brandLockups).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Chào mừng trở lại" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Vận hành đào tạo. Đúng người, đúng việc." })).toBeNull();
    expect(screen.queryByText("Phiên đăng nhập được bảo vệ")).toBeNull();
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Đăng nhập bằng Google" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Quên mật khẩu?" }).getAttribute("href")).toBe("/forgot-password");
    expect(screen.getByRole("link", { name: "Tạo workspace" }).getAttribute("href")).toBe("/register");
    expect(screen.getByText("Đăng nhập để tiếp tục với DX LMS.")).toBeTruthy();
    expect(screen.getByText("Dùng tài khoản Google đã liên kết.")).toBeTruthy();
    expect(screen.getByLabelText("Email").getAttribute("autocomplete")).toBe("email");
    expect(screen.getByLabelText("Mật khẩu").getAttribute("autocomplete")).toBe("current-password");
  });

  it("translates the focused heading and sign-in controls without changing destinations", () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
    render(<FeedbackLocaleProvider><FeedbackLanguageSwitcher /><LoginPage /></FeedbackLocaleProvider>);

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeTruthy();
    expect(screen.getByText("Sign in to continue with DX LMS.")).toBeTruthy();
    expect(screen.getByText("Use your linked Google account.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe("/forgot-password");
    expect(screen.getByRole("link", { name: "Create workspace" }).getAttribute("href")).toBe("/register");
    expect(mocks.auth.login).not.toHaveBeenCalled();
    expect(mocks.googleLogin).not.toHaveBeenCalled();
  });

  it("khóa submit trong lúc đang xác minh phiên lưu cũ", () => {
    mocks.auth.loading = true;
    render(<LoginPage />);

    expect((screen.getByRole("button", { name: /Đăng nhập$/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Đăng nhập bằng Google" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText("Email")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Mật khẩu")).toHaveProperty("disabled", true);
  });

  it("shows email submission loading, blocks Google, and sends credentials only once", async () => {
    const request = deferred<void>();
    mocks.auth.login.mockReturnValueOnce(request.promise);
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "Owner@123" } });
    const submit = screen.getByRole("button", { name: "Đăng nhập" });
    fireEvent.click(submit);

    await waitFor(() => expect(mocks.auth.login).toHaveBeenCalledOnce());
    expect(submit.classList.contains("ant-btn-loading")).toBe(true);
    expect(screen.getByRole("button", { name: "Đăng nhập bằng Google" })).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Email")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Mật khẩu")).toHaveProperty("disabled", true);
    fireEvent.click(submit);
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập bằng Google" }));
    expect(mocks.auth.login).toHaveBeenCalledOnce();
    expect(mocks.googleLogin).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();

    await act(async () => request.resolve(undefined));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/dashboard"));
    expect(submit.classList.contains("ant-btn-loading")).toBe(false);
  });

  it("releases failed email loading and lets the same form retry without losing inputs", async () => {
    const request = deferred<void>();
    const error = new Error("Email hoặc mật khẩu không đúng");
    mocks.auth.login.mockReturnValueOnce(request.promise);
    render(<LoginPage />);

    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Mật khẩu");
    const submit = screen.getByRole("button", { name: "Đăng nhập" });
    fireEvent.change(email, { target: { value: "owner@example.com" } });
    fireEvent.change(password, { target: { value: "Owner@123" } });
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.auth.login).toHaveBeenCalledOnce());

    await act(async () => request.reject(error));

    expect(await screen.findByText("Email hoặc mật khẩu không đúng")).toBeTruthy();
    expect(mocks.toastError).toHaveBeenCalledWith(error, "Không thể đăng nhập");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(email).toHaveProperty("value", "owner@example.com");
    expect(password).toHaveProperty("value", "Owner@123");
    expect(screen.getByRole("button", { name: "Đăng nhập bằng Google" })).toHaveProperty("disabled", false);
    expect(submit.classList.contains("ant-btn-loading")).toBe(false);

    fireEvent.click(submit);

    await waitFor(() => expect(mocks.auth.login).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByText("Email hoặc mật khẩu không đúng")).toBeNull();
  });

  it("locks both sign-in methods while Google verification is pending and waits for session consumption", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
    const request = deferred<typeof googleAuthResponse>();
    const session = deferred<void>();
    mocks.googleLogin.mockReturnValueOnce(request.promise);
    mocks.auth.consumeAuthResponse.mockReturnValueOnce(session.promise);
    render(<FeedbackLocaleProvider><FeedbackLanguageSwitcher /><LoginPage /></FeedbackLocaleProvider>);

    const google = screen.getByRole("button", { name: "Đăng nhập bằng Google" });
    fireEvent.click(google);

    await waitFor(() => expect(mocks.googleLogin).toHaveBeenCalledOnce());
    expect(google).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /Đăng nhập$/ })).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Email")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Mật khẩu")).toHaveProperty("disabled", true);
    expect(screen.getByRole("status").textContent).toContain("Đang xác minh với Google…");
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("status").textContent).toContain("Verifying with Google…");
    expect(screen.getByLabelText("Password")).toHaveProperty("disabled", true);
    fireEvent.click(google);
    expect(mocks.googleLogin).toHaveBeenCalledOnce();
    expect(mocks.auth.login).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();

    await act(async () => request.resolve(googleAuthResponse));

    expect(mocks.auth.consumeAuthResponse).toHaveBeenCalledWith(googleAuthResponse, 7);
    expect(google).toHaveProperty("disabled", true);
    expect(mocks.replace).not.toHaveBeenCalled();

    await act(async () => session.resolve(undefined));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/dashboard"));
    expect(google).toHaveProperty("disabled", false);
    expect(screen.getByLabelText("Email")).toHaveProperty("disabled", false);
    expect(screen.queryByRole("status")).toBeNull();
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
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Đăng nhập thành công");
    expect(document.body.textContent).not.toContain("google-id-credential-secret");
  });

  it("focuses email login when a local account still needs Google linking", async () => {
    mocks.googleLogin.mockRejectedValue(
      new ApiError("raw credential provider error", 409, "GOOGLE_LINK_REQUIRED"),
    );
    render(<LoginPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Đăng nhập bằng Google" }),
    );

    expect(
      await screen.findByText(/Email này đã có tài khoản.*Bảo mật tài khoản/i),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Đăng nhập bằng email" }),
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Email"));
    expect(mocks.push).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("raw credential provider error");
  });

  it("clears the Google recovery action on retry and restores the email form after failure", async () => {
    mocks.googleLogin.mockRejectedValueOnce(
      new ApiError("raw credential provider error", 409, "GOOGLE_LINK_REQUIRED"),
    );
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập bằng Google" }));

    expect(await screen.findByRole("button", { name: "Đăng nhập bằng email" })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toHaveProperty("disabled", false);
    expect(screen.getByLabelText("Mật khẩu")).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "Đăng nhập bằng Google" })).toHaveProperty("disabled", false);
    expect(mocks.auth.consumeAuthResponse).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập bằng Google" }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/dashboard"));
    expect(mocks.googleLogin).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Đăng nhập bằng email" })).toBeNull();
  });

  it("offers workspace registration for the backend GOOGLE_SIGNUP_REQUIRED code", async () => {
    mocks.googleLogin.mockRejectedValue(
      new ApiError("raw credential provider error", 404, "GOOGLE_SIGNUP_REQUIRED"),
    );
    render(<LoginPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Đăng nhập bằng Google" }),
    );

    expect(
      await screen.findByText(/Tài khoản Google này chưa có.*Bảo mật tài khoản/i),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tạo workspace" }));
    expect(mocks.push).toHaveBeenCalledWith("/register");
    expect(document.body.textContent).not.toContain("raw credential provider error");
  });

  it("localizes the Google signup recovery message and CTA", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
    mocks.googleLogin.mockRejectedValue(
      new ApiError("raw credential provider error", 404, "GOOGLE_SIGNUP_REQUIRED"),
    );
    render(
      <FeedbackLocaleProvider>
        <FeedbackLanguageSwitcher />
        <LoginPage />
      </FeedbackLocaleProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Đăng nhập bằng Google" }),
    );
    await screen.findByRole("button", { name: "Tạo workspace" });
    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(
      await screen.findByText(/not registered on DX LMS.*Account security/i),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create workspace" })).toBeTruthy();
  });

  it("does not turn an unavailable linked account into a signup path", async () => {
    mocks.googleLogin.mockRejectedValue(
      new ApiError("raw credential provider error", 404, "GOOGLE_ACCOUNT_UNAVAILABLE"),
    );
    render(<LoginPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Đăng nhập bằng Google" }),
    );

    expect(
      await screen.findByText(/đã liên kết với Google hiện không khả dụng/i),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tạo workspace" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Đăng nhập bằng email" })).toBeNull();
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
    ["/account/security", "/account/security"],
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

  it.each([
    ["/account/security", "/account/security"],
    ["https://evil.example/steal", "/dashboard"],
    ["//evil.example/steal", "/dashboard"],
    ["/%2f%2fevil.example/steal", "/dashboard"],
    ["/courses?tab=mine#active", "/courses?tab=mine#active"],
  ])("applies the same safe next redirect after Google sign-in: %s", async (value, expected) => {
    mocks.getSearchParam.mockReturnValue(value);
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập bằng Google" }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(expected));
    expect(mocks.auth.consumeAuthResponse).toHaveBeenCalledWith(googleAuthResponse, 7);
  });

  it.each([
    ["/account/security", "/account/security"],
    ["https://evil.example/steal", "/dashboard"],
    ["/invite/invite-token", "/invite/invite-token"],
  ])("waits for the saved session to resolve before safely redirecting: %s", async (value, expected) => {
    mocks.getSearchParam.mockReturnValue(value);
    mocks.auth.user = { email: "owner@example.com", sub: "owner-id" };
    mocks.auth.loading = true;
    const { rerender } = render(<LoginPage />);

    expect(mocks.replace).not.toHaveBeenCalled();
    mocks.auth.loading = false;
    rerender(<LoginPage />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(expected));
    expect(mocks.auth.login).not.toHaveBeenCalled();
    expect(mocks.googleLogin).not.toHaveBeenCalled();
  });
});
