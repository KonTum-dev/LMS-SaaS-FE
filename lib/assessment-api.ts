import { apiFetch } from "@/lib/api";
import type { Paginated } from "@/lib/types";

export type AssessmentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type AssessmentAttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "TIMED_OUT";
export type AssessmentAvailability = "UPCOMING" | "OPEN" | "CLOSED";
export type AssessmentQuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
export type AssessmentResultVisibility =
  | "AFTER_SUBMIT"
  | "AFTER_ATTEMPTS_EXHAUSTED"
  | "AFTER_CLOSE";

export interface AssessmentChoiceDraft {
  id: string;
  text: string;
}

export interface AssessmentQuestionDraft {
  choices: AssessmentChoiceDraft[];
  correctChoiceIds: string[];
  id: string;
  points: number;
  prompt: string;
  type: AssessmentQuestionType;
}

export interface AssessmentDraft {
  closesAt: string | null;
  instructions: string;
  maxAttempts: number;
  opensAt: string | null;
  passPercent: number;
  questions: AssessmentQuestionDraft[];
  resultVisibility: AssessmentResultVisibility;
  timeLimitSeconds: number | null;
  title: string;
}

export interface CreateAssessmentInput extends AssessmentDraft {
  courseId: string;
}

export interface UpdateAssessmentDraftInput extends AssessmentDraft {
  expectedRevision: number;
}

export interface AssessmentAuthoring {
  _id: string;
  archivedAt: string | null;
  courseId: string;
  currentVersionId: string | null;
  currentVersionNumber: number;
  draft: AssessmentDraft;
  hasUnpublishedChanges: boolean;
  lastPublishedAt: string | null;
  publishedAt: string | null;
  revision: number;
  status: AssessmentStatus;
}

export interface AssessmentManagerListItem {
  _id: string;
  archivedAt: string | null;
  courseId: string;
  currentVersionNumber: number;
  hasUnpublishedChanges: boolean;
  lastPublishedAt: string | null;
  revision: number;
  status: AssessmentStatus;
  title: string;
  updatedAt: string | null;
}

export interface AssessmentSafeMetadata {
  _id: string;
  availability: AssessmentAvailability;
  closesAt: string | null;
  courseId: string;
  currentVersionNumber: number;
  instructions: string;
  maxAttempts: number;
  maxScore: number;
  opensAt: string | null;
  passPercent: number;
  resultVisibility: AssessmentResultVisibility;
  serverNow: string;
  status: AssessmentStatus;
  timeLimitSeconds: number | null;
  title: string;
  versionNumber: number;
}

export type AssessmentLearnerListItem = AssessmentSafeMetadata;

export interface AssessmentLearnerDetail extends AssessmentSafeMetadata {
  activeAttemptId: string | null;
  attemptsRemaining: number;
  attemptsUsed: number;
}

export interface AssessmentPublicChoice {
  id: string;
  text: string;
}

export interface AssessmentPublicQuestion {
  choices: AssessmentPublicChoice[];
  id: string;
  points: number;
  prompt: string;
  type: AssessmentQuestionType;
}

export interface AssessmentSavedAnswer {
  questionId: string;
  selectedChoiceIds: string[];
}

export interface AssessmentScoreSummary {
  maxScore: number;
  passed: boolean;
  percentage: number;
  score: number;
  scoredAt: string;
}

export interface AssessmentAttempt {
  _id: string;
  answers: AssessmentSavedAnswer[];
  assessmentId: string;
  attemptNumber: number;
  deadlineAt: string | null;
  instructions: string;
  questions: AssessmentPublicQuestion[];
  result: AssessmentScoreSummary | null;
  resultReleased: boolean;
  revision: number;
  serverNow: string;
  startedAt: string;
  status: AssessmentAttemptStatus;
  submittedAt: string | null;
  title: string;
  versionNumber: number;
}

export interface AssessmentAttemptResult {
  attemptId: string;
  attemptNumber: number;
  result: AssessmentScoreSummary | null;
  resultReleased: boolean;
  status: AssessmentAttemptStatus;
  submittedAt: string | null;
}

export interface AssessmentManagerAttemptRow {
  _id: string;
  assessmentId: string;
  /** Published version title; optional for compatibility with older servers. */
  assessmentTitle?: string | null;
  attemptNumber: number;
  courseId: string;
  deadlineAt: string | null;
  learner: {
    _id: string;
    email: string;
    fullName: string;
  };
  maxScore: number;
  passed: boolean | null;
  percentage: number | null;
  revision: number;
  score: number | null;
  scoredAt: string | null;
  startedAt: string;
  status: AssessmentAttemptStatus;
  submittedAt: string | null;
  versionNumber: number;
}

export interface AssessmentListQuery {
  courseId?: string;
  limit?: number;
  page?: number;
  status?: AssessmentStatus;
}

export interface AssessmentReportQuery {
  assessmentId?: string;
  courseId?: string;
  limit?: number;
  page?: number;
  search?: string;
  status?: AssessmentAttemptStatus;
}

export interface AssessmentApiContext {
  token: string;
}

export function createAssessmentMutationId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function buildAssessmentQuery(values: object = {}): string {
  const params = new URLSearchParams();
  const record = values as Readonly<Record<string, unknown>>;
  for (const key of Object.keys(record).sort()) {
    const raw = record[key];
    if (typeof raw === "string") {
      const value = raw.trim();
      if (value) params.set(key, value);
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      params.set(key, String(raw));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

const assessmentPath = (assessmentId: string) =>
  `/assessments/${encodeURIComponent(assessmentId)}`;
const attemptPath = (attemptId: string) =>
  `/assessment-attempts/${encodeURIComponent(attemptId)}`;

export const assessmentApi = {
  listForManager: (
    { token }: AssessmentApiContext,
    query: AssessmentListQuery = {},
  ) => apiFetch<Paginated<AssessmentManagerListItem>>(
    `/assessments${buildAssessmentQuery(query)}`,
    { token },
  ),
  listForLearner: (
    { token }: AssessmentApiContext,
    query: AssessmentListQuery = {},
  ) => apiFetch<Paginated<AssessmentLearnerListItem>>(
    `/assessments${buildAssessmentQuery(query)}`,
    { token },
  ),
  create: ({ token }: AssessmentApiContext, input: CreateAssessmentInput) =>
    apiFetch<AssessmentAuthoring>("/assessments", {
      body: JSON.stringify(input),
      method: "POST",
      token,
    }),
  getAuthoring: ({ token }: AssessmentApiContext, assessmentId: string) =>
    apiFetch<AssessmentAuthoring>(`${assessmentPath(assessmentId)}/authoring`, { token }),
  getLearnerDetail: ({ token }: AssessmentApiContext, assessmentId: string) =>
    apiFetch<AssessmentLearnerDetail>(assessmentPath(assessmentId), { token }),
  updateDraft: (
    { token }: AssessmentApiContext,
    assessmentId: string,
    input: UpdateAssessmentDraftInput,
  ) => apiFetch<AssessmentAuthoring>(`${assessmentPath(assessmentId)}/draft`, {
    body: JSON.stringify(input),
    method: "PUT",
    token,
  }),
  publish: (
    { token }: AssessmentApiContext,
    assessmentId: string,
    input: { clientMutationId: string; expectedRevision: number },
  ) => apiFetch<AssessmentAuthoring>(`${assessmentPath(assessmentId)}/publish`, {
    body: JSON.stringify(input),
    method: "POST",
    token,
  }),
  archive: (
    { token }: AssessmentApiContext,
    assessmentId: string,
    input: { expectedRevision: number },
  ) => apiFetch<AssessmentAuthoring>(`${assessmentPath(assessmentId)}/archive`, {
    body: JSON.stringify(input),
    method: "POST",
    token,
  }),
  startAttempt: (
    { token }: AssessmentApiContext,
    assessmentId: string,
    input: { clientMutationId: string },
  ) => apiFetch<AssessmentAttempt>(`${assessmentPath(assessmentId)}/attempts/start`, {
    body: JSON.stringify(input),
    method: "POST",
    token,
  }),
  getAttempt: ({ token }: AssessmentApiContext, attemptId: string) =>
    apiFetch<AssessmentAttempt>(attemptPath(attemptId), { token }),
  saveAnswer: (
    { token }: AssessmentApiContext,
    attemptId: string,
    questionId: string,
    input: { expectedRevision: number; selectedChoiceIds: string[] },
    options: { signal?: AbortSignal } = {},
  ) => apiFetch<AssessmentAttempt>(
    `${attemptPath(attemptId)}/answers/${encodeURIComponent(questionId)}`,
    {
      body: JSON.stringify(input),
      method: "PUT",
      ...(options.signal ? { signal: options.signal } : {}),
      token,
    },
  ),
  submitAttempt: (
    { token }: AssessmentApiContext,
    attemptId: string,
    input: { expectedRevision: number },
    options: { signal?: AbortSignal } = {},
  ) => apiFetch<AssessmentAttempt>(`${attemptPath(attemptId)}/submit`, {
    body: JSON.stringify(input),
    method: "POST",
    ...(options.signal ? { signal: options.signal } : {}),
    token,
  }),
  getResult: ({ token }: AssessmentApiContext, attemptId: string) =>
    apiFetch<AssessmentAttemptResult>(`${attemptPath(attemptId)}/result`, { token }),
  listManagerAttempts: (
    { token }: AssessmentApiContext,
    query: AssessmentReportQuery = {},
  ) => apiFetch<Paginated<AssessmentManagerAttemptRow>>(
    `/assessment-attempts${buildAssessmentQuery(query)}`,
    { token },
  ),
};
