// @vitest-environment jsdom

import { defaultScheduler, notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EffectiveAccess, LearnerProgressRow, Paginated, UserRole } from "@/lib/types";
import CourseLearnerProgressPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  effectiveAccess: null as EffectiveAccess | null,
  role: "TENANT_ADMIN" as UserRole,
  tenantId: "tenant-1",
  viewerId: "manager-1",
}));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "course-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: mocks.effectiveAccess,
    organization: { _id: mocks.tenantId },
    token: "tenant-token",
    user: {
      email: "manager@example.test",
      fullName: "Manager",
      membershipId: mocks.role === "SUPER_ADMIN" ? undefined : "membership-1",
      role: mocks.role,
      sub: mocks.viewerId,
      tenantId: mocks.role === "SUPER_ADMIN" ? undefined : mocks.tenantId,
    },
  }),
}));
vi.mock("@ant-design/icons", () => ({ ArrowLeftOutlined: () => null }));
vi.mock("antd", async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd);

const learner = (name: string, id = "learner-1"): LearnerProgressRow => ({
  completed: false,
  completedRequiredLessons: 2,
  learner: { _id: id, email: `${id}@example.test`, fullName: name },
  percent: 50,
  requiredLessons: 4,
});

function setupApi() {
  mocks.apiFetch.mockImplementation((path: string) => {
    if (!path.startsWith("/courses/course-1/learner-progress?")) {
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    }
    const page = Number(new URLSearchParams(path.split("?", 2)[1]).get("page") ?? "1");
    const response: Paginated<LearnerProgressRow> = {
      items: [learner(mocks.tenantId === "tenant-1" ? "Lan Nguyễn" : "Bình Trần")],
      limit: 20,
      page,
      total: 41,
    };
    return Promise.resolve(response);
  });
}

function renderPage(client = new QueryClient({
  defaultOptions: { queries: { gcTime: Infinity, retry: false } },
})) {
  const view = render(
    <QueryClientProvider client={client}><CourseLearnerProgressPage /></QueryClientProvider>,
  );
  return { client, ...view };
}

describe("course learner progress report", () => {
  beforeEach(() => {
    notifyManager.setScheduler((callback) => queueMicrotask(callback));
    mocks.apiFetch.mockReset();
    mocks.effectiveAccess = {
      graceEndsAt: null,
      limits: {
        maxActiveLearners: null,
        maxBranches: null,
        maxCourses: 10,
        maxUsers: 50,
      },
      modules: ["COURSES", "ENROLLMENTS"],
      readOnly: false,
      state: "ACTIVE",
    };
    mocks.role = "TENANT_ADMIN";
    mocks.tenantId = "tenant-1";
    mocks.viewerId = "manager-1";
    setupApi();
  });

  afterEach(() => {
    notifyManager.setScheduler(defaultScheduler);
    cleanup();
  });

  it("fetch mặc định, search và pagination bằng server contract", async () => {
    renderPage();

    expect(await screen.findByText("Lan Nguyễn")).toBeTruthy();
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/courses/course-1/learner-progress?limit=20&page=1",
      { token: "tenant-token" },
    );
    expect(screen.getByText("2/4")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByLabelText("Tìm học viên theo tên hoặc email").getAttribute("maxlength"))
      .toBe("100");

    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/courses/course-1/learner-progress?limit=20&page=2",
      { token: "tenant-token" },
    ));

    fireEvent.change(screen.getByLabelText("Tìm học viên theo tên hoặc email"), {
      target: { value: "  Lan  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/courses/course-1/learner-progress?limit=20&page=1&search=Lan",
      { token: "tenant-token" },
    ));
  });

  it("READ_ONLY vẫn cho phép tải báo cáo", async () => {
    mocks.role = "INSTRUCTOR";
    mocks.effectiveAccess = { ...mocks.effectiveAccess!, readOnly: true, state: "READ_ONLY" };
    renderPage();

    expect(await screen.findByText("Workspace chỉ đọc")).toBeTruthy();
    expect(await screen.findByText("Lan Nguyễn")).toBeTruthy();
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
  });

  it.each<[UserRole, EffectiveAccess["modules"]]>([
    ["LEARNER" as const, ["COURSES", "ENROLLMENTS"]],
    ["SUPER_ADMIN" as const, ["COURSES", "ENROLLMENTS"]],
    ["TENANT_ADMIN" as const, ["COURSES"]],
    ["TENANT_ADMIN" as const, ["ENROLLMENTS"]],
  ])("role %s/modules %j không phát sinh manager request", async (role, modules) => {
    mocks.role = role;
    mocks.effectiveAccess = { ...mocks.effectiveAccess!, modules };
    renderPage();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("đổi workspace remount state, không hiện cache hay search tenant cũ", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    const view = renderPage(client);
    expect(await screen.findByText("Lan Nguyễn")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Tìm học viên theo tên hoặc email"), {
      target: { value: "Lan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
    await waitFor(() => expect(mocks.apiFetch.mock.calls.some(([path]) =>
      path === "/courses/course-1/learner-progress?limit=20&page=1&search=Lan")).toBe(true));

    mocks.tenantId = "tenant-2";
    mocks.viewerId = "manager-2";
    view.rerender(
      <QueryClientProvider client={client}><CourseLearnerProgressPage /></QueryClientProvider>,
    );

    expect(await screen.findByText("Bình Trần")).toBeTruthy();
    expect(screen.queryByText("Lan Nguyễn")).toBeNull();
    expect((screen.getByLabelText("Tìm học viên theo tên hoặc email") as HTMLInputElement).value)
      .toBe("");
    expect(mocks.apiFetch.mock.calls.at(-1)?.[0])
      .toBe("/courses/course-1/learner-progress?limit=20&page=1");
  });
});
