// @vitest-environment jsdom

import {
  defaultScheduler,
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { Cohort, ClassSession } from "@/lib/cohort-api";
import type { UserRole } from "@/lib/types";
import CohortsPage from "./page";

const mocks = vi.hoisted(() => ({
  addLearners: vi.fn(),
  archiveCohort: vi.fn(),
  cancelSession: vi.fn(),
  createCohort: vi.fn(),
  createSession: vi.fn(),
  listCohorts: vi.fn(),
  listCourseLearners: vi.fn(),
  listCourses: vi.fn(),
  listEligibleInstructors: vi.fn(),
  listLearners: vi.fn(),
  listSessions: vi.fn(),
  membershipId: "membership-1" as string | undefined,
  orgStructureEnabled: true,
  orgUnitScopeMode: "GLOBAL" as "GLOBAL" | "SCOPED",
  orgUnitsTree: vi.fn(),
  readOnly: false,
  removeLearner: vi.fn(),
  role: "TENANT_ADMIN" as UserRole,
  updateCohort: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock("@/lib/cohort-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cohort-api")>()),
  cohortApi: {
    addLearners: mocks.addLearners,
    archiveCohort: mocks.archiveCohort,
    cancelSession: mocks.cancelSession,
    createCohort: mocks.createCohort,
    createSession: mocks.createSession,
    listCohorts: mocks.listCohorts,
    listCourseLearners: mocks.listCourseLearners,
    listCourses: mocks.listCourses,
    listEligibleInstructors: mocks.listEligibleInstructors,
    listLearners: mocks.listLearners,
    listSessions: mocks.listSessions,
    removeLearner: mocks.removeLearner,
    updateCohort: mocks.updateCohort,
    updateSession: mocks.updateSession,
  },
}));
vi.mock("@/lib/org-units-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/org-units-api")>()),
  orgUnitsApi: { tree: mocks.orgUnitsTree },
}));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: {
      graceEndsAt: null,
      limits: { maxCourses: 100, maxUsers: 1_000 },
      modules: [
        "USERS",
        "COURSES",
        "ENROLLMENTS",
        "COHORTS",
        ...(mocks.orgStructureEnabled ? ["ORGANIZATION_STRUCTURE"] : []),
      ],
      readOnly: mocks.readOnly,
      state: mocks.readOnly ? "READ_ONLY" : "ACTIVE",
    },
    organization: { _id: "tenant-1" },
    token: "tenant-token",
    user: {
      email: "viewer@example.test",
      fullName: "Viewer",
      membershipId: mocks.membershipId,
      orgUnitScopeMode: mocks.orgUnitScopeMode,
      role: mocks.role,
      sub: "viewer-1",
      tenantId: "tenant-1",
    },
  }),
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@ant-design/icons", () => ({
  CalendarOutlined: () => null,
  DeleteOutlined: () => null,
  EditOutlined: () => null,
  PlusOutlined: () => null,
  TeamOutlined: () => null,
  UsergroupAddOutlined: () => null,
}));
vi.mock("antd", async () => {
  const { lightweightAntd } = await import("@/test-utils/lightweight-antd");
  function TestSelect({
    "aria-label": ariaLabel,
    disabled,
    mode,
    onChange,
    options = [],
    value,
  }: {
    "aria-label"?: string;
    disabled?: boolean;
    mode?: string;
    onChange?: (value: string | string[]) => void;
    options?: Array<{ label?: ReactNode; value?: string }>;
    value?: string | string[];
  }) {
    const multiple = mode === "multiple";
    return (
      <select
        aria-label={ariaLabel}
        disabled={disabled}
        multiple={multiple}
        onChange={(event) =>
          onChange?.(
            multiple
              ? Array.from(event.currentTarget.selectedOptions).map(
                  (option) => option.value,
                )
              : event.currentTarget.value,
          )
        }
        value={multiple ? (Array.isArray(value) ? value : []) : value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  return { ...lightweightAntd, Select: TestSelect };
});

const cohort: Cohort = {
  _id: "cohort-1",
  capacity: 24,
  code: "IELTS-K09",
  courseId: {
    _id: "course-1",
    slug: "ielts-foundation",
    status: "PUBLISHED",
    title: "IELTS Foundation",
  },
  endDate: "2030-11-30T16:59:59.999Z",
  instructorIds: [
    {
      _id: "instructor-1",
      email: "teacher@example.test",
      fullName: "Cô Minh Anh",
    },
  ],
  name: "IELTS buổi tối K09",
  orgUnitId: "branch-1",
  startDate: "2030-09-01T17:00:00.000Z",
  status: "ACTIVE",
  tenantId: "tenant-1",
  timezone: "Asia/Ho_Chi_Minh",
};

const session: ClassSession = {
  _id: "session-1",
  cohortId: "cohort-1",
  endAt: "2030-09-04T13:30:00.000Z",
  location: "Phòng 301",
  startAt: "2030-09-04T12:00:00.000Z",
  status: "SCHEDULED",
  tenantId: "tenant-1",
};

const roster = [
  {
    _id: "cohort-enrollment-1",
    cohortId: "cohort-1",
    courseId: "course-1",
    joinedAt: "2030-09-01T08:00:00.000Z",
    learnerId: {
      _id: "learner-1",
      email: "lan@example.test",
      fullName: "Nguyễn Ngọc Lan",
    },
    status: "ACTIVE" as const,
    tenantId: "tenant-1",
  },
];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <CohortsPage />
    </QueryClientProvider>,
  );
  return { ...view, client };
}

beforeEach(() => {
  notifyManager.setScheduler((callback) => queueMicrotask(callback));
  for (const value of Object.values(mocks)) {
    if (typeof value === "function" && "mockReset" in value) {
      value.mockReset();
    }
  }
  mocks.membershipId = "membership-1";
  mocks.orgStructureEnabled = true;
  mocks.orgUnitScopeMode = "GLOBAL";
  mocks.readOnly = false;
  mocks.role = "TENANT_ADMIN";
  mocks.listCohorts.mockResolvedValue([cohort]);
  mocks.listCourses.mockResolvedValue([cohort.courseId]);
  mocks.listEligibleInstructors.mockResolvedValue({
    items: [
      {
        email: "teacher@example.test",
        fullName: "Cô Minh Anh",
        userId: "instructor-1",
      },
    ],
    limit: 100,
    page: 1,
    total: 1,
  });
  mocks.listLearners.mockResolvedValue(roster);
  mocks.listCourseLearners.mockResolvedValue({
    items: [
      {
        _id: "course-enrollment-2",
        status: "ACTIVE",
        userId: {
          _id: "learner-2",
          email: "minh@example.test",
          fullName: "Trần Hoàng Minh",
        },
      },
    ],
    limit: 100,
    page: 1,
    total: 2,
  });
  mocks.listSessions.mockResolvedValue([session]);
  mocks.addLearners.mockResolvedValue(roster);
  mocks.removeLearner.mockResolvedValue({
    ...roster[0],
    status: "WITHDRAWN",
  });
  mocks.orgUnitsTree.mockResolvedValue({
    items: [
      {
        _id: "branch-1",
        ancestorIds: [],
        archivedAt: null,
        archivedBy: null,
        children: [],
        code: "hcm",
        createdBy: "admin-1",
        depth: 0,
        name: "Chi nhánh HCM",
        parentId: null,
        path: ["branch-1"],
        policyOverrides: {},
        revision: 1,
        status: "ACTIVE",
        tenantId: "tenant-1",
        timezone: "Asia/Ho_Chi_Minh",
        type: "BRANCH",
        updatedBy: "admin-1",
      },
    ],
    total: 1,
  });
});

afterEach(() => {
  notifyManager.setScheduler(defaultScheduler);
  cleanup();
});

describe("CohortsPage", () => {
  it("hiển thị lớp, khóa học, giảng viên và trạng thái tiếng Việt", async () => {
    renderPage();

    expect(await screen.findByText("IELTS buổi tối K09")).toBeTruthy();
    expect(screen.getByText("IELTS Foundation")).toBeTruthy();
    expect(screen.getByText("Cô Minh Anh")).toBeTruthy();
    expect(screen.getAllByText("Đang học").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chi nhánh HCM").length).toBeGreaterThan(0);
    expect(mocks.listCohorts).toHaveBeenCalledWith(
      { token: "tenant-token" },
      {},
      { signal: expect.any(AbortSignal) },
    );
    expect(mocks.listCourses).toHaveBeenCalled();
    expect(mocks.listEligibleInstructors).not.toHaveBeenCalled();
    expect(mocks.orgUnitsTree).toHaveBeenCalledWith(
      { token: "tenant-token" },
      false,
      { signal: expect.any(AbortSignal) },
    );
    expect(
      screen
        .getByRole("button", {
          name: "Điểm danh lớp IELTS buổi tối K09",
        })
        .closest("a")
        ?.getAttribute("href"),
    ).toBe("/cohorts/cohort-1/attendance");
  });

  it("mở được biểu mẫu tạo và chỉnh sửa lớp", async () => {
    renderPage();
    await screen.findByText("IELTS buổi tối K09");

    fireEvent.click(screen.getByRole("button", { name: "Tạo lớp học" }));
    expect(screen.getByRole("dialog", { name: "Tạo lớp học" })).toBeTruthy();
    await waitFor(() =>
      expect(mocks.listEligibleInstructors).toHaveBeenCalledWith(
        { token: "tenant-token" },
        {},
        { signal: expect.any(AbortSignal) },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));

    fireEvent.click(
      screen.getByRole("button", {
        name: "Chỉnh sửa lớp IELTS buổi tối K09",
      }),
    );
    expect(
      screen.getByRole("dialog", { name: "Chỉnh sửa lớp học" }),
    ).toBeTruthy();
  });

  it("scoped admin chỉ tải giảng viên sau khi chọn chi nhánh", async () => {
    mocks.orgUnitScopeMode = "SCOPED";
    renderPage();
    await screen.findByText("IELTS buổi tối K09");

    fireEvent.click(screen.getByRole("button", { name: "Tạo lớp học" }));
    expect(mocks.listEligibleInstructors).not.toHaveBeenCalled();
    expect(
      screen.getByLabelText("Chọn giảng viên phụ trách"),
    ).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Chỉnh sửa lớp IELTS buổi tối K09",
      }),
    );

    await waitFor(() =>
      expect(mocks.listEligibleInstructors).toHaveBeenCalledWith(
        { token: "tenant-token" },
        { orgUnitId: "branch-1" },
        { signal: expect.any(AbortSignal) },
      ),
    );
    expect(
      screen.getByLabelText("Chọn giảng viên phụ trách"),
    ).toHaveProperty("disabled", false);
  });

  it("chỉ tải lịch khi mở lớp và hiển thị thao tác buổi học", async () => {
    renderPage();
    await screen.findByText("IELTS buổi tối K09");
    expect(mocks.listSessions).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Lịch học IELTS buổi tối K09" }),
    );

    expect(await screen.findByText("Phòng 301")).toBeTruthy();
    expect(mocks.listSessions).toHaveBeenCalledWith(
      { token: "tenant-token" },
      "cohort-1",
      {},
      { signal: expect.any(AbortSignal) },
    );
    fireEvent.click(screen.getByRole("button", { name: "Thêm buổi học" }));
    expect(
      screen.getByRole("dialog", { name: "Thêm buổi học" }),
    ).toBeTruthy();
  });

  it("admin xem roster lớp, lấy nguồn từ course roster và rút học viên", async () => {
    const { client } = renderPage();
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    await screen.findByText("IELTS buổi tối K09");
    expect(mocks.listLearners).not.toHaveBeenCalled();
    expect(mocks.listCourseLearners).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Học viên lớp IELTS buổi tối K09",
      }),
    );

    expect(await screen.findByText("Nguyễn Ngọc Lan")).toBeTruthy();
    expect(screen.getByText("Danh sách lớp (1/24)")).toBeTruthy();
    expect(
      screen.getByRole("option", {
        name: "Trần Hoàng Minh · minh@example.test",
      }),
    ).toBeTruthy();
    expect(mocks.listLearners).toHaveBeenCalledWith(
      { token: "tenant-token" },
      "cohort-1",
      { signal: expect.any(AbortSignal) },
    );
    expect(mocks.listCourseLearners).toHaveBeenCalledWith(
      { token: "tenant-token" },
      "course-1",
      { limit: 100, page: 1 },
      { signal: expect.any(AbortSignal) },
    );

    fireEvent.change(
      screen.getByLabelText("Chọn học viên thêm vào lớp"),
      { target: { value: "learner-2" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào lớp" }));
    await waitFor(() =>
      expect(mocks.addLearners).toHaveBeenCalledWith(
        { token: "tenant-token" },
        "cohort-1",
        ["learner-2"],
      ),
    );

    const removeButtons = screen.getAllByRole("button", { name: "Rút" });
    fireEvent.click(removeButtons[removeButtons.length - 1]);
    await waitFor(() =>
      expect(mocks.removeLearner).toHaveBeenCalledWith(
        { token: "tenant-token" },
        "cohort-1",
        "learner-1",
      ),
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        "lms",
        "tenant-1",
        "viewer-1",
        "membership-1",
        "TENANT_ADMIN",
        "cohorts",
        "cohort-1",
        "learners",
      ],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        "lms",
        "tenant-1",
        "viewer-1",
        "membership-1",
        "TENANT_ADMIN",
        "cohorts",
        "cohort-1",
        "attendance",
      ],
    });
  });

  it("instructor chỉ thấy lớp thuộc API scope và không tải directory giảng viên", async () => {
    mocks.role = "INSTRUCTOR";
    renderPage();

    expect(await screen.findByText("IELTS buổi tối K09")).toBeTruthy();
    expect(mocks.listCohorts).toHaveBeenCalled();
    expect(mocks.listEligibleInstructors).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Tạo lớp học" })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Học viên lớp IELTS buổi tối K09",
      }),
    );
    expect(await screen.findByText("Nguyễn Ngọc Lan")).toBeTruthy();
    expect(screen.getByText("Danh sách chỉ đọc")).toBeTruthy();
    expect(mocks.listLearners).toHaveBeenCalled();
    expect(mocks.listCourseLearners).not.toHaveBeenCalled();
    expect(
      screen.queryByLabelText("Chọn học viên thêm vào lớp"),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Rút" })).toBeNull();
  });

  it("khóa thao tác ghi nhưng vẫn tải lớp khi workspace chỉ đọc", async () => {
    mocks.readOnly = true;
    renderPage();

    expect(await screen.findByText("IELTS buổi tối K09")).toBeTruthy();
    expect(screen.getByText("Workspace chỉ đọc")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Tạo lớp học" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.queryByRole("button", {
        name: "Chỉnh sửa lớp IELTS buổi tối K09",
      }),
    ).toBeNull();
  });

  it("fail closed với role hoặc membership không hợp lệ", async () => {
    mocks.role = "LEARNER";
    const { unmount } = renderPage();
    expect(
      screen.getByText(
        "Chỉ quản trị viên và giảng viên được quản lý lớp học.",
      ),
    ).toBeTruthy();
    expect(mocks.listCohorts).not.toHaveBeenCalled();

    unmount();
    mocks.role = "INSTRUCTOR";
    mocks.membershipId = undefined;
    renderPage();
    expect(
      screen.getByText("Phiên làm việc thiếu phạm vi thành viên hợp lệ."),
    ).toBeTruthy();
    await waitFor(() => expect(mocks.listCohorts).not.toHaveBeenCalled());
  });
});
