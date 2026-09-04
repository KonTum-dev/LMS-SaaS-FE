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

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:4000/api/v1");
const API_TIMEOUT_MS = 15_000;
const API_MAX_TIMEOUT_MS = 120_000;

export function apiRequestUrl(path: string): string {
  if (!API_URL) throw new ApiError("Thiếu cấu hình NEXT_PUBLIC_API_URL", 0);
  return `${API_URL}${path}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public operationId?: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function resolveRequestTimeoutMs(timeoutMs: number | undefined): number {
  const resolved = timeoutMs ?? API_TIMEOUT_MS;
  if (
    !Number.isSafeInteger(resolved) ||
    resolved < 1_000 ||
    resolved > API_MAX_TIMEOUT_MS
  ) {
    throw new ApiError(
      "Cấu hình thời gian chờ yêu cầu không hợp lệ",
      0,
      "API_TIMEOUT_INVALID",
    );
  }
  return resolved;
}

function boundedRequestSignal(
  callerSignal?: AbortSignal,
  timeoutMs?: number,
) {
  const resolvedTimeoutMs = resolveRequestTimeoutMs(timeoutMs);
  const controller = new AbortController();
  const forwardCallerAbort = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) forwardCallerAbort();
  else
    callerSignal?.addEventListener("abort", forwardCallerAbort, { once: true });
  const timeout = setTimeout(() => {
    controller.abort(new DOMException("Request timeout", "TimeoutError"));
  }, resolvedTimeoutMs);
  return {
    cleanup: () => {
      clearTimeout(timeout);
      callerSignal?.removeEventListener("abort", forwardCallerAbort);
    },
    signal: controller.signal,
  };
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & {
    preserveSessionOnUnauthorizedCodes?: readonly string[];
    timeoutMs?: number;
    token?: string;
  } = {},
): Promise<T> {
  if (!API_URL) throw new ApiError("Thiếu cấu hình NEXT_PUBLIC_API_URL", 0);
  const {
    preserveSessionOnUnauthorizedCodes = [],
    signal: callerSignal,
    timeoutMs,
    token,
    ...request
  } = options;
  const bounded = boundedRequestSignal(callerSignal ?? undefined, timeoutMs);
  try {
    const response = await fetch(apiRequestUrl(path), {
      ...request,
      signal: bounded.signal,
      headers: {
        ...(request.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...request.headers,
      },
    });

    if (!response.ok) {
      let message = "Không thể hoàn tất yêu cầu";
      let code: string | undefined;
      let operationId: string | undefined;
      let retryAfterSeconds: number | undefined;
      try {
        const payload = (await response.json()) as {
          code?: unknown;
          message?: unknown;
          operationId?: unknown;
          retryAfterSeconds?: unknown;
        };
        message = Array.isArray(payload.message)
          ? payload.message
              .filter((item): item is string => typeof item === "string")
              .join(". ") || message
          : typeof payload.message === "string"
            ? payload.message
            : message;
        code =
          typeof payload.code === "string" &&
          /^[A-Z][A-Z0-9_]{1,63}$/.test(payload.code)
            ? payload.code
            : undefined;
        operationId =
          typeof payload.operationId === "string" &&
          /^[0-9a-f]{24}$/i.test(payload.operationId)
            ? payload.operationId.toLowerCase()
            : undefined;
        retryAfterSeconds =
          Number.isSafeInteger(payload.retryAfterSeconds) &&
          Number(payload.retryAfterSeconds) >= 1 &&
          Number(payload.retryAfterSeconds) <= 300
            ? Number(payload.retryAfterSeconds)
            : undefined;
      } catch {
        // Preserve a safe generic message when the server does not return JSON.
      }
      if (
        response.status === 401 &&
        token &&
        typeof window !== "undefined" &&
        (!code || !preserveSessionOnUnauthorizedCodes.includes(code))
      ) {
        window.dispatchEvent(
          new CustomEvent("auth:expired", { detail: { token } }),
        );
      }
      throw new ApiError(
        message,
        response.status,
        code,
        operationId,
        retryAfterSeconds,
      );
    }

    if (response.status === 204) return undefined as T;
    const body = await response.text();
    if (!body.trim()) return null as T;
    try {
      return JSON.parse(body) as T;
    } catch {
      throw new ApiError("Máy chủ trả dữ liệu không hợp lệ", response.status);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (
      bounded.signal.aborted ||
      callerSignal?.aborted ||
      (error instanceof DOMException &&
        (error.name === "AbortError" || error.name === "TimeoutError"))
    ) {
      throw new ApiError("Máy chủ phản hồi quá lâu, vui lòng thử lại", 0);
    }
    throw new ApiError("Không thể kết nối tới máy chủ", 0);
  } finally {
    bounded.cleanup();
  }
}

interface BillingApiContext {
  token: string;
}

function queryString(values: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values) as Array<
    [string, string | number | undefined]
  >) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const billingApi = {
  listPlans: ({ token }: BillingApiContext) =>
    apiFetch<BillingPlan[]>("/billing/plans", { token }),
  getSubscription: ({ token }: BillingApiContext) =>
    apiFetch<Subscription | null>("/billing/subscription", { token }),
  listOrders: ({ token }: BillingApiContext) =>
    apiFetch<PaymentOrder[]>("/billing/orders", { token }),
  getOrder: ({ token }: BillingApiContext, id: string) =>
    apiFetch<PaymentOrder>(`/billing/orders/${id}`, { token }),
  createCheckout: (
    { token }: BillingApiContext,
    input: {
      billingCycle: BillingCycle;
      idempotencyKey: string;
      planId: string;
    },
  ) =>
    apiFetch<CheckoutResponse>("/billing/checkout", {
      body: JSON.stringify({
        billingCycle: input.billingCycle,
        planId: input.planId,
      }),
      headers: { "Idempotency-Key": input.idempotencyKey },
      method: "POST",
      token,
    }),
  simulate: (
    { token }: BillingApiContext,
    id: string,
    result: "PAID" | "CANCELED",
  ) =>
    apiFetch<PaymentOrder>(`/billing/orders/${id}/mock`, {
      body: JSON.stringify({ result }),
      method: "POST",
      token,
    }),
  scheduleDowngrade: ({ token }: BillingApiContext, planId: string) =>
    apiFetch<Subscription>("/billing/downgrade", {
      body: JSON.stringify({ planId }),
      method: "POST",
      token,
    }),
  cancelScheduledDowngrade: ({ token }: BillingApiContext) =>
    apiFetch<Subscription>("/billing/downgrade", { method: "DELETE", token }),
  adminListPlans: ({ token }: BillingApiContext) =>
    apiFetch<BillingPlan[]>("/admin/billing/plans", { token }),
  adminCreatePlan: ({ token }: BillingApiContext, input: BillingPlanInput) =>
    apiFetch<BillingPlan>("/admin/billing/plans", {
      body: JSON.stringify(input),
      method: "POST",
      token,
    }),
  adminUpdatePlan: (
    { token }: BillingApiContext,
    id: string,
    input: Partial<BillingPlanInput>,
  ) =>
    apiFetch<BillingPlan>(`/admin/billing/plans/${id}`, {
      body: JSON.stringify(input),
      method: "PATCH",
      token,
    }),
  adminListSubscriptions: (
    { token }: BillingApiContext,
    query: AdminSubscriptionsQuery,
  ) =>
    apiFetch<Paginated<Subscription>>(
      `/admin/billing/subscriptions${queryString(query)}`,
      { token },
    ),
  adminListOrders: ({ token }: BillingApiContext, query: AdminOrdersQuery) =>
    apiFetch<Paginated<PaymentOrder>>(
      `/admin/billing/orders${queryString(query)}`,
      { token },
    ),
  adminGetOrder: ({ token }: BillingApiContext, id: string) =>
    apiFetch<AdminOrderDetail>(`/admin/billing/orders/${id}`, { token }),
  adminReconcileOrder: (
    { token }: BillingApiContext,
    id: string,
    reason: string,
  ) =>
    apiFetch<AdminOrderDetail>(`/admin/billing/orders/${id}/reconcile`, {
      body: JSON.stringify({ reason }),
      method: "POST",
      token,
    }),
  adminMarkRefundRequired: (
    { token }: BillingApiContext,
    id: string,
    reason: string,
  ) =>
    apiFetch<AdminOrderDetail>(`/admin/billing/orders/${id}/refund-required`, {
      body: JSON.stringify({ reason }),
      method: "POST",
      token,
    }),
};

export function submitCheckoutForm(
  checkout: CheckoutResponse["checkout"],
): void {
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
