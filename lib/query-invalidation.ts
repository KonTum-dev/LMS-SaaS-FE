import type { QueryClient } from "@tanstack/react-query";
import { lmsQueryKeys, type ViewerScope } from "./query-keys";

export function invalidateAssignmentQueries(queryClient: QueryClient, scope: ViewerScope) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.assignmentsRoot(scope) }),
    queryClient.invalidateQueries({ queryKey: lmsQueryKeys.dashboard(scope) }),
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
