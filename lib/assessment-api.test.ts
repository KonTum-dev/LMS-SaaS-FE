import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assessmentApi,
  buildAssessmentQuery,
  createAssessmentMutationId,
  type AssessmentAttempt,
  type AssessmentDraft,
} from "./assessment-api";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));

const context = { token: "tenant-token" };
const draft: AssessmentDraft = {
  closesAt: null,
  instructions: "Làm tất cả câu hỏi.",
  maxAttempts: 2,
  opensAt: null,
  passPercent: 70,
  questions: [{
    choices: [
      { id: "22222222-2222-4222-8222-222222222222", text: "Đúng" },
      { id: "33333333-3333-4333-8333-333333333333", text: "Sai" },
    ],
    correctChoiceIds: ["22222222-2222-4222-8222-222222222222"],
    id: "11111111-1111-4111-8111-111111111111",
    points: 1,
    prompt: "Câu hỏi đầu tiên",
    type: "SINGLE_CHOICE",
  }],
  resultVisibility: "AFTER_ATTEMPTS_EXHAUSTED",
  timeLimitSeconds: null,
  title: "Bài kiểm tra nhập môn",
};

describe("assessmentApi contract", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockResolvedValue(null);
  });

  it("canonicalize query, trim chuỗi và bỏ blank/undefined/non-finite", () => {
    expect(buildAssessmentQuery({
      blank: " ",
      courseId: " course-1 ",
      ignored: undefined,
      invalid: Number.NaN,
      page: 2,
      status: " PUBLISHED ",
    })).toBe("?courseId=course-1&page=2&status=PUBLISHED");
    expect(buildAssessmentQuery({ status: "PUBLISHED", page: 1 })).toBe(
      buildAssessmentQuery({ page: 1, status: " PUBLISHED " }),
    );
  });

  it("tạo clientMutationId UUID v4 cho publish/start idempotent", () => {
    const ids = Array.from({ length: 10 }, createAssessmentMutationId);
    ids.forEach((id) => expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    ));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("manager và learner list dùng cùng route nhưng giữ response type riêng", async () => {
    await assessmentApi.listForManager(context, { limit: 20, page: 2, status: "DRAFT" });
    await assessmentApi.listForLearner(context, { courseId: "course-1", page: 1 });

    expect(mocks.apiFetch.mock.calls).toEqual([
      ["/assessments?limit=20&page=2&status=DRAFT", { token: "tenant-token" }],
      ["/assessments?courseId=course-1&page=1", { token: "tenant-token" }],
    ]);
  });

  it("create/update/publish/archive gửi exact aggregate và revision contract", async () => {
    await assessmentApi.create(context, { ...draft, courseId: "course-1" });
    await assessmentApi.updateDraft(context, "assessment/one", { ...draft, expectedRevision: 2 });
    await assessmentApi.publish(context, "assessment/one", {
      clientMutationId: "44444444-4444-4444-8444-444444444444",
      expectedRevision: 3,
    });
    await assessmentApi.archive(context, "assessment/one", { expectedRevision: 4 });

    expect(mocks.apiFetch.mock.calls).toEqual([
      ["/assessments", {
        body: JSON.stringify({ ...draft, courseId: "course-1" }),
        method: "POST",
        token: "tenant-token",
      }],
      ["/assessments/assessment%2Fone/draft", {
        body: JSON.stringify({ ...draft, expectedRevision: 2 }),
        method: "PUT",
        token: "tenant-token",
      }],
      ["/assessments/assessment%2Fone/publish", {
        body: JSON.stringify({
          clientMutationId: "44444444-4444-4444-8444-444444444444",
          expectedRevision: 3,
        }),
        method: "POST",
        token: "tenant-token",
      }],
      ["/assessments/assessment%2Fone/archive", {
        body: JSON.stringify({ expectedRevision: 4 }),
        method: "POST",
        token: "tenant-token",
      }],
    ]);
  });

  it("đọc authoring và learner detail bằng các endpoint không dùng chung", async () => {
    await assessmentApi.getAuthoring(context, "assessment/one");
    await assessmentApi.getLearnerDetail(context, "assessment/one");

    expect(mocks.apiFetch.mock.calls).toEqual([
      ["/assessments/assessment%2Fone/authoring", { token: "tenant-token" }],
      ["/assessments/assessment%2Fone", { token: "tenant-token" }],
    ]);
  });

  it("start/save/submit/result theo đúng attempt routes và CAS body", async () => {
    await assessmentApi.startAttempt(context, "assessment/one", {
      clientMutationId: "44444444-4444-4444-8444-444444444444",
    });
    await assessmentApi.getAttempt(context, "attempt/one");
    await assessmentApi.saveAnswer(context, "attempt/one", "question/one", {
      expectedRevision: 5,
      selectedChoiceIds: ["22222222-2222-4222-8222-222222222222"],
    });
    await assessmentApi.submitAttempt(context, "attempt/one", { expectedRevision: 6 });
    await assessmentApi.getResult(context, "attempt/one");

    expect(mocks.apiFetch.mock.calls).toEqual([
      ["/assessments/assessment%2Fone/attempts/start", {
        body: JSON.stringify({ clientMutationId: "44444444-4444-4444-8444-444444444444" }),
        method: "POST",
        token: "tenant-token",
      }],
      ["/assessment-attempts/attempt%2Fone", { token: "tenant-token" }],
      ["/assessment-attempts/attempt%2Fone/answers/question%2Fone", {
        body: JSON.stringify({
          expectedRevision: 5,
          selectedChoiceIds: ["22222222-2222-4222-8222-222222222222"],
        }),
        method: "PUT",
        token: "tenant-token",
      }],
      ["/assessment-attempts/attempt%2Fone/submit", {
        body: JSON.stringify({ expectedRevision: 6 }),
        method: "POST",
        token: "tenant-token",
      }],
      ["/assessment-attempts/attempt%2Fone/result", { token: "tenant-token" }],
    ]);
  });

  it("manager report gửi đúng bounded filters", async () => {
    await assessmentApi.listManagerAttempts(context, {
      assessmentId: "assessment-1",
      limit: 25,
      page: 3,
      search: " Nguyễn Lan ",
      status: "SUBMITTED",
    });
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/assessment-attempts?assessmentId=assessment-1&limit=25&page=3&search=Nguy%E1%BB%85n+Lan&status=SUBMITTED",
      { token: "tenant-token" },
    );
  });

  it("learner attempt type không cung cấp private correctness payload", () => {
    const attempt = {} as AssessmentAttempt;
    // @ts-expect-error Learner contract intentionally excludes any private key payload.
    expect(attempt.answerKey).toBeUndefined();
  });
});
