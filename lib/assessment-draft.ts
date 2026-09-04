import {
  createAssessmentMutationId,
  type AssessmentDraft,
  type AssessmentQuestionDraft,
} from "@/lib/assessment-api";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const byteLength = (value: string) => new TextEncoder().encode(value).length;

export function createAssessmentQuestion(): AssessmentQuestionDraft {
  const firstChoiceId = createAssessmentMutationId();
  return {
    choices: [
      { id: firstChoiceId, text: "" },
      { id: createAssessmentMutationId(), text: "" },
    ],
    correctChoiceIds: [firstChoiceId],
    id: createAssessmentMutationId(),
    points: 1,
    prompt: "",
    type: "SINGLE_CHOICE",
  };
}

export function createAssessmentDraft(): AssessmentDraft {
  return {
    closesAt: null,
    instructions: "",
    maxAttempts: 1,
    opensAt: null,
    passPercent: 70,
    questions: [createAssessmentQuestion()],
    resultVisibility: "AFTER_ATTEMPTS_EXHAUSTED",
    timeLimitSeconds: null,
    title: "",
  };
}

export function cloneAssessmentDraft(draft: AssessmentDraft): AssessmentDraft {
  return {
    ...draft,
    questions: draft.questions.map((question) => ({
      ...question,
      choices: question.choices.map((choice) => ({ ...choice })),
      correctChoiceIds: [...question.correctChoiceIds],
    })),
  };
}

export function canonicalizeAssessmentDraft(draft: AssessmentDraft): AssessmentDraft {
  return {
    ...cloneAssessmentDraft(draft),
    instructions: draft.instructions.trim(),
    questions: draft.questions.map((question) => ({
      ...question,
      choices: question.choices.map((choice) => ({
        id: choice.id.toLowerCase(),
        text: choice.text.trim(),
      })),
      correctChoiceIds: question.correctChoiceIds.map((id) => id.toLowerCase()).sort(),
      id: question.id.toLowerCase(),
      prompt: question.prompt.trim(),
    })),
    title: draft.title.trim(),
  };
}

export function assessmentDraftsEqual(left: AssessmentDraft, right: AssessmentDraft): boolean {
  return JSON.stringify(canonicalizeAssessmentDraft(left))
    === JSON.stringify(canonicalizeAssessmentDraft(right));
}

export function validateAssessmentDraft(draft: AssessmentDraft): string[] {
  const issues: string[] = [];
  const title = draft.title.trim();
  if (title.length < 2 || title.length > 200 || byteLength(title) > 512) {
    issues.push("Tên bài kiểm tra phải có từ 2 đến 200 ký tự.");
  }
  const instructions = draft.instructions.trim();
  if (instructions.length > 20_000 || byteLength(instructions) > 51_200) {
    issues.push("Hướng dẫn vượt quá giới hạn 20.000 ký tự.");
  }
  const opensAt = draft.opensAt ? new Date(draft.opensAt) : null;
  const closesAt = draft.closesAt ? new Date(draft.closesAt) : null;
  if (draft.opensAt && !Number.isFinite(opensAt?.getTime())) {
    issues.push("Thời điểm mở không hợp lệ.");
  }
  if (draft.closesAt && !Number.isFinite(closesAt?.getTime())) {
    issues.push("Thời điểm đóng không hợp lệ.");
  }
  if (opensAt && closesAt && opensAt.getTime() >= closesAt.getTime()) {
    issues.push("Thời điểm mở phải trước thời điểm đóng.");
  }
  if (draft.timeLimitSeconds !== null && (
    !Number.isSafeInteger(draft.timeLimitSeconds)
    || draft.timeLimitSeconds < 60
    || draft.timeLimitSeconds > 10_800
  )) {
    issues.push("Thời lượng phải từ 1 đến 180 phút.");
  }
  if (!Number.isSafeInteger(draft.maxAttempts) || draft.maxAttempts < 1 || draft.maxAttempts > 5) {
    issues.push("Số lượt làm phải từ 1 đến 5.");
  }
  if (!Number.isSafeInteger(draft.passPercent) || draft.passPercent < 0 || draft.passPercent > 100) {
    issues.push("Điểm đạt phải là số nguyên từ 0 đến 100%.");
  }
  if (draft.resultVisibility === "AFTER_CLOSE" && !draft.closesAt) {
    issues.push("Chính sách công bố sau khi đóng yêu cầu thời điểm đóng.");
  }
  if (draft.questions.length < 1 || draft.questions.length > 50) {
    issues.push("Bài kiểm tra phải có từ 1 đến 50 câu hỏi.");
  }

  const questionIds = new Set<string>();
  const allChoiceIds = new Set<string>();
  let totalPoints = 0;
  draft.questions.forEach((question, questionIndex) => {
    const number = questionIndex + 1;
    const questionId = question.id.toLowerCase();
    if (!UUID_PATTERN.test(question.id) || questionIds.has(questionId)) {
      issues.push(`Câu ${number} có mã không hợp lệ hoặc bị trùng.`);
    }
    questionIds.add(questionId);
    const prompt = question.prompt.trim();
    if (!prompt || prompt.length > 10_000 || byteLength(prompt) > 25_600) {
      issues.push(`Nội dung câu ${number} đang trống hoặc vượt giới hạn.`);
    }
    if (!Number.isSafeInteger(question.points) || question.points < 1 || question.points > 10_000) {
      issues.push(`Điểm của câu ${number} phải là số nguyên dương.`);
    } else {
      totalPoints += question.points;
    }
    if (question.choices.length < 2 || question.choices.length > 8) {
      issues.push(`Câu ${number} phải có từ 2 đến 8 lựa chọn.`);
    }
    const localChoiceIds = new Set<string>();
    question.choices.forEach((choice, choiceIndex) => {
      const id = choice.id.toLowerCase();
      const text = choice.text.trim();
      if (!UUID_PATTERN.test(choice.id) || allChoiceIds.has(id)) {
        issues.push(`Lựa chọn ${choiceIndex + 1} của câu ${number} có mã bị trùng.`);
      }
      allChoiceIds.add(id);
      localChoiceIds.add(id);
      if (!text || text.length > 2_000 || byteLength(text) > 5_120) {
        issues.push(`Lựa chọn ${choiceIndex + 1} của câu ${number} đang trống hoặc vượt giới hạn.`);
      }
    });
    const correctIds = question.correctChoiceIds.map((id) => id.toLowerCase());
    if (new Set(correctIds).size !== correctIds.length
      || correctIds.some((id) => !localChoiceIds.has(id))) {
      issues.push(`Đáp án đúng của câu ${number} không hợp lệ.`);
    } else if (question.type === "SINGLE_CHOICE" && correctIds.length !== 1) {
      issues.push(`Câu ${number} phải có đúng một đáp án đúng.`);
    } else if (question.type === "MULTIPLE_CHOICE"
      && (correctIds.length < 2 || correctIds.length >= question.choices.length)) {
      issues.push(`Câu ${number} phải có ít nhất hai đáp án đúng và một đáp án sai.`);
    }
  });
  if (totalPoints > 10_000) issues.push("Tổng điểm không được vượt quá 10.000.");
  return issues;
}
