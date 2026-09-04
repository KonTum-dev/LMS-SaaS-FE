import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import {
  parseCourseReport,
  parseGradingSubmissionDetail,
  parseGradingSubmissionRow,
  parseLearnerSubmission,
  parseMyResult,
} from "./submission-response";
import type {
  CourseReport,
  GradingSubmissionDetail,
  LearnerSubmission,
  MyResult,
} from "./types";

const submittedAt = "2030-08-20T10:00:00.000Z";
const gradedAt = "2030-08-21T08:00:00.000Z";
const attachmentId = "64b000000000000000000011";

const learnerReturned: LearnerSubmission = {
  _id: "submission-1",
  assignmentId: "assignment-1",
  attemptCount: 2,
  draftAttachmentIds: [],
  draftContent: "Bản sửa",
  draftUpdatedAt: "2030-08-21T09:00:00.000Z",
  dueAt: "2030-08-30T08:00:00.000Z",
  firstSubmittedAt: "2030-08-18T08:00:00.000Z",
  gradedAt: null,
  gradingFeedback: null,
  maxPoints: 100,
  returnFeedback: "Bổ sung ví dụ",
  returnedAt: "2030-08-20T12:00:00.000Z",
  revision: 7,
  score: null,
  status: "RETURNED",
  submissionMode: "TEXT",
  submittedAttachmentIds: [],
  submittedAt,
  submittedContent: "Bài làm lần hai",
  wasLate: false,
};

const myGradedResult: MyResult = {
  attemptCount: 2,
  result: {
    feedback: "Tốt",
    gradedAt,
    maxPoints: 100,
    percentage: 85,
    score: 85,
  },
  returnFeedback: null,
  state: "GRADED",
  submissionId: "submission-1",
  submissionMode: "TEXT",
  submittedAttachmentIds: [],
  submittedAt,
  wasLate: false,
};

const gradingDetail: GradingSubmissionDetail = {
  _id: "submission-1",
  assignment: { _id: "assignment-1", title: "Bài tập Một" },
  attemptCount: 2,
  course: { _id: "course-1", title: "Khóa học Một" },
  gradedAt,
  gradingFeedback: "Lập luận tốt",
  history: [
    {
      action: "SUBMIT",
      actorId: "learner-1",
      at: submittedAt,
      revision: 6,
    },
    {
      action: "GRADE",
      actorId: "teacher-1",
      at: gradedAt,
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
  submittedAt,
  submittedContent: "Nội dung bài làm",
  wasLate: false,
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

function expectInvalid(parser: (value: unknown) => unknown, value: unknown) {
  let caught: unknown;
  try {
    parser(value);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ApiError);
  expect(caught).toMatchObject({
    code: "SUBMISSION_RESPONSE_INVALID",
    status: 502,
  });
}

describe("submission response lifecycle invariants", () => {
  it("accepts canonical learner and result lifecycle responses", () => {
    expect(parseLearnerSubmission(learnerReturned)).toEqual(learnerReturned);
    expect(parseMyResult(myGradedResult)).toEqual(myGradedResult);
  });

  it.each([
    [
      "DRAFT carrying a submitted snapshot",
      { ...learnerReturned, status: "DRAFT" },
    ],
    [
      "SUBMITTED carrying a score",
      {
        ...learnerReturned,
        returnFeedback: null,
        returnedAt: null,
        score: 1,
        status: "SUBMITTED",
      },
    ],
    ["RETURNED missing feedback", { ...learnerReturned, returnFeedback: null }],
    [
      "GRADED missing its grade timestamp",
      {
        ...learnerReturned,
        gradedAt: null,
        gradingFeedback: "Đạt",
        returnFeedback: null,
        returnedAt: null,
        score: 85,
        status: "GRADED",
      },
    ],
    [
      "post-submit state missing firstSubmittedAt",
      { ...learnerReturned, firstSubmittedAt: null },
    ],
    [
      "post-submit TEXT snapshot missing content",
      { ...learnerReturned, submittedContent: null },
    ],
    [
      "FILES snapshot missing attachments",
      {
        ...learnerReturned,
        draftAttachmentIds: [attachmentId],
        draftContent: null,
        submissionMode: "FILES",
        submittedAttachmentIds: [],
        submittedContent: null,
      },
    ],
    [
      "late flag disagreeing with the due snapshot",
      { ...learnerReturned, wasLate: true },
    ],
  ])("rejects %s", (_label, response) => {
    expectInvalid(parseLearnerSubmission, response);
  });

  it.each([
    [
      "NOT_STARTED carrying an identity",
      {
        attemptCount: 0,
        result: null,
        returnFeedback: null,
        state: "NOT_STARTED",
        submissionId: "submission-1",
        submissionMode: "TEXT",
        submittedAttachmentIds: [],
        submittedAt: null,
        wasLate: false,
      },
    ],
    [
      "RETURNED without return feedback",
      {
        ...myGradedResult,
        result: null,
        returnFeedback: null,
        state: "RETURNED",
      },
    ],
    [
      "GRADED with a non-derived percentage",
      {
        ...myGradedResult,
        result: { ...myGradedResult.result, percentage: 84.99 },
      },
    ],
    [
      "GRADED without normalized grading feedback",
      {
        ...myGradedResult,
        result: { ...myGradedResult.result, feedback: "  " },
      },
    ],
    [
      "submitted FILES result without its immutable attachments",
      {
        ...myGradedResult,
        submissionMode: "FILES",
        submittedAttachmentIds: [],
      },
    ],
  ])("rejects %s", (_label, response) => {
    expectInvalid(parseMyResult, response);
  });
});

describe("grading response history invariants", () => {
  it("accepts a returned detail after revision-only draft edits", () => {
    const returned: GradingSubmissionDetail = {
      ...gradingDetail,
      gradedAt: null,
      gradingFeedback: null,
      history: [
        gradingDetail.history[0],
        {
          action: "RETURN",
          actorId: "teacher-1",
          at: "2030-08-20T12:00:00.000Z",
          revision: 7,
        },
      ],
      returnFeedback: "Bổ sung ví dụ",
      revision: 9,
      score: null,
      status: "RETURNED",
    };
    expect(parseGradingSubmissionDetail(returned)).toEqual(returned);
  });

  it("accepts legacy duplicate report counts and truncated history", () => {
    const history = Array.from({ length: 100 }, (_, index) => ({
      action: "GRADE" as const,
      actorId: "teacher-1",
      at:
        index === 99
          ? gradedAt
          : `2030-08-21T07:${String(index % 60).padStart(2, "0")}:00.000Z`,
      revision: index + 1,
      score: 85,
    }));
    const truncated = {
      ...gradingDetail,
      history,
      revision: 100,
    };
    expect(parseGradingSubmissionDetail(truncated)).toEqual(truncated);
  });

  it.each([
    [
      "score on a non-GRADE action",
      {
        ...gradingDetail,
        history: [
          { ...gradingDetail.history[0], score: 85 },
          gradingDetail.history[1],
        ],
      },
    ],
    [
      "GRADE action without score",
      {
        ...gradingDetail,
        history: [
          gradingDetail.history[0],
          { ...gradingDetail.history[1], score: undefined },
        ],
      },
    ],
    [
      "non-increasing history revisions",
      {
        ...gradingDetail,
        history: [
          gradingDetail.history[0],
          { ...gradingDetail.history[1], revision: 6 },
        ],
      },
    ],
    [
      "history revision beyond the response revision",
      {
        ...gradingDetail,
        history: [
          gradingDetail.history[0],
          { ...gradingDetail.history[1], revision: 8 },
        ],
      },
    ],
    [
      "terminal action disagreeing with status",
      {
        ...gradingDetail,
        history: [gradingDetail.history[0]],
      },
    ],
    [
      "terminal grade score disagreeing with current score",
      {
        ...gradingDetail,
        history: [
          gradingDetail.history[0],
          { ...gradingDetail.history[1], score: 84 },
        ],
      },
    ],
    [
      "more than the persisted 100 history entries",
      {
        ...gradingDetail,
        history: Array.from({ length: 101 }, () => gradingDetail.history[1]),
      },
    ],
  ])("rejects %s", (_label, response) => {
    expectInvalid(parseGradingSubmissionDetail, response);
  });

  it.each([
    ["GRADED row without score", { ...gradingDetail, score: null }],
    [
      "SUBMITTED row retaining score",
      { ...gradingDetail, status: "SUBMITTED" },
    ],
  ])("rejects %s", (_label, response) => {
    expectInvalid(parseGradingSubmissionRow, response);
  });
});

describe("course report arithmetic invariants", () => {
  it("accepts the exact report formula", () => {
    expect(parseCourseReport(courseReport)).toEqual(courseReport);
  });

  it("preserves BE legacy duplicate and malformed-grade recovery", () => {
    const duplicateReport: CourseReport = {
      ...courseReport,
      activeLearners: 1,
      completionPercent: 100,
      counts: {
        draft: 2,
        graded: 2,
        notStarted: 0,
        returned: 0,
        submitted: 0,
      },
      expectedSubmissions: 1,
      gradedAveragePercent: null,
      lateSubmissions: 1,
      publishedAssignments: 1,
    };
    expect(parseCourseReport(duplicateReport)).toEqual(duplicateReport);

    const concurrentZeroDenominator = {
      ...duplicateReport,
      activeLearners: 0,
      completionPercent: null,
      expectedSubmissions: 0,
    };
    expect(parseCourseReport(concurrentZeroDenominator)).toEqual(
      concurrentZeroDenominator,
    );
  });

  it.each([
    [
      "expectedSubmissions not equal to the roster product",
      { ...courseReport, expectedSubmissions: 31 },
    ],
    [
      "notStarted not equal to the clamped expected gap",
      { ...courseReport, counts: { ...courseReport.counts, notStarted: 4 } },
    ],
    [
      "completion not derived from completed counts",
      { ...courseReport, completionPercent: 75 },
    ],
    [
      "null completion with a non-zero denominator",
      { ...courseReport, completionPercent: null },
    ],
    [
      "late submissions exceeding completed submissions",
      { ...courseReport, lateSubmissions: 24 },
    ],
    [
      "graded average with more than two decimal places",
      { ...courseReport, gradedAveragePercent: 84.567 },
    ],
    [
      "graded average when no graded rows exist",
      {
        ...courseReport,
        activeLearners: 1,
        completionPercent: 100,
        counts: {
          draft: 0,
          graded: 0,
          notStarted: 0,
          returned: 0,
          submitted: 1,
        },
        expectedSubmissions: 1,
        gradedAveragePercent: 50,
        lateSubmissions: 0,
        publishedAssignments: 1,
      },
    ],
  ])("rejects %s", (_label, response) => {
    expectInvalid(parseCourseReport, response);
  });
});
