import type {
  EffectiveAccess,
  LmsModule,
  PlanEntitlements,
  SubscriptionAccessState,
} from "@/lib/types";

export const ALL_LMS_MODULES: readonly LmsModule[] = [
  "USERS",
  "COURSES",
  "ENROLLMENTS",
  "ASSIGNMENTS",
  "ASSESSMENTS",
  "MEDIA",
  "COHORTS",
  "GUARDIANS",
  "TUITION",
  "ORGANIZATION_STRUCTURE",
  "REPORTS",
  "COMMUNICATIONS",
];

export const lmsModuleLabels: Record<LmsModule, string> = {
  ASSIGNMENTS: "Bài tập",
  ASSESSMENTS: "Bài kiểm tra",
  COURSES: "Khóa học",
  ENROLLMENTS: "Ghi danh",
  MEDIA: "Tài liệu riêng tư",
  USERS: "Người dùng",
  COHORTS: "Lớp học & điểm danh",
  GUARDIANS: "Phụ huynh",
  TUITION: "Học phí",
  ORGANIZATION_STRUCTURE: "Cơ cấu chi nhánh",
  REPORTS: "Báo cáo vận hành",
  COMMUNICATIONS: "Thông báo trung tâm",
};

export const lmsModuleOptions = ALL_LMS_MODULES.map((module) => ({
  label: lmsModuleLabels[module],
  value: module,
}));

const COURSE_DEPENDENT_MODULES: readonly LmsModule[] = [
  "ENROLLMENTS",
  "ASSIGNMENTS",
  "ASSESSMENTS",
  "MEDIA",
  "COHORTS",
];
const ENROLLMENT_DEPENDENT_MODULES: readonly LmsModule[] = [
  "ASSIGNMENTS",
  "ASSESSMENTS",
  "COHORTS",
];
const USER_DEPENDENT_MODULES: readonly LmsModule[] = [
  "GUARDIANS",
  "TUITION",
  "ORGANIZATION_STRUCTURE",
  "COMMUNICATIONS",
];

function isLmsModule(value: unknown): value is LmsModule {
  return (
    typeof value === "string" && ALL_LMS_MODULES.includes(value as LmsModule)
  );
}

function orderedModules(modules: ReadonlySet<LmsModule>) {
  return ALL_LMS_MODULES.filter((module) => modules.has(module));
}

/** Normalizes form input by automatically including module prerequisites. */
export function includeLmsModulePrerequisites(modules: unknown): LmsModule[] {
  const selected = new Set(
    (Array.isArray(modules) ? modules : []).filter(isLmsModule),
  );
  if (selected.has("REPORTS")) {
    selected.add("COHORTS");
  }
  if (ENROLLMENT_DEPENDENT_MODULES.some((module) => selected.has(module))) {
    selected.add("ENROLLMENTS");
  }
  if (COURSE_DEPENDENT_MODULES.some((module) => selected.has(module))) {
    selected.add("COURSES");
  }
  if (USER_DEPENDENT_MODULES.some((module) => selected.has(module))) {
    selected.add("USERS");
  }
  return orderedModules(selected);
}

/** Fails closed for legacy/malformed server payloads whose dependencies are missing. */
export function normalizeEffectiveModules(modules: unknown): LmsModule[] {
  const enabled = new Set(
    (Array.isArray(modules) ? modules : []).filter(isLmsModule),
  );
  if (!enabled.has("COURSES")) {
    COURSE_DEPENDENT_MODULES.forEach((module) => enabled.delete(module));
  }
  if (!enabled.has("ENROLLMENTS")) {
    ENROLLMENT_DEPENDENT_MODULES.forEach((module) => enabled.delete(module));
  }
  if (!enabled.has("USERS")) {
    USER_DEPENDENT_MODULES.forEach((module) => enabled.delete(module));
  }
  if (!enabled.has("COHORTS")) {
    enabled.delete("REPORTS");
  }
  return orderedModules(enabled);
}

export function normalizeEffectiveAccess(
  effectiveAccess: EffectiveAccess | null,
): EffectiveAccess | null {
  return effectiveAccess
    ? {
        ...effectiveAccess,
        modules: normalizeEffectiveModules(effectiveAccess.modules),
      }
    : null;
}

const accessPresentation: Record<
  SubscriptionAccessState,
  {
    color: string;
    description: string;
    label: string;
  }
> = {
  ACTIVE: {
    color: "green",
    description:
      "Thuê bao đang hiệu lực và workspace có đầy đủ quyền ghi theo gói.",
    label: "Đang hoạt động",
  },
  GRACE: {
    color: "gold",
    description:
      "Thuê bao đã hết kỳ nhưng workspace vẫn được ghi trong thời gian gia hạn.",
    label: "Thời gian gia hạn",
  },
  READ_ONLY: {
    color: "red",
    description:
      "Workspace vẫn xem được dữ liệu nhưng các thao tác thay đổi đã tạm khóa.",
    label: "Chỉ đọc",
  },
};

export function getSubscriptionAccessPresentation(
  state: SubscriptionAccessState,
) {
  return accessPresentation[state];
}

export function formatEntitlementLimit(
  value: number | null,
  resource: "activeLearners" | "branches" | "courses" | "users",
) {
  const labels = {
    activeLearners: "học viên hoạt động",
    branches: "chi nhánh hoạt động",
    courses: "khóa học",
    users: "người dùng",
  } as const;
  const label = labels[resource];
  return value === null
    ? `Không giới hạn ${label}`
    : `Tối đa ${value.toLocaleString("vi-VN")} ${label}`;
}

export function entitlementSummary(entitlements: PlanEntitlements): string[] {
  const moduleSummary = entitlements.modules.length
    ? entitlements.modules.map((module) => lmsModuleLabels[module]).join(", ")
    : "Không có module học tập";
  return [
    moduleSummary,
    formatEntitlementLimit(entitlements.maxUsers, "users"),
    formatEntitlementLimit(entitlements.maxCourses, "courses"),
    formatEntitlementLimit(entitlements.maxBranches, "branches"),
    formatEntitlementLimit(
      entitlements.maxActiveLearners,
      "activeLearners",
    ),
  ];
}

export function effectiveModuleEnabled(
  effectiveAccess: EffectiveAccess | null,
  module: LmsModule,
) {
  return effectiveAccess
    ? normalizeEffectiveModules(effectiveAccess.modules).includes(module)
    : false;
}
