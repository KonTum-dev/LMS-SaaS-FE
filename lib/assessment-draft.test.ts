import { describe, expect, it } from "vitest";
import {
  assessmentDraftsEqual,
  canonicalizeAssessmentDraft,
  createAssessmentDraft,
  validateAssessmentDraft,
} from "./assessment-draft";

function validDraft() {
  const draft = createAssessmentDraft();
  draft.title = "Bài kiểm tra";
  draft.questions[0].prompt = "Câu hỏi đầu tiên";
  draft.questions[0].choices[0].text = "Đúng";
  draft.questions[0].choices[1].text = "Sai";
  return draft;
}

describe("assessment draft client contract", () => {
  it("tạo draft có UUID hợp lệ và trở nên valid khi nhập text bắt buộc", () => {
    const draft = validDraft();
    expect(validateAssessmentDraft(draft)).toEqual([]);
    expect(draft.questions[0].id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(draft.questions[0].correctChoiceIds).toEqual([draft.questions[0].choices[0].id]);
  });

  it("canonicalize trim text, lower UUID và sort tập đáp án", () => {
    const draft = validDraft();
    draft.title = "  Bài kiểm tra  ";
    draft.questions[0].correctChoiceIds = [draft.questions[0].choices[0].id.toUpperCase()];
    const canonical = canonicalizeAssessmentDraft(draft);
    expect(canonical.title).toBe("Bài kiểm tra");
    expect(canonical.questions[0].correctChoiceIds[0]).toBe(
      draft.questions[0].choices[0].id.toLowerCase(),
    );
  });

  it("exact/no-op comparison bỏ qua whitespace và thứ tự answer id", () => {
    const first = validDraft();
    const second = structuredClone(first);
    second.title = ` ${second.title} `;
    expect(assessmentDraftsEqual(first, second)).toBe(true);
  });

  it("bắt cross-field close policy và semantics multiple choice", () => {
    const draft = validDraft();
    draft.resultVisibility = "AFTER_CLOSE";
    draft.questions[0].type = "MULTIPLE_CHOICE";
    expect(validateAssessmentDraft(draft)).toEqual(expect.arrayContaining([
      expect.stringContaining("thời điểm đóng"),
      expect.stringContaining("ít nhất hai đáp án đúng"),
    ]));
  });

  it("bắt time/order/aggregate bounds trước khi gọi backend", () => {
    const draft = validDraft();
    draft.opensAt = "2030-08-21T10:00:00.000Z";
    draft.closesAt = "2030-08-20T10:00:00.000Z";
    draft.timeLimitSeconds = 59;
    draft.maxAttempts = 6;
    draft.passPercent = 101;
    expect(validateAssessmentDraft(draft)).toHaveLength(4);
  });
});
