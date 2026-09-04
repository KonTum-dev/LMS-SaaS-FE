import type { QueryClient } from "@tanstack/react-query";
import { lmsQueryKeys, type ViewerScope } from "./query-keys";

export function invalidateAssignmentQueries(queryClient: QueryClient, scope: ViewerScope) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.assignmentsRoot(scope) }),
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.dashboard(scope) }),
  ]);
}

export function invalidateAssessmentListQueries(
  queryClient: QueryClient,
  scope: ViewerScope,
) {
  return queryClient.invalidateQueries({ queryKey: lmsQueryKeys.assessmentLists(scope) });
}

export function invalidateAssessmentAuthoringQueries(
  queryClient: QueryClient,
  scope: ViewerScope,
  assessmentId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.assessmentLists(scope) }),
    queryClient.invalidateQueries({
      exact: true,
      queryKey: lmsQueryKeys.assessmentAuthoring(scope, assessmentId),
    }),
    queryClient.invalidateQueries({
      exact: true,
      queryKey: lmsQueryKeys.assessmentLearnerDetail(scope, assessmentId),
    }),
  ]);
}

export function invalidateAssessmentAttemptCompletionQueries(
  queryClient: QueryClient,
  scope: ViewerScope,
  assessmentId: string,
  attemptId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      exact: true,
      queryKey: lmsQueryKeys.assessmentAttempt(scope, attemptId),
    }),
    queryClient.invalidateQueries({
      exact: true,
      queryKey: lmsQueryKeys.assessmentResult(scope, attemptId),
    }),
    queryClient.invalidateQueries({
      exact: true,
      queryKey: lmsQueryKeys.assessmentLearnerDetail(scope, assessmentId),
    }),
  ]);
}

export function invalidateCurriculumQueries(
  queryClient: QueryClient,
  scope: ViewerScope,
  courseId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.curriculumRoot(scope, courseId) }),
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.course(scope, courseId) }),
  ]);
}

export function invalidateLessonProgressQueries(
  queryClient: QueryClient,
  scope: ViewerScope,
  courseId: string,
  lessonId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.curriculumTreeRoot(scope, courseId) }),
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.lesson(scope, courseId, lessonId) }),
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.myCourseProgress(scope, courseId) }),
  ]);
}

export function invalidateLearnerSubmissionQueries(
  queryClient: QueryClient,
  scope: ViewerScope,
  assignmentId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.mySubmission(scope, assignmentId) }),
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.myResult(scope, assignmentId) }),
  ]);
}

export function invalidateGradingSubmissionQueries(
  queryClient: QueryClient,
  scope: ViewerScope,
  courseId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.gradingRoot(scope) }),
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.courseReport(scope, courseId) }),
  ]);
}

export function invalidateCourseRelatedQueries(queryClient: QueryClient, scope: ViewerScope) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.courses(scope) }),
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.dashboard(scope) }),
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.assignmentsRoot(scope) }),
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.enrollments(scope) }),
  ]);
}

export function invalidateCourseEnrollmentQueries(
  queryClient: QueryClient,
  scope: ViewerScope,
  courseId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.courseEnrollmentRoot(scope, courseId) }),
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.courseLearnerProgressRoot(scope, courseId) }),
    queryClient.invalidateQueries({ exact: true, queryKey: lmsQueryKeys.courses(scope) }),
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.dashboard(scope) }),
  ]);
}
