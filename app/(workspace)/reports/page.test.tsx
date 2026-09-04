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
import type { OperationsReportOverview } from "@/lib/operations-report-api";
import type { OrgUnitTreeNode } from "@/lib/org-units-api";
import type { UserRole } from "@/lib/types";
import OperationsReportPage from "./page";

const mocks = vi.hoisted(() => ({
  message: { error: vi.fn() },
  overview: vi.fn(),
  readOnly: false,
  response: null as OperationsReportOverview | null,
  role: "TENANT_ADMIN" as UserRole,
  tree: vi.fn(),
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

vi.mock("@/lib/operations-report-api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/operations-report-api")>();
  return {
    ...actual,
    operationsReportApi: { overview: mocks.overview },
  };
});

vi.mock("@/lib/org-units-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/org-units-api")>();
  return {
    ...actual,
    orgUnitsApi: { ...actual.orgUnitsApi, tree: mocks.tree },
  };
});

vi.mock("@ant-design/icons", () => ({ ReloadOutlined: () => null }));

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
      onChange,
      options = [],
      value,
    }: {
      "aria-label"?: string;
      disabled?: boolean;
      onChange?: (value?: string) => void;
      options?: Array<{ label?: ReactNode; value: string }>;
      value?: string;
    }) => (
      <select
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value || undefined)}
        value={value ?? ""}
      >
        <option value="">Tất cả đơn vị</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  };
});

const actorId = "64b000000000000000000001";

function unit(
  values: Partial<OrgUnitTreeNode> &
    Pick<OrgUnitTreeNode, "_id" | "code" | "name" | "type">,
): OrgUnitTreeNode {
  return {
    _id: values._id,
    ancestorIds: values.ancestorIds ?? [],
    archivedAt: null,
    archivedBy: null,
    children: values.children ?? [],
    code: values.code,
    createdBy: actorId,
    depth: values.depth ?? 0,
    name: values.name,
    parentId: values.parentId ?? null,
    path: values.path ?? [values.code],
    policyOverrides: {},
    revision: 1,
    status: "ACTIVE",
    tenantId: "tenant-1",
    timezone: "Asia/Ho_Chi_Minh",
    type: values.type,
    updatedBy: actorId,
  };
}

const branch = unit({
  _id: "branch-hcm",
  ancestorIds: ["root-1"],
  code: "hcm",
  depth: 1,
  name: "Chi nhánh HCM",
  parentId: "root-1",
  path: ["bright", "hcm"],
  type: "BRANCH",
});
const root = unit({
  _id: "root-1",
  children: [branch],
  code: "bright",
  name: "Bright Academy",
  type: "ROOT",
});

const adminOverview: OperationsReportOverview = {
  attendance: {
    absent: 8,
    attendanceRatePercent: 86.5,
    excused: 4,
    late: 12,
    marked: 200,
    present: 176,
  },
  generatedAt: "2026-09-03T08:30:00.000Z",
  operations: {
    activeCohorts: 12,
    activeLearners: 240,
    completedSessions: 34,
    scheduledSessions: 40,
  },
  scope: {
    from: "2026-08-01",
    orgUnitId: null,
    tenantId: "tenant-1",
    to: "2026-08-31",
  },
  tuition: {
    collectedAmountVnd: 120_000_000,
    invoiceCount: 240,
    issuedAmountVnd: 160_000_000,
    outstandingAmountVnd: 40_000_000,
    overdueAmountVnd: 10_000_000,
  },
  units: [
    {
      attendance: {
        absent: 5,
        attendanceRatePercent: 90,
        excused: 2,
        late: 6,
        marked: 140,
        present: 127,
      },
      code: "hcm",
      name: "Chi nhánh HCM",
      operations: {
        activeCohorts: 8,
        activeLearners: 170,
        completedSessions: 25,
        scheduledSessions: 28,
      },
      orgUnitId: "branch-hcm",
      tuition: {
        collectedAmountVnd: 90_000_000,
        invoiceCount: 170,
        issuedAmountVnd: 115_000_000,
        outstandingAmountVnd: 25_000_000,
        overdueAmountVnd: 5_000_000,
      },
      type: "BRANCH",
    },
    {
      attendance: {
        absent: 3,
        attendanceRatePercent: 72,
        excused: 2,
        late: 6,
        marked: 60,
        present: 49,
      },
      code: "unassigned",
      name: "Chưa phân đơn vị",
      operations: {
        activeCohorts: 4,
        activeLearners: 70,
        completedSessions: 9,
        scheduledSessions: 12,
      },
      orgUnitId: null,
      tuition: {
        collectedAmountVnd: 30_000_000,
        invoiceCount: 70,
        issuedAmountVnd: 45_000_000,
        outstandingAmountVnd: 15_000_000,
        overdueAmountVnd: 5_000_000,
      },
      type: null,
    },
  ],
};

function instructorOverview(): OperationsReportOverview {
  return {
    ...adminOverview,
    tuition: null,
    units: adminOverview.units.map((item) => ({ ...item, tuition: null })),
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <OperationsReportPage />
    </QueryClientProvider>,
  );
}

describe("OperationsReportPage", () => {
  beforeEach(() => {
    mocks.message.error.mockReset();
    mocks.overview.mockReset();
    mocks.tree.mockReset();
    mocks.readOnly = false;
    mocks.response = adminOverview;
    mocks.role = "TENANT_ADMIN";
    mocks.overview.mockImplementation(() => Promise.resolve(mocks.response));
    mocks.tree.mockResolvedValue({ items: [root], total: 2 });
  });

  afterEach(() => cleanup());

  it("hiển thị KPI, học phí và so sánh đơn vị cho quản trị viên", async () => {
    renderPage();

    expect(await screen.findByText("Lớp đang hoạt động")).toBeTruthy();
    expect(screen.getByText("Học viên đang học")).toBeTruthy();
    expect(screen.getByText("240 hóa đơn trong kỳ")).toBeTruthy();
    expect(screen.getByText("Chi nhánh HCM")).toBeTruthy();
    expect(screen.getByText("Chưa phân đơn vị")).toBeTruthy();
    expect(screen.getByText(/120\.000\.000/)).toBeTruthy();

    expect(mocks.overview).toHaveBeenCalledWith(
      { token: "tenant-token" },
      {},
      { signal: expect.any(AbortSignal) },
    );
  });

  it("ẩn toàn bộ số liệu học phí đối với giảng viên", async () => {
    mocks.role = "INSTRUCTOR";
    mocks.response = instructorOverview();
    renderPage();

    expect(
      await screen.findByText(
        "Số liệu học phí chỉ dành cho quản trị tổ chức",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/120\.000\.000/)).toBeNull();
    expect(screen.getByText("Chi nhánh HCM")).toBeTruthy();
  });

  it("không gọi API nếu persona không có quyền xem báo cáo", () => {
    mocks.role = "LEARNER";
    renderPage();

    expect(
      screen.getByText(
        "Báo cáo vận hành chỉ dành cho quản trị tổ chức và giảng viên.",
      ),
    ).toBeTruthy();
    expect(mocks.overview).not.toHaveBeenCalled();
    expect(mocks.tree).not.toHaveBeenCalled();
  });

  it("áp dụng bộ lọc ngày và đơn vị vào request", async () => {
    renderPage();
    await screen.findByText("Lớp đang hoạt động");
    await screen.findByRole("option", { name: "Bright Academy / Chi nhánh HCM" });

    fireEvent.change(screen.getByLabelText("Từ ngày"), {
      target: { value: "2026-08-01" },
    });
    fireEvent.change(screen.getByLabelText("Đến ngày"), {
      target: { value: "2026-08-31" },
    });
    fireEvent.change(screen.getByLabelText("Đơn vị báo cáo"), {
      target: { value: "branch-hcm" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));

    await waitFor(() =>
      expect(mocks.overview).toHaveBeenCalledWith(
        { token: "tenant-token" },
        {
          from: "2026-08-01T00:00:00.000Z",
          orgUnitId: "branch-hcm",
          to: "2026-08-31T23:59:59.999Z",
        },
        { signal: expect.any(AbortSignal) },
      ),
    );
  });

  it("chặn khoảng ngày không hợp lệ trước khi gọi lại báo cáo", async () => {
    renderPage();
    await screen.findByText("Lớp đang hoạt động");
    mocks.overview.mockClear();

    fireEvent.change(screen.getByLabelText("Từ ngày"), {
      target: { value: "2026-09-01" },
    });
    fireEvent.change(screen.getByLabelText("Đến ngày"), {
      target: { value: "2026-08-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));

    expect(mocks.message.error).toHaveBeenCalledWith(
      "Ngày bắt đầu phải trước hoặc trùng ngày kết thúc",
    );
    expect(mocks.overview).not.toHaveBeenCalled();
  });

  it("không gửi khoảng thời gian nếu người dùng chỉ chọn một ngày", async () => {
    renderPage();
    await screen.findByText("Lớp đang hoạt động");
    mocks.overview.mockClear();

    fireEvent.change(screen.getByLabelText("Từ ngày"), {
      target: { value: "2026-09-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));

    expect(mocks.message.error).toHaveBeenCalledWith(
      "Vui lòng chọn đủ ngày bắt đầu và ngày kết thúc",
    );
    expect(mocks.overview).not.toHaveBeenCalled();
  });

  it("giải thích rõ khi workspace chỉ đọc", async () => {
    mocks.readOnly = true;
    renderPage();

    expect(await screen.findByText("Workspace chỉ đọc")).toBeTruthy();
    expect(screen.getByText(/vẫn có thể xem, lọc và làm mới/)).toBeTruthy();
  });

  it("hiển thị empty state khi phạm vi chưa có dữ liệu", async () => {
    mocks.response = {
      ...adminOverview,
      attendance: {
        absent: 0,
        attendanceRatePercent: 0,
        excused: 0,
        late: 0,
        marked: 0,
        present: 0,
      },
      operations: {
        activeCohorts: 0,
        activeLearners: 0,
        completedSessions: 0,
        scheduledSessions: 0,
      },
      tuition: {
        collectedAmountVnd: 0,
        invoiceCount: 0,
        issuedAmountVnd: 0,
        outstandingAmountVnd: 0,
        overdueAmountVnd: 0,
      },
      units: [],
    };
    renderPage();

    expect(
      await screen.findByText(
        "Chưa có dữ liệu vận hành trong phạm vi đã chọn",
      ),
    ).toBeTruthy();
  });
});
