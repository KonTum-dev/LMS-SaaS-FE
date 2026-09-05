// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps, ReactNode } from "react";
import type { EffectiveAccess, UserRole } from "@/lib/types";
import { FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";
import DashboardPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  effectiveAccess: null as EffectiveAccess | null,
  formatError: vi.fn(),
  push: vi.fn(),
  role: "TENANT_ADMIN" as UserRole,
  scopeMode: undefined as "GLOBAL" | "SCOPED" | undefined,
}));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/components/feedback/feedback-provider", () => ({
  useFeedback: () => ({ formatError: mocks.formatError }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: mocks.effectiveAccess,
    organization: {
      _id: "tenant-001",
      enabledModules: ["USERS", "COURSES", "ASSIGNMENTS", "GUARDIANS"],
      logoUrl: null,
      name: "Bright Academy",
      primaryColor: "#176BFF",
      slug: "bright-academy",
      status: "ACTIVE",
    },
    token: "tenant-token",
    user: {
      email: "owner@bright.local",
      fullName: "Bright Owner",
      membershipId: "membership-001",
      orgUnitScopeMode: mocks.scopeMode,
      role: mocks.role,
      sub: "owner-001",
      tenantId: "tenant-001",
    },
  }),
}));
vi.mock(
  "antd",
  async () => ({
    ...(await import("@/test-utils/lightweight-antd")).lightweightAntd,
    Col: ({ children, xs }: { children: ReactNode; xs?: number }) => (
      <div data-testid="dashboard-column" data-xs={xs}>{children}</div>
    ),
  }),
);

function renderPage(locale: "vi" | "en" = "vi") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <FeedbackLocaleProvider initialLocale={locale}>
        <DashboardPage />
      </FeedbackLocaleProvider>
    </QueryClientProvider>,
  );
}

describe("Dashboard subscription access", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset().mockResolvedValue({ recentCourses: [], scope: "tenant", stats: [] });
    // The production formatter returns a generic message even for an absent error.
    mocks.formatError.mockReset().mockImplementation((error: unknown) =>
      error instanceof Error ? error.message : "Không thể hoàn tất yêu cầu",
    );
    mocks.push.mockReset();
    mocks.scopeMode = undefined;
    mocks.role = "TENANT_ADMIN";
    mocks.effectiveAccess = {
      graceEndsAt: null,
      limits: {
        maxActiveLearners: null,
        maxBranches: null,
        maxCourses: 25,
        maxUsers: 250,
      },
      modules: ["COURSES", "ASSIGNMENTS"],
      readOnly: true,
      state: "READ_ONLY",
    };
  });

  afterEach(cleanup);

  it.each([
    ["vi", "Xem học viên được liên kết"],
    ["en", "View linked learners"],
  ] as const)("opens the parent learning portal from the guardian dashboard (%s)", async (locale, label) => {
    mocks.role = "GUARDIAN";
    mocks.effectiveAccess!.modules = ["USERS", "GUARDIANS"];
    renderPage(locale);
    fireEvent.click(await screen.findByRole("button", { name: label }));
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/family");
    expect(mocks.push).not.toHaveBeenCalledWith("/guardians");
  });

  it("does not enable the parent learning shortcut without its module", async () => {
    mocks.role = "GUARDIAN";
    renderPage();
    const button = await screen.findByRole("button", { name: "Xem học viên được liên kết" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("đổi CTA quản lý sang billing khi workspace chỉ đọc nhưng vẫn giữ quyền xem khóa học", async () => {
    renderPage();

    expect(screen.getByText("Chỉ đọc")).toBeTruthy();
    const billingButton = screen.getByRole("button", {
      name: "Quản lý thuê bao",
    });
    fireEvent.click(billingButton);
    expect(mocks.push).toHaveBeenCalledWith("/billing");
    expect(await screen.findByText("Khóa học gần đây")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Quản lý khóa học" }),
    ).toBeNull();
  });

  it("không đưa quản lý đơn vị tới billing toàn tổ chức", async () => {
    mocks.scopeMode = "SCOPED";
    renderPage();

    expect(screen.getByText("Chỉ đọc")).toBeTruthy();
    expect(screen.queryByText("Quản lý đơn vị")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Quản lý thuê bao" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Chọn gói" })).toBeNull();
  });

  it("không định dạng hoặc hiện lỗi khi dữ liệu đang tải hay tải thành công", async () => {
    renderPage();

    expect(screen.getByRole("status", { name: "Đang tải tổng quan" })).toBeTruthy();
    expect(mocks.formatError).not.toHaveBeenCalled();
    expect(await screen.findByText("Khóa học gần đây")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mocks.formatError).not.toHaveBeenCalled();
  });

  it("vẫn hiển thị lỗi tải dữ liệu thật", async () => {
    const error = new Error("Không tải được tổng quan");
    mocks.apiFetch.mockRejectedValue(error);
    renderPage();

    expect(await screen.findByText(error.message)).toBeTruthy();
    expect(mocks.formatError).toHaveBeenCalledWith(error, "");
  });

  it("giữ số liệu, tên khóa học và trạng thái trong giao diện tiếng Anh gọn hơn", async () => {
    mocks.apiFetch.mockResolvedValue({
      recentCourses: [{ _id: "course-1", description: "Nội dung của tôi", status: "PUBLISHED", title: "Khóa học riêng {count}" }],
      scope: "tenant",
      stats: [{ key: "courses", label: "Khóa học", value: 8 }],
    });
    const { container } = renderPage("en");

    expect(screen.getByRole("heading", { name: "Hello, Owner" })).toBeTruthy();
    expect(screen.getByText("Track courses and learning activity.")).toBeTruthy();
    expect(await screen.findByText("Recent courses")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("Nội dung của tôi")).toBeTruthy();
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getByText("Read-only")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open course Khóa học riêng {count}" }).getAttribute("href")).toBe("/courses/course-1");
    expect(container.querySelector(".dashboard-header__eyebrow, .dashboard-header__role, .dashboard-stat-tile__top, .dashboard-course-item__avatar, .dashboard-courses__eyebrow")).toBeNull();
  });

  it("dành hàng rộng cho tiền dài và giữ số đếm, phần trăm trong hai cột trên mobile", async () => {
    mocks.apiFetch.mockResolvedValue({
      recentCourses: [],
      scope: "tenant",
      stats: [
        { key: "learners", label: "Học viên", value: 24 },
        { key: "tuition-outstanding", label: "Học phí còn lại", suffix: "đ", value: 9876543210 },
        { key: "completion", label: "Hoàn thành", suffix: "%", value: 75 },
      ],
    });
    renderPage("en");

    expect(await screen.findByText("9876543210")).toBeTruthy();
    expect(screen.getAllByTestId("dashboard-column").map(column => column.getAttribute("data-xs"))).toEqual(["12", "24", "12"]);
  });
});
