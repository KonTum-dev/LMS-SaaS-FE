// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GuardianRelationship } from "@/lib/guardian-api";
import type { EffectiveAccess } from "@/lib/types";
import GuardiansPage from "./page";

const mocks = vi.hoisted(() => ({
  archive: vi.fn(),
  create: vi.fn(),
  listByLearner: vi.fn(),
  listDirectory: vi.fn(),
  listForCurrentGuardian: vi.fn(),
  listLearners: vi.fn(),
  membershipId: "membership-1" as string | undefined,
  readOnly: false,
  role: "TENANT_ADMIN",
  update: vi.fn(),
}));

vi.mock("@/lib/guardian-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/guardian-api")>()),
  guardianApi: {
    archive: mocks.archive,
    create: mocks.create,
    listByLearner: mocks.listByLearner,
    listDirectory: mocks.listDirectory,
    listForCurrentGuardian: mocks.listForCurrentGuardian,
    listLearners: mocks.listLearners,
    update: mocks.update,
  },
}));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: {
      graceEndsAt: null,
      limits: {
        maxActiveLearners: null,
        maxBranches: null,
        maxCourses: 10,
        maxUsers: 100,
      },
      modules: ["USERS"],
      readOnly: mocks.readOnly,
      state: mocks.readOnly ? "READ_ONLY" : "ACTIVE",
    } satisfies EffectiveAccess,
    organization: { _id: "tenant-1" },
    token: "tenant-token",
    user: {
      email: "viewer@example.test",
      fullName: "Viewer",
      membershipId: mocks.membershipId,
      role: mocks.role,
      sub:
        mocks.role === "LEARNER"
          ? "learner-1"
          : mocks.role === "GUARDIAN"
            ? "guardian-1"
            : "viewer-1",
      tenantId: "tenant-1",
    },
  }),
}));
vi.mock("@ant-design/icons", () => ({
  DeleteOutlined: () => null,
  EditOutlined: () => null,
  PlusOutlined: () => null,
  TeamOutlined: () => null,
}));
vi.mock("antd", async () =>
  (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

const learnerDirectory = {
  _id: "membership-learner-1",
  accountStatus: "ACTIVE" as const,
  email: "learner@example.test",
  fullName: "Lê Học Viên",
  membershipId: "membership-learner-1",
  role: "LEARNER" as const,
  status: "ACTIVE" as const,
  tenantId: "tenant-1",
  userId: "learner-1",
};
const guardianDirectory = {
  _id: "membership-guardian-1",
  accountStatus: "ACTIVE" as const,
  email: "guardian@example.test",
  fullName: "Trần Phụ Huynh",
  membershipId: "membership-guardian-1",
  role: "GUARDIAN" as const,
  status: "ACTIVE" as const,
  tenantId: "tenant-1",
  userId: "guardian-1",
};
const relationship: GuardianRelationship = {
  _id: "relationship-1",
  canReceiveAcademicUpdates: true,
  canReceiveBillingUpdates: true,
  createdAt: "2030-09-01T08:00:00.000Z",
  guardianId: {
    _id: "guardian-1",
    email: "guardian@example.test",
    fullName: "Trần Phụ Huynh",
  },
  learnerId: {
    _id: "learner-1",
    email: "learner@example.test",
    fullName: "Lê Học Viên",
  },
  primaryContact: true,
  relationshipType: "PARENT",
  status: "ACTIVE",
  tenantId: "tenant-1",
  updatedAt: "2030-09-01T08:00:00.000Z",
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <GuardiansPage />
    </QueryClientProvider>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function expectDisabled(name: string) {
  expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
}

function fillCreateForm() {
  fireEvent.change(screen.getByLabelText("Học viên"), { target: { value: "learner-1" } });
  fireEvent.change(screen.getByLabelText("Phụ huynh / người giám hộ"), { target: { value: "guardian-1" } });
  fireEvent.change(screen.getByLabelText("Mối quan hệ"), { target: { value: "PARENT" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Nhận cập nhật học tập" }));
}

async function selectLearner() {
  await screen.findByRole("option", { name: /Lê Học Viên/ });
  fireEvent.change(screen.getByLabelText("Chọn học viên để tra cứu"), {
    target: { value: "learner-1" },
  });
  await screen.findByText("Trần Phụ Huynh");
}

beforeEach(() => {
  mocks.archive.mockReset();
  mocks.archive.mockResolvedValue({
    ...relationship,
    status: "INACTIVE",
  });
  mocks.create.mockReset();
  mocks.create.mockResolvedValue(relationship);
  mocks.listByLearner.mockReset();
  mocks.listByLearner.mockResolvedValue([relationship]);
  mocks.listDirectory.mockReset();
  mocks.listDirectory.mockResolvedValue([learnerDirectory, guardianDirectory]);
  mocks.listForCurrentGuardian.mockReset();
  mocks.listForCurrentGuardian.mockResolvedValue([relationship]);
  mocks.listLearners.mockReset();
  mocks.listLearners.mockResolvedValue([
    { ...learnerDirectory, _id: "learner-1", userId: undefined },
  ]);
  mocks.membershipId = "membership-1";
  mocks.readOnly = false;
  mocks.role = "TENANT_ADMIN";
  mocks.update.mockReset();
  mocks.update.mockResolvedValue(relationship);
});

afterEach(cleanup);

describe("GuardiansPage", () => {
  it("deduplicates repeated creates, locks consent and modal controls, and permits retry after failure", async () => {
    const pending = deferred<GuardianRelationship>();
    mocks.create.mockReturnValueOnce(pending.promise);
    renderPage();
    await selectLearner();
    fireEvent.click(screen.getByRole("button", { name: "Thêm người giám hộ" }));
    fillCreateForm();
    const form = screen.getByRole("button", { name: "Lưu quan hệ" }).closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    for (const name of ["Hủy", "Lưu quan hệ", "Thêm người giám hộ", "Sửa quan hệ Trần Phụ Huynh", "Lưu trữ quan hệ Trần Phụ Huynh", "Xác nhận lưu trữ"]) expectDisabled(name);
    expect((screen.getByLabelText("Học viên") as HTMLSelectElement).disabled).toBe(true);
    const consent = screen.getByRole("checkbox", { name: "Nhận cập nhật học tập" }) as HTMLInputElement;
    expect(consent.disabled).toBe(true);
    expect(consent.checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => pending.reject(new Error("Temporary failure")));
    await waitFor(() => expect((screen.getByRole("button", { name: "Lưu quan hệ" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(consent.checked).toBe(true);
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.archive).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("serializes consent updates against archive/create and holds the lock until refresh completes", async () => {
    const pending = deferred<GuardianRelationship>();
    const refresh = deferred<GuardianRelationship[]>();
    mocks.update.mockReturnValueOnce(pending.promise);
    renderPage();
    await selectLearner();
    fireEvent.click(screen.getByRole("button", { name: "Sửa quan hệ Trần Phụ Huynh" }));
    fireEvent.change(screen.getByLabelText("Mối quan hệ"), { target: { value: "GUARDIAN" } });
    fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "ACTIVE" } });
    const form = screen.getByRole("button", { name: "Lưu thay đổi" }).closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update).toHaveBeenCalledWith({ token: "tenant-token" }, "relationship-1", expect.objectContaining({ canReceiveAcademicUpdates: false }));
    for (const name of ["Hủy", "Lưu thay đổi", "Thêm người giám hộ", "Xác nhận lưu trữ"]) expectDisabled(name);
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận lưu trữ" }));
    expect(mocks.archive).not.toHaveBeenCalled();
    mocks.listByLearner.mockReturnValueOnce(refresh.promise);
    await act(async () => pending.resolve(relationship));
    await waitFor(() => expect(mocks.listByLearner).toHaveBeenCalledTimes(2));
    expectDisabled("Thêm người giám hộ");
    expectDisabled("Xác nhận lưu trữ");
    await act(async () => refresh.resolve([relationship]));
    await waitFor(() => expect((screen.getByRole("button", { name: "Xác nhận lưu trữ" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận lưu trữ" }));
    await waitFor(() => expect(mocks.archive).toHaveBeenCalledTimes(1));
  });

  it("deduplicates archive and prevents opening conflicting forms while it is pending", async () => {
    const pending = deferred<GuardianRelationship>();
    mocks.archive.mockReturnValueOnce(pending.promise);
    renderPage();
    await selectLearner();
    const confirm = screen.getByRole("button", { name: "Xác nhận lưu trữ" });
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm); });
    await waitFor(() => expect(mocks.archive).toHaveBeenCalledTimes(1));
    expectDisabled("Sửa quan hệ Trần Phụ Huynh");
    expectDisabled("Thêm người giám hộ");
    fireEvent.click(screen.getByRole("button", { name: "Sửa quan hệ Trần Phụ Huynh" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => pending.resolve(relationship));
    await waitFor(() => expect((screen.getByRole("button", { name: "Sửa quan hệ Trần Phụ Huynh" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Sửa quan hệ Trần Phụ Huynh" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("links tenant admins to parent account management and excludes inactive or wrong-role accounts", async () => {
    mocks.listDirectory.mockResolvedValue([
      learnerDirectory, guardianDirectory,
      { ...guardianDirectory, _id: "inactive-member", userId: "inactive", fullName: "Inactive membership", status: "INACTIVE" },
      { ...guardianDirectory, _id: "disabled-user", userId: "disabled", fullName: "Disabled account", accountStatus: "INACTIVE" },
      { ...guardianDirectory, _id: "instructor", userId: "instructor", fullName: "Instructor account", role: "INSTRUCTOR" },
    ]);
    renderPage();
    await selectLearner();
    expect(screen.getByRole("button", { name: "Tài khoản phụ huynh" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Thêm người giám hộ" }));
    expect(screen.getByRole("option", { name: /Trần Phụ Huynh/ })).toBeTruthy();
    for (const name of ["Inactive membership", "Disabled account", "Instructor account"]) {
      expect(screen.queryByRole("option", { name: new RegExp(name) })).toBeNull();
    }
  });

  it("does not expose account management to a guardian", async () => {
    mocks.role = "GUARDIAN";
    renderPage();
    await screen.findByText("Trần Phụ Huynh");
    expect(screen.queryByText("Tài khoản phụ huynh")).toBeNull();
  });
  it("admin tải user directory và yêu cầu chọn learner trước khi đọc quan hệ", async () => {
    renderPage();

    expect(
      await screen.findByText("Chọn một học viên để xem quan hệ người giám hộ"),
    ).toBeTruthy();
    expect(mocks.listDirectory).toHaveBeenCalledWith(
      { token: "tenant-token" },
      { signal: expect.any(AbortSignal) },
    );
    expect(mocks.listByLearner).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Thêm người giám hộ" })).toBeTruthy();
  });

  it("admin đọc learner scope và thấy summary cùng mutation actions", async () => {
    renderPage();
    await selectLearner();

    expect(mocks.listByLearner).toHaveBeenCalledWith(
      { token: "tenant-token" },
      "learner-1",
      { status: "ACTIVE" },
      { signal: expect.any(AbortSignal) },
    );
    expect(screen.getByText("1 quan hệ")).toBeTruthy();
    expect(screen.getByText("Cập nhật học phí")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Sửa quan hệ Trần Phụ Huynh" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Lưu trữ quan hệ Trần Phụ Huynh",
      }),
    ).toBeTruthy();
  });

  it("instructor dùng learner directory giới hạn và không thấy dữ liệu học phí", async () => {
    mocks.role = "INSTRUCTOR";
    mocks.listByLearner.mockResolvedValueOnce([
      { ...relationship, canReceiveBillingUpdates: undefined },
    ]);
    renderPage();
    await selectLearner();

    expect(mocks.listLearners).toHaveBeenCalledWith(
      { token: "tenant-token" },
      { signal: expect.any(AbortSignal) },
    );
    expect(mocks.listDirectory).not.toHaveBeenCalled();
    expect(screen.getByText("Đã đồng ý nhận cập nhật học tập")).toBeTruthy();
    expect(screen.queryByText("Nhận cập nhật học phí")).toBeNull();
    expect(screen.queryByText("Cập nhật học phí")).toBeNull();
    expect(screen.queryByRole("button", { name: "Thêm người giám hộ" })).toBeNull();
  });

  it("learner tự đọc quan hệ của chính mình và không tải directory", async () => {
    mocks.role = "LEARNER";
    renderPage();

    expect(await screen.findByText("Trần Phụ Huynh")).toBeTruthy();
    expect(mocks.listByLearner).toHaveBeenCalledWith(
      { token: "tenant-token" },
      "learner-1",
      { status: "ACTIVE" },
      { signal: expect.any(AbortSignal) },
    );
    expect(mocks.listDirectory).not.toHaveBeenCalled();
    expect(mocks.listLearners).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Thêm người giám hộ" })).toBeNull();
    expect(screen.queryByText("Thao tác")).toBeNull();
  });

  it("guardian dùng /guardians/me và có thể lọc quan hệ đã lưu trữ", async () => {
    mocks.role = "GUARDIAN";
    renderPage();

    expect(await screen.findByText("Trần Phụ Huynh")).toBeTruthy();
    expect(mocks.listForCurrentGuardian).toHaveBeenCalledWith(
      { token: "tenant-token" },
      { status: "ACTIVE" },
      { signal: expect.any(AbortSignal) },
    );
    fireEvent.change(screen.getByLabelText("Lọc trạng thái quan hệ"), {
      target: { value: "INACTIVE" },
    });
    await waitFor(() =>
      expect(mocks.listForCurrentGuardian).toHaveBeenCalledWith(
        { token: "tenant-token" },
        { status: "INACTIVE" },
        { signal: expect.any(AbortSignal) },
      ),
    );
    expect(mocks.listDirectory).not.toHaveBeenCalled();
  });

  it("fail closed cho role không hỗ trợ và membership không hợp lệ", () => {
    mocks.role = "SUPER_ADMIN";
    const first = renderPage();
    expect(
      screen.getByText("Bạn không có quyền truy cập quan hệ người giám hộ."),
    ).toBeTruthy();
    expect(mocks.listDirectory).not.toHaveBeenCalled();
    first.unmount();

    mocks.role = "TENANT_ADMIN";
    mocks.membershipId = undefined;
    renderPage();
    expect(
      screen.getByText("Phiên làm việc thiếu phạm vi thành viên hợp lệ."),
    ).toBeTruthy();
    expect(mocks.listDirectory).not.toHaveBeenCalled();
  });

  it("workspace READ_ONLY vẫn đọc nhưng khóa create/edit/archive", async () => {
    mocks.readOnly = true;
    renderPage();
    await selectLearner();

    expect(screen.getByText("Workspace đang ở chế độ chỉ đọc")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Thêm người giám hộ" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Sửa quan hệ Trần Phụ Huynh",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Lưu trữ quan hệ Trần Phụ Huynh",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("admin tạo quan hệ từ learner và guardian trong /users", async () => {
    renderPage();
    const addButton = await screen.findByRole("button", {
      name: "Thêm người giám hộ",
    });
    await waitFor(() => expect((addButton as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(addButton);

    fireEvent.change(screen.getByLabelText("Học viên"), {
      target: { value: "learner-1" },
    });
    fireEvent.change(screen.getByLabelText("Phụ huynh / người giám hộ"), {
      target: { value: "guardian-1" },
    });
    fireEvent.change(screen.getByLabelText("Mối quan hệ"), {
      target: { value: "PARENT" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Đặt làm liên hệ chính" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Nhận cập nhật học tập" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Nhận cập nhật học phí" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu quan hệ" }));

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        { token: "tenant-token" },
        {
          canReceiveAcademicUpdates: true,
          canReceiveBillingUpdates: true,
          guardianId: "guardian-1",
          learnerId: "learner-1",
          primaryContact: true,
          relationshipType: "PARENT",
        },
      ),
    );
  });

  it("admin sửa và kích hoạt lại một quan hệ", async () => {
    renderPage();
    await selectLearner();
    fireEvent.click(
      screen.getByRole("button", { name: "Sửa quan hệ Trần Phụ Huynh" }),
    );

    fireEvent.change(screen.getByLabelText("Mối quan hệ"), {
      target: { value: "GUARDIAN" },
    });
    fireEvent.change(screen.getByLabelText("Trạng thái"), {
      target: { value: "ACTIVE" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Nhận cập nhật học tập" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        { token: "tenant-token" },
        "relationship-1",
        expect.objectContaining({
          canReceiveAcademicUpdates: true,
          relationshipType: "GUARDIAN",
          status: "ACTIVE",
        }),
      ),
    );
  });

  it("admin lưu trữ quan hệ đang hoạt động", async () => {
    renderPage();
    await selectLearner();
    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận lưu trữ" }),
    );

    await waitFor(() =>
      expect(mocks.archive).toHaveBeenCalledWith(
        { token: "tenant-token" },
        "relationship-1",
      ),
    );
  });

  it("hiển thị lỗi quan hệ nhưng vẫn giữ bộ lọc để thử lại", async () => {
    mocks.listByLearner.mockRejectedValueOnce(new Error("Không thể kết nối"));
    renderPage();
    await screen.findByRole("option", { name: /Lê Học Viên/ });
    fireEvent.change(screen.getByLabelText("Chọn học viên để tra cứu"), {
      target: { value: "learner-1" },
    });

    expect(
      await screen.findByText("Không tải được quan hệ người giám hộ"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeTruthy();
  });
});
