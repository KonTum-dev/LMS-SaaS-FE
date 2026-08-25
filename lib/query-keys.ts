import type { CurrentUser, Organization } from "@/lib/types";

export interface ViewerScope {
  tenantId: string;
  viewerId: string;
}

export function getViewerScope(
  user: CurrentUser | null,
  organization: Organization | null,
): ViewerScope | null {
  if (!user) return null;

  return {
    tenantId: user.tenantId ?? organization?._id ?? "platform",
    viewerId: user.sub,
  };
}

const scoped = (scope: ViewerScope) => ["lms", scope.tenantId, scope.viewerId] as const;

export const lmsQueryKeys = {
  all: ["lms"] as const,
  viewer: scoped,
  dashboard: (scope: ViewerScope) => [...scoped(scope), "dashboard"] as const,
  users: (scope: ViewerScope) => [...scoped(scope), "users"] as const,
  learners: (scope: ViewerScope) => [...scoped(scope), "users", "learners"] as const,
  courses: (scope: ViewerScope) => [...scoped(scope), "courses"] as const,
  course: (scope: ViewerScope, id: string) => [...scoped(scope), "courses", id] as const,
  enrollments: (scope: ViewerScope) => [...scoped(scope), "enrollments"] as const,
  assignmentsRoot: (scope: ViewerScope) => [...scoped(scope), "assignments"] as const,
  assignments: (scope: ViewerScope, courseId?: string) => [
    ...lmsQueryKeys.assignmentsRoot(scope),
    courseId ?? "all",
  ] as const,
  tenants: (scope: ViewerScope) => [...scoped(scope), "organizations"] as const,
};
