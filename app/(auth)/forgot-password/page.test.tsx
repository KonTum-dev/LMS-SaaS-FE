// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import ForgotPasswordPage from "./page";

const mocks = vi.hoisted(() => ({ forgotPassword: vi.fn() }));

vi.mock("@/lib/account-security-api", () => ({
  accountSecurityApi: { forgotPassword: mocks.forgotPassword },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><ForgotPasswordPage /></QueryClientProvider>);
}

beforeEach(() => {
  mocks.forgotPassword.mockReset();
  mocks.forgotPassword.mockResolvedValue({ accepted: true });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(), addListener: vi.fn(), matches: false,
      removeEventListener: vi.fn(), removeListener: vi.fn(),
    })),
  });
});

afterEach(cleanup);

describe("ForgotPasswordPage", () => {
  it("POST email và luôn hiển thị xác nhận trung lập khi backend accepted", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "learner@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi hướng dẫn" }));

    await waitFor(() => expect(mocks.forgotPassword).toHaveBeenCalledWith({ email: "learner@example.com" }));
    expect(await screen.findByText("Đã tiếp nhận yêu cầu")).toBeTruthy();
    expect(screen.getByText(/Nếu email thuộc một tài khoản/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Quay lại đăng nhập/ }).getAttribute("href")).toBe("/login");
  });

  it("hiện ApiError và cho thử lại khi request thất bại", async () => {
    mocks.forgotPassword.mockRejectedValue(new ApiError("Hệ thống tạm thời gián đoạn", 503, "SERVICE_UNAVAILABLE"));
    renderPage();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "learner@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi hướng dẫn" }));

    expect(await screen.findByText("Hệ thống tạm thời gián đoạn")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gửi hướng dẫn" })).toBeTruthy();
  });
});
