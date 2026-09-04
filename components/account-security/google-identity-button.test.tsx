// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleIdentityButton } from "./google-identity-button";

const mocks = vi.hoisted(() => ({
  credentialCallback: null as null | ((response: { credential?: string }) => void),
  initialize: vi.fn(),
  renderButton: vi.fn(),
}));

vi.mock("next/script", () => ({
  default: ({
    onError,
    onReady,
    src,
  }: {
    onError: () => void;
    onReady: () => void;
    src: string;
  }) => (
    <div data-src={src}>
      <button data-testid="script-ready" onClick={onReady} type="button">
        ready
      </button>
      <button data-testid="script-error" onClick={onError} type="button">
        error
      </button>
    </div>
  ),
}));

const challenge = {
  challengeToken: "challenge-token-secret",
  clientId: "client.apps.googleusercontent.com",
  expiresAt: "2030-08-16T00:05:00.000Z",
  nonce: "server-nonce",
};

beforeEach(() => {
  mocks.credentialCallback = null;
  mocks.initialize.mockReset();
  mocks.initialize.mockImplementation(
    (configuration: { callback: (response: { credential?: string }) => void }) => {
      mocks.credentialCallback = configuration.callback;
    },
  );
  mocks.renderButton.mockReset();
  mocks.renderButton.mockImplementation((parent: HTMLElement) => {
    const button = document.createElement("button");
    button.textContent = "Google-rendered button";
    parent.append(button);
  });
  Object.defineProperty(window, "google", {
    configurable: true,
    value: {
      accounts: {
        id: {
          initialize: mocks.initialize,
          renderButton: mocks.renderButton,
        },
      },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Reflect.deleteProperty(window, "google");
});

describe("GoogleIdentityButton", () => {
  it("tải đúng GIS, initialize bằng clientId/nonce rồi dùng button do Google render", async () => {
    const getChallenge = vi.fn().mockResolvedValue(challenge);
    render(
      <GoogleIdentityButton
        accessibleLabel="Đăng nhập bằng Google"
        getChallenge={getChallenge}
        intent="LOGIN"
        onCredential={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(
      screen.getByTestId("script-ready").parentElement?.getAttribute("data-src"),
    ).toBe("https://accounts.google.com/gsi/client");
    fireEvent.click(screen.getByTestId("script-ready"));

    await waitFor(() => expect(getChallenge).toHaveBeenCalledOnce());
    expect(mocks.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: challenge.clientId,
        nonce: challenge.nonce,
      }),
    );
    expect(mocks.renderButton).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        logo_alignment: "left",
        text: "signin_with",
        theme: "outline",
        type: "standard",
      }),
    );
    expect(screen.getByText("Google-rendered button")).toBeTruthy();
  });

  it("chỉ chuyển credential trực tiếp tới callback và không render bí mật", async () => {
    const onCredential = vi.fn().mockResolvedValue(undefined);
    render(
      <GoogleIdentityButton
        accessibleLabel="Đăng nhập bằng Google"
        getChallenge={vi.fn().mockResolvedValue(challenge)}
        intent="LOGIN"
        onCredential={onCredential}
      />,
    );
    fireEvent.click(screen.getByTestId("script-ready"));
    await waitFor(() => expect(mocks.credentialCallback).toBeTypeOf("function"));

    await act(async () => {
      mocks.credentialCallback?.({ credential: "google-id-credential-secret" });
      await Promise.resolve();
    });

    expect(onCredential).toHaveBeenCalledWith(
      "google-id-credential-secret",
      "challenge-token-secret",
    );
    expect(document.body.textContent).not.toContain("google-id-credential-secret");
    expect(document.body.textContent).not.toContain("challenge-token-secret");
  });

  it("hiện lỗi an toàn và cho thử lại khi script không tải được", () => {
    const onError = vi.fn();
    render(
      <GoogleIdentityButton
        accessibleLabel="Đăng nhập bằng Google"
        getChallenge={vi.fn().mockResolvedValue(challenge)}
        intent="LOGIN"
        onCredential={vi.fn().mockResolvedValue(undefined)}
        onError={onError}
      />,
    );

    fireEvent.click(screen.getByTestId("script-error"));

    expect(screen.getByRole("alert").textContent).toMatch(
      /Không thể tải nút Google/i,
    );
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeTruthy();
    expect(onError).toHaveBeenCalledOnce();
  });
});
