// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountProfilePage from "./page";
import { FeedbackLanguageSwitcher, FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  removeAvatar: vi.fn(),
  update: vi.fn(),
  updateUserProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  user: {
    avatarUrl: null as string | null,
    email: "mai@example.test",
    fullName: "Cô Mai",
    role: "INSTRUCTOR" as const,
    sub: "64b000000000000000000011",
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    token: "session-token",
    updateUserProfile: mocks.updateUserProfile,
    user: mocks.user,
  }),
}));
vi.mock("@/lib/profile-api", () => ({
  accountProfileApi: {
    removeAvatar: mocks.removeAvatar,
    update: mocks.update,
    uploadAvatar: mocks.uploadAvatar,
  },
}));
vi.mock("@/components/account-security/profile-image-editor", () => ({
  ProfileImageEditor: ({
    onRemove,
    onUpload,
  }: {
    onRemove: () => Promise<void>;
    onUpload: (
      file: File,
      options: { onProgress: () => void; signal: AbortSignal },
    ) => Promise<void>;
  }) => (
    <div>
      <button
        onClick={() =>
          void onUpload(
            new File(["avatar"], "avatar.png", { type: "image/png" }),
            { onProgress() {}, signal: new AbortController().signal },
          )
        }
        type="button"
      >
        Tải ảnh thử
      </button>
      <button onClick={() => void onRemove()} type="button">
        Gỡ ảnh thử
      </button>
    </div>
  ),
}));

const updatedProfile = {
  avatarUrl:
    "http://localhost:4000/api/v1/public-assets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  email: "mai@example.test",
  fullName: "Nguyễn Mai",
  sub: "64b000000000000000000011",
};

beforeEach(() => {
  mocks.push.mockReset();
  mocks.removeAvatar.mockReset();
  mocks.removeAvatar.mockResolvedValue({ ...updatedProfile, avatarUrl: null });
  mocks.update.mockReset();
  mocks.update.mockResolvedValue(updatedProfile);
  mocks.updateUserProfile.mockReset();
  mocks.uploadAvatar.mockReset();
  mocks.uploadAvatar.mockResolvedValue(updatedProfile);
  mocks.user.avatarUrl = null;
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

function renderPage() {
  return render(
    <App>
      <AccountProfilePage />
    </App>,
  );
}

describe("AccountProfilePage", () => {
  it("keeps user-entered names intact while localizing a safe structured error", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
    const diagnostic = "ProfileValidationError: /srv/private/profile.ts";
    mocks.update.mockRejectedValue({ message: diagnostic, status: 400, code: "PROFILE_NAME_INVALID" });
    render(<FeedbackLocaleProvider><FeedbackLanguageSwitcher /><App><AccountProfilePage /></App></FeedbackLocaleProvider>);
    fireEvent.change(screen.getByLabelText("Tên hiển thị"), { target: { value: "Học viên {name}" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Họ tên cần ít nhất 2 ký tự");
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("alert").textContent).toContain("Your full name must have at least 2 characters");
    expect((screen.getByLabelText("Display name") as HTMLInputElement).value).toBe("Học viên {name}");
    expect(screen.queryByText(diagnostic)).toBeNull();
    expect(mocks.updateUserProfile).not.toHaveBeenCalled();
  });

  it("giữ email chỉ đọc và cập nhật tên vào session hiện tại", async () => {
    renderPage();
    const email = await screen.findByLabelText("Email đăng nhập");
    expect(email).toHaveProperty("disabled", true);
    const fullName = screen.getByLabelText("Tên hiển thị");
    fireEvent.change(fullName, { target: { value: " Nguyễn Mai " } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith("session-token", "Nguyễn Mai"),
    );
    expect(mocks.updateUserProfile).toHaveBeenCalledWith(updatedProfile);
  });

  it("đồng bộ avatar upload/remove và mở được trang bảo mật", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Tải ảnh thử" }));
    await waitFor(() => expect(mocks.uploadAvatar).toHaveBeenCalledOnce());
    expect(mocks.updateUserProfile).toHaveBeenCalledWith(updatedProfile);

    fireEvent.click(screen.getByRole("button", { name: "Gỡ ảnh thử" }));
    await waitFor(() =>
      expect(mocks.removeAvatar).toHaveBeenCalledWith("session-token"),
    );
    expect(mocks.updateUserProfile).toHaveBeenLastCalledWith({
      ...updatedProfile,
      avatarUrl: null,
    });

    fireEvent.click(screen.getByRole("button", { name: "Mở cài đặt bảo mật" }));
    expect(mocks.push).toHaveBeenCalledWith("/account/security");
  });
});
