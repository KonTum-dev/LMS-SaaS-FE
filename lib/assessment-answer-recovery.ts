import type { AssessmentPublicQuestion } from "@/lib/assessment-api";
import type { ViewerScope } from "@/lib/query-keys";

const RECOVERY_VERSION = 1;
const MAX_RECOVERY_AGE_MS = 24 * 60 * 60 * 1_000;

interface StoredAnswerRecovery {
  answers: Record<string, string[]>;
  storageKey: string;
  updatedAt: number;
  version: number;
}

export type AssessmentRecoveredAnswers = ReadonlyMap<string, readonly string[]>;

export function assessmentAnswerRecoveryKey(
  scope: ViewerScope,
  attemptId: string,
): string {
  return [
    "dx-lms-assessment-answers",
    scope.tenantId,
    scope.viewerId,
    scope.membershipId,
    scope.role,
    attemptId,
  ].map(encodeURIComponent).join(":");
}

export function clearAssessmentAnswerRecovery(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Storage can be unavailable; the server-side CAS remains authoritative.
  }
}

export function writeAssessmentAnswerRecovery(
  key: string,
  answers: ReadonlyMap<string, readonly string[]>,
): void {
  if (answers.size === 0) {
    clearAssessmentAnswerRecovery(key);
    return;
  }
  const serializable = Object.fromEntries(
    [...answers.entries()].map(([questionId, selectedChoiceIds]) => [
      questionId,
      [...selectedChoiceIds],
    ]),
  );
  try {
    sessionStorage.setItem(key, JSON.stringify({
      answers: serializable,
      storageKey: key,
      updatedAt: Date.now(),
      version: RECOVERY_VERSION,
    } satisfies StoredAnswerRecovery));
  } catch {
    // Autosave still proceeds when browser storage is blocked or full.
  }
}

export function readAssessmentAnswerRecovery(
  key: string,
  questions: readonly AssessmentPublicQuestion[],
): AssessmentRecoveredAnswers {
  let rawParsed: unknown;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return new Map();
    rawParsed = JSON.parse(raw);
  } catch {
    clearAssessmentAnswerRecovery(key);
    return new Map();
  }
  if (typeof rawParsed !== "object" || rawParsed === null || Array.isArray(rawParsed)) {
    clearAssessmentAnswerRecovery(key);
    return new Map();
  }
  const parsed = rawParsed as Partial<StoredAnswerRecovery>;
  const schemaKeys = Object.keys(parsed).sort();
  if (
    schemaKeys.join(",") !== "answers,storageKey,updatedAt,version"
    || parsed.version !== RECOVERY_VERSION
    || parsed.storageKey !== key
    || typeof parsed.updatedAt !== "number"
    || !Number.isFinite(parsed.updatedAt)
    || parsed.updatedAt > Date.now() + 5 * 60 * 1_000
    || Date.now() - parsed.updatedAt > MAX_RECOVERY_AGE_MS
    || typeof parsed.answers !== "object"
    || parsed.answers === null
    || Array.isArray(parsed.answers)
  ) {
    clearAssessmentAnswerRecovery(key);
    return new Map();
  }

  const byId = new Map(questions.map((question) => [question.id, question]));
  const recovered = new Map<string, readonly string[]>();
  for (const [questionId, rawSelection] of Object.entries(parsed.answers)) {
    const question = byId.get(questionId);
    if (!question || !Array.isArray(rawSelection)) {
      clearAssessmentAnswerRecovery(key);
      return new Map();
    }
    const allowed = new Set(question.choices.map((choice) => choice.id));
    const selection = rawSelection.filter(
      (choiceId): choiceId is string => typeof choiceId === "string" && allowed.has(choiceId),
    );
    if (
      selection.length !== rawSelection.length
      || new Set(selection).size !== selection.length
      || (question.type === "SINGLE_CHOICE" && selection.length > 1)
    ) {
      clearAssessmentAnswerRecovery(key);
      return new Map();
    }
    recovered.set(questionId, selection);
  }
  if (recovered.size === 0) clearAssessmentAnswerRecovery(key);
  return recovered;
}
