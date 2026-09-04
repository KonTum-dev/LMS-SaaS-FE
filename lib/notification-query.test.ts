import { describe, expect, it } from "vitest";
import type { CurrentUser } from "./types";
import {
  getNotificationViewerScope,
  lmsQueryKeys,
  type NotificationViewerScope,
} from "./query-keys";

function tenantUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    email: "learner@example.test",
    fullName: "Nguyễn Minh An",
    membershipId: "membership-a",
    role: "LEARNER",
    sub: "learner-a",
    tenantId: "tenant-a",
    ...overrides,
  };
}

describe("notification query isolation", () => {
  it("scope chứa đủ tenant, identity, membership và role", () => {
    const scope = getNotificationViewerScope(tenantUser())!;

    expect(lmsQueryKeys.notificationsRoot(scope)).toEqual([
      "lms",
      "tenant-a",
      "learner-a",
      "membership-a",
      "LEARNER",
      "notifications",
    ]);
    expect(lmsQueryKeys.notificationsList(scope, { unreadOnly: false, limit: 20 })).toEqual([
      ...lmsQueryKeys.notificationLists(scope),
      [["limit", 20], ["unreadOnly", false]],
    ]);
  });

  it("không dùng chung inbox khi cùng user có membership hoặc role khác", () => {
    const first = getNotificationViewerScope(tenantUser())!;
    const second = getNotificationViewerScope(tenantUser({ membershipId: "membership-b" }))!;
    const instructor = getNotificationViewerScope(tenantUser({ role: "INSTRUCTOR" }))!;

    expect(lmsQueryKeys.notificationsRoot(first)).not.toEqual(lmsQueryKeys.notificationsRoot(second));
    expect(lmsQueryKeys.notificationsRoot(first)).not.toEqual(lmsQueryKeys.notificationsRoot(instructor));
  });

  it("không tạo inbox scope cho signed-out, super admin hoặc tenant session thiếu membership", () => {
    expect(getNotificationViewerScope(null)).toBeNull();
    expect(getNotificationViewerScope(tenantUser({
      membershipId: undefined,
      role: "SUPER_ADMIN",
      tenantId: undefined,
    }))).toBeNull();
    expect(getNotificationViewerScope(tenantUser({ membershipId: undefined }))).toBeNull();
    expect(getNotificationViewerScope(tenantUser({ tenantId: undefined }))).toBeNull();
  });

  it("list filters không chứa cursor nên các trang thuộc cùng một infinite query", () => {
    const scope = getNotificationViewerScope(tenantUser()) as NotificationViewerScope;
    const all = lmsQueryKeys.notificationsList(scope, { limit: 20, unreadOnly: false });
    const unread = lmsQueryKeys.notificationsList(scope, { limit: 20, unreadOnly: true });

    expect(all).not.toEqual(unread);
    expect(JSON.stringify(all)).not.toContain("cursor");
  });
});
