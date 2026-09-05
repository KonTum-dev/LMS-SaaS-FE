// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssessmentAttempt } from "@/lib/assessment-api";
import {
  assessmentAnswerRecoveryKey,
  writeAssessmentAnswerRecovery,
} from "@/lib/assessment-answer-recovery";
import { ApiError } from "@/lib/api";
import { lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";
import { AssessmentAttemptRunner } from "./assessment-attempt-runner";
import { FeedbackLanguageSwitcher, FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";

const mocks = vi.hoisted(() => ({
  getAttempt: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  saveAnswer: vi.fn(),
  submitAttempt: vi.fn(),
}));

vi.mock("@/lib/assessment-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/assessment-api")>()),
  assessmentApi: {
    getAttempt: mocks.getAttempt,
    saveAnswer: mocks.saveAnswer,
    submitAttempt: mocks.submitAttempt,
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));
vi.mock("@ant-design/icons", () => ({
  ArrowLeftOutlined: () => null,
  ReloadOutlined: () => null,
  SendOutlined: () => null,
}));
vi.mock("antd", async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd);

const scope: ViewerScope = {
  membershipId: "membership-1",
  role: "LEARNER",
  tenantId: "tenant-1",
  viewerId: "learner-1",
};

const initialAttempt: AssessmentAttempt = {
  _id: "attempt-1",
  answers: [],
  assessmentId: "assessment-1",
  attemptNumber: 1,
  deadlineAt: null,
  instructions: "Chọn đáp án phù hợp.",
  questions: [
    {
      choices: [{ id: "choice-1a", text: "Hà Nội" }, { id: "choice-1b", text: "Huế" }],
      id: "question-1",
      points: 1,
      prompt: "Thủ đô Việt Nam là gì?",
      type: "SINGLE_CHOICE",
    },
    {
      choices: [{ id: "choice-2a", text: "Đỏ" }, { id: "choice-2b", text: "Xanh" }, { id: "choice-2c", text: "Tròn" }],
      id: "question-2",
      points: 2,
      prompt: "Chọn các màu",
      type: "MULTIPLE_CHOICE",
    },
  ],
  result: null,
  resultReleased: false,
  revision: 1,
  serverNow: "2030-08-20T08:00:00.000Z",
  startedAt: "2030-08-20T08:00:00.000Z",
  status: "IN_PROGRESS",
  submittedAt: null,
  title: "Kiểm tra Nhập môn",
  versionNumber: 1,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, reject, resolve };
}

function withAnswer(revision: number, answers: AssessmentAttempt["answers"]): AssessmentAttempt {
  return { ...initialAttempt, answers, revision };
}

function createClient(staleTime = 0) {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime },
    },
  });
}

function renderRunner(readOnly = false, client = createClient()) {
  const view = render(
    <QueryClientProvider client={client}>
      <AssessmentAttemptRunner attemptId="attempt-1" readOnly={readOnly} scope={scope} token="tenant-token" />
    </QueryClientProvider>,
  );
  return { client, ...view };
}

beforeEach(() => {
  mocks.getAttempt.mockReset();
  mocks.getAttempt.mockResolvedValue(initialAttempt);
  mocks.push.mockReset();
  mocks.replace.mockReset();
  mocks.saveAnswer.mockReset();
  mocks.submitAttempt.mockReset();
  mocks.submitAttempt.mockResolvedValue({
    ...initialAttempt,
    revision: 4,
    status: "SUBMITTED",
    submittedAt: "2030-08-20T08:10:00.000Z",
  });
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AssessmentAttemptRunner", () => {
  it("serialize answer PUTs và submit chỉ sau khi queue đã drain", async () => {
    const first = deferred<AssessmentAttempt>();
    const second = deferred<AssessmentAttempt>();
    mocks.saveAnswer
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    renderRunner();
    await screen.findByText("Thủ đô Việt Nam là gì?");

    fireEvent.click(screen.getByRole("radio", { name: "Hà Nội" }));
    await waitFor(() => expect(mocks.saveAnswer).toHaveBeenCalledTimes(1));
    expect(mocks.saveAnswer.mock.calls[0].slice(1, 4)).toEqual([
      "attempt-1",
      "question-1",
      { expectedRevision: 1, selectedChoiceIds: ["choice-1a"] },
    ]);

    fireEvent.click(screen.getByRole("checkbox", { name: "Đỏ" }));
    expect(mocks.saveAnswer).toHaveBeenCalledTimes(1);
    const submitButtons = screen.getAllByRole("button", { name: "Nộp bài" });
    fireEvent.click(submitButtons.at(-1)!);
    expect(mocks.submitAttempt).not.toHaveBeenCalled();

    first.resolve(withAnswer(2, [{ questionId: "question-1", selectedChoiceIds: ["choice-1a"] }]));
    await waitFor(() => expect(mocks.saveAnswer).toHaveBeenCalledTimes(2));
    expect(mocks.saveAnswer.mock.calls[1].slice(1, 4)).toEqual([
      "attempt-1",
      "question-2",
      { expectedRevision: 2, selectedChoiceIds: ["choice-2a"] },
    ]);
    second.resolve(withAnswer(3, [
      { questionId: "question-1", selectedChoiceIds: ["choice-1a"] },
      { questionId: "question-2", selectedChoiceIds: ["choice-2a"] },
    ]));

    await waitFor(() => expect(mocks.submitAttempt).toHaveBeenCalledWith(
      { token: "tenant-token" },
      "attempt-1",
      { expectedRevision: 3 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/assessments/results/attempt-1"));
  });

  it("READ_ONLY vẫn GET attempt nhưng khóa lựa chọn và submit", async () => {
    renderRunner(true);
    await screen.findByText("Thủ đô Việt Nam là gì?");
    expect((screen.getByRole("radio", { name: "Hà Nội" }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/không thể thay đổi hoặc nộp bài/)).toBeTruthy();
    screen.getAllByRole("button", { name: "Nộp bài" }).forEach((button) => {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });
    expect(mocks.saveAnswer).not.toHaveBeenCalled();
    expect(mocks.submitAttempt).not.toHaveBeenCalled();
  });

  it("READ_ONLY không phục hồi thành mutation từ bản lưu cục bộ", async () => {
    writeAssessmentAnswerRecovery(
      assessmentAnswerRecoveryKey(scope, "attempt-1"),
      new Map([["question-1", ["choice-1a"]]]),
    );

    renderRunner(true);
    const choice = await screen.findByRole("radio", { name: "Hà Nội" }) as HTMLInputElement;

    expect(choice.checked).toBe(false);
    expect(mocks.saveAnswer).not.toHaveBeenCalled();
  });

  it("CAS conflict giữ lựa chọn local và hiện hành động nạp bản mới", async () => {
    mocks.saveAnswer.mockRejectedValue(new ApiError(
      "Lượt làm đã thay đổi",
      409,
      "ATTEMPT_REVISION_MISMATCH",
    ));
    renderRunner();
    await screen.findByText("Thủ đô Việt Nam là gì?");
    fireEvent.click(screen.getByRole("radio", { name: "Hà Nội" }));

    expect(await screen.findByText("Chưa lưu được đáp án")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nạp bản mới và lưu lại" })).toBeTruthy();
    expect((screen.getByRole("radio", { name: "Hà Nội" }) as HTMLInputElement).checked).toBe(true);
  });

  it("terminal attempt không render câu hỏi có thể sửa và chỉ dẫn tới result", async () => {
    mocks.getAttempt.mockResolvedValue({ ...initialAttempt, status: "TIMED_OUT" });
    renderRunner();
    expect(await screen.findByText("Lượt làm đã hết giờ")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Hà Nội" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Xem trạng thái kết quả" }));
    expect(mocks.replace).toHaveBeenCalledWith("/assessments/results/attempt-1");
  });

  it("dùng tuổi thật của serverNow trong cache để không cộng lại thời gian", () => {
    const snapshotAt = Date.parse("2030-08-20T08:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(snapshotAt);
    const client = createClient(Number.POSITIVE_INFINITY);
    client.setQueryData(
      lmsQueryKeys.assessmentAttempt(scope, "attempt-1"),
      {
        ...initialAttempt,
        deadlineAt: "2030-08-20T08:10:00.000Z",
        serverNow: "2030-08-20T08:00:00.000Z",
      },
    );
    vi.setSystemTime(snapshotAt + 5 * 60 * 1_000);

    renderRunner(false, client);

    expect(screen.getByLabelText("Thời gian còn lại 05:00")).toBeTruthy();
    expect(mocks.getAttempt).not.toHaveBeenCalled();
  });

  it("hết giờ lỗi mạng không refetch lặp và cho phép xác nhận lại", async () => {
    const snapshotAt = Date.parse("2030-08-20T08:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(snapshotAt);
    const client = createClient(Number.POSITIVE_INFINITY);
    client.setQueryData(
      lmsQueryKeys.assessmentAttempt(scope, "attempt-1"),
      {
        ...initialAttempt,
        deadlineAt: "2030-08-20T08:00:01.000Z",
        serverNow: "2030-08-20T08:00:00.000Z",
      },
    );
    mocks.getAttempt.mockRejectedValue(new Error("Mất kết nối"));
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
    render(<FeedbackLocaleProvider><FeedbackLanguageSwitcher /><QueryClientProvider client={client}><AssessmentAttemptRunner attemptId="attempt-1" readOnly={false} scope={scope} token="tenant-token" /></QueryClientProvider></FeedbackLocaleProvider>);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByText("Chưa chốt được lượt làm")).toBeTruthy();
    expect(screen.getByText(/Chưa thể xác nhận hết giờ: Mất kết nối/)).toBeTruthy();
    expect(mocks.getAttempt).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByText(/Could not confirm timeout: Mất kết nối/)).toBeTruthy();
    expect(mocks.getAttempt).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    expect(screen.getByText(/Chưa thể xác nhận hết giờ: Mất kết nối/)).toBeTruthy();
    expect(mocks.getAttempt).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(5_000));
    expect(mocks.getAttempt).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Thử xác nhận lại" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.getAttempt).toHaveBeenCalledTimes(2);
  });

  it("hết giờ lấy terminal status từ máy chủ rồi điều hướng tới kết quả", async () => {
    const snapshotAt = Date.parse("2030-08-20T08:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(snapshotAt);
    const client = createClient(Number.POSITIVE_INFINITY);
    const timedAttempt = {
      ...initialAttempt,
      deadlineAt: "2030-08-20T08:00:01.000Z",
      serverNow: "2030-08-20T08:00:00.000Z",
    };
    client.setQueryData(
      lmsQueryKeys.assessmentAttempt(scope, "attempt-1"),
      timedAttempt,
    );
    mocks.getAttempt.mockResolvedValue({
      ...timedAttempt,
      serverNow: "2030-08-20T08:00:01.000Z",
      status: "TIMED_OUT",
    });
    renderRunner(false, client);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(mocks.replace).toHaveBeenCalledWith("/assessments/results/attempt-1");
    expect(
      (screen.getByRole("radio", { name: "Hà Nội" }) as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it("đợi PUT pending hoàn tất trước khi điều hướng về chi tiết", async () => {
    const pendingSave = deferred<AssessmentAttempt>();
    mocks.saveAnswer.mockReturnValueOnce(pendingSave.promise);
    renderRunner();
    await screen.findByText("Thủ đô Việt Nam là gì?");

    fireEvent.click(screen.getByRole("radio", { name: "Hà Nội" }));
    await waitFor(() => expect(mocks.saveAnswer).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Chi tiết bài kiểm tra" }));
    expect(mocks.push).not.toHaveBeenCalled();

    pendingSave.resolve(withAnswer(2, [{
      questionId: "question-1",
      selectedChoiceIds: ["choice-1a"],
    }]));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/assessments/assessment-1"));
  });

  it("khôi phục lựa chọn sau unmount khi PUT pending bị hủy", async () => {
    const pendingSave = deferred<AssessmentAttempt>();
    mocks.saveAnswer
      .mockReturnValueOnce(pendingSave.promise)
      .mockResolvedValueOnce(withAnswer(2, [{
        questionId: "question-1",
        selectedChoiceIds: ["choice-1a"],
      }]));
    const firstView = renderRunner();
    await screen.findByText("Thủ đô Việt Nam là gì?");
    fireEvent.click(screen.getByRole("radio", { name: "Hà Nội" }));
    await waitFor(() => expect(mocks.saveAnswer).toHaveBeenCalledTimes(1));

    firstView.unmount();
    renderRunner();

    await waitFor(() => expect(
      (screen.getByRole("radio", { name: "Hà Nội" }) as HTMLInputElement).checked,
    ).toBe(true));
    await waitFor(() => expect(mocks.saveAnswer).toHaveBeenCalledTimes(2));
    expect(mocks.saveAnswer.mock.calls[1].slice(1, 4)).toEqual([
      "attempt-1",
      "question-1",
      { expectedRevision: 1, selectedChoiceIds: ["choice-1a"] },
    ]);
  });
});
