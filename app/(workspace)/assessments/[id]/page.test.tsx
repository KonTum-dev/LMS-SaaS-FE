// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssessmentAttempt, AssessmentLearnerDetail } from "@/lib/assessment-api";
import { lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";
import type { EffectiveAccess } from "@/lib/types";
import AssessmentDetailPage from "./page";

const mocks = vi.hoisted(() => ({
  getLearnerDetail: vi.fn(),
  push: vi.fn(),
  startAttempt: vi.fn(),
}));

vi.mock("@/lib/assessment-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/assessment-api")>()),
  assessmentApi: {
    getLearnerDetail: mocks.getLearnerDetail,
    startAttempt: mocks.startAttempt,
  },
  createAssessmentMutationId: () => "mutation-1",
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "assessment-1" }),
  useRouter: () => ({ push: mocks.push }),
}));
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
      readOnly: false,
      state: "ACTIVE",
    } satisfies EffectiveAccess,
    organization: { _id: "tenant-1" },
    token: "tenant-token",
    user: {
      email: "learner@example.test",
      fullName: "Learner",
      membershipId: "membership-1",
      role: "LEARNER",
      sub: "learner-1",
      tenantId: "tenant-1",
    },
  }),
}));
vi.mock("@ant-design/icons", () => ({
  ArrowLeftOutlined: () => null,
  PlayCircleOutlined: () => null,
  ReloadOutlined: () => null,
}));
vi.mock("antd", async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd);

const scope: ViewerScope = {
  membershipId: "membership-1",
  role: "LEARNER",
  tenantId: "tenant-1",
  viewerId: "learner-1",
};

const detail: AssessmentLearnerDetail = {
  _id: "assessment-1",
  activeAttemptId: null,
  attemptsRemaining: 2,
  attemptsUsed: 0,
  availability: "OPEN",
  closesAt: null,
  courseId: "course-1",
  currentVersionNumber: 1,
  instructions: "Làm tất cả câu hỏi.",
  maxAttempts: 2,
  maxScore: 10,
  opensAt: null,
  passPercent: 70,
  resultVisibility: "AFTER_ATTEMPTS_EXHAUSTED",
  serverNow: "2030-08-20T08:00:00.000Z",
  status: "PUBLISHED",
  timeLimitSeconds: 600,
  title: "Kiểm tra Nhập môn",
  versionNumber: 1,
};

const attempt: AssessmentAttempt = {
  _id: "attempt-1",
  answers: [],
  assessmentId: "assessment-1",
  attemptNumber: 1,
  deadlineAt: "2030-08-20T08:10:00.000Z",
  instructions: detail.instructions,
  questions: [],
  result: null,
  resultReleased: false,
  revision: 1,
  serverNow: detail.serverNow,
  startedAt: detail.serverNow,
  status: "IN_PROGRESS",
  submittedAt: null,
  title: detail.title,
  versionNumber: 1,
};

function createClient(staleTime = 0) {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime },
    },
  });
}

function renderPage(client = createClient(), strict = false) {
  const page = <AssessmentDetailPage />;
  return render(
    <QueryClientProvider client={client}>
      {strict ? <StrictMode>{page}</StrictMode> : page}
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getLearnerDetail.mockReset();
  mocks.getLearnerDetail.mockResolvedValue(detail);
  mocks.push.mockReset();
  mocks.startAttempt.mockReset();
  mocks.startAttempt.mockResolvedValue(attempt);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AssessmentDetailPage", () => {
  it("retries a failed load once and disables retry while fetching", async () => {
    let resolve!: (value: AssessmentLearnerDetail) => void;
    const pending = new Promise<AssessmentLearnerDetail>((done) => { resolve = done; });
    mocks.getLearnerDetail.mockRejectedValueOnce(new Error("Temporary outage")).mockReturnValue(pending);
    renderPage();
    const retry = await screen.findByRole("button", { name: "Thử lại" });
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull());
    expect(document.querySelector('[role="status"], .ant-skeleton')).toBeTruthy();
    fireEvent.click(retry);
    expect(mocks.getLearnerDetail).toHaveBeenCalledTimes(2);
    await act(async () => { resolve(detail); });
    expect(await screen.findByRole("heading", { name: detail.title })).toBeTruthy();
    expect(mocks.startAttempt).not.toHaveBeenCalled();
  });

  it("React StrictMode vẫn điều hướng và cập nhật cache sau khi start thành công", async () => {
    const startedDetail = {
      ...detail,
      activeAttemptId: "attempt-1",
      attemptsRemaining: 1,
      attemptsUsed: 1,
    };
    mocks.getLearnerDetail
      .mockResolvedValueOnce(detail)
      .mockResolvedValue(startedDetail);
    const client = createClient();
    renderPage(client, true);

    fireEvent.click(await screen.findByRole("button", { name: "Bắt đầu lượt làm" }));

    await waitFor(() => expect(mocks.startAttempt).toHaveBeenCalledWith(
      { token: "tenant-token" },
      "assessment-1",
      { clientMutationId: "mutation-1" },
    ));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(
      "/assessments/attempts/attempt-1",
    ));
    await waitFor(() => expect(
      client.getQueryData<AssessmentLearnerDetail>(
        lmsQueryKeys.assessmentLearnerDetail(scope, "assessment-1"),
      )?.activeAttemptId,
    ).toBe("attempt-1"));
    expect(client.getQueryData(
      lmsQueryKeys.assessmentAttempt(scope, "attempt-1"),
    )).toEqual(attempt);
    await waitFor(() => expect(mocks.getLearnerDetail).toHaveBeenCalledTimes(2));
  });

  it("tự chuyển UPCOMING → OPEN → CLOSED theo serverNow mà không cần refetch", () => {
    const snapshotAt = Date.parse("2030-08-20T08:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(snapshotAt);
    const client = createClient(Number.POSITIVE_INFINITY);
    client.setQueryData(
      lmsQueryKeys.assessmentLearnerDetail(scope, "assessment-1"),
      {
        ...detail,
        availability: "UPCOMING",
        closesAt: "2030-08-20T08:00:04.000Z",
        opensAt: "2030-08-20T08:00:02.000Z",
      },
    );
    renderPage(client);
    const startButton = screen.getByRole("button", { name: "Bắt đầu lượt làm" });

    expect(screen.getByText("Sắp mở")).toBeTruthy();
    expect((startButton as HTMLButtonElement).disabled).toBe(true);

    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByText("Đang mở")).toBeTruthy();
    expect((startButton as HTMLButtonElement).disabled).toBe(false);

    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByText("Đã đóng")).toBeTruthy();
    expect((startButton as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.getLearnerDetail).not.toHaveBeenCalled();
  });
});
