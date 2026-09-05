// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Announcement } from "@/lib/communications-api";
import type { Cohort } from "@/lib/cohort-api";
import type { OrgUnitTreeNode } from "@/lib/org-units-api";
import type { UserRole } from "@/lib/types";
import CommunicationsPage from "./page";

const mocks = vi.hoisted(() => ({
  archive: vi.fn(),
  cohorts: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  message: { error: vi.fn(), success: vi.fn() },
  publish: vi.fn(),
  readOnly: false,
  response: [] as Announcement[],
  role: "TENANT_ADMIN" as UserRole,
  tree: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: { readOnly: mocks.readOnly },
    organization: {
      _id: "tenant-1",
      enabledModules: ["USERS", "COURSES"],
      logoUrl: null,
      name: "Bright Academy",
      primaryColor: "#176BFF",
      slug: "bright-academy",
      status: "ACTIVE",
    },
    token: "tenant-token",
    user: {
      email: "viewer@bright.test",
      fullName: "Bright Viewer",
      membershipId: "membership-1",
      role: mocks.role,
      sub: "viewer-1",
      tenantId: "tenant-1",
    },
  }),
}));

vi.mock("@/lib/communications-api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/communications-api")>();
  return {
    ...actual,
    communicationsApi: {
      archive: mocks.archive,
      create: mocks.create,
      directory: mocks.list,
      list: mocks.list,
      publish: mocks.publish,
      update: mocks.update,
    },
  };
});

vi.mock("@/lib/cohort-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cohort-api")>();
  return {
    ...actual,
    cohortApi: { ...actual.cohortApi, listCohorts: mocks.cohorts },
  };
});

vi.mock("@/lib/org-units-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/org-units-api")>();
  return {
    ...actual,
    orgUnitsApi: { ...actual.orgUnitsApi, tree: mocks.tree },
  };
});

vi.mock("@ant-design/icons", () => ({
  EditOutlined: () => null,
  PlusOutlined: () => null,
  ReloadOutlined: () => null,
  SendOutlined: () => null,
}));

vi.mock("antd", async () => {
  const { lightweightAntd } = await import("@/test-utils/lightweight-antd");
  const TestApp = ({ children }: { children?: ReactNode }) => <>{children}</>;
  TestApp.useApp = () => ({ message: mocks.message });

  return {
    ...lightweightAntd,
    App: TestApp,
    Select: ({
      "aria-label": ariaLabel,
      disabled,
      mode,
      onChange,
      options = [],
      value,
    }: {
      "aria-label"?: string;
      disabled?: boolean;
      mode?: "multiple";
      onChange?: (value: string | string[] | undefined) => void;
      options?: Array<{ label?: ReactNode; value: string }>;
      value?: string | string[];
    }) => (
      <select
        aria-label={ariaLabel}
        disabled={disabled}
        multiple={mode === "multiple"}
        onChange={(event) =>
          onChange?.(
            mode === "multiple"
              ? Array.from(
                  event.target.selectedOptions,
                  (option) => option.value,
                )
              : event.target.value || undefined,
          )
        }
        value={mode === "multiple" ? (value ?? []) : (value ?? "")}
      >
        {mode !== "multiple" && <option value="">Tất cả</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  };
});

const cohort: Cohort = {
  _id: "cohort-1",
  capacity: 30,
  code: "IELTS-A1",
  courseId: "course-1",
  instructorIds: [],
  name: "IELTS A1",
  orgUnitId: "branch-hcm",
  status: "ACTIVE",
  tenantId: "tenant-1",
  timezone: "Asia/Ho_Chi_Minh",
};
const actorId = "64b000000000000000000001";
const branch: OrgUnitTreeNode = {
  _id: "branch-hcm",
  ancestorIds: ["root-1"],
  archivedAt: null,
  archivedBy: null,
  children: [],
  code: "hcm",
  createdBy: actorId,
  depth: 1,
  name: "Chi nhánh HCM",
  parentId: "root-1",
  path: ["bright", "hcm"],
  policyOverrides: {},
  revision: 1,
  status: "ACTIVE",
  tenantId: "tenant-1",
  timezone: "Asia/Ho_Chi_Minh",
  type: "BRANCH",
  updatedBy: actorId,
};
const root: OrgUnitTreeNode = {
  ...branch,
  _id: "root-1",
  ancestorIds: [],
  children: [branch],
  code: "bright",
  depth: 0,
  name: "Bright Academy",
  parentId: null,
  path: ["bright"],
  type: "ROOT",
};

const draftAnnouncement: Announcement = {
  _id: "announcement-draft",
  audience: "COHORT",
  body: "Lớp nghỉ học vào chiều thứ bảy.",
  cohortId: "cohort-1",
  createdAt: "2026-09-01T08:00:00.000Z",
  createdBy: actorId,
  recipientRoles: ["LEARNER", "GUARDIAN"],
  resolvedCohortIds: ["cohort-1"],
  status: "DRAFT",
  tenantId: "tenant-1",
  title: "Điều chỉnh lịch học",
  updatedAt: "2026-09-01T08:30:00.000Z",
};
const publishedAnnouncement: Announcement = {
  _id: "announcement-published",
  audience: "ORG_UNIT",
  body: "Trung tâm đóng cửa trong ngày Quốc khánh.",
  createdBy: actorId,
  orgUnitId: "branch-hcm",
  publishedAt: "2026-09-01T09:00:00.000Z",
  recipientRoles: ["INSTRUCTOR", "LEARNER", "GUARDIAN"],
  resolvedCohortIds: ["cohort-1"],
  status: "PUBLISHED",
  tenantId: "tenant-1",
  title: "Lịch nghỉ lễ",
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
      <CommunicationsPage />
    </QueryClientProvider>,
  );
}

describe("CommunicationsPage", () => {
  beforeEach(() => {
    mocks.archive.mockReset();
    mocks.cohorts.mockReset();
    mocks.create.mockReset();
    mocks.list.mockReset();
    mocks.message.error.mockReset();
    mocks.message.success.mockReset();
    mocks.publish.mockReset();
    mocks.tree.mockReset();
    mocks.update.mockReset();
    mocks.readOnly = false;
    mocks.response = [draftAnnouncement, publishedAnnouncement];
    mocks.role = "TENANT_ADMIN";
    mocks.list.mockImplementation((_context, query) =>
      Promise.resolve({
        items: mocks.response,
        page: query.page,
        limit: query.limit,
        total: mocks.response.length,
      }),
    );
    mocks.cohorts.mockResolvedValue([cohort]);
    mocks.tree.mockResolvedValue({ items: [root], total: 2 });
    mocks.create.mockResolvedValue(draftAnnouncement);
    mocks.update.mockResolvedValue(draftAnnouncement);
    mocks.publish.mockResolvedValue({
      ...draftAnnouncement,
      status: "PUBLISHED",
    });
    mocks.archive.mockResolvedValue({
      ...draftAnnouncement,
      status: "ARCHIVED",
    });
  });

  afterEach(() => cleanup());

  it("quản trị viên xem danh sách và tạo thông báo toàn trung tâm", async () => {
    renderPage();

    expect(await screen.findByText("Điều chỉnh lịch học")).toBeTruthy();
    expect(screen.getByText("Lịch nghỉ lễ")).toBeTruthy();
    expect(screen.getByText("Chi nhánh HCM")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tạo thông báo" }));
    fireEvent.change(screen.getByLabelText("Tiêu đề thông báo"), {
      target: { value: "  Nhắc lịch kiểm tra  " },
    });
    fireEvent.change(screen.getByLabelText("Nội dung thông báo"), {
      target: { value: "  Có mặt trước giờ thi 15 phút.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thông báo" }));

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        { token: "tenant-token" },
        {
          audience: "TENANT",
          body: "Có mặt trước giờ thi 15 phút.",
          recipientRoles: ["LEARNER", "GUARDIAN"],
          title: "Nhắc lịch kiểm tra",
        },
      ),
    );
    expect(mocks.message.success).toHaveBeenCalledWith(
      "Đã tạo bản nháp thông báo",
    );
  });

  it("giảng viên bị giới hạn ở lớp và người nhận learner/guardian", async () => {
    mocks.role = "INSTRUCTOR";
    mocks.response = [draftAnnouncement];
    renderPage();
    await screen.findByText("Điều chỉnh lịch học");

    fireEvent.click(screen.getByRole("button", { name: "Tạo thông báo" }));
    expect(
      (screen.getByLabelText("Phạm vi nhận thông báo") as HTMLSelectElement)
        .disabled,
    ).toBe(true);
    expect(screen.queryByRole("option", { name: "Giảng viên" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Tiêu đề thông báo"), {
      target: { value: "Bài tập cuối tuần" },
    });
    fireEvent.change(screen.getByLabelText("Nội dung thông báo"), {
      target: { value: "Hoàn thành bài số 5 trước thứ hai." },
    });
    fireEvent.change(screen.getByLabelText("Lớp nhận thông báo"), {
      target: { value: "cohort-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thông báo" }));

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        { token: "tenant-token" },
        {
          audience: "COHORT",
          body: "Hoàn thành bài số 5 trước thứ hai.",
          cohortId: "cohort-1",
          recipientRoles: ["LEARNER", "GUARDIAN"],
          title: "Bài tập cuối tuần",
        },
      ),
    );
    expect(mocks.tree).not.toHaveBeenCalled();
  });

  it("học viên chỉ đọc và không tải danh mục quản trị", async () => {
    mocks.role = "LEARNER";
    mocks.response = [publishedAnnouncement];
    renderPage();

    expect(await screen.findByText("Lịch nghỉ lễ")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tạo thông báo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tạo thông báo" })).toBeNull();
    expect(screen.queryByText("Chỉnh sửa")).toBeNull();
    expect(mocks.cohorts).not.toHaveBeenCalled();
    expect(mocks.tree).not.toHaveBeenCalled();
    expect(mocks.list).toHaveBeenCalledWith(
      { token: "tenant-token" },
      { page: 1, limit: 20 },
      { signal: expect.any(AbortSignal) },
    );
  });

  it("workspace read-only khóa toàn bộ hành động quản trị", async () => {
    mocks.readOnly = true;
    renderPage();

    expect(await screen.findByText("Workspace chỉ đọc")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Tạo thông báo",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.queryByText("Chỉnh sửa")).toBeNull();
    expect(screen.queryByText("Phát hành")).toBeNull();
  });

  it("gửi status và audience vào list query khi lọc", async () => {
    renderPage();
    await screen.findByText("Điều chỉnh lịch học");

    fireEvent.change(screen.getByLabelText("Lọc trạng thái thông báo"), {
      target: { value: "PUBLISHED" },
    });
    fireEvent.change(screen.getByLabelText("Lọc phạm vi thông báo"), {
      target: { value: "ORG_UNIT" },
    });

    await waitFor(() =>
      expect(mocks.list).toHaveBeenCalledWith(
        { token: "tenant-token" },
        { audience: "ORG_UNIT", status: "PUBLISHED", page: 1, limit: 20 },
        { signal: expect.any(AbortSignal) },
      ),
    );
  });

  it("phân trang toàn bộ kết quả, tìm trên máy chủ và reset trang khi đổi bộ lọc/kích thước", async () => {
    mocks.list.mockImplementation((_context, query) =>
      Promise.resolve({
        items: [
          { ...publishedAnnouncement, title: `Thông báo trang ${query.page}` },
        ],
        page: query.page,
        limit: query.limit,
        total: 125,
      }),
    );
    renderPage();
    await screen.findByText("Thông báo trang 1");
    expect(
      (screen.getByRole("button", { name: "Trang sau" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await screen.findByText("Thông báo trang 2");
    expect(mocks.list).toHaveBeenLastCalledWith(
      { token: "tenant-token" },
      { page: 2, limit: 20 },
      { signal: expect.any(AbortSignal) },
    );
    const search = screen.getByRole("textbox", { name: "Tìm thông báo" });
    fireEvent.change(search, { target: { value: "  học phí  " } });
    fireEvent.keyDown(search, { key: "Enter" });
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        { token: "tenant-token" },
        { page: 1, limit: 20, search: "học phí" },
        { signal: expect.any(AbortSignal) },
      ),
    );
    await screen.findByText("Thông báo trang 1");
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await screen.findByText("Thông báo trang 2");
    fireEvent.change(screen.getByLabelText("Lọc phạm vi thông báo"), {
      target: { value: "COHORT" },
    });
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        { token: "tenant-token" },
        { page: 1, limit: 20, search: "học phí", audience: "COHORT" },
        { signal: expect.any(AbortSignal) },
      ),
    );
    fireEvent.change(screen.getByLabelText("Số dòng mỗi trang"), {
      target: { value: "50" },
    });
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        { token: "tenant-token" },
        { page: 1, limit: 50, search: "học phí", audience: "COHORT" },
        { signal: expect.any(AbortSignal) },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        { token: "tenant-token" },
        { page: 1, limit: 50 },
        { signal: expect.any(AbortSignal) },
      ),
    );
    expect((search as HTMLInputElement).value).toBe("");
  });

  it("quay về trang hợp lệ khi tổng số kết quả giảm", async () => {
    let total = 21;
    mocks.list.mockImplementation((_context, query) =>
      Promise.resolve({
        items: query.page === 1 || total > 20 ? [publishedAnnouncement] : [],
        page: query.page,
        limit: query.limit,
        total,
      }),
    );
    renderPage();
    await screen.findByText("Lịch nghỉ lễ");
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        { token: "tenant-token" },
        { page: 2, limit: 20 },
        { signal: expect.any(AbortSignal) },
      ),
    );
    await screen.findByText("Lịch nghỉ lễ");
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Làm mới" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    total = 20;
    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        { token: "tenant-token" },
        { page: 1, limit: 20 },
        { signal: expect.any(AbortSignal) },
      ),
    );
    await screen.findByText("Lịch nghỉ lễ");
    expect(screen.queryByText("Chưa có thông báo phù hợp bộ lọc")).toBeNull();
  });

  it("sửa thông báo và xóa target cũ khi đổi về toàn trung tâm", async () => {
    renderPage();
    await screen.findByText("Điều chỉnh lịch học");

    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    fireEvent.change(screen.getByLabelText("Phạm vi nhận thông báo"), {
      target: { value: "TENANT" },
    });
    fireEvent.change(screen.getByLabelText("Tiêu đề thông báo"), {
      target: { value: "Điều chỉnh lịch học tuần này" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thông báo" }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        { token: "tenant-token" },
        "announcement-draft",
        {
          audience: "TENANT",
          body: "Lớp nghỉ học vào chiều thứ bảy.",
          cohortId: null,
          orgUnitId: null,
          recipientRoles: ["LEARNER", "GUARDIAN"],
          title: "Điều chỉnh lịch học tuần này",
        },
      ),
    );
  });

  it("phát hành và lưu trữ từ đúng thông báo nháp", async () => {
    renderPage();
    await screen.findByText("Điều chỉnh lịch học");

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận phát hành" }));
    await waitFor(() =>
      expect(mocks.publish).toHaveBeenCalledWith(
        { token: "tenant-token" },
        "announcement-draft",
      ),
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: "Xác nhận lưu trữ" })[0],
    );
    await waitFor(() =>
      expect(mocks.archive).toHaveBeenCalledWith(
        { token: "tenant-token" },
        "announcement-draft",
      ),
    );
  });

  it("hiển thị empty state khi chưa có thông báo phù hợp", async () => {
    mocks.response = [];
    renderPage();

    expect(
      await screen.findByText("Chưa có thông báo phù hợp bộ lọc"),
    ).toBeTruthy();
  });
});
