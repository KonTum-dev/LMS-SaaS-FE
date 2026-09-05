// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App, ConfigProvider } from "antd";
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
        <ConfigProvider theme={{ token: { motion: false } }}>
        <App>
          <YouTubeIntegrationCard
            canPublish={canPublish}
            canRevoke={canRevoke}
            scope={scope}
            token="session-token"
          />
        </App>
        </ConfigProvider>
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
  it("shows pending, prevents duplicate confirmations and unlocks on failure", async () => {
    let reject!: (reason: unknown) => void;
    mocks.connect.mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest; }));
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: /Liên kết YouTube/ }));
    const input = screen.getByLabelText("Mật khẩu hiện tại") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "CurrentPassword123" } });
    const form = input.closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    await waitFor(() => expect(mocks.connect).toHaveBeenCalledTimes(1));
    const confirm = screen.getByRole("button", { name: "Xác nhận và liên kết" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await waitFor(() => expect(confirm.className).toContain("ant-btn-loading"));
    expect(confirm.getAttribute("aria-busy")).toBe("true");
    expect((screen.getByRole("button", { name: "Hủy" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(form);
    await act(async () => { await Promise.resolve(); });
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    await act(async () => { reject(new ApiError("invalid", 403, "CURRENT_PASSWORD_INVALID")); });
    expect(await screen.findByText("Mật khẩu hiện tại không đúng.")).toBeTruthy();
    expect(confirm.disabled).toBe(false);
    expect(confirm.className).not.toContain("ant-btn-loading");
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), { target: { value: "RetryPassword123" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.connect).toHaveBeenCalledTimes(2));
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });

  it("keeps disconnect confirmation loading through status refresh", async () => {
    mocks.getStatus.mockResolvedValue({ channel: { id: "UC-safe", title: "Kênh cá nhân" }, connectedAt: null, state: "CONNECTED", uploadEnabled: true });
    let resolve!: (value: unknown) => void;
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: /Hủy liên kết YouTube/ }));
    mocks.getStatus.mockImplementationOnce(() => new Promise((resolveRequest) => { resolve = resolveRequest; }));
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), { target: { value: "CurrentPassword123" } });
    const confirm = screen.getByRole("button", { name: "Hủy liên kết YouTube" }) as HTMLButtonElement;
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.getStatus).toHaveBeenCalledTimes(2));
    expect(confirm.disabled).toBe(true);
    expect(confirm.className).toContain("ant-btn-loading");
    await act(async () => { resolve({ channel: null, connectedAt: null, state: "DISCONNECTED", uploadEnabled: false }); });
    const connect = await screen.findByRole("button", { name: /youtube Liên kết YouTube/ }) as HTMLButtonElement;
    await waitFor(() => expect(connect.disabled).toBe(false));
    expect(connect.className).not.toContain("ant-btn-loading");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("không gọi API hay render action khi tài khoản không thuộc tenant", () => {
    renderCard({ canPublish: false, canRevoke: false });

    expect(
      screen.getByText(
        "Không có kết nối YouTube trong tài khoản này",
      ),
    ).toBeTruthy();
    expect(mocks.getStatus).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /Liên kết YouTube/ }),
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
      screen.queryByRole("button", { name: /Liên kết YouTube/ }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Hủy liên kết YouTube/ }),
    );
    expect(screen.getByText(/workspace hoặc tài khoản DX LMS khác/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), {
      target: { value: "CurrentPassword123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Hủy liên kết YouTube" }),
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

    expect((await screen.findAllByText("Chưa liên kết")).length).toBeGreaterThan(
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
      await screen.findByRole("button", { name: /Hủy liên kết YouTube/ }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Liên kết lại YouTube/ }),
    ).toBeNull();
  });

  it("xác nhận mật khẩu rồi điều hướng same-tab tới OAuth URL đã kiểm tra", async () => {
    renderCard();
    fireEvent.click(
      await screen.findByRole("button", { name: /Liên kết YouTube/ }),
    );
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), {
      target: { value: "CurrentPassword123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận và liên kết" }),
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
      await screen.findByRole("button", { name: /Liên kết YouTube/ }),
    );
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), {
      target: { value: "WrongPassword123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận và liên kết" }),
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
      await screen.findByRole("button", { name: /Hủy liên kết YouTube/ }),
    );

    expect(
      screen.getByText(/workspace hoặc tài khoản DX LMS khác/i),
    ).toBeTruthy();
    expect(screen.getByText(/video đã xuất bản vẫn được giữ nguyên/i)).toBeTruthy();
  });
});
