import { describe, expect, it } from "vitest";
import type { CurrentUser, Organization } from "./types";
import { getViewerScope, lmsQueryKeys } from "./query-keys";

const organization = { _id: "tenant-a" } as Organization;

function viewer(sub: string): CurrentUser {
  return { email: `${sub}@example.test`, fullName: sub, role: "LEARNER", sub, tenantId: "tenant-a" };
}

describe("query keys theo tenant và viewer", () => {
  it("không dùng chung cache giữa hai người xem trong cùng tenant", () => {
    const parentA = getViewerScope(viewer("parent-a"), organization)!;
    const parentB = getViewerScope(viewer("parent-b"), organization)!;

    expect(lmsQueryKeys.courses(parentA)).not.toEqual(lmsQueryKeys.courses(parentB));
    expect(lmsQueryKeys.courses(parentA)).toEqual(["lms", "tenant-a", "parent-a", "courses"]);
  });

  it("không tạo scope khi đã đăng xuất", () => {
    expect(getViewerScope(null, organization)).toBeNull();
  });

  it("dùng một prefix để mutation invalidate cả danh sách và chi tiết bài tập", () => {
    const scope = getViewerScope(viewer("teacher-a"), organization)!;
    const root = lmsQueryKeys.assignmentsRoot(scope);
    expect(lmsQueryKeys.assignments(scope).slice(0, root.length)).toEqual(root);
    expect(lmsQueryKeys.assignments(scope, "course-1").slice(0, root.length)).toEqual(root);
  });
});
