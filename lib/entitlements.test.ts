import { describe, expect, it } from "vitest";
import {
  effectiveModuleEnabled,
  entitlementSummary,
  formatEntitlementLimit,
  getSubscriptionAccessPresentation,
  includeLmsModulePrerequisites,
  normalizeEffectiveModules,
} from "./entitlements";
import type { EffectiveAccess } from "./types";

const access: EffectiveAccess = {
  graceEndsAt: null,
  limits: {
    maxActiveLearners: 200,
    maxBranches: null,
    maxCourses: 25,
    maxUsers: null,
  },
  modules: ["COURSES", "ASSIGNMENTS"],
  readOnly: false,
  state: "ACTIVE",
};

describe("billing entitlements presentation", () => {
  it("phân biệt quota hữu hạn và không giới hạn", () => {
    expect(formatEntitlementLimit(null, "users")).toBe("Không giới hạn người dùng");
    expect(formatEntitlementLimit(2500, "courses")).toBe("Tối đa 2.500 khóa học");
    expect(formatEntitlementLimit(null, "branches")).toBe(
      "Không giới hạn chi nhánh hoạt động",
    );
    expect(formatEntitlementLimit(2500, "activeLearners")).toBe(
      "Tối đa 2.500 học viên hoạt động",
    );
  });

  it("hiển thị module và quota có cấu trúc", () => {
    expect(entitlementSummary({
      maxActiveLearners: 200,
      maxBranches: null,
      maxCourses: 25,
      maxUsers: null,
      modules: ["COURSES", "ASSIGNMENTS"],
    })).toEqual([
      "Khóa học, Bài tập",
      "Không giới hạn người dùng",
      "Tối đa 25 khóa học",
      "Không giới hạn chi nhánh hoạt động",
      "Tối đa 200 học viên hoạt động",
    ]);
  });

  it.each([
    ["ACTIVE", "Đang hoạt động"],
    ["GRACE", "Thời gian gia hạn"],
    ["READ_ONLY", "Chỉ đọc"],
  ] as const)("có nhãn tiếng Việt cho %s", (state, label) => {
    expect(getSubscriptionAccessPresentation(state).label).toBe(label);
  });

  it("chỉ tin danh sách module hiệu lực từ backend", () => {
    expect(effectiveModuleEnabled(access, "COURSES")).toBe(true);
    expect(effectiveModuleEnabled(access, "USERS")).toBe(false);
    expect(effectiveModuleEnabled(null, "COURSES")).toBe(false);
  });

  it("tự thêm Khóa học cho module phụ thuộc trong form quản trị", () => {
    expect(includeLmsModulePrerequisites([
      "USERS",
      "ASSIGNMENTS",
      "ASSESSMENTS",
      "MEDIA",
    ])).toEqual([
      "USERS",
      "COURSES",
      "ENROLLMENTS",
      "ASSIGNMENTS",
      "ASSESSMENTS",
      "MEDIA",
    ]);
    expect(includeLmsModulePrerequisites(["ENROLLMENTS"])).toEqual([
      "COURSES", "ENROLLMENTS",
    ]);
  });

  it("tự đóng đủ dependency cho vận hành lớp, phụ huynh, học phí và chi nhánh", () => {
    expect(
      includeLmsModulePrerequisites([
        "COHORTS",
        "GUARDIANS",
        "TUITION",
        "ORGANIZATION_STRUCTURE",
        "REPORTS",
        "COMMUNICATIONS",
      ]),
    ).toEqual([
      "USERS",
      "COURSES",
      "ENROLLMENTS",
      "COHORTS",
      "GUARDIANS",
      "TUITION",
      "ORGANIZATION_STRUCTURE",
      "REPORTS",
      "COMMUNICATIONS",
    ]);

    expect(
      normalizeEffectiveModules([
        "COHORTS",
        "GUARDIANS",
        "TUITION",
        "ORGANIZATION_STRUCTURE",
        "REPORTS",
      ]),
    ).toEqual([]);

    expect(includeLmsModulePrerequisites(["REPORTS"])).toEqual([
      "COURSES",
      "ENROLLMENTS",
      "COHORTS",
      "REPORTS",
    ]);

    expect(includeLmsModulePrerequisites(["COMMUNICATIONS"])).toEqual([
      "USERS",
      "COMMUNICATIONS",
    ]);
  });

  it("ẩn fail-closed module phụ thuộc khi payload legacy thiếu Khóa học", () => {
    expect(normalizeEffectiveModules([
      "USERS",
      "ENROLLMENTS",
      "ASSIGNMENTS",
      "ASSESSMENTS",
      "MEDIA",
    ])).toEqual(["USERS"]);
    expect(effectiveModuleEnabled({ ...access, modules: ["ASSIGNMENTS"] }, "ASSIGNMENTS")).toBe(false);
  });

  it("ẩn Bài tập nếu payload có Khóa học nhưng thiếu Ghi danh", () => {
    expect(normalizeEffectiveModules([
      "COURSES",
      "ASSIGNMENTS",
      "ASSESSMENTS",
      "MEDIA",
    ])).toEqual(["COURSES", "MEDIA"]);
  });

  it("fail-closed thay vì throw với danh sách module runtime malformed", () => {
    expect(normalizeEffectiveModules(null)).toEqual([]);
    expect(normalizeEffectiveModules({ modules: ["COURSES"] })).toEqual([]);
    expect(includeLmsModulePrerequisites(undefined)).toEqual([]);
  });
});
