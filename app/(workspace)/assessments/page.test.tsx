// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";
import type { EffectiveAccess, UserRole } from "@/lib/types";
import AssessmentsPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  create: vi.fn(),
  listForLearner: vi.fn(),
  listForManager: vi.fn(),
  membershipId: "membership-1" as string | undefined,
  push: vi.fn(),
  readOnly: false,
  role: "TENANT_ADMIN" as UserRole,
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: mocks.apiFetch,
}));
vi.mock("@/lib/assessment-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/assessment-api")>()),
  assessmentApi: {
    create: mocks.create,
    listForLearner: mocks.listForLearner,
    listForManager: mocks.listForManager,
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: {
      graceEndsAt: null,
      limits: {
        maxActiveLearners: null,
        maxBranches: null,
        maxCourses: 10,
        maxUsers: 100,
      },
      modules: ["COURSES", "ENROLLMENTS", "ASSESSMENTS"],
      readOnly: mocks.readOnly,
      state: mocks.readOnly ? "READ_ONLY" : "ACTIVE",
    } satisfies EffectiveAccess,
    organization: { _id: "tenant-1" },
    token: "tenant-token",
    user: {
      email: "viewer@example.test",
      fullName: "Viewer",
      membershipId: mocks.membershipId,
      role: mocks.role,
      sub: "viewer-1",
      tenantId: "tenant-1",
    },
  }),
}));
vi.mock("@ant-design/icons", () => ({
  BarChartOutlined: () => null,
  EditOutlined: () => null,
  PlusOutlined: () => null,
  ReloadOutlined: () => null,
}));
vi.mock("antd", async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd);

const managerItem = {
  _id: "assessment-1",
  archivedAt: null,
  courseId: "course-1",
  currentVersionNumber: 1,
  hasUnpublishedChanges: false,
  lastPublishedAt: "2030-08-20T08:00:00.000Z",
  revision: 3,
  status: "PUBLISHED" as const,
  title: "Kiểm tra Nhập môn",
  updatedAt: "2030-08-20T08:00:00.000Z",
};
const learnerItem = {
  _id: "assessment-1",
  availability: "OPEN" as const,
  closesAt: null,
  courseId: "course-1",
  currentVersionNumber: 1,
  instructions: "Làm tất cả câu hỏi",
  maxAttempts: 2,
  maxScore: 10,
  opensAt: null,
  passPercent: 70,
  resultVisibility: "AFTER_ATTEMPTS_EXHAUSTED" as const,
  serverNow: "2030-08-20T08:00:00.000Z",
  status: "PUBLISHED" as const,
  timeLimitSeconds: 600,
  title: "Kiểm tra Nhập môn",
  versionNumber: 1,
};
const learnerScope: ViewerScope = {
  membershipId: "membership-1",
  role: "LEARNER",
  tenantId: "tenant-1",
  viewerId: "viewer-1",
};

function renderPage(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(<QueryClientProvider client={client}><AssessmentsPage /></QueryClientProvider>);
}

beforeEach(() => {
  mocks.apiFetch.mockReset();
  mocks.apiFetch.mockResolvedValue([{ _id: "course-1", status: "PUBLISHED", title: "Khóa học Một" }]);
  mocks.create.mockReset();
  mocks.listForLearner.mockReset();
  mocks.listForLearner.mockResolvedValue({ items: [learnerItem], limit: 12, page: 1, total: 1 });
  mocks.listForManager.mockReset();
  mocks.listForManager.mockResolvedValue({ items: [managerItem], limit: 12, page: 1, total: 1 });
  mocks.membershipId = "membership-1";
  mocks.push.mockReset();
  mocks.readOnly = false;
  mocks.role = "TENANT_ADMIN";
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AssessmentsPage", () => {
  it("manager chỉ dùng manager list contract và thấy authoring/report actions", async () => {
    renderPage();
    expect(await screen.findByText("Kiểm tra Nhập môn")).toBeTruthy();
    expect(mocks.listForManager).toHaveBeenCalledWith(
      { token: "tenant-token" },
      { courseId: undefined, limit: 12, page: 1, status: undefined },
    );
    expect(mocks.listForLearner).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Tạo bài kiểm tra" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Báo cáo lượt làm" })).toBeTruthy();
  });

  it("learner chỉ dùng safe list, không render mutation/report action", async () => {
    mocks.role = "LEARNER";
    renderPage();
    expect(await screen.findByText("Kiểm tra Nhập môn")).toBeTruthy();
    expect(mocks.listForLearner).toHaveBeenCalled();
    expect(mocks.listForManager).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Tạo bài kiểm tra" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Báo cáo lượt làm" })).toBeNull();
    expect(screen.getByText("10 phút")).toBeTruthy();
  });

  it("learner list tự cập nhật cửa sổ mở/đóng theo serverNow", () => {
    const snapshotAt = Date.parse("2030-08-20T08:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(snapshotAt);
    mocks.role = "LEARNER";
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    });
    client.setQueryData(
      lmsQueryKeys.assessmentList(learnerScope, {
        courseId: undefined,
        limit: 12,
        page: 1,
      }),
      {
        items: [{
          ...learnerItem,
          availability: "UPCOMING",
          closesAt: "2030-08-20T08:00:04.000Z",
          opensAt: "2030-08-20T08:00:02.000Z",
        }],
        limit: 12,
        page: 1,
        total: 1,
      },
    );

    renderPage(client);
    expect(screen.getByText("Sắp mở")).toBeTruthy();
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByText("Đang mở")).toBeTruthy();
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByText("Đã đóng")).toBeTruthy();
    expect(mocks.listForLearner).not.toHaveBeenCalled();
  });

  it("READ_ONLY vẫn GET nhưng khóa tạo và giải thích lý do", async () => {
    mocks.readOnly = true;
    renderPage();
    await screen.findByText("Kiểm tra Nhập môn");
    expect(mocks.listForManager).toHaveBeenCalled();
    expect(
      (screen.getByRole("button", { name: "Tạo bài kiểm tra" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText(/Tạo, sửa, xuất bản và lưu trữ đang tạm khóa/)).toBeTruthy();
  });

  it("fail closed khi tenant user thiếu membershipId và không gọi assessment API", () => {
    mocks.membershipId = undefined;
    renderPage();
    expect(screen.getByText(/thiếu phạm vi thành viên hợp lệ/)).toBeTruthy();
    expect(mocks.listForManager).not.toHaveBeenCalled();
    expect(mocks.listForLearner).not.toHaveBeenCalled();
  });

  it("membership rotation trong cùng tenant dùng cache authority mới", async () => {
    mocks.listForManager
      .mockResolvedValueOnce({ items: [managerItem], limit: 12, page: 1, total: 1 })
      .mockResolvedValueOnce({ items: [{ ...managerItem, title: "Dữ liệu membership mới" }], limit: 12, page: 1, total: 1 });
    const view = renderPage();
    await screen.findByText("Kiểm tra Nhập môn");
    mocks.membershipId = "membership-2";
    view.rerender(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AssessmentsPage /></QueryClientProvider>);
    expect(await screen.findByText("Dữ liệu membership mới")).toBeTruthy();
    await waitFor(() => expect(mocks.listForManager).toHaveBeenCalledTimes(2));
  });
});
