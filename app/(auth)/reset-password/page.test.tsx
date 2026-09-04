// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { ApiError } from "@/lib/api";
import ResetPasswordPage from "./page";

const validToken = "0123456789abcdef01234567.abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";
const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  replace: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({ logout: mocks.logout }),
}));
vi.mock("@/lib/account-security-api", () => ({
  accountSecurityApi: { resetPassword: mocks.resetPassword },
}));

function renderPage(url: string, strict = false) {
  window.history.replaceState({ test: true }, "", url);
  const replaceState = vi.spyOn(window.history, "replaceState");
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const page = <QueryClientProvider client={queryClient}><ResetPasswordPage /></QueryClientProvider>;
  const rendered = render(strict ? <StrictMode>{page}</StrictMode> : page);
  return { ...rendered, queryClient, replaceState };
}

function privateCacheSnapshot(queryClient: QueryClient): string {
  return JSON.stringify({
    mutations: queryClient.getMutationCache().getAll().map((mutation) => mutation.state.variables),
    queries: queryClient.getQueryCache().getAll().map((query) => ({ data: query.state.data, key: query.queryKey })),
  });
}

async function submitNewPassword(password = "NewPassword123") {
  fireEvent.change(await screen.findByLabelText("Mật khẩu mới"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu" }));
}

beforeEach(() => {
  mocks.logout.mockReset();
  mocks.replace.mockReset();
  mocks.resetPassword.mockReset();
  mocks.resetPassword.mockResolvedValue(undefined);
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
  vi.restoreAllMocks();
});

describe("ResetPasswordPage", () => {
  it("pre-paint consume một lần trong StrictMode, strip trước API rồi đóng phiên trước khi về login", async () => {
    const { queryClient, replaceState } = renderPage(`/reset-password#token=${validToken}`, true);
    await screen.findByLabelText("Mật khẩu mới");
    expect(window.location.hash).toBe("");
    expect(replaceState).toHaveBeenCalledOnce();
    expect(replaceState).toHaveBeenCalledWith({ test: true }, "", "/reset-password");

    await submitNewPassword();

    await waitFor(() => expect(mocks.resetPassword).toHaveBeenCalledWith({
      newPassword: "NewPassword123",
      token: validToken,
    }));
    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenCalledWith("/login");
    expect(replaceState.mock.invocationCallOrder[0]).toBeLessThan(mocks.resetPassword.mock.invocationCallOrder[0]);
    expect(mocks.logout.mock.invocationCallOrder[0]).toBeLessThan(mocks.replace.mock.invocationCallOrder[0]);
    const cache = privateCacheSnapshot(queryClient);
    expect(cache).not.toContain(validToken);
    expect(cache).not.toContain("NewPassword123");
  });

  it.each([
    ["thiếu token", "/reset-password"],
    ["token trong query", `/reset-password?token=${validToken}`],
    ["fragment sai", "/reset-password#token=invalid"],
  ])("chặn %s và không gọi API", async (_case, url) => {
    renderPage(url);

    expect(await screen.findByText(/Liên kết đặt lại mật khẩu không hợp lệ/)).toBeTruthy();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
    expect(window.location.search).not.toContain("token=");
    expect(screen.getByRole("link", { name: /Yêu cầu liên kết mới/ }).getAttribute("href")).toBe("/forgot-password");
  });

  it("giữ nguyên phiên và form với lỗi không làm thay đổi credential", async () => {
    mocks.resetPassword.mockRejectedValue(new ApiError("Mật khẩu mới đã được sử dụng", 409, "PASSWORD_REUSE_NOT_ALLOWED"));
    const { queryClient } = renderPage(`/reset-password#token=${validToken}`);
    await submitNewPassword();

    expect(await screen.findByText("Mật khẩu mới đã được sử dụng")).toBeTruthy();
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Đặt lại mật khẩu" })).toBeTruthy();
    const cache = privateCacheSnapshot(queryClient);
    expect(cache).not.toContain(validToken);
    expect(cache).not.toContain("NewPassword123");
  });

  it("410 token invalid chuyển sang trạng thái terminal và bỏ token khỏi ref", async () => {
    mocks.resetPassword.mockRejectedValue(new ApiError(
      "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn",
      410,
      "PASSWORD_RESET_TOKEN_INVALID",
    ));
    renderPage(`/reset-password#token=${validToken}`);
    await submitNewPassword();

    expect(await screen.findByText(/Liên kết đặt lại mật khẩu không hợp lệ/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Yêu cầu liên kết mới/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Đặt lại mật khẩu" })).toBeNull();
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("409 already-applied xóa phiên trước khi về login", async () => {
    mocks.resetPassword.mockRejectedValue(new ApiError(
      "Mật khẩu đã được đặt lại bởi yêu cầu này",
      409,
      "PASSWORD_RESET_ALREADY_APPLIED",
    ));
    renderPage(`/reset-password#token=${validToken}`);
    await submitNewPassword();

    await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
    expect(mocks.replace).toHaveBeenCalledWith("/login");
    expect(mocks.logout.mock.invocationCallOrder[0]).toBeLessThan(mocks.replace.mock.invocationCallOrder[0]);
  });

  it("chặn mật khẩu ngắn và xác nhận không khớp trước API", async () => {
    renderPage(`/reset-password#token=${validToken}`);
    await submitNewPassword("short");

    expect(await screen.findByText("Mật khẩu phải có ít nhất 8 ký tự")).toBeTruthy();
    expect(mocks.resetPassword).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "NewPassword123" } });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: "DifferentPassword123" } });
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu" }));

    expect(await screen.findByText("Mật khẩu xác nhận chưa khớp")).toBeTruthy();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });
});
