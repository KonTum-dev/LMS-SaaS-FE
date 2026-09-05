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
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseReport, EffectiveAccess, UserRole } from "@/lib/types";
import CourseDetailPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  effectiveAccess: null as EffectiveAccess | null,
  formatError: vi.fn(),
  push: vi.fn(),
  role: "LEARNER" as UserRole,
}));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/components/feedback/feedback-provider", () => ({
  useFeedback: () => ({ formatError: mocks.formatError }),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "course-1" }),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: mocks.effectiveAccess,
    organization: { _id: "tenant-1" },
    token: "tenant-token",
    user: {
      email: "viewer@example.test",
      fullName: "Viewer",
      membershipId: "membership-1",
      role: mocks.role,
      sub: "viewer-1",
      tenantId: "tenant-1",
    },
  }),
}));
vi.mock("@ant-design/icons", () => ({
  ArrowLeftOutlined: () => null,
  CalendarOutlined: () => null,
  ReadOutlined: () => null,
  UserOutlined: () => null,
}));
vi.mock(
  "antd",
  async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

const course = {
  _id: "course-1",
  description: "Nội dung khóa học",
  slug: "course-one",
  status: "PUBLISHED" as const,
  title: "Khóa học Một",
};
const assignment = {
  _id: "assignment-1",
  allowLate: false,
  courseId: { _id: "course-1", slug: "course-one", title: "Khóa học Một" },
  description: "Phân tích tình huống",
  maxPoints: 100,
  published: true,
  submissionMode: "TEXT" as const,
  title: "Bài tập Một",
};
const report: CourseReport = {
  activeLearners: 4,
  completionPercent: 0,
  counts: { draft: 1, graded: 0, notStarted: 3, returned: 0, submitted: 0 },
  course: { _id: "course-1", status: "PUBLISHED", title: "Khóa học Một" },
  expectedSubmissions: 4,
  generatedAt: "2030-09-03T10:00:00.000Z",
  gradedAveragePercent: null,
  lateSubmissions: 0,
  publishedAssignments: 1,
  scope: "CURRENT_ACTIVE_ROSTER",
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CourseDetailPage />
    </QueryClientProvider>,
  );
}

describe("course detail module composition", () => {
  beforeEach(() => {
    notifyManager.setScheduler((callback) => queueMicrotask(callback));
    mocks.apiFetch.mockReset();
    // Match the production formatter's non-empty fallback for absent errors.
    mocks.formatError.mockReset().mockImplementation((error: unknown) =>
      error instanceof Error ? error.message : "Không thể hoàn tất yêu cầu",
    );
    mocks.push.mockReset();
    mocks.role = "LEARNER";
    mocks.effectiveAccess = {
      graceEndsAt: null,
      limits: {
        maxActiveLearners: null,
        maxBranches: null,
        maxCourses: 10,
        maxUsers: 50,
      },
      modules: ["COURSES"],
      readOnly: false,
      state: "ACTIVE",
    };
  });

  afterEach(() => {
    notifyManager.setScheduler(defaultScheduler);
    cleanup();
  });

  it("vẫn tải header course nhưng không gọi assignments khi module tắt", async () => {
    mocks.apiFetch.mockImplementation((path: string) =>
      path === "/courses/course-1"
        ? Promise.resolve(course)
        : Promise.reject(new Error(`Unexpected request: ${path}`)),
    );
    renderPage();

    expect(
      await screen.findByRole("heading", { name: course.title }),
    ).toBeTruthy();
    expect(mocks.apiFetch).toHaveBeenCalledWith("/courses/course-1", {
      token: "tenant-token",
    });
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).startsWith("/assignments"),
      ),
    ).toBe(false);
    expect(screen.queryByText("Bài tập")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mocks.formatError).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mở giáo trình" }));
    expect(mocks.push).toHaveBeenCalledWith("/courses/course-1/curriculum");
  });

  it("vẫn hiển thị lỗi thật khi không tải được khóa học", async () => {
    const error = new Error("Không tải được khóa học");
    mocks.apiFetch.mockRejectedValue(error);
    renderPage();

    expect(await screen.findByText(error.message)).toBeTruthy();
    expect(mocks.formatError).toHaveBeenCalledWith(error, "");
    expect(screen.queryByRole("heading", { name: course.title })).toBeNull();
  });

  it("không hiện lối vào giáo trình khi COURSES bị tắt", async () => {
    mocks.effectiveAccess = { ...mocks.effectiveAccess!, modules: [] };
    mocks.apiFetch.mockResolvedValue(course);
    renderPage();

    expect(
      await screen.findByRole("heading", { name: course.title }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mở giáo trình" })).toBeNull();
  });

  it("lỗi assignments chỉ hiện cảnh báo và không làm sập header course", async () => {
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      modules: ["COURSES", "ENROLLMENTS", "ASSIGNMENTS"],
    };
    mocks.apiFetch.mockImplementation((path: string) =>
      path === "/courses/course-1"
        ? Promise.resolve(course)
        : Promise.reject(new Error("Không tải được bài tập")),
    );
    renderPage();

    expect(
      await screen.findByRole("heading", { name: course.title }),
    ).toBeTruthy();
    expect(await screen.findByText("Không tải được bài tập")).toBeTruthy();
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/assignments?courseId=course-1",
        { token: "tenant-token" },
      ),
    );
  });

  it("learner không bao giờ gọi manager report dù ASSIGNMENTS bật", async () => {
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      modules: ["COURSES", "ENROLLMENTS", "ASSIGNMENTS"],
    };
    mocks.apiFetch.mockImplementation((path: string) =>
      path === "/courses/course-1"
        ? Promise.resolve(course)
        : path === "/assignments?courseId=course-1"
          ? Promise.resolve([assignment])
          : Promise.reject(new Error(`Unexpected request: ${path}`)),
    );
    renderPage();

    expect(
      await screen.findByRole("heading", { name: course.title }),
    ).toBeTruthy();
    expect(await screen.findByText("Bài tập Một")).toBeTruthy();
    expect(
      mocks.apiFetch.mock.calls.some(
        ([path]) => path === "/courses/course-1/report",
      ),
    ).toBe(false);
    expect(screen.queryByText("Báo cáo tiến độ")).toBeNull();
  });

  it("manager READ_ONLY vẫn thấy report và phân biệt 0% với null", async () => {
    mocks.role = "INSTRUCTOR";
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      modules: ["COURSES", "ENROLLMENTS", "ASSIGNMENTS"],
      readOnly: true,
      state: "READ_ONLY",
    };
    mocks.apiFetch.mockImplementation((path: string) =>
      path === "/courses/course-1"
        ? Promise.resolve(course)
        : path === "/assignments?courseId=course-1"
          ? Promise.resolve([assignment])
          : path === "/courses/course-1/report"
            ? Promise.resolve(report)
            : Promise.reject(new Error(`Unexpected request: ${path}`)),
    );
    renderPage();

    expect(await screen.findByText("Báo cáo tiến độ")).toBeTruthy();
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/courses/course-1/report",
      expect.objectContaining({
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: expect.anything(),
        token: "tenant-token",
      }),
    );
    const reportCard = screen.getByText("Báo cáo tiến độ").closest("section")!;
    expect(within(reportCard).getByText("0%", { exact: true })).toBeTruthy();
    expect(
      within(reportCard).getByText("Chưa có dữ liệu", { exact: true }),
    ).toBeTruthy();
    expect(within(reportCard).getByText("Học viên đang học")).toBeTruthy();
    expect(within(reportCard).getByText("Bài nộp kỳ vọng")).toBeTruthy();
  });

  it("không gọi report cho course chưa PUBLISHED", async () => {
    mocks.role = "TENANT_ADMIN";
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      modules: ["COURSES", "ENROLLMENTS", "ASSIGNMENTS"],
    };
    mocks.apiFetch.mockImplementation((path: string) =>
      path === "/courses/course-1"
        ? Promise.resolve({ ...course, status: "DRAFT" })
        : path === "/assignments?courseId=course-1"
          ? Promise.resolve([])
          : Promise.reject(new Error(`Unexpected request: ${path}`)),
    );
    renderPage();

    expect(
      await screen.findByRole("heading", { name: course.title }),
    ).toBeTruthy();
    expect(
      mocks.apiFetch.mock.calls.some(
        ([path]) => path === "/courses/course-1/report",
      ),
    ).toBe(false);
    expect(screen.queryByText("Báo cáo tiến độ")).toBeNull();
  });

  it("lỗi report cô lập khỏi header course và card assignments", async () => {
    mocks.role = "TENANT_ADMIN";
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      modules: ["COURSES", "ENROLLMENTS", "ASSIGNMENTS"],
    };
    mocks.apiFetch.mockImplementation((path: string) =>
      path === "/courses/course-1"
        ? Promise.resolve(course)
        : path === "/assignments?courseId=course-1"
          ? Promise.resolve([assignment])
          : path === "/courses/course-1/report"
            ? Promise.reject(new Error("Không tạo được báo cáo"))
            : Promise.reject(new Error(`Unexpected request: ${path}`)),
    );
    renderPage();

    expect(await screen.findByText("Không tạo được báo cáo")).toBeTruthy();
    expect(screen.getByRole("heading", { name: course.title })).toBeTruthy();
    expect(screen.getByText("Bài tập Một")).toBeTruthy();
  });
});
