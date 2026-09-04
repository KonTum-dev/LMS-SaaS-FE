// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import RegisterPage, { metadata } from "./page";

const mocks = vi.hoisted(() => ({
  auth: {
    captureAuthGeneration: vi.fn(() => 4),
    consumeAuthResponse: vi.fn(),
    loading: false,
    user: null as null | { role: "TENANT_ADMIN" },
  },
  register: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/lib/public-registration", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/public-registration")>();
  return {
    ...actual,
    publicRegistrationApi: { register: mocks.register },
  };
});

const authResponse = {
  accessToken: "signup-token",
  effectiveAccess: {
    graceEndsAt: null,
    limits: {
      maxActiveLearners: 100,
      maxBranches: 1,
      maxCourses: 10,
      maxUsers: 120,
    },
    modules: ["USERS" as const, "COURSES" as const],
    readOnly: false,
    state: "ACTIVE" as const,
    trial: true,
    trialEndsAt: "2030-09-18T00:00:00.000Z",
  },
  organization: {
    _id: "tenant-001",
    enabledModules: ["USERS" as const, "COURSES" as const],
    logoUrl: null,
    name: "Trung tâm Ánh Dương",
    primaryColor: "#176BFF",
    slug: "trung-tam-anh-duong",
    status: "ACTIVE" as const,
  },
  user: {
    email: "owner@example.com",
    fullName: "Nguyễn Minh Anh",
    membershipId: "membership-001",
    role: "TENANT_ADMIN" as const,
    sub: "owner-001",
    tenantId: "tenant-001",
  },
  workspaces: [],
};

function fillRegistrationForm() {
  fireEvent.change(screen.getByLabelText("Họ và tên"), {
    target: { value: "Nguyễn Minh Anh" },
  });
  fireEvent.change(screen.getByLabelText("Email đăng nhập"), {
    target: { value: "Owner@Example.com" },
  });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), {
    target: { value: "Owner@123" },
  });
  fireEvent.change(screen.getByLabelText("Nhập lại mật khẩu"), {
    target: { value: "Owner@123" },
  });
  fireEvent.change(screen.getByLabelText("Tên workspace"), {
    target: { value: "Trung tâm Ánh Dương" },
  });
}

beforeEach(() => {
  window.sessionStorage.clear();
  mocks.auth.captureAuthGeneration.mockClear();
  mocks.auth.consumeAuthResponse.mockReset();
  mocks.auth.consumeAuthResponse.mockResolvedValue(undefined);
  mocks.auth.loading = false;
  mocks.auth.user = null;
  mocks.register.mockReset();
  mocks.register.mockResolvedValue(authResponse);
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
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.clearAllMocks();
});

describe("DX LMS public registration", () => {
  it("hiển thị hành trình owner, workspace, trial và link đăng nhập", () => {
    render(<RegisterPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Mở không gian đào tạo của riêng bạn." })).toBeTruthy();
    expect(screen.getByText("Thông tin của bạn")).toBeTruthy();
    expect(screen.getByText("Workspace đào tạo")).toBeTruthy();
    expect(screen.getByText(/Trial tự động theo workspace/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Đăng nhập" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: "DX LMS, về trang chủ" }).getAttribute("href")).toBe("/");
    expect(metadata.title).toBe("Tạo workspace dùng thử");
  });

  it("tạo slug tiếng Việt, gửi đúng contract rồi nhận phiên và tới billing", async () => {
    const view = render(<RegisterPage />);
    fillRegistrationForm();

    expect((screen.getByLabelText("Mã workspace") as HTMLInputElement).value).toBe(
      "trung-tam-anh-duong",
    );
    fireEvent.click(screen.getByRole("button", { name: /Tạo workspace dùng thử/i }));

    await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(1));
    expect(mocks.register.mock.calls[0][0]).toEqual({
      owner: {
        email: "owner@example.com",
        fullName: "Nguyễn Minh Anh",
        password: "Owner@123",
      },
      workspace: {
        name: "Trung tâm Ánh Dương",
        slug: "trung-tam-anh-duong",
      },
    });
    expect(mocks.register.mock.calls[0][1]).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    expect(mocks.auth.consumeAuthResponse).toHaveBeenCalledWith(authResponse, 4);
    expect(mocks.replace).toHaveBeenCalledWith("/billing?onboarding=1");

    mocks.auth.user = { role: "TENANT_ADMIN" };
    view.rerender(<RegisterPage />);
    expect(mocks.replace).not.toHaveBeenCalledWith("/billing");
  });

  it("giữ idempotency key khi retry cùng form và đổi key sau khi sửa dữ liệu", async () => {
    mocks.register.mockRejectedValue(
      new ApiError("retry", 503, "SIGNUP_RETRYABLE"),
    );
    render(<RegisterPage />);
    fillRegistrationForm();
    const submit = screen.getByRole("button", { name: /Tạo workspace dùng thử/i });

    fireEvent.click(submit);
    await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(1));
    await screen.findByText("Chưa xác nhận được kết quả đăng ký");
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(2));
    expect(mocks.register.mock.calls[1][1]).toBe(mocks.register.mock.calls[0][1]);

    fireEvent.change(screen.getByLabelText("Tên workspace"), {
      target: { value: "Trung tâm Ánh Dương 2" },
    });
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(3));
    expect(mocks.register.mock.calls[2][1]).not.toBe(mocks.register.mock.calls[1][1]);
  });

  it("chặn mật khẩu xác nhận sai trước khi gọi API", async () => {
    render(<RegisterPage />);
    fillRegistrationForm();
    fireEvent.change(screen.getByLabelText("Nhập lại mật khẩu"), {
      target: { value: "different-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Tạo workspace dùng thử/i }));

    expect(await screen.findByText("Mật khẩu xác nhận chưa khớp")).toBeTruthy();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("không thay phiên hiện có và đưa tenant admin về billing", async () => {
    mocks.auth.user = { role: "TENANT_ADMIN" };
    render(<RegisterPage />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/billing"));
    expect(mocks.register).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Đang kiểm tra phiên đăng nhập")).toBeTruthy();
  });
});
