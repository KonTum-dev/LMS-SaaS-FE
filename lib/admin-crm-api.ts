import { apiFetch } from "@/lib/api";
import type {
  BillingCycle,
  OrganizationStatus,
  PaymentOrderStatus,
} from "@/lib/types";
import type { ViewerScope } from "@/lib/query-keys";

export type AdminCrmAccessState =
  "ACTIVE" | "TRIAL" | "GRACE" | "READ_ONLY" | "NONE";

export interface AdminCrmQuery {
  access?: AdminCrmAccessState;
  limit: number;
  page: number;
  search?: string;
  status?: OrganizationStatus;
}

export interface AdminCrmMetrics {
  activeMembers: number;
  activeSubscriptions: number;
  activeTenants: number;
  graceWorkspaces: number;
  grossRevenueVnd: number;
  noSubscriptionWorkspaces: number;
  paidOrders: number;
  readOnlyWorkspaces: number;
  recentRevenueVnd: number;
  reviewOrders: number;
  suspendedTenants: number;
  totalTenants: number;
  trialWorkspaces: number;
}

export interface AdminCrmTenant {
  accessState: AdminCrmAccessState;
  createdAt: string;
  id: string;
  memberCount: number;
  name: string;
  revenueVnd: number;
  slug: string;
  status: OrganizationStatus;
  subscription: {
    billingCycle: BillingCycle;
    endAt: string;
    isTrial: boolean;
    planCode: string;
  } | null;
}

export interface AdminCrmActivity {
  amountVnd: number | null;
  id: string;
  kind: "TENANT_CREATED" | "PAYMENT_PAID" | "PAYMENT_NEEDS_ATTENTION";
  occurredAt: string;
  status: PaymentOrderStatus | null;
  tenant: { id: string; name: string; slug: string };
}

export interface AdminCrmDashboard {
  generatedAt: string;
  metrics: AdminCrmMetrics;
  recentActivity: AdminCrmActivity[];
  tenants: {
    items: AdminCrmTenant[];
    limit: number;
    page: number;
    total: number;
  };
}

type QueryValue = number | string | undefined;

export function buildAdminCrmQuery(
  values: Readonly<Record<string, QueryValue>>,
): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(values).sort()) {
    const value = values[key];
    if (typeof value === "number" && Number.isSafeInteger(value)) {
      params.set(key, String(value));
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      params.set(key, value.trim());
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

const rootKey = (scope: ViewerScope) =>
  [
    "lms",
    scope.tenantId,
    scope.viewerId,
    scope.membershipId,
    scope.role,
    "admin-crm",
  ] as const;

export const adminCrmQueryKeys = {
  overview: (scope: ViewerScope, query: AdminCrmQuery) =>
    [
      ...rootKey(scope),
      "overview",
      buildAdminCrmQuery(
        query as unknown as Readonly<Record<string, QueryValue>>,
      ),
    ] as const,
  root: rootKey,
};

export const adminCrmApi = {
  overview: (
    token: string,
    query: AdminCrmQuery,
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<AdminCrmDashboard>(
      `/admin/dashboard${buildAdminCrmQuery(
        query as unknown as Readonly<Record<string, QueryValue>>,
      )}`,
      {
        cache: "no-store",
        ...(options.signal ? { signal: options.signal } : {}),
        token,
      },
    ),
};
