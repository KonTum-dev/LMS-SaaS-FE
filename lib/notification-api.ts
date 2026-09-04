import { apiFetch } from "@/lib/api";
import type {
  NotificationListResponse,
  NotificationReadAllResponse,
  NotificationUnreadCountResponse,
} from "@/lib/types";

export interface NotificationApiContext {
  signal?: AbortSignal;
  token: string;
}

export interface NotificationListQuery {
  cursor?: string;
  limit?: number;
  unreadOnly?: boolean;
}

function readOptions({ signal, token }: NotificationApiContext): RequestInit & { token: string } {
  return signal ? { signal, token } : { token };
}

export function buildNotificationQuery({
  cursor,
  limit = 20,
  unreadOnly = false,
}: NotificationListQuery = {}): string {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError("Notification limit phải nằm trong khoảng 1-100");
  }

  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  params.set("unreadOnly", String(unreadOnly));
  return `?${params.toString()}`;
}

export function safeNotificationActionPath(
  candidate: unknown,
  origin = typeof window === "undefined" ? "https://lms.invalid" : window.location.origin,
): string | null {
  if (
    typeof candidate !== "string"
    || !candidate.startsWith("/")
    || candidate.startsWith("//")
    || candidate.includes("\\")
    || /[\u0000-\u001f\u007f]/u.test(candidate)
    || !origin
  ) {
    return null;
  }

  try {
    const base = new URL(origin);
    if (base.protocol !== "http:" && base.protocol !== "https:") return null;
    const resolved = new URL(candidate, base);
    if (resolved.origin !== base.origin) return null;
    const canonical = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    return canonical === candidate ? candidate : null;
  } catch {
    return null;
  }
}

export const notificationApi = {
  list: (context: NotificationApiContext, query: NotificationListQuery = {}) =>
    apiFetch<NotificationListResponse>(
      `/notifications${buildNotificationQuery(query)}`,
      readOptions(context),
    ),
  getUnreadCount: (context: NotificationApiContext) =>
    apiFetch<NotificationUnreadCountResponse>(
      "/notifications/unread-count",
      readOptions(context),
    ),
  markRead: ({ token }: NotificationApiContext, notificationId: string) =>
    apiFetch<void>(`/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: "PATCH",
      token,
    }),
  markAllRead: ({ token }: NotificationApiContext) =>
    apiFetch<NotificationReadAllResponse>("/notifications/read-all", {
      method: "POST",
      token,
    }),
};
