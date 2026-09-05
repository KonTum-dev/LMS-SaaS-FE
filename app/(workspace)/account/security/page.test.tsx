// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import AccountSecurityPage from "./page";
import { FeedbackLanguageSwitcher, FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  logout: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({ logout: mocks.logout, token: "session-token" }),
}));
vi.mock("@/components/account-security/google-sign-in-method-card", () => ({
  GoogleSignInMethodCard: () => (
    <section aria-label="Phương thức đăng nhập">Liên kết đăng nhập Google</section>
  ),
}));
vi.mock("@/lib/account-security-api", () => ({
  accountSecurityApi: { changePassword: mocks.changePassword },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return {
    ...render(<QueryClientProvider client={queryClient}><AccountSecurityPage /></QueryClientProvider>),
    queryClient,
  };
}

function privateCacheSnapshot(queryClient: QueryClient): string {
  return JSON.stringify({
    mutations: queryClient.getMutationCache().getAll().map((mutation) => mutation.state.variables),
    queries: queryClient.getQueryCache().getAll().map((query) => ({ data: query.state.data, key: query.queryKey })),
  });
}

async function submitChange() {
  fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), { target: { value: "CurrentPassword123" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "NewPassword123" } });
  fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: "NewPassword123" } });
  fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
}

beforeEach(() => {
  mocks.changePassword.mockReset();
  mocks.changePassword.mockResolvedValue(undefined);
  mocks.logout.mockReset();
  mocks.replace.mockReset();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(), addListener: vi.fn(), matches: false,
      removeEventListener: vi.fn(), removeListener: vi.fn(),
    })),
  });
});

afterEach(cleanup);

describe("AccountSecurityPage", () => {
  it("shows Google sign-in methods separately from password changes", () => {
    renderPage();

    expect(screen.getByLabelText("Phương thức đăng nhập")).toBeTruthy();
    expect(screen.getByText("Liên kết đăng nhập Google")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Đổi mật khẩu" })).toBeTruthy();
  });

  it("keeps structured password errors localized and preserves the entered passwords", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
    const diagnostic = "Private authentication stack: credential=not-a-real-secret";
    mocks.changePassword.mockRejectedValue(new ApiError(diagnostic, 403, "CURRENT_PASSWORD_INVALID"));
    render(<FeedbackLocaleProvider><FeedbackLanguageSwitcher /><AccountSecurityPage /></FeedbackLocaleProvider>);
    await submitChange();
    expect((await screen.findByRole("alert")).textContent).toContain("Mật khẩu hiện tại chưa chính xác");
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("alert").textContent).toContain("Your current password is incorrect.");
    expect(screen.queryByText(diagnostic)).toBeNull();
    expect((screen.getByLabelText("Current password") as HTMLInputElement).value).toBe("CurrentPassword123");
    expect(mocks.logout).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("đổi mật khẩu bằng token phiên rồi logout trước khi về login", async () => {
    const { queryClient } = renderPage();
    await submitChange();

    await waitFor(() => expect(mocks.changePassword).toHaveBeenCalledWith(
      { token: "session-token" },
      { currentPassword: "CurrentPassword123", newPassword: "NewPassword123" },
    ));
    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenCalledWith("/login");
    expect(mocks.logout.mock.invocationCallOrder[0]).toBeLessThan(mocks.replace.mock.invocationCallOrder[0]);
    const cache = privateCacheSnapshot(queryClient);
    expect(cache).not.toContain("CurrentPassword123");
    expect(cache).not.toContain("NewPassword123");
  });

  it("403 sai mật khẩu hiện tại giữ nguyên session, cache và trang", async () => {
    mocks.changePassword.mockRejectedValue(new ApiError("Mật khẩu hiện tại không đúng", 403, "CURRENT_PASSWORD_INVALID"));
    const { queryClient } = renderPage();
    await submitChange();

    expect(await screen.findByText("Mật khẩu hiện tại chưa chính xác. Hãy nhập lại; không chia sẻ mật khẩu với người khác.")).toBeTruthy();
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Đổi mật khẩu" })).toBeTruthy();
    const cache = privateCacheSnapshot(queryClient);
    expect(cache).not.toContain("CurrentPassword123");
    expect(cache).not.toContain("NewPassword123");
  });

  it("409 credential đổi đồng thời xóa phiên trước khi về login", async () => {
    mocks.changePassword.mockRejectedValue(new ApiError(
      "Thông tin đăng nhập đã thay đổi; vui lòng đăng nhập lại",
      409,
      "CREDENTIAL_CHANGED_RELOGIN",
    ));
    renderPage();
    await submitChange();

    await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
    expect(mocks.replace).toHaveBeenCalledWith("/login");
    expect(mocks.logout.mock.invocationCallOrder[0]).toBeLessThan(mocks.replace.mock.invocationCallOrder[0]);
  });
});
