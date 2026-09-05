// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InvitationPage from "./page";
import { ApiError } from "@/lib/api";
import { FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  auth: {
    captureAuthGeneration: vi.fn(() => 7),
    consumeAuthResponse: vi.fn(),
    loading: false,
    logout: vi.fn(),
    token: "",
    user: null as null | { email: string; sub: string },
  },
  params: { token: "invite-token" },
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => mocks.params,
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@ant-design/icons", () => ({
  SafetyCertificateOutlined: () => null,
  UserAddOutlined: () => null,
}));

vi.mock("antd", async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd);

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, apiFetch: mocks.apiFetch };
});

const inspection = {
  email: "learner@example.com",
  expiresAt: "2026-09-01T12:00:00.000Z",
  organization: {
    _id: "tenant-a",
    logoUrl: null,
    name: "Bright Academy",
    primaryColor: "#176BFF",
    slug: "bright-academy",
  },
  requiresAuthentication: false,
  role: "LEARNER" as const,
  status: "PENDING" as const,
};

const authResponse = {
  accessToken: "new-token",
  effectiveAccess: null,
  organization: inspection.organization,
  user: {
    email: inspection.email,
    fullName: "Learner",
    membershipId: "membership-a",
    role: "LEARNER" as const,
    sub: "user-a",
    tenantId: "tenant-a",
  },
  workspaces: [],
};

beforeEach(() => {
  mocks.apiFetch.mockReset();
  mocks.apiFetch.mockResolvedValue(inspection);
  mocks.auth.captureAuthGeneration.mockClear();
  mocks.auth.consumeAuthResponse.mockReset();
  mocks.auth.consumeAuthResponse.mockResolvedValue(undefined);
  mocks.auth.loading = false;
  mocks.auth.logout.mockReset();
  mocks.auth.token = "";
  mocks.auth.user = null;
  mocks.replace.mockReset();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(), addListener: vi.fn(), matches: false,
      removeEventListener: vi.fn(), removeListener: vi.fn(),
    })),
  });
});

afterEach(() => cleanup());

describe("public invitation flow", () => {
  it("redacts unknown server errors and translates the same retained failure on language change", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
    const diagnostic = "DatabaseError: invitation-token=not-a-real-secret";
    mocks.apiFetch.mockRejectedValue(new ApiError(diagnostic, 500, "UNKNOWN_SERVER_ERROR"));
    render(<FeedbackLocaleProvider><InvitationPage /></FeedbackLocaleProvider>);
    expect(await screen.findByText(/Chưa xác nhận được kết quả/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByText(/The result could not be confirmed/)).toBeTruthy();
    expect(screen.queryByText(diagnostic)).toBeNull();
    expect(mocks.auth.consumeAuthResponse).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("chỉ đọc metadata công khai rồi hiển thị form tạo tài khoản", async () => {
    render(<InvitationPage />);

    expect(await screen.findByRole("heading", { name: "Lời mời tham gia", level: 1 })).toBeTruthy();
    expect(await screen.findByText("Bright Academy")).toBeTruthy();
    expect(screen.getByText("learner@example.com")).toBeTruthy();
    expect(screen.getByText("Học viên")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tạo tài khoản và tham gia" })).toBeTruthy();
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/auth/invitations/invite-token",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("keeps one brand, heading and metadata block without the decorative invitation hero", async () => {
    render(<InvitationPage />);
    await screen.findByText("Bright Academy");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("img", { name: "DX LMS" })).toHaveLength(1);
    expect(screen.getAllByText(inspection.email)).toHaveLength(1);
    expect(screen.getAllByText(inspection.organization.name)).toHaveLength(1);
    expect(screen.getAllByText("Học viên")).toHaveLength(1);
    expect(document.querySelector("time")?.getAttribute("dateTime")).toBe(inspection.expiresAt);
    expect(document.querySelector(".auth-hero, .auth-proof, .ant-avatar")).toBeNull();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex,nofollow,noarchive");
    expect(document.querySelector('meta[name="referrer"]')?.getAttribute("content")).toBe("no-referrer");
  });

  it("localizes the compact existing-account invitation without repeating its email", async () => {
    mocks.apiFetch.mockResolvedValue({ ...inspection, requiresAuthentication: true });
    render(<FeedbackLocaleProvider initialLocale="en"><InvitationPage /></FeedbackLocaleProvider>);
    expect(await screen.findByText("This email already has an account. Enter your password to join.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Invitation to join", level: 1 })).toBeTruthy();
    expect(screen.getAllByText(inspection.email)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Confirm and join" })).toBeTruthy();
  });

  it("đăng ký, nhận phiên đầy đủ và chuyển vào workspace", async () => {
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => (
      options?.method === "POST" ? Promise.resolve(authResponse) : Promise.resolve(inspection)
    ));
    render(<InvitationPage />);

    await screen.findByRole("button", { name: "Tạo tài khoản và tham gia" });
    fireEvent.change(screen.getByLabelText("Họ và tên"), { target: { value: "Nguyễn Văn An" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "Learner@123" } });
    fireEvent.change(screen.getByLabelText("Nhập lại mật khẩu"), { target: { value: "Learner@123" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản và tham gia" }));

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/auth/invitations/invite-token/register",
      { body: JSON.stringify({ fullName: "Nguyễn Văn An", password: "Learner@123" }), method: "POST" },
    ));
    expect(mocks.auth.consumeAuthResponse).toHaveBeenCalledWith(authResponse, 7);
    expect(mocks.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("đưa tài khoản hiện có qua login bằng next nội bộ", async () => {
    mocks.apiFetch.mockResolvedValue({ ...inspection, requiresAuthentication: true });
    render(<InvitationPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Đăng nhập để chấp nhận" }));

    expect(mocks.replace).toHaveBeenCalledWith("/login?next=%2Finvite%2Finvite-token");
  });

  it("cho identity chưa có workspace xác nhận bằng mật khẩu mà không gửi email", async () => {
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => (
      options?.method === "POST"
        ? Promise.resolve(authResponse)
        : Promise.resolve({ ...inspection, requiresAuthentication: true })
    ));
    render(<InvitationPage />);

    await screen.findByRole("button", { name: "Xác nhận và tham gia" });
    fireEvent.change(screen.getByLabelText("Mật khẩu tài khoản"), { target: { value: "Existing@123" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận và tham gia" }));

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/auth/invitations/invite-token/accept-existing",
      { body: JSON.stringify({ password: "Existing@123" }), method: "POST" },
    ));
    expect(mocks.auth.consumeAuthResponse).toHaveBeenCalledWith(authResponse, 7);
    expect(mocks.replace).toHaveBeenCalledWith("/dashboard");
    const request = mocks.apiFetch.mock.calls.find(([path]) => String(path).endsWith("/accept-existing"));
    expect(request?.[1]?.body).not.toContain("learner@example.com");
  });

  it("giữ nguyên invitation khi mật khẩu tài khoản hiện có không đúng", async () => {
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return Promise.reject(new ApiError("Mật khẩu không chính xác", 401));
      }
      return Promise.resolve({ ...inspection, requiresAuthentication: true });
    });
    render(<InvitationPage />);
    await screen.findByRole("button", { name: "Xác nhận và tham gia" });
    fireEvent.change(screen.getByLabelText("Mật khẩu tài khoản"), { target: { value: "WrongPass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận và tham gia" }));

    expect(await screen.findByText("Mật khẩu hiện tại không đúng.")).toBeTruthy();
    expect(mocks.auth.consumeAuthResponse).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalledWith("/dashboard");
    expect(screen.getByRole("button", { name: "Xác nhận và tham gia" })).toBeTruthy();
  });

  it("chấp nhận bằng access token hiện tại rồi thay toàn bộ phiên", async () => {
    mocks.auth.token = "current-token";
    mocks.auth.user = { email: inspection.email, sub: "user-a" };
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => (
      options?.method === "POST" ? Promise.resolve(authResponse) : Promise.resolve({ ...inspection, requiresAuthentication: true })
    ));
    render(<InvitationPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Chấp nhận lời mời" }));

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/auth/invitations/invite-token/accept",
      { method: "POST", token: "current-token" },
    ));
    expect(mocks.auth.consumeAuthResponse).toHaveBeenCalledWith(authResponse, 7);
    expect(mocks.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("không gửi accept khi email phiên hiện tại không khớp", async () => {
    mocks.auth.token = "wrong-token";
    mocks.auth.user = { email: "other@example.com", sub: "user-b" };
    mocks.apiFetch.mockResolvedValue({ ...inspection, requiresAuthentication: true });
    render(<InvitationPage />);

    expect(await screen.findByText("Sai tài khoản")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Chấp nhận lời mời" })).toBeNull();
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["INVITATION_EXPIRED", 410, "Lời mời đã hết hạn. Hãy đề nghị quản trị viên gửi lời mời mới."],
    ["INVITATION_INVALID", 404, "Lời mời không hợp lệ, đã được sử dụng hoặc đã bị thu hồi."],
  ])("hiện trạng thái kết thúc an toàn cho %s", async (code, status, expected) => {
    mocks.apiFetch.mockRejectedValue(new ApiError("Backend detail", status, code));
    render(<InvitationPage />);

    expect(await screen.findByText(expected)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Chấp nhận lời mời" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tạo tài khoản và tham gia" })).toBeNull();
  });
});
