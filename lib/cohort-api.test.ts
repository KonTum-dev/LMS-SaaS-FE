import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import {
  buildCohortQuery,
  cohortApi,
  cohortQueryKeys,
} from "@/lib/cohort-api";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

const mockedApiFetch = vi.mocked(apiFetch);
const context = { token: "tenant-token" };
const scope = {
  membershipId: "membership-1",
  role: "TENANT_ADMIN" as const,
  tenantId: "tenant-1",
  viewerId: "admin-1",
};

beforeEach(() => {
  mockedApiFetch.mockReset();
  mockedApiFetch.mockResolvedValue({});
});

describe("cohortApi", () => {
  it("chuẩn hóa query ổn định và bỏ giá trị rỗng", () => {
    expect(
      buildCohortQuery({
        courseId: " course-1 ",
        orgUnitId: " branch-1 ",
        search: " ",
        status: "ACTIVE",
      }),
    ).toBe("?courseId=course-1&orgUnitId=branch-1&status=ACTIVE");
  });

  it("đưa đầy đủ authority của người xem vào query key", () => {
    expect(cohortQueryKeys.list(scope, { search: " Lớp A " })).toEqual([
      "lms",
      "tenant-1",
      "admin-1",
      "membership-1",
      "TENANT_ADMIN",
      "cohorts",
      "list",
      [["search", "Lớp A"]],
    ]);
    expect(
      cohortQueryKeys.attendance(scope, "cohort-1", "session-1"),
    ).toEqual([
      "lms",
      "tenant-1",
      "admin-1",
      "membership-1",
      "TENANT_ADMIN",
      "cohorts",
      "cohort-1",
      "attendance",
      "session-1",
    ]);
    expect(cohortQueryKeys.learners(scope, "cohort-1")).toEqual([
      "lms",
      "tenant-1",
      "admin-1",
      "membership-1",
      "TENANT_ADMIN",
      "cohorts",
      "cohort-1",
      "learners",
      "active",
    ]);
    expect(
      cohortQueryKeys.courseLearners(scope, "cohort-1", "course-1", {
        limit: 100,
        page: 1,
        search: " Lan ",
      }),
    ).toEqual([
      "lms",
      "tenant-1",
      "admin-1",
      "membership-1",
      "TENANT_ADMIN",
      "cohorts",
      "cohort-1",
      "learners",
      "course-roster",
      "course-1",
      [
        ["limit", 100],
        ["page", 1],
        ["search", "Lan"],
      ],
    ]);
  });

  it("liệt kê lớp và truyền abort signal theo convention client", async () => {
    const signal = new AbortController().signal;
    mockedApiFetch.mockResolvedValueOnce([]);

    await cohortApi.listCohorts(
      context,
      { search: " IELTS ", status: "ACTIVE" },
      { signal },
    );

    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/cohorts?search=IELTS&status=ACTIVE",
      { cache: "no-store", signal, token: "tenant-token" },
    );
  });

  it("lấy giảng viên phù hợp theo chi nhánh của lớp", async () => {
    const signal = new AbortController().signal;

    await cohortApi.listEligibleInstructors(
      context,
      { orgUnitId: " branch-1 " },
      { signal },
    );

    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/cohorts/eligible-instructors?limit=100&orgUnitId=branch-1&page=1",
      { cache: "no-store", signal, token: "tenant-token" },
    );
  });

  it("tạo, sửa và lưu trữ lớp đúng contract", async () => {
    const createInput = {
      capacity: 24,
      code: "IELTS-K09",
      courseId: "course-1",
      instructorIds: ["instructor-1"],
      name: "IELTS buổi tối K09",
      orgUnitId: "branch-1",
      status: "SCHEDULED" as const,
    };

    await cohortApi.createCohort(context, createInput);
    await cohortApi.updateCohort(context, "cohort/one", {
      name: "IELTS K09 cập nhật",
    });
    await cohortApi.archiveCohort(context, "cohort/one");

    expect(mockedApiFetch).toHaveBeenNthCalledWith(1, "/cohorts", {
      body: JSON.stringify(createInput),
      method: "POST",
      token: "tenant-token",
    });
    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      2,
      "/cohorts/cohort%2Fone",
      {
        body: JSON.stringify({ name: "IELTS K09 cập nhật" }),
        method: "PATCH",
        token: "tenant-token",
      },
    );
    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      3,
      "/cohorts/cohort%2Fone",
      { method: "DELETE", token: "tenant-token" },
    );
  });

  it("đọc, thêm và rút học viên trong roster riêng của lớp", async () => {
    const signal = new AbortController().signal;

    await cohortApi.listLearners(context, "cohort/one", { signal });
    await cohortApi.listCourseLearners(
      context,
      "course/one",
      { limit: 100, page: 1, search: " Lan " },
      { signal },
    );
    await cohortApi.addLearners(context, "cohort/one", [
      "learner-1",
      "learner-2",
    ]);
    await cohortApi.removeLearner(
      context,
      "cohort/one",
      "learner/two",
    );

    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      1,
      "/cohorts/cohort%2Fone/learners",
      { cache: "no-store", signal, token: "tenant-token" },
    );
    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      2,
      "/enrollments/courses/course%2Fone/roster?limit=100&page=1&search=Lan",
      { cache: "no-store", signal, token: "tenant-token" },
    );
    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      3,
      "/cohorts/cohort%2Fone/learners",
      {
        body: JSON.stringify({ learnerIds: ["learner-1", "learner-2"] }),
        method: "POST",
        token: "tenant-token",
      },
    );
    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      4,
      "/cohorts/cohort%2Fone/learners/learner%2Ftwo",
      { method: "DELETE", token: "tenant-token" },
    );
  });

  it("quản lý lịch lớp với identifier đã encode", async () => {
    const input = {
      endAt: "2030-09-04T13:30:00.000Z",
      location: "Phòng 301",
      startAt: "2030-09-04T12:00:00.000Z",
    };

    await cohortApi.createSession(context, "cohort/one", input);
    await cohortApi.updateSession(
      context,
      "cohort/one",
      "session/two",
      { status: "COMPLETED" },
    );
    await cohortApi.cancelSession(
      context,
      "cohort/one",
      "session/two",
      { reason: "Giảng viên nghỉ" },
    );

    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      1,
      "/cohorts/cohort%2Fone/sessions",
      {
        body: JSON.stringify(input),
        method: "POST",
        token: "tenant-token",
      },
    );
    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      2,
      "/cohorts/cohort%2Fone/sessions/session%2Ftwo",
      {
        body: JSON.stringify({ status: "COMPLETED" }),
        method: "PATCH",
        token: "tenant-token",
      },
    );
    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      3,
      "/cohorts/cohort%2Fone/sessions/session%2Ftwo/cancel",
      {
        body: JSON.stringify({ reason: "Giảng viên nghỉ" }),
        method: "POST",
        token: "tenant-token",
      },
    );
  });

  it("đọc và bulk upsert điểm danh với no-referrer", async () => {
    const signal = new AbortController().signal;
    const records = [
      { learnerId: "learner-1", note: null, status: "PRESENT" as const },
      { learnerId: "learner-2", note: "Có báo trước", status: "EXCUSED" as const },
    ];

    await cohortApi.getAttendance(
      context,
      "cohort-1",
      "session-1",
      { signal },
    );
    await cohortApi.bulkMarkAttendance(
      context,
      "cohort-1",
      "session-1",
      records,
    );

    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      1,
      "/cohorts/cohort-1/sessions/session-1/attendance",
      {
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal,
        token: "tenant-token",
      },
    );
    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      2,
      "/cohorts/cohort-1/sessions/session-1/attendance",
      {
        body: JSON.stringify({ records }),
        method: "PUT",
        referrerPolicy: "no-referrer",
        token: "tenant-token",
      },
    );
  });
});
