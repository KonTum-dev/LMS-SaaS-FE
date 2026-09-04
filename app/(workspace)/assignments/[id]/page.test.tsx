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
import type {
  Assignment,
  EffectiveAccess,
  LearnerSubmission,
  MyResult,
  SubmissionStatus,
  UserRole,
} from "@/lib/types";
import LearnerAssignmentPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  assignment: null as Assignment | null,
  currentResult: null as MyResult | null,
  currentSubmission: null as LearnerSubmission | null,
  effectiveAccess: null as EffectiveAccess | null,
  getMyResult: vi.fn(),
  getMySubmission: vi.fn(),
  gradeSubmission: vi.fn(),
  push: vi.fn(),
  returnGradingSubmission: vi.fn(),
  role: "LEARNER" as UserRole,
  saveMySubmission: vi.fn(),
  sequence: [] as string[],
  submitMySubmission: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiFetch: mocks.apiFetch };
});
vi.mock("@/lib/submission-api", () => ({
  submissionApi: {
    getMyResult: mocks.getMyResult,
    getMySubmission: mocks.getMySubmission,
    gradeSubmission: mocks.gradeSubmission,
    returnGradingSubmission: mocks.returnGradingSubmission,
    saveMySubmission: mocks.saveMySubmission,
    submitMySubmission: mocks.submitMySubmission,
  },
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "assignment-1" }),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: mocks.effectiveAccess,
    organization: { _id: "tenant-1" },
    token: "tenant-token",
    user: {
      email: "learner@example.test",
      fullName: "Learner One",
      membershipId: "membership-1",
      role: mocks.role,
      sub: "learner-1",
      tenantId: "tenant-1",
    },
  }),
}));
vi.mock("@ant-design/icons", () => ({
  ArrowLeftOutlined: () => null,
  LinkOutlined: () => null,
  SaveOutlined: () => null,
  SendOutlined: () => null,
}));
vi.mock(
  "antd",
  async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

function assignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    _id: "assignment-1",
    allowLate: true,
    archivedAt: null,
    courseId: { _id: "course-1", slug: "course-one", title: "Khóa học Một" },
    description: "Viết phần phân tích",
    dueAt: "2030-09-01T12:00:00.000Z",
    maxPoints: 100,
    published: true,
    publishedAt: "2030-08-01T12:00:00.000Z",
    submissionMode: "TEXT",
    title: "Bài tập Một",
    ...overrides,
  };
}

function result(state: MyResult["state"]): MyResult {
  const submitted =
    state === "SUBMITTED" || state === "RETURNED" || state === "GRADED";
  const submissionMode = mocks.assignment?.submissionMode ?? "TEXT";
  return {
    attemptCount: submitted ? 1 : 0,
    result:
      state === "GRADED"
        ? {
            feedback: "Lập luận tốt",
            gradedAt: "2030-09-03T09:00:00.000Z",
            maxPoints: 100,
            percentage: 85,
            score: 85,
          }
        : null,
    returnFeedback: state === "RETURNED" ? "Bổ sung nguồn tham khảo" : null,
    state,
    submissionMode,
    submittedAttachmentIds:
      submitted && submissionMode === "FILES"
        ? ["64b000000000000000000011"]
        : [],
    submissionId: state === "NOT_STARTED" ? null : "submission-1",
    submittedAt: submitted ? "2030-09-02T09:00:00.000Z" : null,
    wasLate: false,
  };
}

function submission(status: SubmissionStatus): LearnerSubmission {
  const submitted =
    status === "SUBMITTED" || status === "RETURNED" || status === "GRADED";
  const submissionMode = mocks.assignment?.submissionMode ?? "TEXT";
  const fileIds =
    submissionMode === "FILES" ? ["64b000000000000000000011"] : [];
  return {
    _id: "submission-1",
    assignmentId: "assignment-1",
    attemptCount: submitted ? 1 : 0,
    draftAttachmentIds: fileIds,
    draftContent:
      submissionMode === "FILES"
        ? null
        : status === "RETURNED"
          ? "Nội dung cần sửa"
          : "Bản nháp hiện tại",
    draftUpdatedAt: "2030-09-02T08:00:00.000Z",
    firstSubmittedAt: submitted ? "2030-09-02T09:00:00.000Z" : null,
    gradedAt: status === "GRADED" ? "2030-09-03T09:00:00.000Z" : null,
    gradingFeedback: status === "GRADED" ? "Lập luận tốt" : null,
    maxPoints: 100,
    dueAt: "2030-09-01T12:00:00.000Z",
    returnFeedback: status === "RETURNED" ? "Bổ sung nguồn tham khảo" : null,
    returnedAt: status === "RETURNED" ? "2030-09-03T08:00:00.000Z" : null,
    revision: 4,
    score: status === "GRADED" ? 85 : null,
    status,
    submissionMode,
    submittedAttachmentIds: submitted ? fileIds : [],
    submittedAt: submitted ? "2030-09-02T09:00:00.000Z" : null,
    submittedContent: submitted ? "Bài làm đã gửi" : null,
    wasLate: false,
  };
}

function configureState(state: MyResult["state"]) {
  mocks.currentResult = result(state);
  mocks.currentSubmission = state === "NOT_STARTED" ? null : submission(state);
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <LearnerAssignmentPage />
    </QueryClientProvider>,
  );
  return client;
}

describe("learner assignment detail", () => {
  beforeEach(() => {
    notifyManager.setScheduler((callback) => queueMicrotask(callback));
    mocks.assignment = assignment();
    mocks.effectiveAccess = {
      graceEndsAt: null,
      limits: {
        maxActiveLearners: null,
        maxBranches: null,
        maxCourses: 100,
        maxUsers: 1000,
      },
      modules: ["COURSES", "ENROLLMENTS", "ASSIGNMENTS"],
      readOnly: false,
      state: "ACTIVE",
    };
    mocks.role = "LEARNER";
    mocks.sequence = [];
    configureState("NOT_STARTED");
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockImplementation(() => Promise.resolve(mocks.assignment));
    mocks.getMySubmission.mockReset();
    mocks.getMySubmission.mockImplementation(() =>
      Promise.resolve(mocks.currentSubmission),
    );
    mocks.getMyResult.mockReset();
    mocks.getMyResult.mockImplementation(() =>
      Promise.resolve(mocks.currentResult),
    );
    mocks.saveMySubmission.mockReset();
    mocks.saveMySubmission.mockImplementation(
      (
        _,
        assignmentId: string,
        input: {
          attachmentIds?: string[];
          content?: string;
          expectedRevision: number;
        },
      ) => {
        mocks.sequence.push(`save:${input.expectedRevision}`);
        const previous = mocks.currentSubmission;
        const filesMode = Array.isArray(input.attachmentIds);
        const saved: LearnerSubmission = {
          ...(previous ?? submission("DRAFT")),
          assignmentId,
          draftAttachmentIds: filesMode ? (input.attachmentIds ?? []) : [],
          draftContent: filesMode ? null : (input.content ?? ""),
          revision: input.expectedRevision + 1,
          status: previous?.status === "RETURNED" ? "RETURNED" : "DRAFT",
          submissionMode: filesMode
            ? "FILES"
            : (mocks.assignment?.submissionMode ?? "TEXT"),
        };
        mocks.currentSubmission = saved;
        mocks.currentResult = result(saved.status);
        return Promise.resolve(saved);
      },
    );
    mocks.submitMySubmission.mockReset();
    mocks.submitMySubmission.mockImplementation(
      (_, __: string, input: { expectedRevision: number }) => {
        mocks.sequence.push(`submit:${input.expectedRevision}`);
        const submitted: LearnerSubmission = {
          ...(mocks.currentSubmission ?? submission("DRAFT")),
          attemptCount: (mocks.currentSubmission?.attemptCount ?? 0) + 1,
          revision: input.expectedRevision + 1,
          status: "SUBMITTED",
          submittedAt: "2030-09-02T09:00:00.000Z",
          submittedAttachmentIds:
            mocks.currentSubmission?.draftAttachmentIds ?? [],
          submittedContent:
            mocks.currentSubmission?.submissionMode === "FILES"
              ? null
              : (mocks.currentSubmission?.draftContent ?? ""),
        };
        mocks.currentSubmission = submitted;
        mocks.currentResult = result("SUBMITTED");
        return Promise.resolve(submitted);
      },
    );
    mocks.push.mockReset();
  });

  afterEach(() => {
    notifyManager.setScheduler(defaultScheduler);
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each([
    ["NOT_STARTED", "Chưa bắt đầu"],
    ["DRAFT", "Bản nháp"],
    ["SUBMITTED", "Đã nộp"],
    ["RETURNED", "Cần chỉnh sửa"],
    ["GRADED", "Đã chấm điểm"],
  ] as const)("render state %s rõ ràng", async (state, label) => {
    configureState(state);
    renderPage();

    expect(await screen.findByText(label, { exact: true })).toBeTruthy();
    if (state === "NOT_STARTED" || state === "DRAFT" || state === "RETURNED") {
      expect(screen.getByLabelText("Nội dung bài làm")).toBeTruthy();
      expect(
        screen.getByRole("button", {
          name: state === "RETURNED" ? "Nộp lại" : "Nộp bài",
        }),
      ).toBeTruthy();
    } else {
      expect(screen.queryByLabelText("Nội dung bài làm")).toBeNull();
      expect(
        screen.getByText(
          state === "SUBMITTED"
            ? "Bài làm đang chờ giảng viên chấm điểm."
            : "Bài làm đã được chấm điểm.",
        ),
      ).toBeTruthy();
    }
    if (state === "RETURNED")
      expect(screen.getByText("Bổ sung nguồn tham khảo")).toBeTruthy();
    if (state === "GRADED") {
      expect(screen.getByText(/85\/100 điểm · 85%/)).toBeTruthy();
      expect(screen.getByText("Lập luận tốt")).toBeTruthy();
    }
  });

  it("one-click submit luôn save trước với revision 0 rồi submit revision trả về", async () => {
    configureState("NOT_STARTED");
    renderPage();
    const editor = await screen.findByLabelText("Nội dung bài làm");
    fireEvent.change(editor, { target: { value: "Nội dung lần đầu" } });
    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));

    await waitFor(() => expect(mocks.sequence).toEqual(["save:0", "submit:1"]));
    expect(mocks.saveMySubmission).toHaveBeenCalledWith(
      { token: "tenant-token" },
      "assignment-1",
      { content: "Nội dung lần đầu", expectedRevision: 0 },
    );
    expect(mocks.submitMySubmission).toHaveBeenCalledWith(
      { token: "tenant-token" },
      "assignment-1",
      { expectedRevision: 1 },
    );
    expect(await screen.findByText("Đã nộp", { exact: true })).toBeTruthy();
  });

  it("revision conflict giữ nguyên input, dừng submit và hướng dẫn refetch", async () => {
    const conflict = Object.assign(new Error("Revision mismatch"), {
      code: "SUBMISSION_REVISION_MISMATCH",
    });
    mocks.saveMySubmission.mockRejectedValueOnce(conflict);
    mocks.getMySubmission
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(submission("DRAFT"));
    renderPage();
    const editor = await screen.findByLabelText("Nội dung bài làm");
    fireEvent.change(editor, { target: { value: "Nội dung cục bộ chưa lưu" } });
    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));

    expect(
      await screen.findByText("Bản nháp đã thay đổi ở một phiên khác"),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText("Nội dung bài làm") as HTMLTextAreaElement).value,
    ).toBe("Nội dung cục bộ chưa lưu");
    const reloadButton = screen.getByRole("button", {
      name: "Đồng bộ revision mới nhất",
    });
    expect(reloadButton).toBeTruthy();
    expect(mocks.submitMySubmission).not.toHaveBeenCalled();
    expect(mocks.getMySubmission).toHaveBeenCalledOnce();

    fireEvent.click(reloadButton);
    await waitFor(() => expect(mocks.getMySubmission).toHaveBeenCalledTimes(2));
    expect(
      (screen.getByLabelText("Nội dung bài làm") as HTMLTextAreaElement).value,
    ).toBe("Nội dung cục bộ chưa lưu");
    fireEvent.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
    await waitFor(() =>
      expect(mocks.saveMySubmission).toHaveBeenLastCalledWith(
        { token: "tenant-token" },
        "assignment-1",
        { content: "Nội dung cục bộ chưa lưu", expectedRevision: 4 },
      ),
    );
  });

  it("ưu tiên submission status mới hơn result refetch đang stale", async () => {
    mocks.currentSubmission = submission("DRAFT");
    mocks.currentResult = result("NOT_STARTED");
    renderPage();

    expect(await screen.findByText("Bản nháp", { exact: true })).toBeTruthy();
    expect(screen.getByLabelText("Nội dung bài làm")).toBeTruthy();
    expect(screen.queryByText("Chưa bắt đầu", { exact: true })).toBeNull();
  });

  it("retry sau khi submit lỗi dùng revision của draft vừa lưu", async () => {
    mocks.submitMySubmission.mockImplementationOnce(
      (_, __: string, input: { expectedRevision: number }) => {
        mocks.sequence.push(`submit:${input.expectedRevision}`);
        return Promise.reject(new Error("Mất kết nối khi nộp bài"));
      },
    );
    renderPage();
    const editor = await screen.findByLabelText("Nội dung bài làm");
    fireEvent.change(editor, { target: { value: "Nội dung cần retry" } });
    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));

    expect(await screen.findByText("Mất kết nối khi nộp bài")).toBeTruthy();
    expect(mocks.sequence).toEqual(["save:0", "submit:1"]);
    expect(screen.getByText("Bản nháp", { exact: true })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    await waitFor(() =>
      expect(mocks.sequence).toEqual([
        "save:0",
        "submit:1",
        "save:1",
        "submit:2",
      ]),
    );
    expect(mocks.saveMySubmission).toHaveBeenLastCalledWith(
      { token: "tenant-token" },
      "assignment-1",
      { content: "Nội dung cần retry", expectedRevision: 1 },
    );
    expect(mocks.submitMySubmission).toHaveBeenLastCalledWith(
      { token: "tenant-token" },
      "assignment-1",
      { expectedRevision: 2 },
    );
    expect(await screen.findByText("Đã nộp", { exact: true })).toBeTruthy();
  });

  it("TEXT giới hạn chính xác 50 KiB UTF-8 và mô tả lỗi accessible", async () => {
    renderPage();
    const editor = await screen.findByLabelText("Nội dung bài làm");
    const saveButton = screen.getByRole("button", {
      name: "Lưu bản nháp",
    }) as HTMLButtonElement;
    const submitButton = screen.getByRole("button", {
      name: "Nộp bài",
    }) as HTMLButtonElement;

    fireEvent.change(editor, { target: { value: "đ".repeat(25_601) } });
    expect(
      await screen.findByText(
        "Nội dung văn bản không được vượt quá 50 KiB UTF-8.",
      ),
    ).toBeTruthy();
    expect(editor.getAttribute("aria-invalid")).toBe("true");
    expect(editor.getAttribute("aria-describedby")).toBe(
      "submission-content-validation",
    );
    expect(saveButton.disabled).toBe(true);
    expect(submitButton.disabled).toBe(true);

    fireEvent.change(editor, { target: { value: "đ".repeat(25_600) } });
    await waitFor(() =>
      expect(
        screen.queryByText(
          "Nội dung văn bản không được vượt quá 50 KiB UTF-8.",
        ),
      ).toBeNull(),
    );
    expect(editor.getAttribute("aria-invalid")).toBe("false");
    expect(saveButton.disabled).toBe(false);
    expect(submitButton.disabled).toBe(false);

    fireEvent.change(editor, {
      target: { value: `  ${"đ".repeat(25_600)}  ` },
    });
    await waitFor(() =>
      expect(
        screen.queryByText(
          "Nội dung văn bản không được vượt quá 50 KiB UTF-8.",
        ),
      ).toBeNull(),
    );
    expect(saveButton.disabled).toBe(false);
    expect(submitButton.disabled).toBe(false);
  });

  it("HTTPS_LINK khóa Save và Submit cho protocol/userinfo/link quá dài", async () => {
    mocks.assignment = assignment({ submissionMode: "HTTPS_LINK" });
    renderPage();
    const input = await screen.findByLabelText("Liên kết bài làm HTTPS");
    const saveButton = screen.getByRole("button", {
      name: "Lưu bản nháp",
    }) as HTMLButtonElement;
    const submitButton = screen.getByRole("button", {
      name: "Nộp bài",
    }) as HTMLButtonElement;

    fireEvent.change(input, {
      target: { value: "http://example.com/bai-lam" },
    });
    expect(
      await screen.findByText(
        "Nhập liên kết HTTPS có tên miền và không chứa tên đăng nhập hoặc mật khẩu.",
      ),
    ).toBeTruthy();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(
      "submission-content-validation",
    );
    expect(saveButton.disabled).toBe(true);
    expect(submitButton.disabled).toBe(true);

    fireEvent.change(input, {
      target: { value: "https://user:secret@example.com/bai-lam" },
    });
    expect(saveButton.disabled).toBe(true);
    expect(submitButton.disabled).toBe(true);

    fireEvent.change(input, {
      target: { value: `https://example.com/${"a".repeat(2_029)}` },
    });
    expect(
      await screen.findByText(
        "Liên kết HTTPS không được vượt quá 2.048 ký tự.",
      ),
    ).toBeTruthy();
    expect(saveButton.disabled).toBe(true);
    expect(submitButton.disabled).toBe(true);

    const urlThatGrowsWhenNormalized = `https://example.com?x=${"a".repeat(2_048 - "https://example.com?x=".length)}`;
    expect(urlThatGrowsWhenNormalized).toHaveLength(2_048);
    expect(new URL(urlThatGrowsWhenNormalized).toString()).toHaveLength(2_049);
    fireEvent.change(input, { target: { value: urlThatGrowsWhenNormalized } });
    expect(saveButton.disabled).toBe(true);
    expect(submitButton.disabled).toBe(true);

    fireEvent.change(input, {
      target: { value: "https://example.com/bai-lam" },
    });
    await waitFor(() =>
      expect(
        screen.queryByText("Liên kết HTTPS không được vượt quá 2.048 ký tự."),
      ).toBeNull(),
    );
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(saveButton.disabled).toBe(false);
    expect(submitButton.disabled).toBe(false);
  });

  it("FILES upload tuần tự, khóa submit đến khi drain, CAS-save từng AVAILABLE rồi submit snapshot", async () => {
    const firstId = "64b000000000000000000011";
    const secondId = "64b000000000000000000012";
    mocks.assignment = assignment({ submissionMode: "FILES" });
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      modules: ["COURSES", "ENROLLMENTS", "ASSIGNMENTS", "MEDIA"],
    };
    configureState("NOT_STARTED");
    let initiateIndex = 0;
    const assets = [firstId, secondId];
    let releaseFirstPut!: () => void;
    const firstPut = new Promise<Response>((resolve) => {
      releaseFirstPut = () => resolve(new Response(null, { status: 204 }));
    });
    const storagePut = vi
      .fn()
      .mockImplementationOnce(() => firstPut)
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", storagePut);
    mocks.apiFetch.mockImplementation(
      (path: string, options?: { method?: string }) => {
        if (path === "/assignments/assignment-1")
          return Promise.resolve(mocks.assignment);
        if (path.endsWith("/uploads") && options?.method === "POST") {
          const currentId = assets[initiateIndex++];
          return Promise.resolve({
            asset: {
              _id: currentId,
              contentType: "application/pdf",
              originalFileName: `bai-lam-${initiateIndex}.pdf`,
              purpose: "SUBMISSION_ATTACHMENT",
              revision: 2,
              sizeBytes: 4,
              status: "PENDING_UPLOAD",
            },
            upload: {
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
              headers: { "content-type": "application/pdf" },
              method: "PUT",
              url: `https://private-files.example.test/upload/${currentId}`,
            },
          });
        }
        const matchedId = assets.find((item) => path.includes(item));
        if (
          matchedId &&
          path.endsWith("/finalize") &&
          options?.method === "POST"
        ) {
          return Promise.resolve({
            _id: matchedId,
            contentType: "application/pdf",
            originalFileName: `bai-lam-${matchedId.slice(-1)}.pdf`,
            purpose: "SUBMISSION_ATTACHMENT",
            revision: 4,
            sizeBytes: 4,
            status: "AVAILABLE",
          });
        }
        if (matchedId && !options?.method) {
          return Promise.resolve({
            _id: matchedId,
            contentType: "application/pdf",
            originalFileName: `bai-lam-${matchedId.slice(-1)}.pdf`,
            purpose: "SUBMISSION_ATTACHMENT",
            revision: 4,
            sizeBytes: 4,
            status: "AVAILABLE",
          });
        }
        return Promise.reject(new Error(`Unexpected request: ${path}`));
      },
    );
    renderPage();
    const input = await screen.findByLabelText("Thêm tệp bài làm");
    fireEvent.change(input, {
      target: {
        files: [
          new File(["one!"], "one.pdf", {
            lastModified: 1,
            type: "application/pdf",
          }),
          new File(["two!"], "two.pdf", {
            lastModified: 2,
            type: "application/pdf",
          }),
        ],
      },
    });

    await waitFor(() => expect(storagePut).toHaveBeenCalledOnce());
    expect(
      (screen.getByRole("button", { name: "Nộp bài" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    releaseFirstPut();
    await waitFor(() =>
      expect(mocks.saveMySubmission).toHaveBeenNthCalledWith(
        1,
        { token: "tenant-token" },
        "assignment-1",
        { attachmentIds: [firstId], expectedRevision: 0 },
      ),
    );
    await waitFor(() =>
      expect(mocks.saveMySubmission).toHaveBeenNthCalledWith(
        2,
        { token: "tenant-token" },
        "assignment-1",
        { attachmentIds: [firstId, secondId], expectedRevision: 1 },
      ),
    );
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Nộp bài" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );

    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    await waitFor(() =>
      expect(mocks.saveMySubmission).toHaveBeenNthCalledWith(
        3,
        { token: "tenant-token" },
        "assignment-1",
        { attachmentIds: [firstId, secondId], expectedRevision: 2 },
      ),
    );
    expect(mocks.submitMySubmission).toHaveBeenCalledWith(
      { token: "tenant-token" },
      "assignment-1",
      { expectedRevision: 3 },
    );
    expect(await screen.findByText("Đã nộp", { exact: true })).toBeTruthy();
  });

  it("historical FILES snapshot vẫn hiện IDs khi MEDIA off nhưng download và mutation fail closed", async () => {
    mocks.assignment = assignment({ submissionMode: "FILES" });
    configureState("GRADED");
    renderPage();

    expect(await screen.findByText(/Mã tệp …00000011/u)).toBeTruthy();
    expect(screen.getByText("Tải tệp đang tạm khóa")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Tải xuống" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.queryByLabelText("Thêm tệp bài làm")).toBeNull();
    expect(
      mocks.apiFetch.mock.calls.filter(([path]) =>
        String(path).includes("attachments"),
      ),
    ).toHaveLength(0);
    expect(mocks.saveMySubmission).not.toHaveBeenCalled();
    expect(mocks.submitMySubmission).not.toHaveBeenCalled();
  });

  it("READ_ONLY vẫn GET dữ liệu nhưng khóa editor và mọi mutation", async () => {
    configureState("DRAFT");
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      readOnly: true,
      state: "READ_ONLY",
    };
    renderPage();

    const editor = await screen.findByLabelText("Nội dung bài làm");
    expect(screen.getByText("Workspace chỉ đọc")).toBeTruthy();
    expect((editor as HTMLTextAreaElement).disabled).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Lưu bản nháp",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Nộp bài" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/assignments/assignment-1",
      expect.objectContaining({
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: expect.anything(),
        token: "tenant-token",
      }),
    );
    expect(mocks.getMySubmission).toHaveBeenCalled();
    expect(mocks.getMyResult).not.toHaveBeenCalled();
    expect(mocks.saveMySubmission).not.toHaveBeenCalled();
    expect(mocks.submitMySubmission).not.toHaveBeenCalled();
  });

  it("manager không bao giờ gọi learner-private endpoints", async () => {
    mocks.role = "INSTRUCTOR";
    renderPage();

    expect(
      await screen.findByText("Khu vực nộp bài dành cho học viên"),
    ).toBeTruthy();
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/assignments/assignment-1",
      expect.objectContaining({
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: expect.anything(),
        token: "tenant-token",
      }),
    );
    expect(mocks.getMySubmission).not.toHaveBeenCalled();
    expect(mocks.getMyResult).not.toHaveBeenCalled();
  });

  it("module-off không phát sinh bất kỳ request nào", async () => {
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      modules: ["COURSES", "ENROLLMENTS"],
    };
    renderPage();

    expect(
      await screen.findByText(
        "Module Bài tập không khả dụng trong workspace này.",
      ),
    ).toBeTruthy();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
    expect(mocks.getMySubmission).not.toHaveBeenCalled();
    expect(mocks.getMyResult).not.toHaveBeenCalled();
  });
});
