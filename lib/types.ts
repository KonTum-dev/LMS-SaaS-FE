export type UserRole = "SUPER_ADMIN" | "TENANT_ADMIN" | "INSTRUCTOR" | "LEARNER";
export type OrganizationStatus = "ACTIVE" | "SUSPENDED";
export type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type LmsModule = "USERS" | "COURSES" | "ENROLLMENTS" | "ASSIGNMENTS";

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

export interface CurrentUser {
  sub: string;
  email: string;
  fullName: string;
  role: UserRole;
  tenantId?: string;
}

export interface AppUser {
  _id: string;
  email: string;
  fullName: string;
  role: Exclude<UserRole, "SUPER_ADMIN">;
  status: "ACTIVE" | "INACTIVE";
  createdAt?: string;
}

export interface Course {
  _id: string;
  title: string;
  slug: string;
  description: string;
  status: CourseStatus;
  instructorId?: string | Pick<AppUser, "_id" | "fullName" | "email">;
  createdAt?: string;
}

export interface Enrollment {
  _id: string;
  courseId: string | Pick<Course, "_id" | "title" | "slug" | "status">;
  userId: string | Pick<AppUser, "_id" | "fullName" | "email">;
  createdAt?: string;
}

export interface Assignment {
  _id: string;
  courseId: string | Pick<Course, "_id" | "title" | "slug">;
  title: string;
  description: string;
  dueAt?: string;
  published: boolean;
  createdAt?: string;
}

export interface DashboardData {
  scope: "platform" | "tenant" | "learner";
  stats: Array<{ key: string; label: string; value: number; suffix?: string }>;
  recentCourses: Course[];
}

export interface AuthResponse {
  accessToken: string;
  organization: Organization | null;
  user: CurrentUser;
}

export type BillingCycle = "MONTHLY" | "YEARLY";
export type PaymentOrderType = "NEW" | "RENEWAL" | "UPGRADE";
export type PaymentOrderStatus =
  | "PENDING"
  | "PAID"
  | "CANCELED"
  | "EXPIRED"
  | "REVIEW_REQUIRED"
  | "REFUND_REQUIRED";
export type SubscriptionStatus = "ACTIVE" | "EXPIRED";

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
  startedAt: string;
  currentPeriodStartAt: string;
  endAt: string;
  scheduledPlanId: string | BillingPlan | null;
  scheduledPlanCode: string | null;
  scheduledAt: string | null;
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
