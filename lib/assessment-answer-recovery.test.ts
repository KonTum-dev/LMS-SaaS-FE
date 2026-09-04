// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssessmentPublicQuestion } from "@/lib/assessment-api";
import {
  assessmentAnswerRecoveryKey,
  clearAssessmentAnswerRecovery,
  readAssessmentAnswerRecovery,
  writeAssessmentAnswerRecovery,
} from "@/lib/assessment-answer-recovery";
import type { ViewerScope } from "@/lib/query-keys";

const scope: ViewerScope = {
  membershipId: "membership-1",
  role: "LEARNER",
  tenantId: "tenant-1",
  viewerId: "learner-1",
};
const questions: AssessmentPublicQuestion[] = [{
  choices: [
    { id: "choice-a", text: "A" },
    { id: "choice-b", text: "B" },
  ],
  id: "question-1",
  points: 1,
  prompt: "Chọn một đáp án",
  type: "SINGLE_CHOICE",
}];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime("2030-08-20T08:00:00.000Z");
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
});

describe("assessment answer recovery", () => {
  it("stores only scoped choice IDs with a finite timestamp and TTL metadata", () => {
    const key = assessmentAnswerRecoveryKey(scope, "attempt-1");
    writeAssessmentAnswerRecovery(
      key,
      new Map([["question-1", ["choice-a"]]]),
    );

    const raw = sessionStorage.getItem(key);
    expect(raw).not.toBeNull();
    expect(raw).not.toContain("token");
    expect(raw).not.toContain("answerKey");
    expect(raw).not.toContain("result");
    expect(raw).not.toContain("score");
    expect(JSON.parse(raw!)).toEqual({
      answers: { "question-1": ["choice-a"] },
      storageKey: key,
      updatedAt: Date.now(),
      version: 1,
    });
  });

  it("fails closed for malformed, expired, future, or choice-invalid records", () => {
    const cases = [
      "{not-json",
      "null",
      JSON.stringify({ answers: { "question-1": ["choice-a"] }, updatedAt: Date.now(), version: 1 }),
      JSON.stringify({ answers: { "question-1": ["choice-a"] }, storageKey: "wrong", updatedAt: Date.now(), version: 1 }),
      JSON.stringify({ answers: { "question-1": ["choice-a"] }, storageKey: "KEY", updatedAt: Date.now() - 25 * 60 * 60 * 1_000, version: 1 }),
      JSON.stringify({ answers: { "question-1": ["choice-a"] }, storageKey: "KEY", updatedAt: Date.now() + 6 * 60 * 1_000, version: 1 }),
      JSON.stringify({ answers: { "question-1": ["choice-a", "choice-b"] }, storageKey: "KEY", updatedAt: Date.now(), version: 1 }),
      JSON.stringify({ answers: { "question-1": ["unknown"] }, storageKey: "KEY", updatedAt: Date.now(), version: 1 }),
      JSON.stringify({ answerKey: "secret", answers: { "question-1": ["choice-a"] }, storageKey: "KEY", updatedAt: Date.now(), version: 1 }),
    ];

    cases.forEach((raw, index) => {
      const key = index < 4 ? assessmentAnswerRecoveryKey(scope, `attempt-${index}`) : "KEY";
      sessionStorage.setItem(key, raw);
      expect(readAssessmentAnswerRecovery(key, questions).size).toBe(0);
      expect(sessionStorage.getItem(key)).toBeNull();
    });
  });

  it("rejects a valid record copied into another attempt or viewer scope", () => {
    const sourceKey = assessmentAnswerRecoveryKey(scope, "attempt-1");
    const otherAttemptKey = assessmentAnswerRecoveryKey(scope, "attempt-2");
    const otherViewerKey = assessmentAnswerRecoveryKey({
      ...scope,
      membershipId: "membership-2",
      viewerId: "learner-2",
    }, "attempt-1");
    writeAssessmentAnswerRecovery(
      sourceKey,
      new Map([["question-1", ["choice-a"]]]),
    );
    const raw = sessionStorage.getItem(sourceKey)!;
    sessionStorage.setItem(otherAttemptKey, raw);
    sessionStorage.setItem(otherViewerKey, raw);

    expect(readAssessmentAnswerRecovery(otherAttemptKey, questions).size).toBe(0);
    expect(readAssessmentAnswerRecovery(otherViewerKey, questions).size).toBe(0);
    expect([...readAssessmentAnswerRecovery(sourceKey, questions)]).toEqual([
      ["question-1", ["choice-a"]],
    ]);
  });

  it("clears recovery explicitly and when no dirty answers remain", () => {
    const key = assessmentAnswerRecoveryKey(scope, "attempt-1");
    writeAssessmentAnswerRecovery(key, new Map([["question-1", ["choice-a"]]]));
    clearAssessmentAnswerRecovery(key);
    expect(sessionStorage.getItem(key)).toBeNull();

    writeAssessmentAnswerRecovery(key, new Map());
    expect(sessionStorage.getItem(key)).toBeNull();
  });
});
