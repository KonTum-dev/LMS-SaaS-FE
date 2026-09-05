// @vitest-environment jsdom

import {
  defaultScheduler,
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EffectiveAccess } from "@/lib/types";
import CoursesPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  effectiveAccess: null as EffectiveAccess | null,
  push: vi.fn(),
  scopeMode: undefined as "GLOBAL" | "SCOPED" | undefined,
}));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: mocks.effectiveAccess,
    organization: {
      _id: "tenant-1",
      enabledModules: ["USERS", "COURSES", "ENROLLMENTS", "ASSIGNMENTS"],
      logoUrl: null,
      name: "Tenant One",
      primaryColor: "#176BFF",
      slug: "tenant-one",
      status: "ACTIVE",
    },
    token: "tenant-token",
    user: {
      email: "owner@example.test",
      fullName: "Owner",
      membershipId: "membership-1",
      orgUnitScopeMode: mocks.scopeMode,
      role: "TENANT_ADMIN",
      sub: "owner-1",
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
vi.mock(
  "antd",
  async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

const course = {
  _id: "course-1",
  description: "Mô tả",
  slug: "course-one",
  status: "PUBLISHED" as const,
  title: "Khóa học Một",
};

function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function installApiResponses() {
  mocks.apiFetch.mockImplementation((path: string) => {
    if (path === "/courses") return Promise.resolve([course]);
    if (path === "/courses/eligible-instructors?limit=20&page=1") {
      return Promise.resolve({
        items: [
          {
            email: "teacher@example.test",
            fullName: "Teacher",
            userId: "teacher-1",
          },
        ],
        limit: 20,
        page: 1,
        total: 1,
      });
    }
    if (
      path === "/enrollments/courses/course-1/eligible-learners?limit=20&page=1"
    ) {
      return Promise.resolve({
        items: [
          {
            email: "new@example.test",
            fullName: "New Learner",
            userId: "learner-2",
          },
        ],
        limit: 20,
        page: 1,
        total: 1,
      });
    }
    if (path === "/enrollments/courses/course-1/roster?limit=20&page=1") {
      return Promise.resolve({
        items: [
          {
            _id: "enrollment-1",
            status: "ACTIVE",
            userId: {
              _id: "learner-1",
              email: "learner@example.test",
              fullName: "Learner One",
            },
          },
        ],
        limit: 20,
        page: 1,
        total: 1,
      });
    }
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CoursesPage />
    </QueryClientProvider>,
  );
  return client;
}

describe("course people directories", () => {
  beforeEach(() => {
    notifyManager.setScheduler((callback) => queueMicrotask(callback));
    mocks.apiFetch.mockReset();
    mocks.push.mockReset();
    mocks.scopeMode = undefined;
    mocks.effectiveAccess = {
      graceEndsAt: null,
      limits: {
        maxActiveLearners: null,
        maxBranches: null,
        maxCourses: 100,
        maxUsers: 1000,
      },
      modules: ["USERS", "COURSES", "ENROLLMENTS", "ASSIGNMENTS"],
      readOnly: false,
      state: "ACTIVE",
    };
    installApiResponses();
  });

  afterEach(() => {
    notifyManager.setScheduler(defaultScheduler);
    cleanup();
  });

  it("shows archive loading only on the target course, blocks duplicate confirmations and waits for refresh", async () => {
    const deletion = deferred();
    const refresh = deferred<typeof course[]>();
    const courses = [course, { ...course, _id: "course-2", title: "Khóa học Hai" }];
    let reads = 0;
    mocks.apiFetch.mockImplementation((path, options) => {
      if (path === "/courses") return ++reads === 1 ? Promise.resolve(courses) : refresh.promise;
      if (path === "/courses/course-1" && options?.method === "DELETE") return deletion.promise;
      throw new Error(`Unexpected request: ${path}`);
    });
    renderPage();
    const first = (await screen.findByText(course.title)).closest("article")!;
    const second = screen.getByText("Khóa học Hai").closest("article")!;
    fireEvent.click(within(first).getByLabelText(`Tùy chọn khóa học ${course.title}`));
    fireEvent.click(within(second).getByLabelText("Tùy chọn khóa học Khóa học Hai"));
    const confirm = within(first).getByRole("button", { name: "Lưu trữ" });
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm); });
    const trigger = within(first).getByRole("button", { name: `Lưu trữ khóa học ${course.title}` });
    expect(trigger.classList.contains("ant-btn-loading")).toBe(true);
    expect(within(second).getByRole("button", { name: "Lưu trữ khóa học Khóa học Hai" }).classList.contains("ant-btn-loading")).toBe(false);
    await waitFor(() => expect(mocks.apiFetch.mock.calls.filter(([, options]) => options?.method === "DELETE")).toHaveLength(1));
    await act(async () => deletion.resolve({}));
    await waitFor(() => expect(reads).toBe(2));
    expect(trigger.classList.contains("ant-btn-loading")).toBe(true);
    await act(async () => refresh.resolve(courses));
    await waitFor(() => expect(trigger.classList.contains("ant-btn-loading")).toBe(false));
  });

  it("releases withdrawal loading after failure and allows an explicit retry without duplicate writes", async () => {
    const removal = deferred();
    const base = mocks.apiFetch.getMockImplementation()!;
    mocks.apiFetch.mockImplementation((path, options) => path === "/enrollments/enrollment-1" && options?.method === "DELETE" ? removal.promise : base(path, options));
    renderPage();
    await screen.findByText(course.title);
    fireEvent.click(screen.getByRole("button", { name: "Học viên" }));
    await screen.findByText("Learner One");
    const [trigger, confirm] = screen.getAllByRole("button", { name: "Rút" });
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm); });
    expect(trigger.classList.contains("ant-btn-loading")).toBe(true);
    await waitFor(() => expect(mocks.apiFetch.mock.calls.filter(([path]) => path === "/enrollments/enrollment-1")).toHaveLength(1));
    await act(async () => removal.reject(new Error("Unavailable")));
    await waitFor(() => expect(trigger.classList.contains("ant-btn-loading")).toBe(false));
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.apiFetch.mock.calls.filter(([path]) => path === "/enrollments/enrollment-1")).toHaveLength(2));
    await waitFor(() => expect(trigger.classList.contains("ant-btn-loading")).toBe(false));
  });

  it("shows retry loading while a failed course query is retried", async () => {
    const retry = deferred<typeof course[]>();
    mocks.apiFetch.mockRejectedValueOnce(new Error("Offline")).mockImplementation(() => retry.promise);
    renderPage();
    const button = await screen.findByRole("button", { name: "Thử lại" });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    await waitFor(() => expect(button.classList.contains("ant-btn-loading")).toBe(true));
    expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
    await act(async () => retry.resolve([course]));
    expect(await screen.findByText(course.title)).toBeTruthy();
  });

  it("phân trang thẻ khóa học và đổi số mục về trang đầu", async () => {
    mocks.apiFetch.mockResolvedValue(Array.from({ length: 25 }, (_, i) => ({ ...course, _id: `course-${i}`, title: `Khóa số ${i + 1}` })));
    renderPage();
    await screen.findByText("Khóa số 1");
    expect(screen.getAllByRole("article")).toHaveLength(12);
    expect(screen.queryByText("Khóa số 13")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    expect(await screen.findByText("Khóa số 13")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Số dòng mỗi trang" }), { target: { value: "24" } });
    expect(screen.getByText("Khóa số 1")).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(24);
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
  });

  it("tìm tiếng Việt không dấu, lọc trạng thái, xóa bộ lọc và không nhầm danh sách rỗng", async () => {
    mocks.apiFetch.mockResolvedValue([
      { ...course, title: "Đào tạo Giáo viên" },
      { ...course, _id: "draft", title: "Kỹ năng đọc", status: "DRAFT" },
    ]);
    renderPage();
    await screen.findByText("Đào tạo Giáo viên");
    const search = screen.getByRole("textbox", { name: "Tìm khóa học" });
    fireEvent.change(search, { target: { value: "  DAO  TAO " } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.change(screen.getByRole("combobox", { name: "Lọc trạng thái khóa học" }), { target: { value: "DRAFT" } });
    expect(screen.getByText("Không có khóa học phù hợp")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tạo khóa học đầu tiên" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(search).toHaveProperty("value", "");
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
  });

  it("đổi từ khóa về trang đầu dù số kết quả vẫn lớn", async () => {
    mocks.apiFetch.mockResolvedValue(Array.from({ length: 25 }, (_, i) => ({ ...course, _id: `course-${i}`, title: `Đào tạo ${i + 1}` })));
    renderPage();
    await screen.findByText("Đào tạo 1");
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    expect(screen.queryByText("Đào tạo 1")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm khóa học" }), { target: { value: "dao tao" } });
    expect(screen.getByText("Đào tạo 1")).toBeTruthy();
  });

  it("không tải directory hoặc enrollment toàn tenant trước khi mở modal", async () => {
    renderPage();
    expect(await screen.findByText(course.title)).toBeTruthy();
    expect(screen.getByText("Quản lý nội dung, giảng viên và học viên.")).toBeTruthy();

    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
    expect(mocks.apiFetch).toHaveBeenCalledWith("/courses", {
      token: "tenant-token",
    });
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).startsWith("/users"),
      ),
    ).toBe(false);
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).startsWith("/enrollments"),
      ),
    ).toBe(false);
  });

  it("quản lý đơn vị chỉ dùng danh mục chung để quản lý ghi danh", async () => {
    mocks.scopeMode = "SCOPED";
    renderPage();

    expect(
      await screen.findByText("Danh mục học thuật dùng chung"),
    ).toBeTruthy();
    expect(screen.getByText("Bạn quản lý ghi danh trong đơn vị. Nội dung do quản trị viên toàn tổ chức hoặc giảng viên phụ trách quản lý.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tạo khóa học" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Chỉnh sửa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mở khóa học" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Học viên" }));
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/enrollments/courses/course-1/eligible-learners?limit=20&page=1",
        { token: "tenant-token" },
      ),
    );
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).startsWith("/courses/eligible-instructors"),
      ),
    ).toBe(false);
  });

  it("chỉ tải roster và learner phân trang cho course đang mở", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Học viên" }));

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/enrollments/courses/course-1/roster?limit=20&page=1",
        { token: "tenant-token" },
      );
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/enrollments/courses/course-1/eligible-learners?limit=20&page=1",
        { token: "tenant-token" },
      );
    });
    expect(await screen.findByText("Learner One")).toBeTruthy();
    expect(
      mocks.apiFetch.mock.calls.some(([path]) => path === "/enrollments"),
    ).toBe(false);
  });

  it("READ_ONLY vẫn xem roster nhưng không tải learner hay hiện thao tác ghi/rút", async () => {
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      readOnly: true,
      state: "READ_ONLY",
    };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Học viên" }));

    expect(await screen.findByText("Learner One")).toBeTruthy();
    expect(screen.getByText("Workspace chỉ đọc")).toBeTruthy();
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).includes("eligible-learners"),
      ),
    ).toBe(false);
    expect(screen.queryByRole("button", { name: "Ghi danh" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rút" })).toBeNull();
  });

  it("không lộ hoặc query enrollment khi module bị tắt", async () => {
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      modules: ["COURSES", "ASSIGNMENTS"],
    };
    renderPage();
    expect(await screen.findByText(course.title)).toBeTruthy();

    expect(screen.queryByRole("button", { name: "Học viên" })).toBeNull();
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).startsWith("/enrollments"),
      ),
    ).toBe(false);
  });

  it("không mở roster cho course đã lưu trữ vì backend trả 404", async () => {
    mocks.apiFetch.mockImplementation((path: string) =>
      path === "/courses"
        ? Promise.resolve([{ ...course, status: "ARCHIVED" }])
        : Promise.reject(new Error(`Unexpected request: ${path}`)),
    );
    renderPage();

    expect(await screen.findByText(course.title)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Học viên" })).toBeNull();
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).startsWith("/enrollments"),
      ),
    ).toBe(false);
  });

  it("chỉ tải instructor directory khi mở trình sửa khóa học", async () => {
    renderPage();
    expect(await screen.findByText(course.title)).toBeTruthy();
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).includes("eligible-instructors"),
      ),
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Tạo khóa học" }));
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/courses/eligible-instructors?limit=20&page=1",
        { token: "tenant-token" },
      ),
    );
  });
});
