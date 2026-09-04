import { describe, expect, it } from "vitest";
import type { CurrentUser, Organization } from "./types";
import {
  getViewerScope,
  lmsQueryKeys,
  normalizeQueryFilters,
} from "./query-keys";

const organization = { _id: "tenant-a" } as Organization;

function viewer(sub: string): CurrentUser {
  return {
    email: `${sub}@example.test`,
    fullName: sub,
    membershipId: `membership-${sub}`,
    role: "LEARNER",
    sub,
    tenantId: "tenant-a",
  };
}

describe("query keys theo tenant và viewer", () => {
  it("không dùng chung cache giữa hai người xem trong cùng tenant", () => {
    const parentA = getViewerScope(viewer("parent-a"), organization)!;
    const parentB = getViewerScope(viewer("parent-b"), organization)!;

    expect(lmsQueryKeys.courses(parentA)).not.toEqual(
      lmsQueryKeys.courses(parentB),
    );
    expect(lmsQueryKeys.courses(parentA)).toEqual([
      "lms",
      "tenant-a",
      "parent-a",
      "membership-parent-a",
      "LEARNER",
      "courses",
    ]);
  });

  it("không tạo scope khi đã đăng xuất", () => {
    expect(getViewerScope(null, organization)).toBeNull();
  });

  it("dùng một prefix để mutation invalidate cả danh sách và chi tiết bài tập", () => {
    const scope = getViewerScope(viewer("teacher-a"), organization)!;
    const root = lmsQueryKeys.assignmentsRoot(scope);
    expect(lmsQueryKeys.assignments(scope).slice(0, root.length)).toEqual(root);
    expect(
      lmsQueryKeys.assignments(scope, "course-1").slice(0, root.length),
    ).toEqual(root);
  });

  it("đặt invitations dưới users nhưng vẫn cô lập tenant và viewer", () => {
    const scope = getViewerScope(viewer("owner-a"), organization)!;
    expect(lmsQueryKeys.invitations(scope)).toEqual([
      "lms",
      "tenant-a",
      "owner-a",
      "membership-owner-a",
      "LEARNER",
      "users",
      "invitations",
    ]);
    expect(
      lmsQueryKeys
        .invitations(scope)
        .slice(0, lmsQueryKeys.users(scope).length),
    ).toEqual(lmsQueryKeys.users(scope));
  });

  it("cô lập cache billing theo tenant/viewer và gom order dưới billing root", () => {
    const scopeA = getViewerScope(viewer("owner-a"), organization)!;
    const scopeB = getViewerScope(
      { ...viewer("owner-b"), tenantId: "tenant-b" },
      { ...organization, _id: "tenant-b" },
    )!;

    expect(lmsQueryKeys.billingOrders(scopeA)).not.toEqual(
      lmsQueryKeys.billingOrders(scopeB),
    );
    expect(
      lmsQueryKeys
        .billingOrder(scopeA, "order-1")
        .slice(0, lmsQueryKeys.billing(scopeA).length),
    ).toEqual(lmsQueryKeys.billing(scopeA));
    expect(
      lmsQueryKeys
        .adminSubscriptions(scopeA)
        .slice(0, lmsQueryKeys.adminBilling(scopeA).length),
    ).toEqual(lmsQueryKeys.adminBilling(scopeA));
  });

  it("tách cache thành viên khi super admin chuyển giữa các tenant", () => {
    const platformScope = {
      membershipId: "platform",
      role: "SUPER_ADMIN" as const,
      tenantId: "platform",
      viewerId: "platform-admin",
    };

    expect(lmsQueryKeys.tenantUsers(platformScope, "tenant-a")).toEqual([
      "lms",
      "platform",
      "platform-admin",
      "platform",
      "SUPER_ADMIN",
      "organizations",
      "tenant-a",
      "users",
    ]);
    expect(lmsQueryKeys.tenantUsers(platformScope, "tenant-a")).not.toEqual(
      lmsQueryKeys.tenantUsers(platformScope, "tenant-b"),
    );
  });

  it("cô lập notification operations theo platform actor và normalize bộ lọc", () => {
    const scopeA = {
      membershipId: "platform",
      role: "SUPER_ADMIN" as const,
      tenantId: "platform",
      viewerId: "platform-admin-a",
    };
    const scopeB = { ...scopeA, viewerId: "platform-admin-b" };
    const filters = {
      limit: 20,
      page: 1,
      tenantId: "64b000000000000000000002",
      type: "ASSIGNMENT_PUBLISHED" as const,
    };

    expect(lmsQueryKeys.adminNotificationEvents(scopeA, filters)).not.toEqual(
      lmsQueryKeys.adminNotificationEvents(scopeB, filters),
    );
    expect(
      lmsQueryKeys
        .adminNotificationEvents(scopeA, filters)
        .slice(0, lmsQueryKeys.adminNotificationEventsRoot(scopeA).length),
    ).toEqual(lmsQueryKeys.adminNotificationEventsRoot(scopeA));
    expect(lmsQueryKeys.adminNotificationEvents(scopeA, filters).at(-1)).toEqual([
      ["limit", 20],
      ["page", 1],
      ["tenantId", "64b000000000000000000002"],
      ["type", "ASSIGNMENT_PUBLISHED"],
    ]);
  });

  it("scope roster và directory theo course, viewer, trang và tìm kiếm", () => {
    const scope = getViewerScope(viewer("teacher-a"), organization)!;
    const first = { limit: 20, page: 1 };
    const searched = { limit: 20, page: 1, search: "Lan" };

    expect(lmsQueryKeys.courseRoster(scope, "course-1", first)).not.toEqual(
      lmsQueryKeys.courseRoster(scope, "course-2", first),
    );
    expect(lmsQueryKeys.courseRoster(scope, "course-1", first)).not.toEqual(
      lmsQueryKeys.courseRoster(scope, "course-1", searched),
    );
    expect(
      lmsQueryKeys
        .eligibleLearners(scope, "course-1", first)
        .slice(0, lmsQueryKeys.courseEnrollmentRoot(scope, "course-1").length),
    ).toEqual(lmsQueryKeys.courseEnrollmentRoot(scope, "course-1"));
  });

  it("canonicalize filter key, khoảng trắng và field rỗng mà không làm mất false/null/0", () => {
    expect(
      normalizeQueryFilters({
        archived: false,
        empty: "   ",
        ignored: undefined,
        page: 0,
        search: "  Lan  ",
        status: null,
      }),
    ).toEqual([
      ["archived", false],
      ["page", 0],
      ["search", "Lan"],
      ["status", null],
    ]);
  });

  it("grading list không collision vì thứ tự filter và vẫn tách list/detail", () => {
    const scope = getViewerScope(viewer("teacher-a"), organization)!;
    const first = lmsQueryKeys.gradingList(scope, { page: 1, search: " Lan " });
    const reordered = lmsQueryKeys.gradingList(scope, {
      search: "Lan",
      page: 1,
      unused: undefined,
    });

    expect(first).toEqual(reordered);
    expect(first).not.toEqual(
      lmsQueryKeys.gradingList(scope, { page: 2, search: "Lan" }),
    );
    expect(first).not.toEqual(lmsQueryKeys.gradingDetail(scope, "list"));
  });

  it("submission/result/report keys có prefix riêng và cô lập tenant-viewer-course", () => {
    const scope = getViewerScope(viewer("learner-a"), organization)!;
    const otherViewer = getViewerScope(viewer("learner-b"), organization)!;

    expect(
      lmsQueryKeys
        .myResult(scope, "assignment-1")
        .slice(0, lmsQueryKeys.mySubmission(scope, "assignment-1").length),
    ).toEqual(lmsQueryKeys.mySubmission(scope, "assignment-1"));
    expect(lmsQueryKeys.mySubmission(scope, "assignment-1")).not.toEqual(
      lmsQueryKeys.mySubmission(otherViewer, "assignment-1"),
    );
    expect(
      lmsQueryKeys.courseReport(scope, "course-1", { search: "Lan" }),
    ).not.toEqual(
      lmsQueryKeys.courseReport(scope, "course-2", { search: "Lan" }),
    );
    expect(
      lmsQueryKeys.courseReport(scope, "course-1", { search: " Lan " }),
    ).toEqual(lmsQueryKeys.courseReport(scope, "course-1", { search: "Lan" }));
  });

  it("media metadata keys luôn nằm dưới tenant, viewer, membership và exact target", () => {
    const scope = getViewerScope(viewer("learner-a"), organization)!;
    const otherMembership = getViewerScope(
      {
        ...viewer("learner-a"),
        membershipId: "membership-reissued",
      },
      organization,
    )!;

    expect(
      lmsQueryKeys.lessonAsset(scope, "course-1", "lesson-1", "asset-1"),
    ).toEqual([
      "lms",
      "tenant-a",
      "learner-a",
      "membership-learner-a",
      "LEARNER",
      "courses",
      "course-1",
      "curriculum",
      "lessons",
      "lesson-1",
      "assets",
      "asset-1",
    ]);
    expect(
      lmsQueryKeys
        .mySubmissionAsset(scope, "assignment-1", "asset-1")
        .slice(0, lmsQueryKeys.mySubmission(scope, "assignment-1").length),
    ).toEqual(lmsQueryKeys.mySubmission(scope, "assignment-1"));
    expect(
      lmsQueryKeys.gradingAsset(scope, "submission-1", "asset-1"),
    ).not.toEqual(lmsQueryKeys.gradingAsset(scope, "submission-2", "asset-1"));
    expect(
      lmsQueryKeys.mySubmissionAsset(scope, "assignment-1", "asset-1"),
    ).not.toEqual(
      lmsQueryKeys.mySubmissionAsset(
        otherMembership,
        "assignment-1",
        "asset-1",
      ),
    );
  });

  it("tách assignment detail khỏi list/filter key", () => {
    const scope = getViewerScope(viewer("learner-a"), organization)!;
    expect(lmsQueryKeys.assignmentDetail(scope, "assignment-1")).toEqual([
      "lms",
      "tenant-a",
      "learner-a",
      "membership-learner-a",
      "LEARNER",
      "assignments",
      "detail",
      "assignment-1",
    ]);
    expect(lmsQueryKeys.assignmentDetail(scope, "all")).not.toEqual(
      lmsQueryKeys.assignments(scope),
    );
  });

  it("tách cache assessment learner, authoring, attempt, result và manager report", () => {
    const scope = getViewerScope(viewer("learner-a"), organization)!;
    const keys = [
      lmsQueryKeys.assessmentList(scope, { page: 1, status: "PUBLISHED" }),
      lmsQueryKeys.assessmentLearnerDetail(scope, "assessment-1"),
      lmsQueryKeys.assessmentAuthoring(scope, "assessment-1"),
      lmsQueryKeys.assessmentAttempt(scope, "attempt-1"),
      lmsQueryKeys.assessmentResult(scope, "attempt-1"),
      lmsQueryKeys.assessmentReport(scope, { page: 1 }),
    ];

    expect(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(
      keys.length,
    );
    expect(
      lmsQueryKeys.assessmentList(scope, { page: 1, status: " PUBLISHED " }),
    ).toEqual(
      lmsQueryKeys.assessmentList(scope, { status: "PUBLISHED", page: 1 }),
    );
    expect(
      lmsQueryKeys
        .assessmentAuthoring(scope, "assessment-1")
        .slice(0, lmsQueryKeys.assessmentAuthoringRoot(scope).length),
    ).toEqual(lmsQueryKeys.assessmentAuthoringRoot(scope));
  });

  it("không dùng lại cache khi cùng identity đổi vai trò trong tenant", () => {
    const learner = getViewerScope(viewer("same-user"), organization)!;
    const instructor = getViewerScope(
      { ...viewer("same-user"), role: "INSTRUCTOR" },
      organization,
    )!;

    expect(lmsQueryKeys.assignments(learner)).not.toEqual(
      lmsQueryKeys.assignments(instructor),
    );
    expect(lmsQueryKeys.courses(learner)).not.toEqual(
      lmsQueryKeys.courses(instructor),
    );
  });

  it("tách cache khi cùng user và tenant đổi membership", () => {
    const first = getViewerScope(viewer("same-user"), organization)!;
    const second = getViewerScope(
      {
        ...viewer("same-user"),
        membershipId: "membership-reissued",
      },
      organization,
    )!;

    expect(lmsQueryKeys.viewer(first)).not.toEqual(lmsQueryKeys.viewer(second));
  });

  it("fail closed khi tenant role thiếu authority hoặc organization lệch tenant", () => {
    expect(
      getViewerScope(
        { ...viewer("learner-a"), membershipId: undefined },
        organization,
      ),
    ).toBeNull();
    expect(
      getViewerScope(
        { ...viewer("learner-a"), tenantId: undefined },
        organization,
      ),
    ).toBeNull();
    expect(
      getViewerScope(viewer("learner-a"), { ...organization, _id: "tenant-b" }),
    ).toBeNull();
  });

  it("dùng sentinel platform tường minh cho SUPER_ADMIN", () => {
    expect(
      getViewerScope(
        {
          email: "root@example.test",
          fullName: "Root",
          role: "SUPER_ADMIN",
          sub: "root-user",
        },
        organization,
      ),
    ).toEqual({
      membershipId: "platform",
      role: "SUPER_ADMIN",
      tenantId: "platform",
      viewerId: "root-user",
    });
  });
});
