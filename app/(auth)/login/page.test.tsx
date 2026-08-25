// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const mocks = vi.hoisted(() => ({ login: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({ loading: false, login: mocks.login, user: null }),
}));

beforeEach(() => {
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
    expect(screen.getByText(/workspace riêng mang bản sắc của tổ chức/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeTruthy();
  });
});
