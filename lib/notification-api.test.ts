import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildNotificationQuery,
  notificationApi,
  safeNotificationActionPath,
} from "./notification-api";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));

describe("notificationApi contract", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockResolvedValue(undefined);
  });

  it("gửi cursor opaque, limit và unreadOnly qua đúng list route", async () => {
    const controller = new AbortController();
    await notificationApi.list(
      { signal: controller.signal, token: "tenant-token" },
      { cursor: "v1_opaque-cursor", limit: 40, unreadOnly: true },
    );

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/notifications?limit=40&cursor=v1_opaque-cursor&unreadOnly=true",
      { signal: controller.signal, token: "tenant-token" },
    );
  });

  it("dùng defaults công khai và chặn limit ngoài contract", () => {
    expect(buildNotificationQuery()).toBe("?limit=20&unreadOnly=false");
    expect(() => buildNotificationQuery({ limit: 0 })).toThrow(RangeError);
    expect(() => buildNotificationQuery({ limit: 101 })).toThrow(RangeError);
    expect(() => buildNotificationQuery({ limit: 1.5 })).toThrow(RangeError);
  });

  it("gọi unread, mark-one và read-all bằng bearer nhưng không đưa scope vào URL", async () => {
    await notificationApi.getUnreadCount({ token: "tenant-token" });
    await notificationApi.markRead({ token: "tenant-token" }, "notice/one");
    await notificationApi.markAllRead({ token: "tenant-token" });

    expect(mocks.apiFetch.mock.calls).toEqual([
      ["/notifications/unread-count", { token: "tenant-token" }],
      ["/notifications/notice%2Fone/read", { method: "PATCH", token: "tenant-token" }],
      ["/notifications/read-all", { method: "POST", token: "tenant-token" }],
    ]);
  });
});

describe("safeNotificationActionPath", () => {
  const origin = "https://lms.example.test";

  it.each([
    "/courses/course-1",
    "/assignments/assignment-1?tab=result#feedback",
  ])("cho phép đường dẫn nội bộ canonical %s", (path) => {
    expect(safeNotificationActionPath(path, origin)).toBe(path);
  });

  it.each([
    "https://attacker.example/courses/1",
    "//attacker.example/courses/1",
    "/\\attacker.example/courses/1",
    "javascript:alert(1)",
    " /courses/course-1",
    "/courses/../admin/tenants",
    "/courses/course-1\nmalformed",
    null,
  ])("từ chối URL ngoài origin hoặc không canonical %#", (path) => {
    expect(safeNotificationActionPath(path, origin)).toBeNull();
  });
});
