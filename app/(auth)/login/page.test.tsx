// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const mocks = vi.hoisted(() => ({
  auth: {
    loading: false,
    login: vi.fn(),
    user: null as null | { email: string; sub: string },
  },
  getSearchParam: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => ({ get: mocks.getSearchParam }),
}));

vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => mocks.auth,
}));

beforeEach(() => {
  mocks.auth.loading = false;
  mocks.auth.user = null;
  mocks.auth.login.mockResolvedValue(undefined);
  mocks.getSearchParam.mockReturnValue(null);
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
  vi.clearAllMocks();
});

describe("DX LMS login", () => {
  it("hiển thị lockup và thông điệp DX LMS trên cả hai panel", () => {
    render(<LoginPage />);

    expect(screen.getAllByText("DX LMS")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Vận hành đào tạo. Đúng người, đúng việc." })).toBeTruthy();
    expect(screen.getByText(/không gian riêng mang bản sắc của tổ chức/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Quên mật khẩu?" }).getAttribute("href")).toBe("/forgot-password");
  });

  it("khóa submit trong lúc đang xác minh phiên lưu cũ", () => {
    mocks.auth.loading = true;
    render(<LoginPage />);

    expect((screen.getByRole("button", { name: /Đăng nhập/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("đi tiếp tới đường dẫn nội bộ sau khi đăng nhập", async () => {
    mocks.getSearchParam.mockReturnValue("/invite/invite-token");
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "Owner@123" } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() => expect(mocks.auth.login).toHaveBeenCalledWith("owner@example.com", "Owner@123"));
    expect(mocks.replace).toHaveBeenCalledWith("/invite/invite-token");
  });

  it.each([
    ["https://evil.example/steal", "/dashboard"],
    ["//evil.example/steal", "/dashboard"],
    ["/%2f%2fevil.example/steal", "/dashboard"],
    ["/\\\\evil.example/steal", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    [" /invite/token", "/dashboard"],
    ["/courses?tab=mine#active", "/courses?tab=mine#active"],
  ])("chỉ điều hướng next nội bộ: %s thành %s", async (value, expected) => {
    mocks.getSearchParam.mockReturnValue(value);
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "Owner@123" } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(expected));
  });
});
