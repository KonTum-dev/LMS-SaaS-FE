// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { ViewerScope } from "@/lib/query-keys";
import { YouTubeIntegrationCard } from "./youtube-integration-card";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  getStatus: vi.fn(),
  logout: vi.fn(),
  navigate: vi.fn(),
  replace: vi.fn(),
  searchParam: null as string | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => ({
    get: (name: string) => (name === "youtube" ? mocks.searchParam : null),
  }),
}));

vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({ logout: mocks.logout }),
}));

vi.mock("@/lib/youtube-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/youtube-api")>();
  return {
    ...original,
    navigateToYouTubeAuthorization: mocks.navigate,
    youtubeApi: {
      ...original.youtubeApi,
      connect: mocks.connect,
      disconnect: mocks.disconnect,
      getStatus: mocks.getStatus,
    },
  };
});

const scope: ViewerScope = {
  membershipId: "membership-1",
  role: "INSTRUCTOR",
  tenantId: "tenant-1",
  viewerId: "teacher-1",
};

function renderCard({
  canPublish = true,
  canRevoke = true,
}: {
  canPublish?: boolean;
  canRevoke?: boolean;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <App>
          <YouTubeIntegrationCard
            canPublish={canPublish}
            canRevoke={canRevoke}
            scope={scope}
            token="session-token"
          />
        </App>
      </QueryClientProvider>,
    ),
    queryClient,
  };
}

beforeEach(() => {
  mocks.searchParam = null;
  mocks.connect.mockReset().mockResolvedValue(
    "https://accounts.google.com/o/oauth2/v2/auth?client_id=youtube-client",
  );
  mocks.disconnect.mockReset().mockResolvedValue(undefined);
  mocks.getStatus.mockReset().mockResolvedValue({
    channel: null,
    connectedAt: null,
    state: "DISCONNECTED",
    uploadEnabled: false,
  });
  mocks.logout.mockReset();
  mocks.navigate.mockReset();
  mocks.replace.mockReset();
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

describe("YouTubeIntegrationCard", () => {
  it("không gọi API hay render action khi tài khoản không thuộc tenant", () => {
    renderCard({ canPublish: false, canRevoke: false });

    expect(
      screen.getByText(
        "Không có kết nối YouTube trong tài khoản này",
      ),
    ).toBeTruthy();
    expect(mocks.getStatus).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /Kết nối YouTube/ }),
    ).toBeNull();
  });

  it("cho thành viên không có quyền publish xem và ngắt grant của chính mình", async () => {
    mocks.getStatus.mockResolvedValue({
      channel: { id: "UC-safe", title: "Kênh cá nhân" },
      connectedAt: "2030-08-16T00:00:00.000Z",
      state: "CONNECTED",
      uploadEnabled: false,
    });
    renderCard({ canPublish: false, canRevoke: true });

    expect(await screen.findByText("Kênh cá nhân")).toBeTruthy();
    expect(mocks.getStatus).toHaveBeenCalledWith(
      { token: "session-token" },
      expect.any(AbortSignal),
    );
    expect(
      screen.queryByRole("button", { name: /Kết nối YouTube/ }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Ngắt kết nối YouTube/ }),
    );
    expect(screen.getByText(/workspace hoặc tài khoản DX LMS khác/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), {
      target: { value: "CurrentPassword123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Ngắt kết nối YouTube" }),
    );

    await waitFor(() =>
      expect(mocks.disconnect).toHaveBeenCalledWith(
        { token: "session-token" },
        "CurrentPassword123",
      ),
    );
  });

  it("chỉ hiện thông tin khi thành viên không có quyền publish và chưa kết nối", async () => {
    renderCard({ canPublish: false, canRevoke: true });

    expect((await screen.findAllByText("Chưa kết nối")).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByText("Quyền xuất bản không khả dụng với vai trò hiện tại"),
    ).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("cho thành viên không có quyền publish thu hồi grant cần xác thực lại", async () => {
    mocks.getStatus.mockResolvedValue({
      channel: { id: "UC-safe", title: "Kênh cũ" },
      connectedAt: "2030-08-16T00:00:00.000Z",
      state: "REAUTH_REQUIRED",
      uploadEnabled: false,
    });
    renderCard({ canPublish: false, canRevoke: true });

    expect(
      await screen.findByRole("button", { name: /Ngắt kết nối YouTube/ }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Kết nối lại YouTube/ }),
    ).toBeNull();
  });

  it("xác nhận mật khẩu rồi điều hướng same-tab tới OAuth URL đã kiểm tra", async () => {
    renderCard();
    fireEvent.click(
      await screen.findByRole("button", { name: /Kết nối YouTube/ }),
    );
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), {
      target: { value: "CurrentPassword123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận và kết nối" }),
    );

    await waitFor(() =>
      expect(mocks.connect).toHaveBeenCalledWith(
        { token: "session-token" },
        "CurrentPassword123",
      ),
    );
    expect(mocks.navigate).toHaveBeenCalledWith(
      "https://accounts.google.com/o/oauth2/v2/auth?client_id=youtube-client",
    );
    expect(screen.queryByDisplayValue("CurrentPassword123")).toBeNull();
  });

  it("ẩn lỗi provider thô khi mật khẩu không đúng", async () => {
    mocks.connect.mockRejectedValue(
      new ApiError("provider secret details", 403, "CURRENT_PASSWORD_INVALID"),
    );
    renderCard();
    fireEvent.click(
      await screen.findByRole("button", { name: /Kết nối YouTube/ }),
    );
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), {
      target: { value: "WrongPassword123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận và kết nối" }),
    );

    expect(await screen.findByText("Mật khẩu hiện tại không đúng.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("provider secret details");
    expect(screen.queryByDisplayValue("WrongPassword123")).toBeNull();
  });

  it("hiển thị kênh kết nối nhưng khóa upload theo trạng thái backend", async () => {
    mocks.getStatus.mockResolvedValue({
      channel: { id: "UC-safe", title: "Kênh giáo viên" },
      connectedAt: "2030-08-16T00:00:00.000Z",
      state: "CONNECTED",
      uploadEnabled: false,
    });
    renderCard();

    expect(await screen.findByText("Kênh giáo viên")).toBeTruthy();
    expect(screen.getByText("Tạm khóa xuất bản")).toBeTruthy();
    expect(screen.getByText("Xuất bản YouTube chưa khả dụng")).toBeTruthy();
  });

  it("cảnh báo ảnh hưởng các workspace khác trước khi thu hồi grant", async () => {
    mocks.getStatus.mockResolvedValue({
      channel: { id: "UC-safe", title: "Kênh giáo viên" },
      connectedAt: "2030-08-16T00:00:00.000Z",
      state: "CONNECTED",
      uploadEnabled: true,
    });
    renderCard();

    fireEvent.click(
      await screen.findByRole("button", { name: /Ngắt kết nối YouTube/ }),
    );

    expect(
      screen.getByText(/workspace hoặc tài khoản DX LMS khác/i),
    ).toBeTruthy();
    expect(screen.getByText(/video đã xuất bản vẫn được giữ nguyên/i)).toBeTruthy();
  });
});
