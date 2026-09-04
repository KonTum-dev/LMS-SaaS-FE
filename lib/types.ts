export type UserRole =
  "SUPER_ADMIN" | "TENANT_ADMIN" | "INSTRUCTOR" | "LEARNER" | "GUARDIAN";
export type OrganizationStatus = "ACTIVE" | "SUSPENDED";
export type OrgUnitScopeMode = "GLOBAL" | "SCOPED";

export type TenantProvisioningStatus = "PENDING" | "SUCCEEDED" | "FAILED";
export type TenantProvisioningPhase =
  | "RESERVED"
  | "ORGANIZATION_CREATED"
  | "IDENTITY_CREATED"
  | "MEMBERSHIP_CREATED"
  | "SUCCEEDED";
export type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type LmsModule =
  | "USERS"
  | "COURSES"
  | "ENROLLMENTS"
  | "ASSIGNMENTS"
  | "ASSESSMENTS"
  | "MEDIA"
  | "COHORTS"
  | "GUARDIANS"
  | "TUITION"
  | "ORGANIZATION_STRUCTURE"
  | "REPORTS"
  | "COMMUNICATIONS";

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  primaryColor: string;
  logoUrl: string | null;
  enabledModules: LmsModule[];
  createdAt?: string;
}

export interface TenantProvisioningOperation {
  attemptCount: number;
  completedAt?: string;
  failureCode?:
    | "ADMIN_EMAIL_CONFLICT"
    | "RESOURCE_INTEGRITY_CONFLICT"
    | "TENANT_SLUG_CONFLICT";
  operationId: string;
  organization: Organization | null;
  phase: TenantProvisioningPhase;
  status: TenantProvisioningStatus;
}

export interface CurrentUser {
  sub: string;
  email: string;
  fullName: string;
  role: UserRole;
  tenantId?: string;
  membershipId?: string;
  orgUnitScopeMode?: OrgUnitScopeMode;
}

export interface WorkspaceSummary {
  membershipId: string;
  tenantId: string;
  name: string;
  slug: string;
  role: Exclude<UserRole, "SUPER_ADMIN">;
  displayName?: string;
  logoUrl: string | null;
  primaryColor: string;
  orgUnitId?: string;
  orgUnitScopeMode?: OrgUnitScopeMode;
}

export interface AppUser {
  _id: string;
  membershipId?: string;
  email: string;
  fullName: string;
  role: Exclude<UserRole, "SUPER_ADMIN">;
  status: "ACTIVE" | "INACTIVE";
  orgUnitId?: string;
  createdAt?: string;
}

export interface Course {
  _id: string;
  title: string;
  slug: string;
  description: string;
  status: CourseStatus;
  curriculumRevision?: number;
  instructorId?: string | Pick<AppUser, "_id" | "fullName" | "email">;
  createdAt?: string;
}

export type LessonType = "TEXT" | "HTTPS_LINK";

export interface LessonProgressOverlay {
  completed: boolean;
  completedAt: string | null;
  completedContentRevision: number | null;
  contentChangedSinceCompletion: boolean;
  revision: number;
}

export interface LessonProgress extends LessonProgressOverlay {
  _id: string;
  tenantId: string;
  courseId: string;
  sectionId: string;
  lessonId: string;
  learnerId: string;
  enrollmentId: string;
}

export interface CurriculumLesson {
  _id: string;
  attachmentIds: string[];
  courseId: string;
  sectionId: string;
  title: string;
  summary: string;
  type: LessonType;
  estimatedMinutes: number | null;
  required: boolean;
  position: number;
  published: boolean;
  publishedAt: string | null;
  archivedAt: string | null;
  revision: number;
  contentRevision: number;
  progress?: LessonProgressOverlay | null;
}

export interface CurriculumSectionResource {
  _id: string;
  courseId: string;
  title: string;
  description: string;
  position: number;
  published: boolean;
  publishedAt: string | null;
  archivedAt: string | null;
  revision: number;
}

export interface CurriculumSection extends CurriculumSectionResource {
  lessons: CurriculumLesson[];
}

export interface CourseProgressSummary {
  courseId: string;
  requiredLessons: number;
  completedRequiredLessons: number;
  percent: number;
  completed: boolean;
}

export interface CourseCurriculum {
  course: Pick<Course, "_id" | "title" | "status">;
  curriculumRevision: number;
  sections: CurriculumSection[];
  myProgress?: CourseProgressSummary | null;
}

export interface CreateCurriculumSectionResult {
  curriculumRevision: number;
  section: CurriculumSection;
}

export interface CreateCurriculumLessonResult {
  curriculumRevision: number;
  lesson: CurriculumLesson;
}

export interface CurriculumLessonResource extends CurriculumLesson {
  textContent: string | null;
  sourceUrl: string | null;
}

export interface LessonDetail extends CurriculumLessonResource {
  course: Pick<Course, "_id" | "title" | "status">;
  section: Pick<
    CurriculumSection,
    "_id" | "title" | "published" | "archivedAt"
  >;
}

export interface LearnerProgressRow {
  learner: Pick<AppUser, "_id" | "email" | "fullName">;
  requiredLessons: number;
  completedRequiredLessons: number;
  percent: number;
  completed: boolean;
}

export interface Enrollment {
  _id: string;
  courseId: string | Pick<Course, "_id" | "title" | "slug" | "status">;
  userId: string | Pick<AppUser, "_id" | "fullName" | "email">;
  status?: "ACTIVE" | "WITHDRAWN";
  createdAt?: string;
}

export interface DirectoryPerson {
  email: string;
  fullName: string;
  userId: string;
}

export interface CourseRosterItem {
  _id: string;
  status: "ACTIVE";
  userId: Pick<AppUser, "_id" | "fullName" | "email">;
}

export type AssignmentSubmissionMode = "TEXT" | "HTTPS_LINK" | "FILES";
export type SubmissionStatus = "DRAFT" | "SUBMITTED" | "RETURNED" | "GRADED";
export type GradingSubmissionStatus = Exclude<SubmissionStatus, "DRAFT">;

export interface Assignment {
  _id: string;
  courseId: string | Pick<Course, "_id" | "title" | "slug">;
  title: string;
  description: string;
  dueAt?: string;
  published: boolean;
  maxPoints: number;
  submissionMode: AssignmentSubmissionMode;
  allowLate: boolean;
  archivedAt?: string | null;
  publishedAt?: string | null;
  createdAt?: string;
}

export interface LearnerSubmission {
  _id: string;
  assignmentId: string;
  status: SubmissionStatus;
  draftContent: string | null;
  draftAttachmentIds: string[];
  draftUpdatedAt: string;
  submittedContent: string | null;
  submittedAttachmentIds: string[];
  submittedAt: string | null;
  firstSubmittedAt: string | null;
  attemptCount: number;
  wasLate: boolean;
  returnFeedback: string | null;
  score: number | null;
  gradingFeedback: string | null;
  gradedAt: string | null;
  returnedAt: string | null;
  submissionMode: AssignmentSubmissionMode;
  dueAt: string | null;
  maxPoints: number;
  revision: number;
}

export interface MyResult {
  state: "NOT_STARTED" | SubmissionStatus;
  submissionId: string | null;
  attemptCount: number;
  submittedAt: string | null;
  wasLate: boolean;
  submissionMode: AssignmentSubmissionMode;
  submittedAttachmentIds: string[];
  returnFeedback: string | null;
  result: {
    score: number;
    maxPoints: number;
    percentage: number;
    feedback: string | null;
    gradedAt: string;
  } | null;
}

export interface SubmissionLearnerSummary {
  _id: string;
  email: string;
  fullName: string;
}

export interface SubmissionCourseSummary {
  _id: string;
  title: string;
}

export interface SubmissionAssignmentSummary {
  _id: string;
  title: string;
}

export interface GradingSubmissionRow {
  _id: string;
  learner: SubmissionLearnerSummary;
  course: SubmissionCourseSummary;
  assignment: SubmissionAssignmentSummary;
  status: GradingSubmissionStatus;
  attemptCount: number;
  submittedAt: string;
  wasLate: boolean;
  score: number | null;
  maxPoints: number;
  revision: number;
  submissionMode: AssignmentSubmissionMode;
  submittedAttachmentIds: string[];
}

export interface GradingHistoryEntry {
  action: "SUBMIT" | "RETURN" | "GRADE";
  actorId: string;
  at: string;
  revision: number;
  score?: number;
}

export interface GradingSubmissionDetail extends GradingSubmissionRow {
  gradedAt: string | null;
  gradingFeedback: string | null;
  returnFeedback: string | null;
  submittedContent: string | null;
  history: GradingHistoryEntry[];
}

export interface CourseReport {
  generatedAt: string;
  scope: "CURRENT_ACTIVE_ROSTER";
  course: {
    _id: string;
    title: string;
    status: "PUBLISHED";
  };
  activeLearners: number;
  publishedAssignments: number;
  expectedSubmissions: number;
  counts: {
    notStarted: number;
    draft: number;
    submitted: number;
    returned: number;
    graded: number;
  };
  lateSubmissions: number;
  completionPercent: number | null;
  gradedAveragePercent: number | null;
}

export interface DashboardData {
  scope: "platform" | "tenant" | "org-unit" | "learner" | "guardian";
  stats: Array<{ key: string; label: string; value: number; suffix?: string }>;
  recentCourses: Course[];
}

export interface AuthResponse {
  accessToken: string;
  effectiveAccess: EffectiveAccess | null;
  organization: Organization | null;
  user: CurrentUser;
  workspaces: WorkspaceSummary[];
}

export type NotificationType =
  | "COURSE_ENROLLED"
  | "COURSE_WITHDRAWN"
  | "ASSIGNMENT_PUBLISHED"
  | "SUBMISSION_RETURNED"
  | "SUBMISSION_GRADED";

export type NotificationResourceKind = "COURSE" | "ASSIGNMENT";

export interface NotificationInboxItem {
  _id: string;
  type: NotificationType;
  title: string;
  body: string;
  action: {
    label: string;
    path: string;
  } | null;
  resource: {
    kind: NotificationResourceKind;
    id: string;
  } | null;
  occurredAt: string;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationListResponse {
  items: NotificationInboxItem[];
  nextCursor: string | null;
}

export interface NotificationUnreadCountResponse {
  unreadCount: number;
}

export interface NotificationReadAllResponse {
  readAt: string;
  updatedCount: number;
}

export interface TenantMember {
  _id: string;
  membershipId: string;
  userId: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: Exclude<UserRole, "SUPER_ADMIN">;
  status: "ACTIVE" | "INACTIVE";
  accountStatus: "ACTIVE" | "INACTIVE";
  joinedAt: string;
  invitedBy?: string;
  governanceRevision?: number;
  orgUnitId?: string;
  orgUnitScopeMode?: OrgUnitScopeMode;
}

export type InvitationStatus =
  "PENDING" | "CLAIMED" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export interface TenantInvitation {
  _id: string;
  tenantId: string;
  email: string;
  role: Exclude<UserRole, "SUPER_ADMIN">;
  displayName?: string;
  status: InvitationStatus;
  expiresAt: string;
  invitedBy: string;
  orgUnitId?: string;
  acceptedBy?: string;
  claimedAt?: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvitationIssueResponse {
  invitation: TenantInvitation;
  token: string;
  acceptPath: string;
}

export interface InvitationInspection {
  email: string;
  expiresAt: string;
  role: Exclude<UserRole, "SUPER_ADMIN">;
  status: "PENDING";
  displayName?: string;
  requiresAuthentication: boolean;
  organization: Pick<
    Organization,
    "_id" | "name" | "slug" | "logoUrl" | "primaryColor"
  >;
}

export type BillingCycle = "MONTHLY" | "YEARLY";
export type SubscriptionAccessState = "ACTIVE" | "GRACE" | "READ_ONLY";
export type PaymentOrderType = "NEW" | "RENEWAL" | "UPGRADE";
export type PaymentOrderStatus =
  | "PENDING"
  | "PAID"
  | "CANCELED"
  | "EXPIRED"
  | "REVIEW_REQUIRED"
  | "REFUND_REQUIRED";
export type SubscriptionStatus = "ACTIVE" | "EXPIRED";

export interface PlanEntitlements {
  modules: LmsModule[];
  maxUsers: number | null;
  maxCourses: number | null;
  maxBranches: number | null;
  maxActiveLearners: number | null;
}

export interface EffectiveAccess {
  state: SubscriptionAccessState;
  readOnly: boolean;
  graceEndsAt: string | null;
  trial?: boolean;
  trialEndsAt?: string | null;
  modules: LmsModule[];
  limits: Pick<
    PlanEntitlements,
    "maxUsers" | "maxCourses" | "maxBranches" | "maxActiveLearners"
  >;
}

export interface BillingPlan {
  _id: string;
  code: string;
  name: string;
  description: string;
  monthlyPriceVnd: number;
  yearlyPriceVnd: number;
  tierLevel: number;
  active: boolean;
  features: string[];
  entitlements: PlanEntitlements;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlanSnapshot {
  planId: string;
  code: string;
  name: string;
  tierLevel: number;
  billingCycle: BillingCycle;
  durationMonths: number;
  priceVnd: number;
  formula: "FULL" | "PRORATED_UPGRADE";
  sourcePlanId: string | null;
  sourcePlanCode: string | null;
  sourceBillingCycle: BillingCycle | null;
  sourceTierLevel: number | null;
  sourcePriceVnd: number | null;
  sourceCurrentPeriodStartAt: string | null;
  sourceEndAt: string | null;
  priceDifferenceVnd: number | null;
  remainingMs: number | null;
  fullPeriodMs: number | null;
  entitlements: PlanEntitlements;
}

export interface PaymentOrder {
  _id: string;
  tenantId: string | Pick<Organization, "_id" | "name" | "slug">;
  planId: string | BillingPlan;
  planSnapshot: PlanSnapshot;
  type: PaymentOrderType;
  invoiceNumber: string;
  amountVnd: number;
  currency: "VND";
  status: PaymentOrderStatus;
  provider: "MOCK" | "SEPAY";
  paidAt: string | null;
  canceledAt: string | null;
  subscriptionAppliedAt: string | null;
  expiresAt: string;
  paymentCapturedAt: string | null;
  reviewReason: string | null;
  transactionReference?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CheckoutResponse {
  checkout: {
    action: string | null;
    fields: Record<string, string>;
    method: "POST" | null;
    mode: "MOCK" | "SEPAY";
  };
  order: PaymentOrder;
}

export interface Subscription {
  _id: string;
  tenantId: string | Pick<Organization, "_id" | "name" | "slug">;
  planId: string | BillingPlan;
  planCode: string;
  currentTierLevel: number;
  billingCycle: BillingCycle;
  currentPriceVnd: number;
  status: SubscriptionStatus;
  isTrial?: boolean;
  trialEndsAt?: string | null;
  startedAt: string;
  currentPeriodStartAt: string;
  endAt: string;
  scheduledPlanId: string | BillingPlan | null;
  scheduledPlanCode: string | null;
  scheduledAt: string | null;
  entitlements: PlanEntitlements;
  effectiveAccess: EffectiveAccess;
  createdAt?: string;
  updatedAt?: string;
}

export interface BillingPlanInput {
  code: string;
  name: string;
  description?: string;
  monthlyPriceVnd: number;
  yearlyPriceVnd: number;
  tierLevel: number;
  active?: boolean;
  features?: string[];
  entitlements: PlanEntitlements;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface PaymentEventTimeline {
  _id: string;
  orderId: string;
  notificationType: string;
  status: "RECEIVED" | "PROCESSED";
  payload: Record<string, unknown>;
  processedAt: string | null;
  createdAt: string;
}

export interface BillingAuditEntry {
  _id: string;
  orderId: string;
  actorId: string;
  action: "RECONCILE" | "MARK_REFUND_REQUIRED";
  reason: string;
  beforeStatus: PaymentOrderStatus;
  afterStatus: PaymentOrderStatus;
  outcome: "ATTEMPT" | "SUCCEEDED" | "NO_CHANGE" | "FAILED";
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminOrderDetail {
  order: PaymentOrder;
  events: PaymentEventTimeline[];
  audits: BillingAuditEntry[];
}

export interface AdminOrdersQuery {
  page: number;
  limit: number;
  status?: PaymentOrderStatus;
  type?: PaymentOrderType;
  tenantId?: string;
  search?: string;
}

export interface AdminSubscriptionsQuery {
  page: number;
  limit: number;
  status?: SubscriptionStatus;
  billingCycle?: BillingCycle;
  tenantId?: string;
}
