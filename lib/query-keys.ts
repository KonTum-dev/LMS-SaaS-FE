import type { CurrentUser, Organization } from "@/lib/types";
import type { AdminOrdersQuery, AdminSubscriptionsQuery } from "@/lib/types";

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
  billing: (scope: ViewerScope) => [...scoped(scope), "billing"] as const,
  billingPlans: (scope: ViewerScope) => [...lmsQueryKeys.billing(scope), "plans"] as const,
  billingSubscription: (scope: ViewerScope) => [...lmsQueryKeys.billing(scope), "subscription"] as const,
  billingOrders: (scope: ViewerScope) => [...lmsQueryKeys.billing(scope), "orders"] as const,
  billingOrder: (scope: ViewerScope, id: string) => [...lmsQueryKeys.billingOrders(scope), id] as const,
  adminBilling: (scope: ViewerScope) => [...scoped(scope), "admin-billing"] as const,
  adminBillingPlans: (scope: ViewerScope) => [...lmsQueryKeys.adminBilling(scope), "plans"] as const,
  adminSubscriptions: (scope: ViewerScope, query?: AdminSubscriptionsQuery) => [...lmsQueryKeys.adminBilling(scope), "subscriptions", query ?? "all"] as const,
  adminOrders: (scope: ViewerScope, query?: AdminOrdersQuery) => [...lmsQueryKeys.adminBilling(scope), "orders", query ?? "all"] as const,
  adminOrder: (scope: ViewerScope, id: string) => [...lmsQueryKeys.adminBilling(scope), "orders", "detail", id] as const,
};
