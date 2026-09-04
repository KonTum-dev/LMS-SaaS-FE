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
import type { AnchorHTMLAttributes } from "react";
import type {
  AttendanceSnapshot,
  ClassSession,
} from "@/lib/cohort-api";
import type { UserRole } from "@/lib/types";
import CohortAttendancePage from "./page";

const mocks = vi.hoisted(() => ({
  bulkMarkAttendance: vi.fn(),
  cohortId: "cohort-1",
  getAttendance: vi.fn(),
  listSessions: vi.fn(),
  membershipId: "membership-1" as string | undefined,
  readOnly: false,
  role: "INSTRUCTOR" as UserRole,
}));

vi.mock("@/lib/cohort-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cohort-api")>()),
  cohortApi: {
    bulkMarkAttendance: mocks.bulkMarkAttendance,
    getAttendance: mocks.getAttendance,
    listSessions: mocks.listSessions,
  },
}));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: {
      graceEndsAt: null,
      limits: { maxCourses: 100, maxUsers: 1_000 },
      modules: ["COURSES"],
      readOnly: mocks.readOnly,
      state: mocks.readOnly ? "READ_ONLY" : "ACTIVE",
    },
    organization: { _id: "tenant-1" },
    token: "tenant-token",
    user: {
      email: "teacher@example.test",
      fullName: "Cô Minh Anh",
      membershipId: mocks.membershipId,
      role: mocks.role,
      sub: "instructor-1",
      tenantId: "tenant-1",
    },
  }),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: mocks.cohortId }),
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
vi.mock("antd", async () =>
  (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

const session: ClassSession = {
  _id: "session-1",
  cohortId: "cohort-1",
  endAt: "2030-09-04T13:30:00.000Z",
  location: "Phòng 301",
  startAt: "2030-09-04T12:00:00.000Z",
  status: "IN_PROGRESS",
  tenantId: "tenant-1",
};

const snapshot: AttendanceSnapshot = {
  items: [
    {
      attendanceId: null,
      enrollmentId: "cohort-enrollment-1",
      learnerId: {
        _id: "learner-1",
        email: "lan@example.test",
        fullName: "Nguyễn Ngọc Lan",
      },
      markedAt: null,
      markedBy: null,
      note: null,
      status: null,
      updatedAt: null,
    },
    {
      attendanceId: "attendance-2",
      enrollmentId: "cohort-enrollment-2",
      learnerId: {
        _id: "learner-2",
        email: "minh@example.test",
        fullName: "Trần Hoàng Minh",
      },
      markedAt: "2030-09-04T12:05:00.000Z",
      markedBy: {
        _id: "instructor-1",
        email: "teacher@example.test",
        fullName: "Cô Minh Anh",
      },
      note: "Đến sau 10 phút",
      status: "LATE",
      updatedAt: "2030-09-04T12:05:00.000Z",
    },
  ],
  markedCount: 1,
  session,
  total: 2,
  unmarkedCount: 1,
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <CohortAttendancePage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  notifyManager.setScheduler((callback) => queueMicrotask(callback));
  mocks.bulkMarkAttendance.mockReset();
  mocks.getAttendance.mockReset();
  mocks.listSessions.mockReset();
  mocks.cohortId = "cohort-1";
  mocks.membershipId = "membership-1";
  mocks.readOnly = false;
  mocks.role = "INSTRUCTOR";
  mocks.listSessions.mockResolvedValue([session]);
  mocks.getAttendance.mockResolvedValue(snapshot);
  mocks.bulkMarkAttendance.mockResolvedValue({
    ...snapshot,
    items: snapshot.items.map((item) => ({
      ...item,
      markedAt: "2030-09-04T12:10:00.000Z",
      status: "PRESENT" as const,
    })),
    markedCount: 2,
    unmarkedCount: 0,
  });
});

afterEach(() => {
  notifyManager.setScheduler(defaultScheduler);
  cleanup();
});

describe("CohortAttendancePage", () => {
  it("tải lịch và roster trong đúng cohort scope", async () => {
    renderPage();

    expect(await screen.findByText("Nguyễn Ngọc Lan")).toBeTruthy();
    expect(screen.getByText("Trần Hoàng Minh")).toBeTruthy();
    expect(mocks.listSessions).toHaveBeenCalledWith(
      { token: "tenant-token" },
      "cohort-1",
      {},
      { signal: expect.any(AbortSignal) },
    );
    expect(mocks.getAttendance).toHaveBeenCalledWith(
      { token: "tenant-token" },
      "cohort-1",
      "session-1",
      { signal: expect.any(AbortSignal) },
    );
    expect(screen.getByLabelText("Chọn buổi học")).toBeTruthy();
    expect(screen.getByText("Đang diễn ra")).toBeTruthy();
  });

  it("đánh dấu tất cả có mặt và bulk lưu một lần", async () => {
    renderPage();
    await screen.findByText("Nguyễn Ngọc Lan");

    fireEvent.click(screen.getByRole("button", { name: "Tất cả có mặt" }));
    expect(
      (screen.getByLabelText(
        "Trạng thái của Nguyễn Ngọc Lan",
      ) as HTMLSelectElement).value,
    ).toBe("PRESENT");
    expect(
      (screen.getByLabelText(
        "Trạng thái của Trần Hoàng Minh",
      ) as HTMLSelectElement).value,
    ).toBe("PRESENT");

    fireEvent.click(screen.getByRole("button", { name: "Lưu điểm danh" }));
    await waitFor(() =>
      expect(mocks.bulkMarkAttendance).toHaveBeenCalledWith(
        { token: "tenant-token" },
        "cohort-1",
        "session-1",
        [
          { learnerId: "learner-1", note: null, status: "PRESENT" },
          {
            learnerId: "learner-2",
            note: "Đến sau 10 phút",
            status: "PRESENT",
          },
        ],
      ),
    );
    expect(mocks.bulkMarkAttendance).toHaveBeenCalledTimes(1);
  });

  it("workspace chỉ đọc vẫn tải sổ nhưng khóa chỉnh sửa", async () => {
    mocks.readOnly = true;
    renderPage();

    await screen.findByText("Nguyễn Ngọc Lan");
    expect(screen.getByText("Workspace chỉ đọc")).toBeTruthy();
    expect(
      (screen.getByRole("button", {
        name: "Tất cả có mặt",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText(
        "Trạng thái của Nguyễn Ngọc Lan",
      ) as HTMLSelectElement).disabled,
    ).toBe(true);
    expect(mocks.getAttendance).toHaveBeenCalled();
  });

  it("không cho điểm danh buổi đã hủy", async () => {
    mocks.listSessions.mockResolvedValue([
      {
        ...session,
        cancellationReason: "Trung tâm nghỉ lễ",
        status: "CANCELLED",
      },
    ]);
    renderPage();

    expect(
      await screen.findByText("Không thể điểm danh buổi đã hủy"),
    ).toBeTruthy();
    expect(screen.getByText("Trung tâm nghỉ lễ")).toBeTruthy();
    expect(
      (screen.getByRole("button", {
        name: "Tất cả có mặt",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("fail closed với learner hoặc membership không hợp lệ", () => {
    mocks.role = "LEARNER";
    const { unmount } = renderPage();
    expect(
      screen.getByText(
        "Chỉ quản trị viên và giảng viên được điểm danh lớp học.",
      ),
    ).toBeTruthy();
    expect(mocks.listSessions).not.toHaveBeenCalled();
    expect(mocks.getAttendance).not.toHaveBeenCalled();

    unmount();
    mocks.role = "TENANT_ADMIN";
    mocks.membershipId = undefined;
    renderPage();
    expect(
      screen.getByText("Phiên làm việc thiếu phạm vi thành viên hợp lệ."),
    ).toBeTruthy();
    expect(mocks.listSessions).not.toHaveBeenCalled();
  });
});
