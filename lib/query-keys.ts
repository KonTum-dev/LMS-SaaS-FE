import type { CurrentUser, Organization } from "@/lib/types";
import type { AdminOrdersQuery, AdminSubscriptionsQuery } from "@/lib/types";
import type { AdminNotificationEventsQuery } from "@/lib/notification-operations-api";

export interface ViewerScope {
  membershipId: string;
  role: CurrentUser["role"];
  tenantId: string;
  viewerId: string;
}

export interface NotificationViewerScope extends ViewerScope {
  role: Exclude<CurrentUser["role"], "SUPER_ADMIN">;
}

/** Stable cache-authority identity for users that do not belong to a tenant. */
export const PLATFORM_SCOPE_SENTINEL = "platform";

export interface DirectoryQuery {
  limit: number;
  page: number;
  search?: string;
}

export type QueryKeyFilterValue = boolean | null | number | string | undefined;
export type QueryKeyFilters = Readonly<Record<string, QueryKeyFilterValue>>;
export type NormalizedQueryFilters = readonly (readonly [
  string,
  Exclude<QueryKeyFilterValue, undefined>,
])[];

export function normalizeQueryFilters(
  filters: QueryKeyFilters = {},
): NormalizedQueryFilters {
  const normalized: Array<
    readonly [string, Exclude<QueryKeyFilterValue, undefined>]
  > = [];
  for (const key of Object.keys(filters).sort()) {
    const value = filters[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) normalized.push([key, trimmed]);
    } else if (value === null || typeof value === "boolean") {
      normalized.push([key, value]);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      normalized.push([key, value]);
    }
  }
  return normalized;
}

export function getViewerScope(
  user: CurrentUser | null,
  organization: Organization | null,
): ViewerScope | null {
  if (!user) return null;

  if (user.role === "SUPER_ADMIN") {
    return {
      membershipId: PLATFORM_SCOPE_SENTINEL,
      role: user.role,
      tenantId: PLATFORM_SCOPE_SENTINEL,
      viewerId: user.sub,
    };
  }

  if (
    !user.tenantId ||
    !user.membershipId ||
    (organization && organization._id !== user.tenantId)
  ) {
    return null;
  }

  return {
    membershipId: user.membershipId,
    role: user.role,
    tenantId: user.tenantId,
    viewerId: user.sub,
  };
}

export function getNotificationViewerScope(
  user: CurrentUser | null,
): NotificationViewerScope | null {
  if (
    !user ||
    user.role === "SUPER_ADMIN" ||
    !user.tenantId ||
    !user.membershipId
  ) {
    return null;
  }

  return {
    membershipId: user.membershipId,
    role: user.role,
    tenantId: user.tenantId,
    viewerId: user.sub,
  };
}

const scoped = (scope: ViewerScope) =>
  [
    "lms",
    scope.tenantId,
    scope.viewerId,
    scope.membershipId,
    scope.role,
  ] as const;
const notificationScoped = (scope: NotificationViewerScope) =>
  [...scoped(scope), "notifications"] as const;

export const lmsQueryKeys = {
  all: ["lms"] as const,
  viewer: scoped,
  account: (viewerId: string) => ["lms", "account", viewerId] as const,
  googleIdentity: (viewerId: string) =>
    [...lmsQueryKeys.account(viewerId), "google-identity"] as const,
  googleDrive: (scope: ViewerScope) =>
    [...scoped(scope), "integrations", "google-drive"] as const,
  youtube: (scope: ViewerScope) =>
    [...scoped(scope), "integrations", "youtube"] as const,
  youtubeUploads: (
    scope: ViewerScope,
    source?: { assetId: string; courseId: string; lessonId: string },
  ) =>
    source
      ? ([
          ...lmsQueryKeys.youtube(scope),
          "uploads",
          normalizeQueryFilters(source),
        ] as const)
      : ([...lmsQueryKeys.youtube(scope), "uploads"] as const),
  youtubeUpload: (scope: ViewerScope, jobId: string) =>
    [...lmsQueryKeys.youtubeUploads(scope), jobId] as const,
  dashboard: (scope: ViewerScope) => [...scoped(scope), "dashboard"] as const,
  users: (scope: ViewerScope) => [...scoped(scope), "users"] as const,
  invitations: (scope: ViewerScope) =>
    [...scoped(scope), "users", "invitations"] as const,
  learners: (scope: ViewerScope) =>
    [...scoped(scope), "users", "learners"] as const,
  courses: (scope: ViewerScope) => [...scoped(scope), "courses"] as const,
  course: (scope: ViewerScope, id: string) =>
    [...scoped(scope), "courses", id] as const,
  curriculumRoot: (scope: ViewerScope, courseId: string) =>
    [...lmsQueryKeys.course(scope, courseId), "curriculum"] as const,
  curriculumTreeRoot: (scope: ViewerScope, courseId: string) =>
    [...lmsQueryKeys.curriculumRoot(scope, courseId), "tree"] as const,
  curriculumTree: (
    scope: ViewerScope,
    courseId: string,
    filters: QueryKeyFilters = {},
  ) =>
    [
      ...lmsQueryKeys.curriculumTreeRoot(scope, courseId),
      normalizeQueryFilters(filters),
    ] as const,
  lesson: (scope: ViewerScope, courseId: string, lessonId: string) =>
    [
      ...lmsQueryKeys.curriculumRoot(scope, courseId),
      "lessons",
      lessonId,
    ] as const,
  lessonAssetsRoot: (scope: ViewerScope, courseId: string, lessonId: string) =>
    [...lmsQueryKeys.lesson(scope, courseId, lessonId), "assets"] as const,
  lessonAsset: (
    scope: ViewerScope,
    courseId: string,
    lessonId: string,
    assetId: string,
  ) =>
    [
      ...lmsQueryKeys.lessonAssetsRoot(scope, courseId, lessonId),
      assetId,
    ] as const,
  myCourseProgress: (scope: ViewerScope, courseId: string) =>
    [
      ...lmsQueryKeys.curriculumRoot(scope, courseId),
      "progress",
      "mine",
    ] as const,
  courseLearnerProgressRoot: (scope: ViewerScope, courseId: string) =>
    [
      ...lmsQueryKeys.curriculumRoot(scope, courseId),
      "progress",
      "learners",
    ] as const,
  courseLearnerProgress: (
    scope: ViewerScope,
    courseId: string,
    filters: QueryKeyFilters = {},
  ) =>
    [
      ...lmsQueryKeys.courseLearnerProgressRoot(scope, courseId),
      normalizeQueryFilters(filters),
    ] as const,
  eligibleInstructors: (scope: ViewerScope, query: DirectoryQuery) =>
    [...lmsQueryKeys.courses(scope), "eligible-instructors", query] as const,
  enrollments: (scope: ViewerScope) =>
    [...scoped(scope), "enrollments"] as const,
  courseEnrollmentRoot: (scope: ViewerScope, courseId: string) =>
    [...lmsQueryKeys.enrollments(scope), "courses", courseId] as const,
  courseRoster: (scope: ViewerScope, courseId: string, query: DirectoryQuery) =>
    [
      ...lmsQueryKeys.courseEnrollmentRoot(scope, courseId),
      "roster",
      query,
    ] as const,
  eligibleLearners: (
    scope: ViewerScope,
    courseId: string,
    query: DirectoryQuery,
  ) =>
    [
      ...lmsQueryKeys.courseEnrollmentRoot(scope, courseId),
      "eligible-learners",
      query,
    ] as const,
  submissionsRoot: (scope: ViewerScope) =>
    [...scoped(scope), "submissions"] as const,
  mySubmission: (scope: ViewerScope, assignmentId: string) =>
    [
      ...lmsQueryKeys.submissionsRoot(scope),
      "mine",
      "assignments",
      assignmentId,
    ] as const,
  mySubmissionAssetsRoot: (scope: ViewerScope, assignmentId: string) =>
    [...lmsQueryKeys.mySubmission(scope, assignmentId), "attachments"] as const,
  mySubmissionAsset: (
    scope: ViewerScope,
    assignmentId: string,
    assetId: string,
  ) =>
    [
      ...lmsQueryKeys.mySubmissionAssetsRoot(scope, assignmentId),
      assetId,
    ] as const,
  myResult: (scope: ViewerScope, assignmentId: string) =>
    [...lmsQueryKeys.mySubmission(scope, assignmentId), "result"] as const,
  gradingRoot: (scope: ViewerScope) =>
    [...lmsQueryKeys.submissionsRoot(scope), "grading"] as const,
  gradingList: (scope: ViewerScope, filters: QueryKeyFilters = {}) =>
    [
      ...lmsQueryKeys.gradingRoot(scope),
      "list",
      normalizeQueryFilters(filters),
    ] as const,
  gradingDetail: (scope: ViewerScope, submissionId: string) =>
    [...lmsQueryKeys.gradingRoot(scope), "detail", submissionId] as const,
  gradingAssetsRoot: (scope: ViewerScope, submissionId: string) =>
    [
      ...lmsQueryKeys.gradingDetail(scope, submissionId),
      "attachments",
    ] as const,
  gradingAsset: (scope: ViewerScope, submissionId: string, assetId: string) =>
    [...lmsQueryKeys.gradingAssetsRoot(scope, submissionId), assetId] as const,
  reportsRoot: (scope: ViewerScope) => [...scoped(scope), "reports"] as const,
  courseReport: (
    scope: ViewerScope,
    courseId: string,
    filters: QueryKeyFilters = {},
  ) =>
    [
      ...lmsQueryKeys.reportsRoot(scope),
      "courses",
      courseId,
      normalizeQueryFilters(filters),
    ] as const,
  assignmentsRoot: (scope: ViewerScope) =>
    [...scoped(scope), "assignments"] as const,
  assignmentDetail: (scope: ViewerScope, assignmentId: string) =>
    [...lmsQueryKeys.assignmentsRoot(scope), "detail", assignmentId] as const,
  assignments: (scope: ViewerScope, courseId?: string) =>
    [...lmsQueryKeys.assignmentsRoot(scope), courseId ?? "all"] as const,
  assessmentsRoot: (scope: ViewerScope) =>
    [...scoped(scope), "assessments"] as const,
  assessmentLists: (scope: ViewerScope) =>
    [...lmsQueryKeys.assessmentsRoot(scope), "list"] as const,
  assessmentList: (scope: ViewerScope, filters: QueryKeyFilters = {}) =>
    [
      ...lmsQueryKeys.assessmentLists(scope),
      normalizeQueryFilters(filters),
    ] as const,
  assessmentLearnerDetails: (scope: ViewerScope) =>
    [...lmsQueryKeys.assessmentsRoot(scope), "learner-detail"] as const,
  assessmentLearnerDetail: (scope: ViewerScope, assessmentId: string) =>
    [...lmsQueryKeys.assessmentLearnerDetails(scope), assessmentId] as const,
  assessmentAuthoringRoot: (scope: ViewerScope) =>
    [...lmsQueryKeys.assessmentsRoot(scope), "authoring"] as const,
  assessmentAuthoring: (scope: ViewerScope, assessmentId: string) =>
    [...lmsQueryKeys.assessmentAuthoringRoot(scope), assessmentId] as const,
  assessmentAttemptsRoot: (scope: ViewerScope) =>
    [...lmsQueryKeys.assessmentsRoot(scope), "attempts"] as const,
  assessmentAttempt: (scope: ViewerScope, attemptId: string) =>
    [...lmsQueryKeys.assessmentAttemptsRoot(scope), attemptId] as const,
  assessmentResultsRoot: (scope: ViewerScope) =>
    [...lmsQueryKeys.assessmentsRoot(scope), "results"] as const,
  assessmentResult: (scope: ViewerScope, attemptId: string) =>
    [...lmsQueryKeys.assessmentResultsRoot(scope), attemptId] as const,
  assessmentReportsRoot: (scope: ViewerScope) =>
    [...lmsQueryKeys.assessmentsRoot(scope), "manager-reports"] as const,
  assessmentReport: (scope: ViewerScope, filters: QueryKeyFilters = {}) =>
    [
      ...lmsQueryKeys.assessmentReportsRoot(scope),
      normalizeQueryFilters(filters),
    ] as const,
  notificationsRoot: notificationScoped,
  notificationLists: (scope: NotificationViewerScope) =>
    [...notificationScoped(scope), "list"] as const,
  notificationsList: (
    scope: NotificationViewerScope,
    filters: QueryKeyFilters = {},
  ) =>
    [
      ...lmsQueryKeys.notificationLists(scope),
      normalizeQueryFilters(filters),
    ] as const,
  notificationUnreadCount: (scope: NotificationViewerScope) =>
    [...notificationScoped(scope), "unread-count"] as const,
  tenants: (scope: ViewerScope) => [...scoped(scope), "organizations"] as const,
  tenantUsers: (scope: ViewerScope, tenantId: string) =>
    [...lmsQueryKeys.tenants(scope), tenantId, "users"] as const,
  billing: (scope: ViewerScope) => [...scoped(scope), "billing"] as const,
  billingPlans: (scope: ViewerScope) =>
    [...lmsQueryKeys.billing(scope), "plans"] as const,
  billingSubscription: (scope: ViewerScope) =>
    [...lmsQueryKeys.billing(scope), "subscription"] as const,
  billingOrders: (scope: ViewerScope) =>
    [...lmsQueryKeys.billing(scope), "orders"] as const,
  billingOrder: (scope: ViewerScope, id: string) =>
    [...lmsQueryKeys.billingOrders(scope), id] as const,
  adminBilling: (scope: ViewerScope) =>
    [...scoped(scope), "admin-billing"] as const,
  adminBillingPlans: (scope: ViewerScope) =>
    [...lmsQueryKeys.adminBilling(scope), "plans"] as const,
  adminSubscriptions: (scope: ViewerScope, query?: AdminSubscriptionsQuery) =>
    [
      ...lmsQueryKeys.adminBilling(scope),
      "subscriptions",
      query ?? "all",
    ] as const,
  adminOrders: (scope: ViewerScope, query?: AdminOrdersQuery) =>
    [...lmsQueryKeys.adminBilling(scope), "orders", query ?? "all"] as const,
  adminOrder: (scope: ViewerScope, id: string) =>
    [...lmsQueryKeys.adminBilling(scope), "orders", "detail", id] as const,
  adminNotificationEventsRoot: (scope: ViewerScope) =>
    [...scoped(scope), "admin-notification-events"] as const,
  adminNotificationEvents: (
    scope: ViewerScope,
    query: AdminNotificationEventsQuery,
  ) =>
    [
      ...lmsQueryKeys.adminNotificationEventsRoot(scope),
      normalizeQueryFilters({
        limit: query.limit,
        page: query.page,
        tenantId: query.tenantId,
        type: query.type,
      }),
    ] as const,
};
