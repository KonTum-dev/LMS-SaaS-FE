// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AssessmentAttempt,
  AssessmentAttemptResult,
  AssessmentLearnerDetail,
} from "@/lib/assessment-api";
import type { EffectiveAccess } from "@/lib/types";
import AssessmentResultPage from "./page";

const mocks = vi.hoisted(() => ({
  getAttempt: vi.fn(),
  getLearnerDetail: vi.fn(),
  getResult: vi.fn(),
  membershipId: "membership-1" as string | undefined,
  push: vi.fn(),
  readOnly: false,
  replace: vi.fn(),
}));

vi.mock("@/lib/assessment-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/assessment-api")>()),
  assessmentApi: {
    getAttempt: mocks.getAttempt,
    getLearnerDetail: mocks.getLearnerDetail,
    getResult: mocks.getResult,
  },
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ attemptId: "attempt-1" }),
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
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
      readOnly: mocks.readOnly,
      state: mocks.readOnly ? "READ_ONLY" : "ACTIVE",
    } satisfies EffectiveAccess,
    organization: { _id: "tenant-1" },
    token: "tenant-token",
    user: {
      email: "learner@example.test",
      fullName: "Learner",
      membershipId: mocks.membershipId,
      role: "LEARNER",
      sub: "learner-1",
      tenantId: "tenant-1",
    },
  }),
}));
vi.mock("@ant-design/icons", () => ({
  ArrowLeftOutlined: () => null,
  ReloadOutlined: () => null,
}));
vi.mock("antd", async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd);

const attempt: AssessmentAttempt = {
  _id: "attempt-1",
  answers: [],
  assessmentId: "assessment-1",
  attemptNumber: 2,
  deadlineAt: null,
  instructions: "",
  questions: [{
    choices: [
      { id: "choice-1", text: "Nội dung lựa chọn không thuộc trang kết quả" },
      { id: "choice-2", text: "Lựa chọn khác" },
    ],
    id: "question-1",
    points: 10,
    prompt: "Nội dung câu hỏi không thuộc trang kết quả",
    type: "SINGLE_CHOICE",
  }],
  result: null,
  resultReleased: false,
  revision: 3,
  serverNow: "2030-08-20T08:10:00.000Z",
  startedAt: "2030-08-20T08:00:00.000Z",
  status: "SUBMITTED",
  submittedAt: "2030-08-20T08:10:00.000Z",
  title: "Kiểm tra Nhập môn",
  versionNumber: 1,
};

const learnerDetail: AssessmentLearnerDetail = {
  _id: "assessment-1",
  activeAttemptId: null,
  attemptsRemaining: 0,
  attemptsUsed: 2,
  availability: "CLOSED",
  closesAt: "2030-08-21T08:00:00.000Z",
  courseId: "course-1",
  currentVersionNumber: 1,
  instructions: "",
  maxAttempts: 2,
  maxScore: 10,
  opensAt: null,
  passPercent: 70,
  resultVisibility: "AFTER_CLOSE",
  serverNow: "2030-08-20T08:10:00.000Z",
  status: "PUBLISHED",
  timeLimitSeconds: null,
  title: "Kiểm tra Nhập môn",
  versionNumber: 1,
};

const pendingResult: AssessmentAttemptResult = {
  attemptId: "attempt-1",
  attemptNumber: 2,
  result: null,
  resultReleased: false,
  status: "SUBMITTED",
  submittedAt: "2030-08-20T08:10:00.000Z",
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AssessmentResultPage /></QueryClientProvider>);
  return client;
}

beforeEach(() => {
  mocks.getAttempt.mockReset();
  mocks.getAttempt.mockResolvedValue(attempt);
  mocks.getLearnerDetail.mockReset();
  mocks.getLearnerDetail.mockResolvedValue(learnerDetail);
  mocks.getResult.mockReset();
  mocks.getResult.mockResolvedValue(pendingResult);
  mocks.membershipId = "membership-1";
  mocks.push.mockReset();
  mocks.readOnly = false;
  mocks.replace.mockReset();
});

afterEach(cleanup);

describe("AssessmentResultPage", () => {
  it("retries a failed result without duplicate requests or revealing hidden scores", async () => {
    let resolve!: (value: AssessmentAttemptResult) => void;
    const pending = new Promise<AssessmentAttemptResult>((done) => { resolve = done; });
    mocks.getResult.mockRejectedValueOnce(new Error("Temporary outage")).mockReturnValue(pending);
    renderPage();
    const retry = await screen.findByRole("button", { name: "Thử lại" });
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull());
    expect(document.querySelector('[role="status"], .ant-skeleton')).toBeTruthy();
    fireEvent.click(retry);
    expect(mocks.getResult).toHaveBeenCalledTimes(2);
    resolve(pendingResult);
    expect(await screen.findByText("Bài đã được ghi nhận")).toBeTruthy();
    expect(screen.queryByText(/\/ 10 điểm/)).toBeNull();
  });

  it("hiển thị policy-pending mà không suy diễn điểm hoặc đáp án", async () => {
    renderPage();

    expect(await screen.findByText("Bài đã được ghi nhận")).toBeTruthy();
    expect(await screen.findByText(/Kết quả sẽ được công bố sau 21\/08\/2030 15:00/)).toBeTruthy();
    expect(screen.queryByText("Nội dung câu hỏi không thuộc trang kết quả")).toBeNull();
    expect(screen.queryByText("Nội dung lựa chọn không thuộc trang kết quả")).toBeNull();
    expect(screen.queryByText(/\/ 10 điểm/)).toBeNull();
  });

  it("mô tả AFTER_ATTEMPTS_EXHAUSTED đúng policy backend, không hứa mở khi đóng bài", async () => {
    mocks.getLearnerDetail.mockResolvedValue({
      ...learnerDetail,
      closesAt: "2030-08-21T08:00:00.000Z",
      resultVisibility: "AFTER_ATTEMPTS_EXHAUSTED",
    });
    renderPage();

    expect(await screen.findByText(
      /hoàn tất toàn bộ số lượt làm được cấp và không còn lượt đang mở/,
    )).toBeTruthy();
    expect(screen.queryByText(/hoặc khi bài kiểm tra đóng/)).toBeNull();
  });

  it("khi released chỉ render summary do server chấm, không render payload thừa dạng answerKey", async () => {
    mocks.getResult.mockResolvedValue({
      ...pendingResult,
      answerKey: "KHÔNG ĐƯỢC HIỂN THỊ",
      result: {
        maxScore: 10,
        passed: true,
        percentage: 82.5,
        score: 8.25,
        scoredAt: "2030-08-20T08:10:01.000Z",
      },
      resultReleased: true,
    });
    renderPage();

    expect(await screen.findByText("Đạt")).toBeTruthy();
    expect(screen.getByText("Xem điểm và kết quả bài kiểm tra của bạn. Đáp án từng câu không hiển thị tại đây.")).toBeTruthy();
    expect(screen.queryByText(/V1|máy chủ chấm/)).toBeNull();
    expect(screen.getAllByText(/82[,.]5%/).length).toBeGreaterThan(0);
    expect(screen.getByText("8,25")).toBeTruthy();
    expect(screen.queryByText("KHÔNG ĐƯỢC HIỂN THỊ")).toBeNull();
    expect(screen.queryByText("Nội dung câu hỏi không thuộc trang kết quả")).toBeNull();
  });

  it("lượt IN_PROGRESS chỉ dẫn trở lại trang làm bài", async () => {
    mocks.getAttempt.mockResolvedValue({ ...attempt, status: "IN_PROGRESS", submittedAt: null });
    mocks.getResult.mockResolvedValue({
      ...pendingResult,
      status: "IN_PROGRESS",
      submittedAt: null,
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục làm bài" }));
    expect(mocks.replace).toHaveBeenCalledWith("/assessments/attempts/attempt-1");
  });

  it("READ_ONLY vẫn tải được result summary qua GET", async () => {
    mocks.readOnly = true;
    mocks.getResult.mockResolvedValue({
      ...pendingResult,
      result: {
        maxScore: 10,
        passed: false,
        percentage: 60,
        score: 6,
        scoredAt: "2030-08-20T08:10:01.000Z",
      },
      resultReleased: true,
    });
    renderPage();

    expect(await screen.findByText("Chưa đạt")).toBeTruthy();
    expect(mocks.getAttempt).toHaveBeenCalledWith({ token: "tenant-token" }, "attempt-1");
    expect(mocks.getResult).toHaveBeenCalledWith({ token: "tenant-token" }, "attempt-1");
  });

  it("fail closed khi thiếu membershipId", async () => {
    mocks.membershipId = undefined;
    renderPage();

    expect(screen.getByText(/Phiên thành viên không hợp lệ/)).toBeTruthy();
    await waitFor(() => expect(mocks.getResult).not.toHaveBeenCalled());
    expect(mocks.getAttempt).not.toHaveBeenCalled();
  });
});
