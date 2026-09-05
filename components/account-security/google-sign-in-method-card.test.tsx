// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { UserRole } from "@/lib/types";
import { GoogleSignInMethodCard } from "./google-sign-in-method-card";

const mocks = vi.hoisted(() => ({
  createLinkChallenge: vi.fn(),
  getLinkStatus: vi.fn(),
  link: vi.fn(),
  logout: vi.fn(),
  replace: vi.fn(),
  role: "TENANT_ADMIN" as UserRole,
  unlink: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    logout: mocks.logout,
    token: "session-token",
    user: {
      email: "owner@example.test",
      fullName: "Owner",
      role: mocks.role,
      sub: "user-1",
    },
  }),
}));

vi.mock("@/components/account-security/google-identity-button", () => ({
  GoogleIdentityButton: ({
    accessibleLabel,
    getChallenge,
    intent,
    onCredential,
    onError,
  }: {
    accessibleLabel: string;
    getChallenge: (signal: AbortSignal) => Promise<{ challengeToken: string }>;
    intent: string;
    onCredential: (credential: string, challengeToken: string) => Promise<void>;
    onError?: (error: unknown) => void;
  }) => (
    <button
      data-intent={intent}
      onClick={() => {
        void getChallenge(new AbortController().signal)
          .then((challenge) =>
            onCredential("google-id-credential", challenge.challengeToken),
          )
          .catch((caught) => onError?.(caught));
      }}
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
      createLinkChallenge: mocks.createLinkChallenge,
      getLinkStatus: mocks.getLinkStatus,
      link: mocks.link,
      unlink: mocks.unlink,
    },
  };
});

const challenge = {
  challengeToken: "link-challenge-token",
  clientId: "client.apps.googleusercontent.com",
  expiresAt: "2030-08-16T00:05:00.000Z",
  nonce: "server-nonce",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App>
        <GoogleSignInMethodCard />
      </App>
    </QueryClientProvider>,
  );
}

async function openGooglePicker(password = "CurrentPassword123") {
  fireEvent.click(
    await screen.findByRole("button", { name: /Liên kết tài khoản Google$/ }),
  );
  fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), {
    target: { value: password },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Xác nhận và tiếp tục" }),
  );
  return screen.findByRole("button", {
    name: "Chọn tài khoản Google để liên kết",
  });
}

beforeEach(() => {
  mocks.role = "TENANT_ADMIN";
  mocks.createLinkChallenge.mockReset().mockResolvedValue(challenge);
  mocks.getLinkStatus.mockReset().mockResolvedValue({
    email: null,
    linked: false,
    linkedAt: null,
  });
  mocks.link.mockReset().mockResolvedValue({
    email: "owner@example.test",
    linked: true,
    linkedAt: "2030-08-16T00:00:00.000Z",
  });
  mocks.unlink.mockReset().mockResolvedValue(undefined);
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("GoogleSignInMethodCard", () => {
  it("keeps Google identity in sign-in methods and separate from data access", async () => {
    renderCard();

    expect(screen.getByText("Phương thức đăng nhập")).toBeTruthy();
    expect(screen.getByText(/Google Drive và YouTube được quản lý riêng/i)).toBeTruthy();
    expect(
      await screen.findByRole("button", { name: /Liên kết tài khoản Google$/ }),
    ).toBeTruthy();
    expect(mocks.getLinkStatus).toHaveBeenCalledWith(
      { token: "session-token" },
      expect.any(AbortSignal),
    );
  });

  it("confirms the password, uses LINK intent and keeps verification pending", async () => {
    const request = deferred<{ email: string; linked: boolean; linkedAt: string }>();
    mocks.link.mockReturnValueOnce(request.promise);
    renderCard();

    const googleButton = await openGooglePicker();
    expect(googleButton.getAttribute("data-intent")).toBe("LINK");
    expect(screen.queryByDisplayValue("CurrentPassword123")).toBeNull();
    act(() => {
      fireEvent.click(googleButton);
      fireEvent.click(googleButton);
    });
    expect(await screen.findByRole("button", { name: /Đang xác minh với Google/ })).toBeTruthy();
    expect(mocks.link).toHaveBeenCalledTimes(1);

    await act(async () => {
      request.resolve({
        email: "owner@example.test",
        linked: true,
        linkedAt: "2030-08-16T00:00:00.000Z",
      });
    });

    expect(await screen.findByText("Google đã liên kết")).toBeTruthy();
    expect(screen.getByText(/lần đăng nhập tiếp theo/i)).toBeTruthy();
  });

  it("treats GOOGLE_ALREADY_LINKED as a usable sign-in method, not a fatal error", async () => {
    mocks.link.mockRejectedValueOnce(
      new ApiError("provider details", 409, "GOOGLE_ALREADY_LINKED"),
    );
    renderCard();

    fireEvent.click(await openGooglePicker());

    expect(
      await screen.findByText(/Tài khoản này đã liên kết Google/i),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain("provider details");
    await waitFor(() => expect(mocks.getLinkStatus).toHaveBeenCalledTimes(2));
  });

  it("unlinks only after password confirmation", async () => {
    mocks.getLinkStatus.mockResolvedValue({
      email: "owner@example.test",
      linked: true,
      linkedAt: "2030-08-16T00:00:00.000Z",
    });
    renderCard();
    fireEvent.click(
      await screen.findByRole("button", { name: /Hủy liên kết Google$/ }),
    );
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), {
      target: { value: "CurrentPassword123" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: /Hủy liên kết Google$/ }).at(-1)!,
    );

    await waitFor(() =>
      expect(mocks.unlink).toHaveBeenCalledWith(
        { token: "session-token" },
        "CurrentPassword123",
      ),
    );
    expect(screen.queryByDisplayValue("CurrentPassword123")).toBeNull();
  });

  it("does not call Google identity APIs for SUPER_ADMIN", () => {
    mocks.role = "SUPER_ADMIN";
    renderCard();

    expect(
      screen.getByText(
        "Tài khoản quản trị nền tảng không hỗ trợ liên kết đăng nhập Google.",
      ),
    ).toBeTruthy();
    expect(mocks.getLinkStatus).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /Liên kết tài khoản Google$/ }),
    ).toBeNull();
  });
});
