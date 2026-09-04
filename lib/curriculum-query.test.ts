import { describe, expect, it } from "vitest";
import { createLmsQueryClient } from "./query-client";
import {
  invalidateCourseEnrollmentQueries,
  invalidateCurriculumQueries,
  invalidateLessonProgressQueries,
} from "./query-invalidation";
import { lmsQueryKeys, type ViewerScope } from "./query-keys";

const instructorScope: ViewerScope = {
  membershipId: "membership-user-a",
  role: "INSTRUCTOR",
  tenantId: "tenant-a",
  viewerId: "user-a",
};
const learnerScope: ViewerScope = {
  membershipId: "membership-user-a",
  role: "LEARNER",
  tenantId: "tenant-a",
  viewerId: "user-a",
};

describe("curriculum query cache contract", () => {
  it("cô lập cùng identity theo role và canonicalize filters", () => {
    expect(lmsQueryKeys.curriculumTree(instructorScope, "course-1")).not.toEqual(
      lmsQueryKeys.curriculumTree(learnerScope, "course-1"),
    );
    expect(lmsQueryKeys.curriculumTree(instructorScope, "course-1", {
      includeArchived: true,
      search: "  Chương  ",
    })).toEqual(lmsQueryKeys.curriculumTree(instructorScope, "course-1", {
      search: "Chương",
      includeArchived: true,
    }));
    expect(lmsQueryKeys.courseLearnerProgress(instructorScope, "course-1", { page: 1 }))
      .not.toEqual(lmsQueryKeys.courseLearnerProgress({
        ...instructorScope,
        tenantId: "tenant-b",
      }, "course-1", { page: 1 }));
    expect(lmsQueryKeys.courseLearnerProgress(instructorScope, "course-1", { page: 1 }))
      .not.toEqual(lmsQueryKeys.courseLearnerProgress({
        ...instructorScope,
        viewerId: "user-b",
      }, "course-1", { page: 1 }));
  });

  it("gom tree, lesson và progress dưới đúng course curriculum root", () => {
    const root = lmsQueryKeys.curriculumRoot(instructorScope, "course-1");
    const keys = [
      lmsQueryKeys.curriculumTree(instructorScope, "course-1"),
      lmsQueryKeys.lesson(instructorScope, "course-1", "lesson-1"),
      lmsQueryKeys.myCourseProgress(instructorScope, "course-1"),
      lmsQueryKeys.courseLearnerProgress(instructorScope, "course-1", { page: 1 }),
    ];
    keys.forEach((key) => expect(key.slice(0, root.length)).toEqual(root));
    expect(lmsQueryKeys.curriculumRoot(instructorScope, "course-2")).not.toEqual(root);
  });

  it("curriculum mutation invalidates cả tree/detail/progress và course, chỉ đúng viewer/course", async () => {
    const queryClient = createLmsQueryClient();
    const affected = [
      lmsQueryKeys.curriculumTree(instructorScope, "course-1"),
      lmsQueryKeys.curriculumTree(instructorScope, "course-1", { includeArchived: true }),
      lmsQueryKeys.lesson(instructorScope, "course-1", "lesson-1"),
      lmsQueryKeys.courseLearnerProgress(instructorScope, "course-1", { page: 1 }),
      lmsQueryKeys.course(instructorScope, "course-1"),
    ];
    const untouched = [
      lmsQueryKeys.curriculumTree(instructorScope, "course-2"),
      lmsQueryKeys.curriculumTree(learnerScope, "course-1"),
    ];
    [...affected, ...untouched].forEach((key) => queryClient.setQueryData(key, {}));

    await invalidateCurriculumQueries(queryClient, instructorScope, "course-1");

    affected.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    untouched.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false));
  });

  it("completion invalidates mọi tree filter, đúng lesson và my-progress", async () => {
    const queryClient = createLmsQueryClient();
    const affected = [
      lmsQueryKeys.curriculumTree(learnerScope, "course-1"),
      lmsQueryKeys.curriculumTree(learnerScope, "course-1", { includeArchived: true }),
      lmsQueryKeys.lesson(learnerScope, "course-1", "lesson-1"),
      lmsQueryKeys.myCourseProgress(learnerScope, "course-1"),
    ];
    const untouched = [
      lmsQueryKeys.lesson(learnerScope, "course-1", "lesson-2"),
      lmsQueryKeys.lesson(learnerScope, "course-2", "lesson-1"),
      lmsQueryKeys.lesson(instructorScope, "course-1", "lesson-1"),
    ];
    [...affected, ...untouched].forEach((key) => queryClient.setQueryData(key, {}));

    await invalidateLessonProgressQueries(queryClient, learnerScope, "course-1", "lesson-1");

    affected.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    untouched.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false));
  });

  it("enrollment mutation invalidates mọi trang learner-progress đúng course/scope", async () => {
    const queryClient = createLmsQueryClient();
    const affected = [
      lmsQueryKeys.courseLearnerProgress(instructorScope, "course-1", { limit: 20, page: 1 }),
      lmsQueryKeys.courseLearnerProgress(instructorScope, "course-1", {
        limit: 20,
        page: 2,
        search: "Lan",
      }),
    ];
    const untouched = [
      lmsQueryKeys.courseLearnerProgress(instructorScope, "course-2", { page: 1 }),
      lmsQueryKeys.courseLearnerProgress({
        ...instructorScope,
        viewerId: "user-b",
      }, "course-1", { page: 1 }),
    ];
    [...affected, ...untouched].forEach((key) => queryClient.setQueryData(key, {}));

    await invalidateCourseEnrollmentQueries(queryClient, instructorScope, "course-1");

    affected.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    untouched.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false));
  });
});
