import { describe, expect, it } from "vitest";
import { createLmsQueryClient } from "./query-client";
import { invalidateAssignmentQueries, invalidateCourseRelatedQueries } from "./query-invalidation";
import { lmsQueryKeys, type ViewerScope } from "./query-keys";

const scope: ViewerScope = { tenantId: "tenant-a", viewerId: "teacher-a" };

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
    const otherScope: ViewerScope = { tenantId: "tenant-a", viewerId: "teacher-b" };
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
    const otherScope: ViewerScope = { tenantId: "tenant-a", viewerId: "teacher-b" };
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
});
