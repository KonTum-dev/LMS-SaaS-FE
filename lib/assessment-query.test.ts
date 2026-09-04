import { describe, expect, it } from "vitest";
import { createLmsQueryClient } from "./query-client";
import {
  invalidateAssessmentAttemptCompletionQueries,
  invalidateAssessmentAuthoringQueries,
  invalidateAssessmentListQueries,
} from "./query-invalidation";
import { lmsQueryKeys, type ViewerScope } from "./query-keys";

const manager: ViewerScope = {
  membershipId: "membership-manager",
  role: "INSTRUCTOR",
  tenantId: "tenant-a",
  viewerId: "user-a",
};
const learner: ViewerScope = {
  membershipId: "membership-learner",
  role: "LEARNER",
  tenantId: "tenant-a",
  viewerId: "user-a",
};

describe("assessment query cache contract", () => {
  it("authoring/private và learner-safe payload không thể collision", () => {
    expect(lmsQueryKeys.assessmentAuthoring(manager, "assessment-1")).not.toEqual(
      lmsQueryKeys.assessmentLearnerDetail(manager, "assessment-1"),
    );
    expect(lmsQueryKeys.assessmentLearnerDetail(manager, "assessment-1")).not.toEqual(
      lmsQueryKeys.assessmentLearnerDetail(learner, "assessment-1"),
    );
  });

  it("list invalidation không chạm detail/attempt/report", async () => {
    const queryClient = createLmsQueryClient();
    const affected = [
      lmsQueryKeys.assessmentList(manager, { page: 1 }),
      lmsQueryKeys.assessmentList(manager, { page: 2, status: "DRAFT" }),
    ];
    const untouched = [
      lmsQueryKeys.assessmentAuthoring(manager, "assessment-1"),
      lmsQueryKeys.assessmentAttempt(manager, "attempt-1"),
      lmsQueryKeys.assessmentReport(manager, { page: 1 }),
    ];
    [...affected, ...untouched].forEach((key) => queryClient.setQueryData(key, {}));
    await invalidateAssessmentListQueries(queryClient, manager);
    affected.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    untouched.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false));
  });

  it("author lifecycle invalidates lists và exact aggregate/detail, không chạm attempt/report", async () => {
    const queryClient = createLmsQueryClient();
    const affected = [
      lmsQueryKeys.assessmentList(manager, { page: 1 }),
      lmsQueryKeys.assessmentAuthoring(manager, "assessment-1"),
      lmsQueryKeys.assessmentLearnerDetail(manager, "assessment-1"),
    ];
    const untouched = [
      lmsQueryKeys.assessmentAuthoring(manager, "assessment-2"),
      lmsQueryKeys.assessmentAttempt(manager, "attempt-1"),
      lmsQueryKeys.assessmentReport(manager, { page: 1 }),
      lmsQueryKeys.assessmentAuthoring(learner, "assessment-1"),
    ];
    [...affected, ...untouched].forEach((key) => queryClient.setQueryData(key, {}));
    await invalidateAssessmentAuthoringQueries(queryClient, manager, "assessment-1");
    affected.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    untouched.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false));
  });

  it("submit invalidates exact attempt/result/metadata, không quét toàn assessment family", async () => {
    const queryClient = createLmsQueryClient();
    const affected = [
      lmsQueryKeys.assessmentAttempt(learner, "attempt-1"),
      lmsQueryKeys.assessmentResult(learner, "attempt-1"),
      lmsQueryKeys.assessmentLearnerDetail(learner, "assessment-1"),
    ];
    const untouched = [
      lmsQueryKeys.assessmentAttempt(learner, "attempt-2"),
      lmsQueryKeys.assessmentResult(learner, "attempt-2"),
      lmsQueryKeys.assessmentLearnerDetail(learner, "assessment-2"),
      lmsQueryKeys.assessmentList(learner, { page: 1 }),
    ];
    [...affected, ...untouched].forEach((key) => queryClient.setQueryData(key, {}));
    await invalidateAssessmentAttemptCompletionQueries(
      queryClient,
      learner,
      "assessment-1",
      "attempt-1",
    );
    affected.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    untouched.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false));
  });
});
