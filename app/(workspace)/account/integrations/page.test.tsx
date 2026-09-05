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
import { App } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { UserRole } from "@/lib/types";
import AccountIntegrationsPage from "./page";

const mocks = vi.hoisted(() => ({
  createLinkChallenge: vi.fn(),
  disconnectDrive: vi.fn(),
  getDriveStatus: vi.fn(),
  getLinkStatus: vi.fn(),
  googleDriveConnect: vi.fn(),
  googleLink: vi.fn(),
  googleUnlink: vi.fn(),
  logout: vi.fn(),
  navigateToDrive: vi.fn(),
  replace: vi.fn(),
  role: "TENANT_ADMIN" as UserRole,
  searchParam: null as string | null,
  scopeMode: "GLOBAL" as "GLOBAL" | "SCOPED",
  syncDrive: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => ({
    get: (name: string) => (name === "googleDrive" ? mocks.searchParam : null),
  }),
}));

vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    logout: mocks.logout,
    organization: {
      _id: "tenant-1",
      enabledModules: [],
      logoUrl: null,
      name: "Bright Academy",
      primaryColor: "#176BFF",
      slug: "bright-academy",
      status: "ACTIVE",
    },
    token: "session-token",
    user: {
      email: "owner@example.test",
      fullName: "Owner",
      membershipId: "membership-1",
      orgUnitScopeMode: mocks.scopeMode,
      role: mocks.role,
      sub: "user-1",
      tenantId: "tenant-1",
    },
    workspaces: [],
  }),
}));

vi.mock("@/components/account-security/google-identity-button", () => ({
  GoogleIdentityButton: ({
    accessibleLabel,
    getChallenge,
    onCredential,
    onError,
  }: {
    accessibleLabel: string;
    getChallenge: (signal: AbortSignal) => Promise<{ challengeToken: string }>;
    onCredential: (credential: string, challengeToken: string) => Promise<void>;
    onError?: (error: unknown) => void;
  }) => (
    <button
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

vi.mock("@/components/integrations/youtube-integration-card", () => ({
  YouTubeIntegrationCard: ({
    canPublish,
    canRevoke,
  }: {
    canPublish: boolean;
    canRevoke: boolean;
  }) => (
    <section aria-label="Kênh YouTube">
      {canPublish ? "Có quyền xuất bản YouTube" : "Không có quyền xuất bản YouTube"}
      {canRevoke ? " · Có quyền thu hồi YouTube" : " · Không có quyền thu hồi YouTube"}
    </section>
  ),
}));

vi.mock("@/lib/google-auth-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/google-auth-api")>();
  return {
    ...original,
    googleAuthApi: {
      createLinkChallenge: mocks.createLinkChallenge,
      getLinkStatus: mocks.getLinkStatus,
      link: mocks.googleLink,
      unlink: mocks.googleUnlink,
    },
  };
});

vi.mock("@/lib/google-drive-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/google-drive-api")>();
  return {
    ...original,
    googleDriveApi: {
      connect: mocks.googleDriveConnect,
      disconnect: mocks.disconnectDrive,
      getStatus: mocks.getDriveStatus,
      sync: mocks.syncDrive,
    },
    navigateToGoogleDriveAuthorization: mocks.navigateToDrive,
  };
});

const linkChallenge = {
  challengeToken: "link-challenge-token",
  clientId: "client.apps.googleusercontent.com",
  expiresAt: "2030-08-16T00:05:00.000Z",
  nonce: "server-nonce",
};

const disconnectedDrive = {
  accountEmail: null,
  connectedAt: null,
  lastSync: null,
  state: "DISCONNECTED" as const,
  syncInProgress: false,
};

const connectedDrive = {
  accountEmail: "owner@gmail.com",
  connectedAt: "2030-08-16T00:00:00.000Z",
  lastSync: {
    completedAt: "2030-08-16T00:05:00.000Z",
    file: {
      name: "DX-LMS-backup.json",
      url: "https://drive.google.com/file/d/file-id/view",
    },
    state: "SUCCEEDED" as const,
  },
  state: "CONNECTED" as const,
  syncInProgress: false,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <App>
          <AccountIntegrationsPage />
        </App>
      </QueryClientProvider>,
    ),
    queryClient,
  };
}

beforeEach(() => {
  mocks.searchParam = null;
  mocks.role = "TENANT_ADMIN";
  mocks.scopeMode = "GLOBAL";
  mocks.createLinkChallenge.mockReset();
  mocks.createLinkChallenge.mockResolvedValue(linkChallenge);
  mocks.disconnectDrive.mockReset();
  mocks.disconnectDrive.mockResolvedValue(undefined);
  mocks.getDriveStatus.mockReset();
  mocks.getDriveStatus.mockResolvedValue(disconnectedDrive);
  mocks.getLinkStatus.mockReset();
  mocks.getLinkStatus.mockResolvedValue({
    email: null,
    linked: false,
    linkedAt: null,
  });
  mocks.googleDriveConnect.mockReset();
  mocks.googleDriveConnect.mockResolvedValue(
    "https://accounts.google.com/o/oauth2/v2/auth?client_id=public-client",
  );
  mocks.googleLink.mockReset();
  mocks.googleLink.mockResolvedValue({
    email: "owner@example.test",
    linked: true,
    linkedAt: "2030-08-16T00:00:00.000Z",
  });
  mocks.googleUnlink.mockReset();
  mocks.googleUnlink.mockResolvedValue(undefined);
  mocks.logout.mockReset();
  mocks.navigateToDrive.mockReset();
  mocks.replace.mockReset();
  mocks.syncDrive.mockReset();
  mocks.syncDrive.mockResolvedValue(connectedDrive);
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
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AccountIntegrationsPage", () => {
  it("shows pending, prevents duplicate Drive link requests, then allows retry", async () => {
    const request = deferred<never>();
    mocks.googleDriveConnect.mockImplementationOnce(() => request.promise);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Liên kết Google Drive$/ }));
    const input = screen.getByLabelText("Mật khẩu hiện tại") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "CurrentPassword123" } });
    const form = input.closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    await waitFor(() => expect(mocks.googleDriveConnect).toHaveBeenCalledTimes(1));
    const confirm = screen.getByRole("button", { name: "Xác nhận và liên kết" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await waitFor(() => expect(confirm.className).toContain("ant-btn-loading"));
    expect(confirm.getAttribute("aria-busy")).toBe("true");
    expect((screen.getByRole("button", { name: "Hủy" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(form);
    await act(async () => { await Promise.resolve(); });
    expect(mocks.googleDriveConnect).toHaveBeenCalledTimes(1);
    await act(async () => { request.reject(new ApiError("invalid", 403, "CURRENT_PASSWORD_INVALID")); });
    expect(await screen.findByText("Mật khẩu hiện tại không đúng.")).toBeTruthy();
    expect(confirm.disabled).toBe(false);
    expect(confirm.className).not.toContain("ant-btn-loading");
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), { target: { value: "RetryPassword123" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.googleDriveConnect).toHaveBeenCalledTimes(2));
  });

  it("locks backup and disconnect until the request settles and unlocks after failure", async () => {
    mocks.getDriveStatus.mockResolvedValue(connectedDrive);
    const request = deferred<never>();
    mocks.syncDrive.mockImplementationOnce(() => request.promise);
    renderPage();
    const sync = await screen.findByRole("button", { name: /Đồng bộ ngay$/ }) as HTMLButtonElement;
    act(() => { fireEvent.click(sync); fireEvent.click(sync); });
    await waitFor(() => expect(mocks.syncDrive).toHaveBeenCalledTimes(1));
    expect(sync.disabled).toBe(true);
    expect(sync.className).toContain("ant-btn-loading");
    expect((screen.getByRole("button", { name: /Hủy liên kết$/ }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { request.reject(new Error("network")); });
    await waitFor(() => expect(sync.disabled).toBe(false));
    fireEvent.click(sync);
    await waitFor(() => expect(mocks.syncDrive).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Đã đồng bộ bản sao lưu lên Google Drive.")).toBeTruthy();
    expect(sync.className).not.toContain("ant-btn-loading");
  });

  it.each([
    ["INSTRUCTOR" as const, "SCOPED" as const, true, true],
    ["TENANT_ADMIN" as const, "GLOBAL" as const, true, true],
    ["TENANT_ADMIN" as const, "SCOPED" as const, false, true],
    ["LEARNER" as const, "GLOBAL" as const, false, true],
  ])(
    "role %s/%s truyền quyền publish = %s và revoke = %s",
    async (role, scopeMode, canPublish, canRevoke) => {
      mocks.role = role;
      mocks.scopeMode = scopeMode;
      renderPage();

      expect((await screen.findByLabelText("Kênh YouTube")).textContent).toBe(
        `${canPublish ? "Có" : "Không có"} quyền xuất bản YouTube · ${canRevoke ? "Có" : "Không có"} quyền thu hồi YouTube`,
      );
    },
  );

  it("không gọi API hoặc hiện action kết nối dữ liệu cho SUPER_ADMIN", async () => {
    mocks.role = "SUPER_ADMIN";
    renderPage();

    expect(
      await screen.findByText(
        "Kết nối dành cho tài khoản tổ chức",
      ),
    ).toBeTruthy();
    expect(mocks.getLinkStatus).not.toHaveBeenCalled();
    expect(mocks.getDriveStatus).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /Liên kết Google$/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Kết nối Google Drive$/ }),
    ).toBeNull();
  });

  it("chỉ giữ kết nối dữ liệu, không trộn phương thức đăng nhập", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Kết nối dữ liệu" }),
    ).toBeTruthy();
    expect(screen.queryByText("Đăng nhập bằng Google")).toBeNull();
    expect(screen.getByText("Google Drive")).toBeTruthy();
    expect(screen.getByText("Sao lưu dữ liệu của tổ chức lên Google Drive.")).toBeTruthy();
    expect(screen.getByText("Kết nối này không thay đổi cách đăng nhập Google.")).toBeTruthy();
    expect(screen.queryByText(/Các workspace hoặc tài khoản LMS khác.*có thể phải liên kết lại/i)).toBeNull();
    expect(mocks.getLinkStatus).not.toHaveBeenCalled();
  });

  it("xác nhận mật khẩu rồi mới điều hướng same-tab tới URL Drive đã kiểm tra", async () => {
    renderPage();
    await screen.findByRole("button", { name: /Liên kết Google Drive$/ });

    fireEvent.click(
      screen.getByRole("button", { name: /Liên kết Google Drive$/ }),
    );
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), {
      target: { value: "CurrentPassword123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận và liên kết" }),
    );

    await waitFor(() =>
      expect(mocks.googleDriveConnect).toHaveBeenCalledWith(
        { token: "session-token" },
        "CurrentPassword123",
      ),
    );
    expect(mocks.navigateToDrive).toHaveBeenCalledWith(
      "https://accounts.google.com/o/oauth2/v2/auth?client_id=public-client",
    );
    expect(screen.queryByDisplayValue("CurrentPassword123")).toBeNull();
  });

  it("hiện file backup an toàn, chạy sao lưu thủ công và xác nhận trước khi ngắt", async () => {
    mocks.getDriveStatus.mockResolvedValue(connectedDrive);
    renderPage();

    const fileLink = await screen.findByRole("link", {
      name: "Mở DX-LMS-backup.json trên Google Drive",
    });
    expect(fileLink.getAttribute("href")).toBe(
      "https://drive.google.com/file/d/file-id/view",
    );
    expect(fileLink.getAttribute("rel")).toBe("noopener noreferrer");

    fireEvent.click(screen.getByRole("button", { name: /Đồng bộ ngay$/ }));
    await waitFor(() =>
      expect(mocks.syncDrive).toHaveBeenCalledWith({ token: "session-token" }),
    );
    expect(await screen.findByText("Đã đồng bộ bản sao lưu lên Google Drive.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Hủy liên kết$/ }));
    expect(
      screen.getAllByText(
        /Các workspace hoặc tài khoản LMS khác.*có thể phải liên kết lại/i,
      ),
    ).toHaveLength(1);
    expect(
      screen.getAllByText(/Các tệp sao lưu đã tạo vẫn được giữ nguyên/i),
    ).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), {
      target: { value: "CurrentPassword123" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: /Hủy liên kết$/ }).at(-1)!,
    );
    await waitFor(() =>
      expect(mocks.disconnectDrive).toHaveBeenCalledWith(
        { token: "session-token" },
        "CurrentPassword123",
      ),
    );
  });

  it("hiện lỗi mật khẩu thân thiện và xóa giá trị khỏi form", async () => {
    mocks.googleDriveConnect.mockRejectedValue(
      new ApiError(
        "raw password/provider details",
        403,
        "CURRENT_PASSWORD_INVALID",
      ),
    );
    renderPage();
    await screen.findByRole("button", { name: /Liên kết Google Drive$/ });

    fireEvent.click(screen.getByRole("button", { name: /Liên kết Google Drive$/ }));
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), {
      target: { value: "WrongPassword123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận và liên kết" }),
    );

    expect(await screen.findByText("Mật khẩu hiện tại không đúng.")).toBeTruthy();
    expect(screen.queryByDisplayValue("WrongPassword123")).toBeNull();
    expect(document.body.textContent).not.toContain("raw password/provider details");
  });

  it("khóa sao lưu và ngắt kết nối khi backend đang xử lý", async () => {
    mocks.getDriveStatus.mockResolvedValue({
      ...connectedDrive,
      syncInProgress: true,
    });
    renderPage();

    const syncButton = await screen.findByRole("button", {
      name: /Đồng bộ ngay$/,
    });
    const disconnectButton = screen.getByRole("button", {
      name: /Hủy liên kết$/,
    });
    expect((syncButton as HTMLButtonElement).disabled).toBe(true);
    expect((disconnectButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Đang xử lý…")).toBeTruthy();
  });

  it("xử lý kết quả callback Drive rồi làm sạch query string", async () => {
    mocks.searchParam = "connected";
    mocks.getDriveStatus.mockResolvedValue(connectedDrive);
    renderPage();

    expect(await screen.findByText("Đã liên kết Google Drive để đồng bộ dữ liệu.")).toBeTruthy();
    expect(mocks.replace).toHaveBeenCalledWith("/account/integrations", {
      scroll: false,
    });
  });
});
