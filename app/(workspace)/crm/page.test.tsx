// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { CurrentUser, EffectiveAccess, Organization } from "@/lib/types";
import CrmPage from "./page";

const mocks = vi.hoisted(() => ({
  api: { options: vi.fn(), list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), addNote: vi.fn() },
  session: {
    token: "tenant-token", loading: false,
    user: null as CurrentUser | null,
    organization: null as Organization | null,
    effectiveAccess: null as EffectiveAccess | null,
  },
}));

vi.mock("@/lib/tenant-crm-api", () => ({ tenantCrmApi: mocks.api }));
vi.mock("@/components/providers/app-providers", () => ({ useAuth: () => mocks.session }));
vi.mock("antd", async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd);
vi.mock("@ant-design/icons", () => ({ CalendarOutlined: () => null, ContactsOutlined: () => null, MessageOutlined: () => null, PlusOutlined: () => null, ReloadOutlined: () => null }));

const contactId = "64f000000000000000000030";
const unitId = "64f000000000000000000040";
function contact(overrides: Record<string, unknown> = {}) {
  return {
    _id: contactId, fullName: "Nguyễn An", phone: "+84901234567", email: "an@example.test",
    kind: "GUARDIAN", stage: "NEW", source: "ZALO_MINI_APP", orgUnitId: unitId,
    userId: "64f000000000000000000021", nextFollowUpAt: "2020-09-01T09:00:00.000Z", revision: 4,
    createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T01:00:00.000Z", canEdit: true,
    zalo: { displayName: "An trên Zalo", avatarUrl: null, phone: null, phoneShared: false, consentVersion: "v1", syncedAt: "2026-09-01T00:00:00.000Z" },
    history: [{ id: "note-1", type: "NOTE", at: "2026-09-01T01:00:00.000Z", actorId: "64f000000000000000000022", fields: [], note: "Quan tâm lớp tiếng Anh buổi tối." }],
    ...overrides,
  };
}
const options = { canCreate: true, scoped: false, orgUnits: [{ _id: unitId, name: "Chi nhánh Hà Nội", canWrite: true }] };
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { ...render(<CrmPage />, { wrapper }), client };
}
async function openContact() {
  const buttons = await screen.findAllByRole("button", { name: "Chi tiết: Nguyễn An" });
  fireEvent.click(buttons[0]);
  await screen.findByLabelText("Họ và tên *");
  return screen.getByRole("dialog");
}
function change(label: string, value: string, root?: HTMLElement) {
  fireEvent.change((root ? within(root) : screen).getByLabelText(label), { target: { value } });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.token = "tenant-token";
  mocks.session.loading = false;
  mocks.session.user = { sub: "64f000000000000000000021", tenantId: "tenant-1", membershipId: "membership-1", role: "TENANT_ADMIN", email: "admin@example.test", fullName: "Tenant Admin", orgUnitScopeMode: "GLOBAL" };
  mocks.session.organization = { _id: "tenant-1", enabledModules: ["USERS"], logoUrl: null, name: "Bright Academy", primaryColor: "#176BFF", slug: "bright", status: "ACTIVE" };
  mocks.session.effectiveAccess = { modules: ["USERS"], readOnly: false, state: "ACTIVE", graceEndsAt: null, limits: { maxActiveLearners: null, maxBranches: null, maxCourses: null, maxUsers: null } };
  mocks.api.options.mockResolvedValue(options);
  mocks.api.list.mockResolvedValue({ items: [contact()], page: 1, limit: 20, total: 41 });
  mocks.api.get.mockResolvedValue(contact());
  mocks.api.create.mockResolvedValue(contact({ _id: "64f000000000000000000031", fullName: "Trần Bình", revision: 0, source: "MANUAL", zalo: null }));
  mocks.api.update.mockResolvedValue(contact({ revision: 5, stage: "CONTACTED" }));
  mocks.api.addNote.mockResolvedValue(contact({ revision: 5, history: [{ id: "note-2", type: "NOTE", at: "2026-09-05T01:00:00.000Z", actorId: "64f000000000000000000022", fields: [], note: "Gọi lại vào thứ Hai." }] }));
});
afterEach(cleanup);

describe("Tenant CRM page", () => {
  it.each(["SUPER_ADMIN", "INSTRUCTOR", "LEARNER", "GUARDIAN"] as const)("rejects %s before any CRM requests", (role) => {
    mocks.session.user = { ...mocks.session.user!, role };
    renderPage();
    expect(screen.getByText("Bạn chưa có quyền quản lý CRM của trung tâm này.")).toBeTruthy();
    expect(mocks.api.options).not.toHaveBeenCalled();
    expect(mocks.api.list).not.toHaveBeenCalled();
    expect(mocks.api.get).not.toHaveBeenCalled();
  });

  it.each(["missing-membership", "wrong-tenant", "module-disabled", "signed-out"])("does not fetch CRM for %s", (state) => {
    if (state === "missing-membership") mocks.session.user = { ...mocks.session.user!, membershipId: undefined };
    if (state === "wrong-tenant") mocks.session.organization = { ...mocks.session.organization!, _id: "other-tenant" };
    if (state === "module-disabled") mocks.session.effectiveAccess = { ...mocks.session.effectiveAccess!, modules: [] };
    if (state === "signed-out") mocks.session.user = null;
    renderPage();
    expect(mocks.api.list).not.toHaveBeenCalled();
    expect(mocks.api.options).not.toHaveBeenCalled();
  });

  it("lists contacts and reads details without mutation controls during read-only access", async () => {
    mocks.session.effectiveAccess = { ...mocks.session.effectiveAccess!, readOnly: true, state: "READ_ONLY" };
    renderPage();
    const dialog = await openContact();
    expect(screen.getByText("Workspace đang ở chế độ chỉ đọc. Bạn có thể xem hồ sơ, nhưng chưa thể thêm hoặc chỉnh sửa.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Thêm liên hệ" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog).getByLabelText("Họ và tên *") as HTMLInputElement).disabled).toBe(true);
    expect(within(dialog).queryByRole("button", { name: "Lưu thay đổi" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Thêm ghi chú" })).toBeNull();
    expect(mocks.api.create).not.toHaveBeenCalled();
    expect(mocks.api.update).not.toHaveBeenCalled();
  });

  it("uses per-contact and branch capabilities even when the subscription is writable", async () => {
    mocks.session.user = { ...mocks.session.user!, orgUnitScopeMode: "SCOPED" };
    mocks.api.options.mockResolvedValue({ canCreate: false, scoped: true, orgUnits: [{ ...options.orgUnits[0], canWrite: false }] });
    mocks.api.get.mockResolvedValue(contact({ canEdit: false }));
    renderPage();
    const dialog = await openContact();
    expect(screen.getByText("Chỉ hiển thị liên hệ trong phạm vi chi nhánh bạn được phân quyền.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Thêm liên hệ" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).getByText("Bạn có quyền xem hồ sơ này, chưa có quyền chỉnh sửa.")).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "Thêm ghi chú" })).toBeNull();
  });

  it("sends filter values and resets pagination when search changes", async () => {
    renderPage();
    await screen.findAllByRole("button", { name: "Chi tiết: Nguyễn An" });
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() => expect(mocks.api.list).toHaveBeenLastCalledWith({ token: "tenant-token" }, expect.objectContaining({ page: 2, limit: 20 }), expect.anything()));
    change("Tìm tên, điện thoại hoặc email", "Nguyễn");
    change("Mọi trạng thái", "QUALIFIED");
    change("Mọi nguồn", "ZALO_MINI_APP");
    change("Mọi lịch chăm sóc", "OVERDUE");
    change("Mọi chi nhánh", unitId);
    await waitFor(() => expect(mocks.api.list).toHaveBeenLastCalledWith({ token: "tenant-token" }, { search: "Nguyễn", stage: "QUALIFIED", source: "ZALO_MINI_APP", followUp: "OVERDUE", orgUnitId: unitId, page: 1, limit: 20 }, expect.objectContaining({ signal: expect.any(AbortSignal) })));
  });

  it("creates a contact with the selected branch and only contact fields", async () => {
    renderPage();
    const create = screen.getByRole("button", { name: "Thêm liên hệ" });
    await waitFor(() => expect((create as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(create);
    const dialog = screen.getByRole("dialog");
    change("Họ và tên *", " Trần Bình ", dialog);
    change("Số điện thoại", "090 123 4567", dialog);
    change("Email", "binh@example.test", dialog);
    change("Chi nhánh", unitId, dialog);
    const form = within(dialog).getByRole("button", { name: "Thêm liên hệ" }).closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.api.create).toHaveBeenCalledTimes(1));
    expect(mocks.api.create).toHaveBeenCalledWith({ token: "tenant-token" }, { fullName: "Trần Bình", phone: "0901234567", email: "binh@example.test", kind: "LEAD", stage: "NEW", orgUnitId: unitId, nextFollowUpAt: null }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("PATCHes only changed fields so prefilled Zalo phone/name are not promoted to manual curation", async () => {
    renderPage();
    const dialog = await openContact();
    change("Trạng thái", "CONTACTED", dialog);
    fireEvent.submit(within(dialog).getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    await waitFor(() => expect(mocks.api.update).toHaveBeenCalledTimes(1));
    expect(mocks.api.update).toHaveBeenCalledWith({ token: "tenant-token" }, contactId, { stage: "CONTACTED", revision: 4 }, expect.anything());
    await screen.findByText("Đã lưu thông tin liên hệ.");
  });

  it("rejects a phone with too few digits after formatting is stripped", async () => {
    renderPage();
    const dialog = await openContact();
    change("Số điện thoại", "1--------------2", dialog);
    fireEvent.submit(within(dialog).getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    expect(await screen.findByText("Số điện thoại cần 7–20 chữ số, có thể bắt đầu bằng dấu +.")).toBeTruthy();
    expect(mocks.api.update).not.toHaveBeenCalled();
  });

  it("prevents a note from discarding a dirty contact draft and vice versa", async () => {
    renderPage();
    const dialog = await openContact();
    change("Trạng thái", "QUALIFIED", dialog);
    expect((within(dialog).getByLabelText("Ghi chú chăm sóc") as HTMLTextAreaElement).disabled).toBe(true);
    expect((within(dialog).getByRole("button", { name: "Thêm ghi chú" }) as HTMLButtonElement).disabled).toBe(true);
    change("Trạng thái", "NEW", dialog);
    change("Ghi chú chăm sóc", "Unsubmitted note", dialog);
    expect((within(dialog).getByLabelText("Trạng thái") as HTMLSelectElement).disabled).toBe(true);
    expect(within(dialog).queryByRole("button", { name: "Lưu thay đổi" })).toBeNull();
    expect(mocks.api.update).not.toHaveBeenCalled();
    expect(mocks.api.addNote).not.toHaveBeenCalled();
  });

  it("clears phone and follow-up explicitly without resubmitting unrelated values", async () => {
    renderPage();
    const dialog = await openContact();
    change("Số điện thoại", "", dialog);
    change("Chăm sóc tiếp theo", "", dialog);
    fireEvent.submit(within(dialog).getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    await waitFor(() => expect(mocks.api.update).toHaveBeenCalledWith({ token: "tenant-token" }, contactId, { phone: null, nextFollowUpAt: null, revision: 4 }, expect.anything()));
  });

  it("shows the separately shared Zalo snapshot and CRM notes; adds a revision-bound note", async () => {
    renderPage();
    const dialog = await openContact();
    expect(within(dialog).getByText("An trên Zalo")).toBeTruthy();
    expect(within(dialog).getByText("Chưa chia sẻ số điện thoại Zalo")).toBeTruthy();
    expect(within(dialog).getByText("Quan tâm lớp tiếng Anh buổi tối.")).toBeTruthy();
    change("Ghi chú chăm sóc", "  Gọi lại vào thứ Hai.  ", dialog);
    fireEvent.submit(within(dialog).getByRole("button", { name: "Thêm ghi chú" }).closest("form")!);
    await waitFor(() => expect(mocks.api.addNote).toHaveBeenCalledWith({ token: "tenant-token" }, contactId, { body: "Gọi lại vào thứ Hai.", revision: 4 }, expect.anything()));
    await screen.findByText("Đã thêm ghi chú chăm sóc.");
    expect(screen.getByText("Gọi lại vào thứ Hai.")).toBeTruthy();
  });

  it("keeps a rejected draft, offers reload on 409, then uses the refreshed revision", async () => {
    mocks.api.update.mockRejectedValueOnce(new ApiError("Changed", 409, "CRM_CONTACT_CHANGED"));
    renderPage();
    let dialog = await openContact();
    change("Trạng thái", "QUALIFIED", dialog);
    fireEvent.submit(within(dialog).getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    await screen.findByText("Hồ sơ vừa được cập nhật ở nơi khác. Hãy tải lại hồ sơ, kiểm tra rồi lưu lại.");
    expect((within(dialog).getByLabelText("Trạng thái") as HTMLSelectElement).value).toBe("QUALIFIED");
    mocks.api.get.mockResolvedValue(contact({ revision: 8, stage: "CONTACTED" }));
    fireEvent.click(screen.getByRole("button", { name: "Tải lại hồ sơ" }));
    await waitFor(() => expect((screen.getByLabelText("Trạng thái") as HTMLSelectElement).value).toBe("CONTACTED"));
    dialog = screen.getByRole("dialog");
    change("Trạng thái", "QUALIFIED", dialog);
    fireEvent.submit(within(dialog).getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    await waitFor(() => expect(mocks.api.update).toHaveBeenLastCalledWith({ token: "tenant-token" }, contactId, { stage: "QUALIFIED", revision: 8 }, expect.anything()));
  });

  it("deduplicates concurrent form submits and locks the dialog while saving", async () => {
    const pending = deferred<ReturnType<typeof contact>>();
    mocks.api.update.mockReturnValueOnce(pending.promise);
    renderPage();
    const dialog = await openContact();
    change("Trạng thái", "CONTACTED", dialog);
    const form = within(dialog).getByRole("button", { name: "Lưu thay đổi" }).closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    await waitFor(() => expect(mocks.api.update).toHaveBeenCalledTimes(1));
    expect((within(dialog).getByRole("button", { name: "Đóng" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog).getByLabelText("Họ và tên *") as HTMLInputElement).disabled).toBe(true);
    await act(async () => pending.resolve(contact({ revision: 5, stage: "CONTACTED" })));
    await screen.findByText("Đã lưu thông tin liên hệ.");
  });

  it("discards private draft/filter state and aborts an in-flight mutation when tenant changes", async () => {
    const pending = deferred<ReturnType<typeof contact>>();
    mocks.api.update.mockReturnValueOnce(pending.promise);
    const view = renderPage();
    change("Tìm tên, điện thoại hoặc email", "private-filter");
    const dialog = await openContact();
    change("Họ và tên *", "Private draft from first tenant", dialog);
    fireEvent.submit(within(dialog).getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
    await waitFor(() => expect(mocks.api.update).toHaveBeenCalledTimes(1));
    const request = mocks.api.update.mock.calls[0][3] as { signal: AbortSignal };
    mocks.session.token = "other-token";
    mocks.session.user = { ...mocks.session.user!, tenantId: "tenant-2", membershipId: "membership-2" };
    mocks.session.organization = { ...mocks.session.organization!, _id: "tenant-2", name: "Other Center" };
    mocks.api.list.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    view.rerender(<CrmPage />);
    await screen.findByText("Chưa có liên hệ phù hợp");
    expect(request.signal.aborted).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((screen.getByLabelText("Tìm tên, điện thoại hoặc email") as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("Nguyễn An")).toBeNull();
    await act(async () => pending.resolve(contact({ fullName: "Private late response", revision: 5 })));
    expect(screen.queryByText("Private late response")).toBeNull();
    expect(screen.queryByText("Đã lưu thông tin liên hệ.")).toBeNull();
    expect(mocks.api.list).toHaveBeenLastCalledWith({ token: "other-token" }, { page: 1, limit: 20 }, expect.anything());
  });

  it("closes private details after a forbidden mutation", async () => {
    mocks.api.addNote.mockRejectedValueOnce(new ApiError("Forbidden", 403));
    renderPage();
    const dialog = await openContact();
    change("Ghi chú chăm sóc", "Draft note", dialog);
    fireEvent.submit(within(dialog).getByRole("button", { name: "Thêm ghi chú" }).closest("form")!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Không thể tải hoặc lưu thông tin. Vui lòng thử lại.")).toBeTruthy();
    expect(screen.queryByText("Quan tâm lớp tiếng Anh buổi tối.")).toBeNull();
  });
});
