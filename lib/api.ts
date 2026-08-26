import type {
  BillingCycle,
  BillingPlan,
  BillingPlanInput,
  CheckoutResponse,
  AdminOrderDetail,
  AdminOrdersQuery,
  AdminSubscriptionsQuery,
  Paginated,
  PaymentOrder,
  Subscription,
} from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:4000/api/v1");

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  if (!API_URL) throw new ApiError("Thiếu cấu hình NEXT_PUBLIC_API_URL", 0);
  const { token, ...request } = options;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...request,
      signal: request.signal ?? AbortSignal.timeout(15_000),
      headers: {
        ...(request.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...request.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new ApiError("Máy chủ phản hồi quá lâu, vui lòng thử lại", 0);
    }
    throw new ApiError("Không thể kết nối tới máy chủ", 0);
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("auth:expired"));
    }
    let message = "Không thể hoàn tất yêu cầu";
    try {
      const payload = (await response.json()) as { message?: string | string[] };
      message = Array.isArray(payload.message)
        ? payload.message.join(". ")
        : payload.message ?? message;
    } catch {
      // Preserve a safe generic message when the server does not return JSON.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  const body = await response.text();
  if (!body.trim()) return null as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new ApiError("Máy chủ trả dữ liệu không hợp lệ", response.status);
  }
}

interface BillingApiContext { token: string }

function queryString(values: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values) as Array<[string, string | number | undefined]>) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const billingApi = {
  listPlans: ({ token }: BillingApiContext) => apiFetch<BillingPlan[]>("/billing/plans", { token }),
  getSubscription: ({ token }: BillingApiContext) => apiFetch<Subscription | null>("/billing/subscription", { token }),
  listOrders: ({ token }: BillingApiContext) => apiFetch<PaymentOrder[]>("/billing/orders", { token }),
  getOrder: ({ token }: BillingApiContext, id: string) => apiFetch<PaymentOrder>(`/billing/orders/${id}`, { token }),
  createCheckout: (
    { token }: BillingApiContext,
    input: { billingCycle: BillingCycle; idempotencyKey: string; planId: string },
  ) => apiFetch<CheckoutResponse>("/billing/checkout", {
    body: JSON.stringify({ billingCycle: input.billingCycle, planId: input.planId }),
    headers: { "Idempotency-Key": input.idempotencyKey },
    method: "POST",
    token,
  }),
  simulate: ({ token }: BillingApiContext, id: string, result: "PAID" | "CANCELED") =>
    apiFetch<PaymentOrder>(`/billing/orders/${id}/mock`, {
      body: JSON.stringify({ result }), method: "POST", token,
    }),
  scheduleDowngrade: ({ token }: BillingApiContext, planId: string) =>
    apiFetch<Subscription>("/billing/downgrade", {
      body: JSON.stringify({ planId }), method: "POST", token,
    }),
  cancelScheduledDowngrade: ({ token }: BillingApiContext) =>
    apiFetch<Subscription>("/billing/downgrade", { method: "DELETE", token }),
  adminListPlans: ({ token }: BillingApiContext) => apiFetch<BillingPlan[]>("/admin/billing/plans", { token }),
  adminCreatePlan: ({ token }: BillingApiContext, input: BillingPlanInput) =>
    apiFetch<BillingPlan>("/admin/billing/plans", { body: JSON.stringify(input), method: "POST", token }),
  adminUpdatePlan: ({ token }: BillingApiContext, id: string, input: Partial<BillingPlanInput>) =>
    apiFetch<BillingPlan>(`/admin/billing/plans/${id}`, { body: JSON.stringify(input), method: "PATCH", token }),
  adminListSubscriptions: ({ token }: BillingApiContext, query: AdminSubscriptionsQuery) =>
    apiFetch<Paginated<Subscription>>(`/admin/billing/subscriptions${queryString(query)}`, { token }),
  adminListOrders: ({ token }: BillingApiContext, query: AdminOrdersQuery) =>
    apiFetch<Paginated<PaymentOrder>>(`/admin/billing/orders${queryString(query)}`, { token }),
  adminGetOrder: ({ token }: BillingApiContext, id: string) =>
    apiFetch<AdminOrderDetail>(`/admin/billing/orders/${id}`, { token }),
  adminReconcileOrder: ({ token }: BillingApiContext, id: string, reason: string) =>
    apiFetch<AdminOrderDetail>(`/admin/billing/orders/${id}/reconcile`, {
      body: JSON.stringify({ reason }), method: "POST", token,
    }),
  adminMarkRefundRequired: ({ token }: BillingApiContext, id: string, reason: string) =>
    apiFetch<AdminOrderDetail>(`/admin/billing/orders/${id}/refund-required`, {
      body: JSON.stringify({ reason }), method: "POST", token,
    }),
};

export function submitCheckoutForm(checkout: CheckoutResponse["checkout"]): void {
  if (!checkout.action || checkout.method !== "POST") {
    throw new ApiError("Checkout chưa sẵn sàng để chuyển sang SePay", 0);
  }
  const form = document.createElement("form");
  form.action = checkout.action;
  form.method = "POST";
  for (const [name, value] of Object.entries(checkout.fields)) {
    const input = document.createElement("input");
    input.name = name;
    input.type = "hidden";
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
