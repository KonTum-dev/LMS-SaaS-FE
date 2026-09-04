import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import type {
  CourseReport,
  GradingSubmissionDetail,
  GradingSubmissionRow,
  LearnerSubmission,
  MyResult,
  Paginated,
} from "./types";
import { buildSubmissionQuery, submissionApi } from "./submission-api";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiFetch: mocks.apiFetch };
});

const context = { token: "tenant-token" };
const secureOptions = {
  cache: "no-store",
  credentials: "same-origin",
  referrerPolicy: "no-referrer",
  token: "tenant-token",
} as const;
const learnerSubmission: LearnerSubmission = {
  _id: "submission-1",
  assignmentId: "assignment-1",
  attemptCount: 2,
  draftAttachmentIds: [],
  draftContent: "Bản nháp mới",
  draftUpdatedAt: "2030-08-20T09:00:00.000Z",
  firstSubmittedAt: "2030-08-18T08:00:00.000Z",
  gradedAt: null,
  gradingFeedback: null,
  maxPoints: 100,
  dueAt: "2030-08-30T08:00:00.000Z",
  returnFeedback: "Bổ sung ví dụ",
  returnedAt: "2030-08-19T08:00:00.000Z",
  revision: 7,
  score: null,
  status: "RETURNED",
  submissionMode: "TEXT",
  submittedAttachmentIds: [],
  submittedAt: "2030-08-18T08:00:00.000Z",
  submittedContent: "Bài làm lần một",
  wasLate: false,
};
const myResult: MyResult = {
  attemptCount: 2,
  result: {
    feedback: "Tốt",
    gradedAt: "2030-08-21T08:00:00.000Z",
    maxPoints: 100,
    percentage: 85,
    score: 85,
  },
  returnFeedback: null,
  state: "GRADED",
  submissionMode: "TEXT",
  submittedAttachmentIds: [],
  submissionId: "submission-1",
  submittedAt: "2030-08-20T10:00:00.000Z",
  wasLate: false,
};
const gradingDetail: GradingSubmissionDetail = {
  _id: "submission-1",
  assignment: { _id: "assignment-1", title: "Bài tập Một" },
  attemptCount: 2,
  course: { _id: "course-1", title: "Khóa học Một" },
  gradedAt: "2030-08-21T08:00:00.000Z",
  gradingFeedback: "Lập luận tốt",
  history: [
    {
      action: "SUBMIT",
      actorId: "learner-1",
      at: "2030-08-20T10:00:00.000Z",
      revision: 6,
    },
    {
      action: "GRADE",
      actorId: "teacher-1",
      at: "2030-08-21T08:00:00.000Z",
      revision: 7,
      score: 85,
    },
  ],
  learner: {
    _id: "learner-1",
    email: "learner@example.test",
    fullName: "Learner One",
  },
  maxPoints: 100,
  revision: 7,
  returnFeedback: null,
  score: 85,
  status: "GRADED",
  submissionMode: "TEXT",
  submittedAttachmentIds: [],
  submittedAt: "2030-08-20T10:00:00.000Z",
  submittedContent: "Nội dung bài làm",
  wasLate: false,
};
const gradingRow: GradingSubmissionRow = {
  _id: gradingDetail._id,
  assignment: gradingDetail.assignment,
  attemptCount: gradingDetail.attemptCount,
  course: gradingDetail.course,
  learner: gradingDetail.learner,
  maxPoints: gradingDetail.maxPoints,
  revision: gradingDetail.revision,
  score: gradingDetail.score,
  status: gradingDetail.status,
  submissionMode: gradingDetail.submissionMode,
  submittedAttachmentIds: gradingDetail.submittedAttachmentIds,
  submittedAt: gradingDetail.submittedAt,
  wasLate: gradingDetail.wasLate,
};
const courseReport: CourseReport = {
  activeLearners: 10,
  completionPercent: 76.67,
  counts: { draft: 2, graded: 12, notStarted: 5, returned: 1, submitted: 10 },
  course: { _id: "course-1", status: "PUBLISHED", title: "Khóa học Một" },
  expectedSubmissions: 30,
  generatedAt: "2030-08-22T10:00:00.000Z",
  gradedAveragePercent: 84.5,
  lateSubmissions: 3,
  publishedAssignments: 3,
  scope: "CURRENT_ACTIVE_ROSTER",
};

describe("submissionApi contract", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockResolvedValue(null);
  });

  it("build query theo thứ tự ổn định, trim và bỏ blank/undefined/non-finite", () => {
    expect(
      buildSubmissionQuery({
        blank: "   ",
        courseId: "  course-1 ",
        ignored: undefined,
        invalid: Number.NaN,
        page: 2,
        search: " Nguyễn Văn ",
      }),
    ).toBe("?courseId=course-1&page=2&search=Nguy%E1%BB%85n+V%C4%83n");
    expect(buildSubmissionQuery({ search: "Lan", page: 1 })).toBe(
      buildSubmissionQuery({ page: 1, search: " Lan " }),
    );
    expect(buildSubmissionQuery({ search: " " })).toBe("");
  });

  it("đọc/lưu/nộp bài và kết quả theo đúng assignment routes cùng revision", async () => {
    const controller = new AbortController();
    mocks.apiFetch
      .mockResolvedValueOnce(learnerSubmission)
      .mockResolvedValueOnce(learnerSubmission)
      .mockResolvedValueOnce(learnerSubmission)
      .mockResolvedValueOnce(myResult);

    await expect(
      submissionApi.getMySubmission(context, "assignment-1", controller.signal),
    ).resolves.toEqual(learnerSubmission);
    await submissionApi.saveMySubmission(context, "assignment-1", {
      content: "  Nội dung giữ nguyên  ",
      expectedRevision: 6,
    });
    await submissionApi.submitMySubmission(context, "assignment-1", {
      expectedRevision: 7,
    });
    await expect(
      submissionApi.getMyResult(context, "assignment-1", controller.signal),
    ).resolves.toEqual(myResult);

    expect(mocks.apiFetch.mock.calls).toEqual([
      [
        "/assignments/assignment-1/my-submission",
        { ...secureOptions, signal: controller.signal },
      ],
      [
        "/assignments/assignment-1/my-submission",
        {
          body: JSON.stringify({
            content: "  Nội dung giữ nguyên  ",
            expectedRevision: 6,
          }),
          ...secureOptions,
          method: "PUT",
        },
      ],
      [
        "/assignments/assignment-1/my-submission/submit",
        {
          body: JSON.stringify({ expectedRevision: 7 }),
          ...secureOptions,
          method: "POST",
        },
      ],
      [
        "/assignments/assignment-1/my-result",
        { ...secureOptions, signal: controller.signal },
      ],
    ]);
  });

  it("FILES draft chỉ gửi attachmentIds theo đúng thứ tự, không gửi content", async () => {
    mocks.apiFetch.mockResolvedValue({
      ...learnerSubmission,
      attemptCount: 0,
      draftAttachmentIds: [
        "64b000000000000000000012",
        "64b000000000000000000011",
      ],
      draftContent: null,
      firstSubmittedAt: null,
      gradedAt: null,
      gradingFeedback: null,
      returnFeedback: null,
      returnedAt: null,
      score: null,
      status: "DRAFT",
      submissionMode: "FILES",
      submittedAttachmentIds: [],
      submittedAt: null,
      submittedContent: null,
      wasLate: false,
    } satisfies LearnerSubmission);

    await submissionApi.saveMySubmission(context, "assignment/files", {
      attachmentIds: ["64b000000000000000000012", "64b000000000000000000011"],
      expectedRevision: 9,
    });

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/assignments/assignment%2Ffiles/my-submission",
      {
        body: JSON.stringify({
          attachmentIds: [
            "64b000000000000000000012",
            "64b000000000000000000011",
          ],
          expectedRevision: 9,
        }),
        ...secureOptions,
        method: "PUT",
      },
    );
    expect(JSON.parse(mocks.apiFetch.mock.calls[0][1].body)).not.toHaveProperty(
      "content",
    );
  });

  it("list grading dùng query deterministic và detail route riêng", async () => {
    const controller = new AbortController();
    const page: Paginated<GradingSubmissionRow> = {
      items: [gradingRow],
      limit: 20,
      page: 2,
      total: 21,
    };
    mocks.apiFetch
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce(gradingDetail);

    await expect(
      submissionApi.listGradingSubmissions(
        context,
        {
          assignmentId: " ",
          courseId: " course-1 ",
          limit: 20,
          page: 2,
          search: " learner ",
          sort: "NEWEST",
          status: "SUBMITTED",
        },
        controller.signal,
      ),
    ).resolves.toEqual(page);
    await expect(
      submissionApi.getGradingSubmission(
        context,
        "submission-1",
        controller.signal,
      ),
    ).resolves.toEqual(gradingDetail);

    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      1,
      "/grading/submissions?courseId=course-1&limit=20&page=2&search=learner&sort=NEWEST&status=SUBMITTED",
      { ...secureOptions, signal: controller.signal },
    );
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      2,
      "/grading/submissions/submission-1",
      { ...secureOptions, signal: controller.signal },
    );
  });

  it("grading list mặc định sort OLDEST", async () => {
    mocks.apiFetch.mockResolvedValue({
      items: [],
      limit: 20,
      page: 1,
      total: 0,
    } satisfies Paginated<GradingSubmissionRow>);

    await submissionApi.listGradingSubmissions(context);
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/grading/submissions?sort=OLDEST",
      secureOptions,
    );
  });

  it("return/grade luôn gửi expectedRevision cùng feedback và score", async () => {
    mocks.apiFetch.mockResolvedValue(gradingDetail);

    await submissionApi.returnGradingSubmission(context, "submission-1", {
      expectedRevision: 7,
      feedback: "Bổ sung nguồn",
    });
    await submissionApi.gradeSubmission(context, "submission-1", {
      expectedRevision: 8,
      feedback: "Đạt yêu cầu",
      score: 85,
    });

    expect(mocks.apiFetch.mock.calls).toEqual([
      [
        "/grading/submissions/submission-1/return",
        {
          body: JSON.stringify({
            expectedRevision: 7,
            feedback: "Bổ sung nguồn",
          }),
          ...secureOptions,
          method: "POST",
        },
      ],
      [
        "/grading/submissions/submission-1/grade",
        {
          body: JSON.stringify({
            expectedRevision: 8,
            feedback: "Đạt yêu cầu",
            score: 85,
          }),
          ...secureOptions,
          method: "POST",
        },
      ],
    ]);
  });

  it("đọc report đúng course route không tự thêm query", async () => {
    const controller = new AbortController();
    mocks.apiFetch.mockResolvedValue(courseReport);

    await expect(
      submissionApi.getCourseReport(context, "course-1", controller.signal),
    ).resolves.toEqual(courseReport);
    expect(mocks.apiFetch).toHaveBeenCalledWith("/courses/course-1/report", {
      ...secureOptions,
      signal: controller.signal,
    });
  });

  it("canonicalize grading detail và không đưa draft-only field vào manager cache", async () => {
    mocks.apiFetch.mockResolvedValue({
      ...gradingDetail,
      draftAttachmentIds: ["64b000000000000000000099"],
      draftContent: "DRAFT_ONLY_SECRET",
    });

    const result = await submissionApi.getGradingSubmission(
      context,
      "submission-1",
    );

    expect(result).toEqual(gradingDetail);
    expect(result).not.toHaveProperty("draftAttachmentIds");
    expect(result).not.toHaveProperty("draftContent");
  });

  it("fail closed với attachment response sai invariant mà không phản chiếu secret", async () => {
    mocks.apiFetch.mockResolvedValue({
      ...gradingDetail,
      draftContent: "DRAFT_ONLY_SECRET",
      submissionMode: "FILES",
      submittedAttachmentIds: [
        "64b000000000000000000011",
        "64b000000000000000000011",
      ],
      submittedContent: null,
    });

    let caught: unknown;
    try {
      await submissionApi.getGradingSubmission(context, "submission-1");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({
      code: "SUBMISSION_RESPONSE_INVALID",
      status: 502,
    });
    expect(`${String(caught)} ${JSON.stringify(caught)}`).not.toContain(
      "DRAFT_ONLY_SECRET",
    );
  });
});
