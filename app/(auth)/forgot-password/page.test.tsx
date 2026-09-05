// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import {
  FeedbackLanguageSwitcher,
  FeedbackLocaleProvider,
} from "@/components/feedback/feedback-locale";
import ForgotPasswordPage from "./page";

const mocks = vi.hoisted(() => ({
  forgotPassword: vi.fn(),
  message: { success: vi.fn() },
  reportError: vi.fn(),
}));

vi.mock("@/components/feedback/feedback-provider", () => ({
  useFeedback: () => ({
    message: mocks.message,
    reportError: mocks.reportError,
  }),
}));

vi.mock("@/lib/account-security-api", () => ({
  accountSecurityApi: { forgotPassword: mocks.forgotPassword },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <FeedbackLocaleProvider>
        <FeedbackLanguageSwitcher />
        <ForgotPasswordPage />
      </FeedbackLocaleProvider>
    </QueryClientProvider>,
  );
}

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
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  mocks.message.success.mockReset();
  mocks.reportError.mockReset();
  mocks.forgotPassword.mockReset();
  mocks.forgotPassword.mockResolvedValue({ accepted: true });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ForgotPasswordPage", () => {
  it("POST email và luôn hiển thị xác nhận trung lập khi backend accepted", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "learner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi hướng dẫn" }));

    await waitFor(() =>
      expect(mocks.forgotPassword).toHaveBeenCalledWith({
        email: "learner@example.com",
        locale: "vi",
      }),
    );
    expect(await screen.findByText("Đã tiếp nhận yêu cầu")).toBeTruthy();
    expect(screen.getByText(/Nếu email thuộc một tài khoản/)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Quay lại đăng nhập/ })
        .getAttribute("href"),
    ).toBe("/login");
    expect(mocks.message.success).toHaveBeenCalledWith(
      "Đã tiếp nhận yêu cầu. Nếu email thuộc một tài khoản, hướng dẫn đặt lại mật khẩu sẽ được gửi trong ít phút.",
    );
    expect(mocks.reportError).not.toHaveBeenCalled();
  });

  it("sends the selected English locale and keeps the acceptance message neutral", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "learner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send instructions" }));

    await waitFor(() =>
      expect(mocks.forgotPassword).toHaveBeenCalledWith({
        email: "learner@example.com",
        locale: "en",
      }),
    );
    expect(
      await screen.findByText(
        "If this email belongs to an account, password reset instructions will arrive in a few minutes.",
      ),
    ).toBeTruthy();
    expect(mocks.reportError).not.toHaveBeenCalled();
  });

  it("locks the form while pending and does not resend on duplicate submits or locale changes", async () => {
    const request = deferred<{ accepted: true }>();
    mocks.forgotPassword.mockReturnValueOnce(request.promise);
    renderPage();
    const email = screen.getByLabelText("Email");
    fireEvent.change(email, { target: { value: "learner@example.com" } });
    const form = email.closest("form");
    if (!form) throw new Error("Expected the forgot-password form");

    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.forgotPassword).toHaveBeenCalledTimes(1));
    expect(email).toHaveProperty("disabled", true);
    expect(form.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("button", { name: /Gửi hướng dẫn/ })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.submit(form);
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    fireEvent.submit(form);

    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.forgotPassword).toHaveBeenCalledTimes(1);
    expect(mocks.forgotPassword).toHaveBeenCalledWith({
      email: "learner@example.com",
      locale: "vi",
    });
    expect(email).toHaveProperty("disabled", true);

    await act(async () => request.resolve({ accepted: true }));
    expect(
      await screen.findByText(
        "If this email belongs to an account, password reset instructions will arrive in a few minutes.",
      ),
    ).toBeTruthy();
    expect(mocks.forgotPassword).toHaveBeenCalledTimes(1);
  });

  it("unlocks after a failed request and retries with the latest locale and unchanged email", async () => {
    const request = deferred<{ accepted: true }>();
    mocks.forgotPassword.mockReturnValueOnce(request.promise);
    renderPage();
    const email = screen.getByLabelText("Email");
    fireEvent.change(email, { target: { value: "learner@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi hướng dẫn" }));
    await waitFor(() => expect(email).toHaveProperty("disabled", true));

    await act(async () =>
      request.reject(new ApiError("Unavailable", 503, "SERVICE_UNAVAILABLE")),
    );
    await waitFor(() => expect(email).toHaveProperty("disabled", false));
    expect(email).toHaveProperty("value", "learner@example.com");
    expect(email.closest("form")?.getAttribute("aria-busy")).toBe("false");
    expect(mocks.message.success).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "English" }));
    fireEvent.click(screen.getByRole("button", { name: /Send instructions/ }));
    await waitFor(() => expect(mocks.forgotPassword).toHaveBeenCalledTimes(2));
    expect(mocks.forgotPassword).toHaveBeenLastCalledWith({
      email: "learner@example.com",
      locale: "en",
    });
    expect(
      await screen.findByText(
        "If this email belongs to an account, password reset instructions will arrive in a few minutes.",
      ),
    ).toBeTruthy();
  });

  it("hiện ApiError và cho thử lại khi request thất bại", async () => {
    mocks.forgotPassword.mockRejectedValue(
      new ApiError("Hệ thống tạm thời gián đoạn", 503, "SERVICE_UNAVAILABLE"),
    );
    renderPage();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "learner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi hướng dẫn" }));

    // A server failure is uncertain; do not render arbitrary backend diagnostics.
    expect(await screen.findByText(/Chưa xác nhận được kết quả/)).toBeTruthy();
    expect(screen.queryByText("Hệ thống tạm thời gián đoạn")).toBeNull();
    expect(screen.getByRole("button", { name: "Gửi hướng dẫn" })).toBeTruthy();
    expect(mocks.reportError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "SERVICE_UNAVAILABLE", status: 503 }),
      "Không thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại.",
    );
    expect(mocks.message.success).not.toHaveBeenCalled();
  });

  it("không hiển thị toast trước khi gửi yêu cầu", () => {
    renderPage();
    expect(mocks.message.success).not.toHaveBeenCalled();
    expect(mocks.reportError).not.toHaveBeenCalled();
  });
});
