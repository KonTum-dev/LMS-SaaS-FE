import { apiFetch } from "@/lib/api";

export interface GuardianChild {
  learnerId: string;
  fullName: string;
}
export interface GuardianPage<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}
export interface GuardianCourse {
  courseId: string;
  title: string;
  progress: {
    requiredLessons: number;
    completedRequiredLessons: number;
    percent: number;
    completed: boolean;
  };
}
export interface GuardianAssignmentResult {
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  courseId: string;
  courseTitle: string;
  state: "GRADED" | "RETURNED";
  feedback: string;
  releasedAt: string;
  grade: { score: number; maxPoints: number; percent: number } | null;
}
export interface GuardianAssessmentResult {
  attemptId: string;
  assessmentId: string;
  assessmentTitle: string;
  courseId: string;
  courseTitle: string;
  attemptNumber: number;
  status: "SUBMITTED" | "TIMED_OUT";
  submittedAt: string | null;
  grade: {
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    scoredAt: string;
  };
}
export interface GuardianLearning {
  child: GuardianChild;
  courses: GuardianPage<GuardianCourse>;
  results: GuardianPage<GuardianAssignmentResult>;
  assessments: GuardianPage<GuardianAssessmentResult>;
  capabilities: { assignmentResults: boolean; assessmentResults: boolean };
}
export interface GuardianLearningPages {
  coursesPage: number;
  resultsPage: number;
  assessmentsPage: number;
}

/** No tenant or guardian ID is accepted: the server derives both from the session. */
export const guardianPortalApi = {
  children: (token: string, page = 1, signal?: AbortSignal) =>
    apiFetch<GuardianPage<GuardianChild>>(
      `/guardians/portal/children?page=${page}&limit=20`,
      { token, signal, cache: "no-store" },
    ),
  learning: (
    token: string,
    learnerId: string,
    pages: GuardianLearningPages,
    signal?: AbortSignal,
  ) => {
    const query = new URLSearchParams({
      coursesPage: String(pages.coursesPage),
      coursesLimit: "10",
      resultsPage: String(pages.resultsPage),
      resultsLimit: "10",
      assessmentsPage: String(pages.assessmentsPage),
      assessmentsLimit: "10",
    });
    return apiFetch<GuardianLearning>(
      `/guardians/portal/children/${encodeURIComponent(learnerId)}/learning?${query}`,
      { token, signal, cache: "no-store" },
    );
  },
};

export function guardianPortalAccessLost(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    [401, 403, 404].includes(Number(error.status))
  );
}
