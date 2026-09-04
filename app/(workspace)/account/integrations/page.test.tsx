// @vitest-environment jsdom

import {
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

  it("không gọi API hoặc hiện action Google cho SUPER_ADMIN", async () => {
    mocks.role = "SUPER_ADMIN";
    renderPage();

    expect(
      await screen.findByText(
        "Tích hợp Google không áp dụng cho quản trị nền tảng",
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

  it("tách Google login khỏi sao lưu Drive và hiển thị đúng workspace", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Ứng dụng kết nối" }),
    ).toBeTruthy();
    expect(screen.getByText("Đăng nhập bằng Google")).toBeTruthy();
    expect(screen.getByText("Sao lưu Google Drive")).toBeTruthy();
    expect(screen.getByText(/bản sao lưu một chiều/i)).toBeTruthy();
    expect(screen.getByText("Workspace hiện tại: Bright Academy")).toBeTruthy();
    expect(
      screen.getByText(
        /Các workspace hoặc tài khoản LMS khác.*có thể phải kết nối lại/i,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Các tệp sao lưu đã tạo vẫn được giữ nguyên/i))
      .toBeTruthy();
  });

  it("xác nhận và xóa mật khẩu trước khi render GIS để liên kết", async () => {
    const { queryClient } = renderPage();
    await screen.findByRole("button", { name: /Liên kết Google$/ });

    fireEvent.click(screen.getByRole("button", { name: /Liên kết Google$/ }));
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), {
      target: { value: "CurrentPassword123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận và tiếp tục" }),
    );

    await waitFor(() =>
      expect(mocks.createLinkChallenge).toHaveBeenCalledWith(
        { token: "session-token" },
        "CurrentPassword123",
      ),
    );
    expect(screen.queryByDisplayValue("CurrentPassword123")).toBeNull();
    const googleButton = await screen.findByRole("button", {
      name: "Chọn tài khoản Google để liên kết",
    });
    fireEvent.click(googleButton);

    await waitFor(() =>
      expect(mocks.googleLink).toHaveBeenCalledWith(
        { token: "session-token" },
        {
          challengeToken: "link-challenge-token",
          credential: "google-id-credential",
        },
      ),
    );
    const cache = JSON.stringify({
      mutations: queryClient
        .getMutationCache()
        .getAll()
        .map((mutation) => mutation.state.variables),
      queries: queryClient
        .getQueryCache()
        .getAll()
        .map((query) => ({ key: query.queryKey, data: query.state.data })),
    });
    expect(cache).not.toContain("CurrentPassword123");
    expect(cache).not.toContain("google-id-credential");
  });

  it("xác nhận mật khẩu rồi mới điều hướng same-tab tới URL Drive đã kiểm tra", async () => {
    renderPage();
    await screen.findByRole("button", { name: /Kết nối Google Drive$/ });

    fireEvent.click(
      screen.getByRole("button", { name: /Kết nối Google Drive$/ }),
    );
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), {
      target: { value: "CurrentPassword123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận và kết nối" }),
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

  it("xác nhận mật khẩu trước khi hủy liên kết Google", async () => {
    mocks.getLinkStatus.mockResolvedValue({
      email: "owner@example.test",
      linked: true,
      linkedAt: "2030-08-16T00:00:00.000Z",
    });
    renderPage();
    await screen.findByRole("button", { name: /Hủy liên kết$/ });

    fireEvent.click(screen.getByRole("button", { name: /Hủy liên kết$/ }));
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), {
      target: { value: "CurrentPassword123" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: /Hủy liên kết$/ }).at(-1)!,
    );

    await waitFor(() =>
      expect(mocks.googleUnlink).toHaveBeenCalledWith(
        { token: "session-token" },
        "CurrentPassword123",
      ),
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

    fireEvent.click(screen.getByRole("button", { name: /Sao lưu ngay$/ }));
    await waitFor(() =>
      expect(mocks.syncDrive).toHaveBeenCalledWith({ token: "session-token" }),
    );
    expect(await screen.findByText("Đã hoàn tất sao lưu lên Google Drive.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Ngắt kết nối$/ }));
    expect(
      screen.getAllByText(
        /Các workspace hoặc tài khoản LMS khác.*có thể phải kết nối lại/i,
      ),
    ).toHaveLength(2);
    expect(
      screen.getAllByText(/Các tệp sao lưu đã tạo vẫn được giữ nguyên/i),
    ).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), {
      target: { value: "CurrentPassword123" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: /Ngắt kết nối$/ }).at(-1)!,
    );
    await waitFor(() =>
      expect(mocks.disconnectDrive).toHaveBeenCalledWith(
        { token: "session-token" },
        "CurrentPassword123",
      ),
    );
  });

  it("hiện lỗi mật khẩu thân thiện và xóa giá trị khỏi form", async () => {
    mocks.createLinkChallenge.mockRejectedValue(
      new ApiError(
        "raw password/provider details",
        403,
        "CURRENT_PASSWORD_INVALID",
      ),
    );
    renderPage();
    await screen.findByRole("button", { name: /Liên kết Google$/ });

    fireEvent.click(screen.getByRole("button", { name: /Liên kết Google$/ }));
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), {
      target: { value: "WrongPassword123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận và tiếp tục" }),
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
      name: /Sao lưu ngay$/,
    });
    const disconnectButton = screen.getByRole("button", {
      name: /Ngắt kết nối$/,
    });
    expect((syncButton as HTMLButtonElement).disabled).toBe(true);
    expect((disconnectButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Đang xử lý…")).toBeTruthy();
  });

  it("xử lý kết quả callback Drive rồi làm sạch query string", async () => {
    mocks.searchParam = "connected";
    renderPage();

    expect(await screen.findByText("Đã kết nối Google Drive.")).toBeTruthy();
    expect(mocks.replace).toHaveBeenCalledWith("/account/integrations", {
      scroll: false,
    });
  });
});
