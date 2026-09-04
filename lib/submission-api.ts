import { apiFetch } from "@/lib/api";
import {
  parseCourseReport,
  parseGradingPage,
  parseGradingSubmissionDetail,
  parseLearnerSubmission,
  parseMyResult,
  parseOptionalLearnerSubmission,
} from "@/lib/submission-response";
import type { GradingSubmissionStatus } from "@/lib/types";

export interface SubmissionApiContext {
  token: string;
}

export interface GradingListQuery {
  assignmentId?: string;
  courseId?: string;
  limit?: number;
  page?: number;
  search?: string;
  sort?: "NEWEST" | "OLDEST";
  status?: GradingSubmissionStatus;
}

export type SaveSubmissionInput =
  | { attachmentIds: string[]; expectedRevision: number }
  | { content: string; expectedRevision: number };

export function buildSubmissionQuery(values: object = {}): string {
  const params = new URLSearchParams();
  const record = values as Readonly<Record<string, unknown>>;
  for (const key of Object.keys(values).sort()) {
    const raw = record[key];
    if (typeof raw === "string") {
      const value = raw.trim();
      if (value) params.set(key, value);
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      params.set(key, String(raw));
    } else if (typeof raw === "boolean") {
      params.set(key, String(raw));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

const assignmentPath = (assignmentId: string) =>
  `/assignments/${encodeURIComponent(assignmentId)}`;
const gradingPath = (submissionId: string) =>
  `/grading/submissions/${encodeURIComponent(submissionId)}`;

function secureSubmissionRequest(token: string, signal?: AbortSignal) {
  return {
    cache: "no-store" as const,
    credentials: "same-origin" as const,
    referrerPolicy: "no-referrer" as const,
    ...(signal ? { signal } : {}),
    token,
  };
}

export const submissionApi = {
  getMySubmission: (
    { token }: SubmissionApiContext,
    assignmentId: string,
    signal?: AbortSignal,
  ) =>
    apiFetch<unknown>(
      `${assignmentPath(assignmentId)}/my-submission`,
      secureSubmissionRequest(token, signal),
    ).then(parseOptionalLearnerSubmission),
  saveMySubmission: (
    { token }: SubmissionApiContext,
    assignmentId: string,
    input: SaveSubmissionInput,
  ) =>
    apiFetch<unknown>(`${assignmentPath(assignmentId)}/my-submission`, {
      ...secureSubmissionRequest(token),
      body: JSON.stringify(input),
      method: "PUT",
    }).then(parseLearnerSubmission),
  submitMySubmission: (
    { token }: SubmissionApiContext,
    assignmentId: string,
    input: { expectedRevision: number },
  ) =>
    apiFetch<unknown>(`${assignmentPath(assignmentId)}/my-submission/submit`, {
      ...secureSubmissionRequest(token),
      body: JSON.stringify({ expectedRevision: input.expectedRevision }),
      method: "POST",
    }).then(parseLearnerSubmission),
  getMyResult: (
    { token }: SubmissionApiContext,
    assignmentId: string,
    signal?: AbortSignal,
  ) =>
    apiFetch<unknown>(
      `${assignmentPath(assignmentId)}/my-result`,
      secureSubmissionRequest(token, signal),
    ).then(parseMyResult),
  listGradingSubmissions: (
    { token }: SubmissionApiContext,
    query: GradingListQuery = {},
    signal?: AbortSignal,
  ) =>
    apiFetch<unknown>(
      `/grading/submissions${buildSubmissionQuery({ sort: "OLDEST", ...query })}`,
      secureSubmissionRequest(token, signal),
    ).then(parseGradingPage),
  getGradingSubmission: (
    { token }: SubmissionApiContext,
    submissionId: string,
    signal?: AbortSignal,
  ) =>
    apiFetch<unknown>(
      gradingPath(submissionId),
      secureSubmissionRequest(token, signal),
    ).then(parseGradingSubmissionDetail),
  returnGradingSubmission: (
    { token }: SubmissionApiContext,
    submissionId: string,
    input: { expectedRevision: number; feedback: string },
  ) =>
    apiFetch<unknown>(`${gradingPath(submissionId)}/return`, {
      ...secureSubmissionRequest(token),
      body: JSON.stringify({
        expectedRevision: input.expectedRevision,
        feedback: input.feedback,
      }),
      method: "POST",
    }).then(parseGradingSubmissionDetail),
  gradeSubmission: (
    { token }: SubmissionApiContext,
    submissionId: string,
    input: { expectedRevision: number; feedback: string; score: number },
  ) =>
    apiFetch<unknown>(`${gradingPath(submissionId)}/grade`, {
      ...secureSubmissionRequest(token),
      body: JSON.stringify({
        expectedRevision: input.expectedRevision,
        feedback: input.feedback,
        score: input.score,
      }),
      method: "POST",
    }).then(parseGradingSubmissionDetail),
  getCourseReport: (
    { token }: SubmissionApiContext,
    courseId: string,
    signal?: AbortSignal,
  ) =>
    apiFetch<unknown>(
      `/courses/${encodeURIComponent(courseId)}/report`,
      secureSubmissionRequest(token, signal),
    ).then(parseCourseReport),
};
