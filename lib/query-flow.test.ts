import { describe, expect, it } from "vitest";
import { createLmsQueryClient } from "./query-client";
import {
  invalidateAssignmentQueries,
  invalidateCourseEnrollmentQueries,
  invalidateCourseRelatedQueries,
  invalidateGradingSubmissionQueries,
  invalidateLearnerSubmissionQueries,
} from "./query-invalidation";
import { lmsQueryKeys, type ViewerScope } from "./query-keys";

const scope: ViewerScope = { membershipId: "membership-teacher-a", role: "INSTRUCTOR", tenantId: "tenant-a", viewerId: "teacher-a" };

describe("server-state flow của Web", () => {
  it("chuyển qua loading, empty rồi data trên query production key", async () => {
    const queryClient = createLmsQueryClient();
    let resolve!: (value: Array<{ id: string }>) => void;
    const response = new Promise<Array<{ id: string }>>((done) => { resolve = done; });
    const key = lmsQueryKeys.assignments(scope);

    const request = queryClient.fetchQuery({ queryKey: key, queryFn: () => response });
    expect(queryClient.getQueryState(key)?.status).toBe("pending");

    resolve([]);
    await expect(request).resolves.toEqual([]);
    expect(queryClient.getQueryData(key)).toEqual([]);

    queryClient.setQueryData(key, [{ id: "assignment-1" }]);
    expect(queryClient.getQueryData(key)).toEqual([{ id: "assignment-1" }]);
  });

  it("mutation invalidates cả list và course detail nhưng không chạm viewer khác", async () => {
    const queryClient = createLmsQueryClient();
    const otherScope: ViewerScope = { membershipId: "membership-teacher-b", role: "INSTRUCTOR", tenantId: "tenant-a", viewerId: "teacher-b" };
    const allKey = lmsQueryKeys.assignments(scope);
    const courseKey = lmsQueryKeys.assignments(scope, "course-1");
    const otherKey = lmsQueryKeys.assignments(otherScope);
    queryClient.setQueryData(allKey, []);
    queryClient.setQueryData(courseKey, []);
    queryClient.setQueryData(otherKey, []);

    await invalidateAssignmentQueries(queryClient, scope);

    expect(queryClient.getQueryState(allKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(courseKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);
  });

  it("course mutation invalidates list, detail, dashboard, assignments và enrollments đúng scope", async () => {
    const queryClient = createLmsQueryClient();
    const otherScope: ViewerScope = { membershipId: "membership-teacher-b", role: "INSTRUCTOR", tenantId: "tenant-a", viewerId: "teacher-b" };
    const keys = [
      lmsQueryKeys.courses(scope),
      lmsQueryKeys.course(scope, "course-1"),
      lmsQueryKeys.dashboard(scope),
      lmsQueryKeys.assignments(scope),
      lmsQueryKeys.assignments(scope, "course-1"),
      lmsQueryKeys.enrollments(scope),
    ];
    const untouched = lmsQueryKeys.course(otherScope, "course-1");
    keys.forEach((key) => queryClient.setQueryData(key, {}));
    queryClient.setQueryData(untouched, {});

    await invalidateCourseRelatedQueries(queryClient, scope);

    keys.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(untouched)?.isInvalidated).toBe(false);
  });

  it("enrollment mutation chỉ invalidates roster/directory của đúng course và viewer", async () => {
    const queryClient = createLmsQueryClient();
    const otherScope: ViewerScope = { membershipId: "membership-teacher-b", role: "INSTRUCTOR", tenantId: "tenant-a", viewerId: "teacher-b" };
    const directory = { limit: 20, page: 1 };
    const affected = [
      lmsQueryKeys.courseRoster(scope, "course-1", directory),
      lmsQueryKeys.eligibleLearners(scope, "course-1", directory),
      lmsQueryKeys.courseLearnerProgress(scope, "course-1", directory),
    ];
    const untouched = [
      lmsQueryKeys.courseRoster(scope, "course-2", directory),
      lmsQueryKeys.eligibleLearners(otherScope, "course-1", directory),
    ];
    [...affected, ...untouched].forEach((key) => queryClient.setQueryData(key, {}));

    await invalidateCourseEnrollmentQueries(queryClient, scope, "course-1");

    affected.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    untouched.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false));
  });

  it("submission/grading/report roots invalidates đúng family và không chạm viewer khác", async () => {
    const queryClient = createLmsQueryClient();
    const otherScope: ViewerScope = { membershipId: "membership-teacher-b", role: "INSTRUCTOR", tenantId: "tenant-a", viewerId: "teacher-b" };
    const submissionFamily = [
      lmsQueryKeys.mySubmission(scope, "assignment-1"),
      lmsQueryKeys.myResult(scope, "assignment-1"),
      lmsQueryKeys.gradingList(scope, { page: 1 }),
      lmsQueryKeys.gradingDetail(scope, "submission-1"),
    ];
    const report = lmsQueryKeys.courseReport(scope, "course-1", { page: 1 });
    const otherViewer = lmsQueryKeys.gradingList(otherScope, { page: 1 });
    [...submissionFamily, report, otherViewer].forEach((key) => queryClient.setQueryData(key, {}));

    await queryClient.invalidateQueries({ queryKey: lmsQueryKeys.submissionsRoot(scope) });

    submissionFamily.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(report)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(otherViewer)?.isInvalidated).toBe(false);

    await queryClient.invalidateQueries({ queryKey: lmsQueryKeys.reportsRoot(scope) });
    expect(queryClient.getQueryState(report)?.isInvalidated).toBe(true);
  });

  it("learner submission mutation invalidates đúng assignment và viewer", async () => {
    const queryClient = createLmsQueryClient();
    const otherScope: ViewerScope = { membershipId: "membership-learner-b", role: "LEARNER", tenantId: "tenant-a", viewerId: "learner-b" };
    const affected = [
      lmsQueryKeys.mySubmission(scope, "assignment-1"),
      lmsQueryKeys.myResult(scope, "assignment-1"),
    ];
    const untouched = [
      lmsQueryKeys.mySubmission(scope, "assignment-2"),
      lmsQueryKeys.myResult(otherScope, "assignment-1"),
    ];
    [...affected, ...untouched].forEach((key) => queryClient.setQueryData(key, {}));

    await invalidateLearnerSubmissionQueries(queryClient, scope, "assignment-1");

    affected.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    untouched.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false));
  });

  it("grading mutation invalidates queue/detail và report đúng course, không chạm viewer/course khác", async () => {
    const queryClient = createLmsQueryClient();
    const otherScope: ViewerScope = { membershipId: "membership-teacher-b", role: "INSTRUCTOR", tenantId: "tenant-a", viewerId: "teacher-b" };
    const affected = [
      lmsQueryKeys.gradingList(scope, { page: 1, status: "SUBMITTED" }),
      lmsQueryKeys.gradingDetail(scope, "submission-1"),
      lmsQueryKeys.courseReport(scope, "course-1"),
    ];
    const untouched = [
      lmsQueryKeys.courseReport(scope, "course-2"),
      lmsQueryKeys.gradingList(otherScope, { page: 1, status: "SUBMITTED" }),
      lmsQueryKeys.courseReport(otherScope, "course-1"),
    ];
    [...affected, ...untouched].forEach((key) => queryClient.setQueryData(key, {}));

    await invalidateGradingSubmissionQueries(queryClient, scope, "course-1");

    affected.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    untouched.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false));
  });
});
