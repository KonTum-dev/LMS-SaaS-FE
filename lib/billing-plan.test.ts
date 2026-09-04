import { describe, expect, it } from "vitest";
import { buildBillingPlanPayload } from "./billing-plan";

describe("billing plan form payload", () => {
  it("gửi entitlement lồng nhau và chuẩn hóa ô quota trống thành null", () => {
    expect(buildBillingPlanPayload({
      active: true,
      code: "standard",
      description: "  Vận hành LMS  ",
      entitlements: {
        maxActiveLearners: 200,
        maxBranches: undefined,
        maxCourses: undefined,
        maxUsers: 250,
        modules: ["USERS", "COURSES", "ENROLLMENTS", "ASSIGNMENTS"],
      },
      featuresText: " Báo cáo cơ bản \n\n Hỗ trợ email ",
      monthlyPriceVnd: 499000,
      name: "Standard",
      tierLevel: 2,
      yearlyPriceVnd: 4990000,
    })).toEqual({
      active: true,
      code: "standard",
      description: "  Vận hành LMS  ",
      entitlements: {
        maxActiveLearners: 200,
        maxBranches: null,
        maxCourses: null,
        maxUsers: 250,
        modules: ["USERS", "COURSES", "ENROLLMENTS", "ASSIGNMENTS"],
      },
      features: ["Báo cáo cơ bản", "Hỗ trợ email"],
      monthlyPriceVnd: 499000,
      name: "Standard",
      tierLevel: 2,
      yearlyPriceVnd: 4990000,
    });
  });

  it("không gửi module phụ thuộc mà thiếu Khóa học", () => {
    const payload = buildBillingPlanPayload({
      active: true,
      code: "assignments",
      entitlements: { maxCourses: 10, maxUsers: 20, modules: ["ASSIGNMENTS"] },
      monthlyPriceVnd: 1000,
      name: "Assignments",
      tierLevel: 1,
      yearlyPriceVnd: 10000,
    });

    expect(payload.entitlements.modules).toEqual(["COURSES", "ENROLLMENTS", "ASSIGNMENTS"]);
  });
});
