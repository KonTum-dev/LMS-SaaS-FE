// @vitest-environment jsdom

import {
  defaultScheduler,
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EffectiveAccess } from "@/lib/types";
import CoursesPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  effectiveAccess: null as EffectiveAccess | null,
  push: vi.fn(),
  scopeMode: undefined as "GLOBAL" | "SCOPED" | undefined,
}));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: mocks.effectiveAccess,
    organization: {
      _id: "tenant-1",
      enabledModules: ["USERS", "COURSES", "ENROLLMENTS", "ASSIGNMENTS"],
      logoUrl: null,
      name: "Tenant One",
      primaryColor: "#176BFF",
      slug: "tenant-one",
      status: "ACTIVE",
    },
    token: "tenant-token",
    user: {
      email: "owner@example.test",
      fullName: "Owner",
      membershipId: "membership-1",
      orgUnitScopeMode: mocks.scopeMode,
      role: "TENANT_ADMIN",
      sub: "owner-1",
      tenantId: "tenant-1",
    },
  }),
}));
vi.mock("@ant-design/icons", () => ({
  DeleteOutlined: () => null,
  EditOutlined: () => null,
  PlusOutlined: () => null,
  TeamOutlined: () => null,
}));
vi.mock(
  "antd",
  async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

const course = {
  _id: "course-1",
  description: "Mô tả",
  slug: "course-one",
  status: "PUBLISHED" as const,
  title: "Khóa học Một",
};

function installApiResponses() {
  mocks.apiFetch.mockImplementation((path: string) => {
    if (path === "/courses") return Promise.resolve([course]);
    if (path === "/courses/eligible-instructors?limit=20&page=1") {
      return Promise.resolve({
        items: [
          {
            email: "teacher@example.test",
            fullName: "Teacher",
            userId: "teacher-1",
          },
        ],
        limit: 20,
        page: 1,
        total: 1,
      });
    }
    if (
      path === "/enrollments/courses/course-1/eligible-learners?limit=20&page=1"
    ) {
      return Promise.resolve({
        items: [
          {
            email: "new@example.test",
            fullName: "New Learner",
            userId: "learner-2",
          },
        ],
        limit: 20,
        page: 1,
        total: 1,
      });
    }
    if (path === "/enrollments/courses/course-1/roster?limit=20&page=1") {
      return Promise.resolve({
        items: [
          {
            _id: "enrollment-1",
            status: "ACTIVE",
            userId: {
              _id: "learner-1",
              email: "learner@example.test",
              fullName: "Learner One",
            },
          },
        ],
        limit: 20,
        page: 1,
        total: 1,
      });
    }
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CoursesPage />
    </QueryClientProvider>,
  );
  return client;
}

describe("course people directories", () => {
  beforeEach(() => {
    notifyManager.setScheduler((callback) => queueMicrotask(callback));
    mocks.apiFetch.mockReset();
    mocks.push.mockReset();
    mocks.scopeMode = undefined;
    mocks.effectiveAccess = {
      graceEndsAt: null,
      limits: {
        maxActiveLearners: null,
        maxBranches: null,
        maxCourses: 100,
        maxUsers: 1000,
      },
      modules: ["USERS", "COURSES", "ENROLLMENTS", "ASSIGNMENTS"],
      readOnly: false,
      state: "ACTIVE",
    };
    installApiResponses();
  });

  afterEach(() => {
    notifyManager.setScheduler(defaultScheduler);
    cleanup();
  });

  it("không tải directory hoặc enrollment toàn tenant trước khi mở modal", async () => {
    renderPage();
    expect(await screen.findByText(course.title)).toBeTruthy();

    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
    expect(mocks.apiFetch).toHaveBeenCalledWith("/courses", {
      token: "tenant-token",
    });
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).startsWith("/users"),
      ),
    ).toBe(false);
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).startsWith("/enrollments"),
      ),
    ).toBe(false);
  });

  it("quản lý đơn vị chỉ dùng danh mục chung để quản lý ghi danh", async () => {
    mocks.scopeMode = "SCOPED";
    renderPage();

    expect(
      await screen.findByText("Danh mục học thuật dùng chung"),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tạo khóa học" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Chỉnh sửa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mở khóa học" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Học viên" }));
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/enrollments/courses/course-1/eligible-learners?limit=20&page=1",
        { token: "tenant-token" },
      ),
    );
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).startsWith("/courses/eligible-instructors"),
      ),
    ).toBe(false);
  });

  it("chỉ tải roster và learner phân trang cho course đang mở", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Học viên" }));

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/enrollments/courses/course-1/roster?limit=20&page=1",
        { token: "tenant-token" },
      );
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/enrollments/courses/course-1/eligible-learners?limit=20&page=1",
        { token: "tenant-token" },
      );
    });
    expect(await screen.findByText("Learner One")).toBeTruthy();
    expect(
      mocks.apiFetch.mock.calls.some(([path]) => path === "/enrollments"),
    ).toBe(false);
  });

  it("READ_ONLY vẫn xem roster nhưng không tải learner hay hiện thao tác ghi/rút", async () => {
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      readOnly: true,
      state: "READ_ONLY",
    };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Học viên" }));

    expect(await screen.findByText("Learner One")).toBeTruthy();
    expect(screen.getByText("Workspace chỉ đọc")).toBeTruthy();
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).includes("eligible-learners"),
      ),
    ).toBe(false);
    expect(screen.queryByRole("button", { name: "Ghi danh" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rút" })).toBeNull();
  });

  it("không lộ hoặc query enrollment khi module bị tắt", async () => {
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      modules: ["COURSES", "ASSIGNMENTS"],
    };
    renderPage();
    expect(await screen.findByText(course.title)).toBeTruthy();

    expect(screen.queryByRole("button", { name: "Học viên" })).toBeNull();
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).startsWith("/enrollments"),
      ),
    ).toBe(false);
  });

  it("không mở roster cho course đã lưu trữ vì backend trả 404", async () => {
    mocks.apiFetch.mockImplementation((path: string) =>
      path === "/courses"
        ? Promise.resolve([{ ...course, status: "ARCHIVED" }])
        : Promise.reject(new Error(`Unexpected request: ${path}`)),
    );
    renderPage();

    expect(await screen.findByText(course.title)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Học viên" })).toBeNull();
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).startsWith("/enrollments"),
      ),
    ).toBe(false);
  });

  it("chỉ tải instructor directory khi mở trình sửa khóa học", async () => {
    renderPage();
    expect(await screen.findByText(course.title)).toBeTruthy();
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).includes("eligible-instructors"),
      ),
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Tạo khóa học" }));
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/courses/eligible-instructors?limit=20&page=1",
        { token: "tenant-token" },
      ),
    );
  });
});
