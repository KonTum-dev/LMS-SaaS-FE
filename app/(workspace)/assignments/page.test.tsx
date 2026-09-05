// @vitest-environment jsdom

import { App as AntdApp, Form as AntdForm } from "antd";
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
import { LocalizedForm } from "@/components/form/localized-form";
import { FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";
import AssignmentsPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  effectiveAccess: null as EffectiveAccess | null,
  formValues: {} as Record<string, unknown>,
  message: { error: vi.fn(), success: vi.fn() },
  role: "INSTRUCTOR" as "INSTRUCTOR" | "LEARNER",
}));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: mocks.effectiveAccess,
    organization: { _id: "tenant-1" },
    token: "tenant-token",
    user: {
      email: "teacher@example.test",
      fullName: "Teacher",
      membershipId: "membership-1",
      role: mocks.role,
      sub: "teacher-1",
      tenantId: "tenant-1",
    },
  }),
}));
vi.mock("@ant-design/icons", () => ({
  DeleteOutlined: () => null,
  EditOutlined: () => null,
  PlusOutlined: () => null,
}));
vi.mock(
  "antd",
  async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

const course = {
  _id: "course-1",
  description: "",
  slug: "course-one",
  status: "PUBLISHED" as const,
  title: "Khóa học Một",
};
const assignment = {
  _id: "assignment-1",
  allowLate: true,
  archivedAt: null,
  courseId: { _id: course._id, slug: course.slug, title: course.title },
  description: "Bài tập hiện tại",
  dueAt: "2030-09-01T12:00:00.000Z",
  maxPoints: 250,
  published: true,
  publishedAt: "2030-08-01T12:00:00.000Z",
  submissionMode: "HTTPS_LINK" as const,
  title: "Bài tập Một",
};

const formApi = {
  resetFields: vi.fn(),
  setFieldsValue: vi.fn(),
  validateFields: vi.fn(),
};

function installApiResponses() {
  mocks.apiFetch.mockImplementation(
    (path: string, options?: { method?: string }) => {
      if (options?.method)
        return Promise.resolve(
          path.endsWith(assignment._id) ? { archived: true } : {},
        );
      if (path === "/assignments") return Promise.resolve([assignment]);
      if (path === "/courses") return Promise.resolve([course]);
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    },
  );
}

function renderPage(locale: "vi" | "en" = "vi") {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        {locale === "en" ? <FeedbackLocaleProvider initialLocale="en"><AssignmentsPage /></FeedbackLocaleProvider> : <AssignmentsPage />}
      </QueryClientProvider>,
    ),
  };
}

function mutationCall(method: "DELETE" | "PATCH" | "POST") {
  return mocks.apiFetch.mock.calls.find(
    ([, options]) => options?.method === method,
  );
}

function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe("assignment lifecycle form", () => {
  beforeEach(() => {
    notifyManager.setScheduler((callback) => queueMicrotask(callback));
    mocks.apiFetch.mockReset();
    mocks.formValues = {};
    mocks.role = "INSTRUCTOR";
    Object.values(mocks.message).forEach((mock) => mock.mockReset());
    mocks.effectiveAccess = {
      graceEndsAt: null,
      limits: {
        maxActiveLearners: null,
        maxBranches: null,
        maxCourses: 100,
        maxUsers: 1000,
      },
      modules: ["COURSES", "ENROLLMENTS", "ASSIGNMENTS"],
      readOnly: false,
      state: "ACTIVE",
    };
    formApi.resetFields.mockReset();
    formApi.resetFields.mockImplementation(() => {
      mocks.formValues = {};
    });
    formApi.setFieldsValue.mockReset();
    formApi.setFieldsValue.mockImplementation((values) => {
      Object.assign(mocks.formValues, values);
    });
    formApi.validateFields.mockReset();
    formApi.validateFields.mockImplementation(async () => ({
      ...mocks.formValues,
    }));
    // The wrapper copies AntD's compound API when imported. Both entry points
    // must share one instance, just as useForm(providedForm) does in AntD.
    const useMockForm = (providedForm?: unknown) => [providedForm ?? formApi] as never;
    vi.spyOn(AntdForm, "useForm").mockImplementation(useMockForm);
    vi.spyOn(LocalizedForm, "useForm").mockImplementation(useMockForm);
    vi.spyOn(AntdApp, "useApp").mockReturnValue({
      message: mocks.message,
    } as never);
    installApiResponses();
  });

  afterEach(() => {
    notifyManager.setScheduler(defaultScheduler);
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows per-assignment archive loading, deduplicates confirmation and releases for retry after error", async () => {
    const pending = deferred();
    const base = mocks.apiFetch.getMockImplementation()!;
    mocks.apiFetch.mockImplementation((path, options) => {
      if (path === "/assignments") return Promise.resolve([assignment, { ...assignment, _id: "assignment-2", title: "Bài tập Hai" }]);
      if (path === `/assignments/${assignment._id}` && options?.method === "DELETE") return pending.promise;
      return base(path, options);
    });
    renderPage();
    await screen.findByText(assignment.title);
    const getGroup = () => screen.getByRole("group", { name: `Thao tác với bài tập ${assignment.title}` });
    const getTrigger = () => within(getGroup()).getByRole("button", { name: `Lưu trữ bài tập ${assignment.title}` });
    const confirm = within(getGroup()).getByRole("button", { name: "Lưu trữ" });
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm); });
    expect(getTrigger().classList.contains("ant-btn-loading")).toBe(true);
    expect(screen.getByRole("button", { name: "Lưu trữ bài tập Bài tập Hai" }).classList.contains("ant-btn-loading")).toBe(false);
    await waitFor(() => expect(mocks.apiFetch.mock.calls.filter(([, options]) => options?.method === "DELETE")).toHaveLength(1));
    await act(async () => pending.reject(new Error("Temporary failure")));
    await waitFor(() => expect(getTrigger().classList.contains("ant-btn-loading")).toBe(false));
    expect(mocks.message.error).toHaveBeenCalledWith("Temporary failure");
    fireEvent.click(within(getGroup()).getByRole("button", { name: "Lưu trữ" }));
    await waitFor(() => expect(mocks.apiFetch.mock.calls.filter(([, options]) => options?.method === "DELETE")).toHaveLength(2));
    await waitFor(() => expect(getTrigger().classList.contains("ant-btn-loading")).toBe(false));
  });

  it("tìm không dấu trên toàn bộ dữ liệu, kết hợp khóa học/trạng thái và xóa bộ lọc", async () => {
    const target = { ...assignment, _id: "assignment-target", title: "Ôn tập đại số", description: "Đồ thị", published: false, courseId: { _id: "course-2", slug: "math", title: "Toán nâng cao" } };
    mocks.apiFetch.mockImplementation((path: string) => Promise.resolve(path === "/assignments"
      ? [...Array.from({ length: 15 }, (_, index) => ({ ...assignment, _id: `assignment-${index}`, title: `Bài tập ${index + 1}` })), target]
      : [course]));
    renderPage();
    const table = screen.getByRole("region", { name: "Danh sách bài tập" });
    expect(await within(table).findByText("Bài tập 1")).toBeTruthy();
    const search = screen.getByRole("searchbox", { name: "Tìm bài tập" });
    fireEvent.change(search, { target: { value: "  ON   TAP  DAI SO  " } });
    fireEvent.change(screen.getByRole("combobox", { name: "Lọc theo khóa học" }), { target: { value: "course-2" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Lọc trạng thái bài tập" }), { target: { value: "DRAFT" } });
    expect(within(table).getByText(target.title)).toBeTruthy();
    expect(within(table).queryByText("Bài tập 1")).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Lọc trạng thái bài tập" }), { target: { value: "PUBLISHED" } });
    expect(within(table).queryByText(target.title)).toBeNull();
    expect(within(table).getByText("Không có bài tập phù hợp")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    expect((search as HTMLInputElement).value).toBe("");
    expect(within(table).getByText("Bài tập 1")).toBeTruthy();
    expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
  });

  it("learner có bộ lọc tiếng Anh nhưng không tải directory hoặc thấy trạng thái nháp", async () => {
    mocks.role = "LEARNER";
    renderPage("en");
    expect(await screen.findByRole("link", { name: assignment.title })).toBeTruthy();
    expect(screen.getByRole("search", { name: "Assignment filters" })).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Search assignments" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Filter by course" })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Filter assignment status" })).toBeNull();
    expect(mocks.apiFetch.mock.calls.some(([path]) => path === "/courses")).toBe(false);
  });

  it("create gửi courseId và defaults lifecycle mới", async () => {
    renderPage();
    expect(screen.getByRole("main", { name: "Bài tập" })).toBeTruthy();
    expect(screen.getByText("Tạo bài tập, đặt hạn nộp và công bố cho học viên.")).toBeTruthy();
    const createButton = await screen.findByRole("button", {
      name: "Tạo bài tập",
    });
    expect(createButton.classList.contains("page-primary-action")).toBe(true);
    fireEvent.click(createButton);
    expect(AntdForm.useForm).toHaveBeenCalledWith(formApi);
    Object.assign(mocks.formValues, {
      courseId: course._id,
      title: "Bài tập mới",
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Tạo bài tập" }).at(-1)!,
    );

    await waitFor(() => expect(mutationCall("POST")).toBeTruthy());
    const [, options] = mutationCall("POST")!;
    expect(JSON.parse(String(options.body))).toEqual({
      allowLate: false,
      courseId: course._id,
      maxPoints: 100,
      published: false,
      submissionMode: "TEXT",
      title: "Bài tập mới",
    });
  });

  it("MEDIA off giữ TEXT/LINK nhưng fail closed nếu form giả mạo chọn FILES", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Tạo bài tập" }));
    expect(
      screen.getByText(
        "Văn bản và liên kết HTTPS vẫn dùng bình thường; nhận tệp yêu cầu module Tài liệu riêng tư.",
      ),
    ).toBeTruthy();
    Object.assign(mocks.formValues, {
      ...mocks.formValues,
      courseId: course._id,
      submissionMode: "FILES",
      title: "Bài tập tệp giả mạo",
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Tạo bài tập" }).at(-1)!,
    );

    await waitFor(() =>
      expect(mocks.message.error).toHaveBeenCalledWith(
        "Module Tài liệu riêng tư phải hoạt động để lưu bài tập nhận tệp.",
      ),
    );
    expect(mutationCall("POST")).toBeUndefined();
  });

  it("MEDIA effective cho phép author chọn FILES và gửi đúng grading config", async () => {
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      modules: ["COURSES", "ENROLLMENTS", "ASSIGNMENTS", "MEDIA"],
    };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Tạo bài tập" }));
    Object.assign(mocks.formValues, {
      ...mocks.formValues,
      courseId: course._id,
      submissionMode: "FILES",
      title: "Bài tập nhận tệp",
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Tạo bài tập" }).at(-1)!,
    );

    await waitFor(() => expect(mutationCall("POST")).toBeTruthy());
    const [, options] = mutationCall("POST")!;
    expect(JSON.parse(String(options.body))).toMatchObject({
      courseId: course._id,
      submissionMode: "FILES",
      title: "Bài tập nhận tệp",
    });
  });

  it("historical FILES vẫn hiện trong list nhưng khóa update khi MEDIA tắt", async () => {
    const filesAssignment = { ...assignment, submissionMode: "FILES" as const };
    mocks.apiFetch.mockImplementation(
      (path: string, options?: { method?: string }) => {
        if (options?.method) return Promise.resolve({});
        if (path === "/assignments") return Promise.resolve([filesAssignment]);
        if (path === "/courses") return Promise.resolve([course]);
        return Promise.reject(new Error(`Unexpected request: ${path}`));
      },
    );
    renderPage();

    expect(
      await screen.findByText("Tệp riêng tư", { exact: true }),
    ).toBeTruthy();
    const editButton = screen.getByRole("button", {
      name: `Chỉnh sửa bài tập ${filesAssignment.title}`,
    }) as HTMLButtonElement;
    expect(editButton.disabled).toBe(true);
    expect(editButton.title).toBe(
      "Bật module Tài liệu riêng tư để sửa bài tập nhận tệp",
    );
    expect(mutationCall("PATCH")).toBeUndefined();
  });

  it("edit assignment đã publish khóa grading fields và không gửi immutable/locked fields", async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", {
        name: `Chỉnh sửa bài tập ${assignment.title}`,
      }),
    );

    expect(
      (screen.getByRole("combobox", { name: "Khóa học" }) as HTMLSelectElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Điểm tối đa") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Hình thức nộp bài") as HTMLSelectElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.getByText("Không thể đổi điểm tối đa sau lần công bố đầu tiên."),
    ).toBeTruthy();
    expect(
      screen.getByText("Không thể đổi hình thức nộp sau lần công bố đầu tiên."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(mutationCall("PATCH")).toBeTruthy());
    const [path, options] = mutationCall("PATCH")!;
    const body = JSON.parse(String(options.body));
    expect(path).toBe(`/assignments/${assignment._id}`);
    expect(body).toEqual({
      allowLate: true,
      description: assignment.description,
      dueAt: assignment.dueAt,
      published: true,
      title: assignment.title,
    });
    expect(body).not.toHaveProperty("courseId");
    expect(body).not.toHaveProperty("maxPoints");
    expect(body).not.toHaveProperty("submissionMode");
  });

  it("legacy publishedAt vẫn khóa và PATCH title không chứa grading fields", async () => {
    const legacy = { ...assignment, published: false, title: "Bài tập legacy" };
    mocks.apiFetch.mockImplementation(
      (path: string, options?: { method?: string }) => {
        if (options?.method) return Promise.resolve({});
        if (path === "/assignments") return Promise.resolve([legacy]);
        if (path === "/courses") return Promise.resolve([course]);
        return Promise.reject(new Error(`Unexpected request: ${path}`));
      },
    );
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", {
        name: `Chỉnh sửa bài tập ${legacy.title}`,
      }),
    );
    Object.assign(mocks.formValues, { title: "Tiêu đề legacy đã sửa" });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(mutationCall("PATCH")).toBeTruthy());
    const [, options] = mutationCall("PATCH")!;
    const body = JSON.parse(String(options.body));
    expect(body.title).toBe("Tiêu đề legacy đã sửa");
    expect(body).not.toHaveProperty("courseId");
    expect(body).not.toHaveProperty("maxPoints");
    expect(body).not.toHaveProperty("submissionMode");
  });

  it("dùng copy Lưu trữ và gọi DELETE rồi báo thành công", async () => {
    renderPage();
    expect(await screen.findByText("Lưu trữ bài tập này?")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: `Lưu trữ bài tập ${assignment.title}`,
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Lưu trữ" }));

    await waitFor(() =>
      expect(mutationCall("DELETE")).toEqual([
        `/assignments/${assignment._id}`,
        { method: "DELETE", token: "tenant-token" },
      ]),
    );
    expect(mocks.message.success).toHaveBeenCalledWith("Đã lưu trữ bài tập");
    expect(screen.queryByText("Xóa bài tập này?")).toBeNull();
  });

  it("READ_ONLY chỉ xem dữ liệu, không cung cấp mutation", async () => {
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      readOnly: true,
      state: "READ_ONLY",
    };
    renderPage();

    expect(await screen.findByText(assignment.title)).toBeTruthy();
    const createButton = screen.getByRole("button", { name: "Tạo bài tập" });
    expect((createButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(createButton);
    expect(
      screen.queryByRole("button", {
        name: `Chỉnh sửa bài tập ${assignment.title}`,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: `Lưu trữ bài tập ${assignment.title}`,
      }),
    ).toBeNull();
    expect(
      mocks.apiFetch.mock.calls.some(([, options]) => Boolean(options?.method)),
    ).toBe(false);
  });

  it("modal đang mở bị khóa ngay khi workspace chuyển sang READ_ONLY", async () => {
    const view = renderPage();
    fireEvent.click(
      await screen.findByRole("button", {
        name: `Chỉnh sửa bài tập ${assignment.title}`,
      }),
    );

    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      readOnly: true,
      state: "READ_ONLY",
    };
    view.rerender(
      <QueryClientProvider client={view.client}>
        <AssignmentsPage />
      </QueryClientProvider>,
    );

    const saveButton = screen.getByRole("button", {
      name: "Lưu thay đổi",
    }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    expect(
      (screen.getByLabelText("Tên bài tập") as HTMLInputElement).disabled,
    ).toBe(true);
    fireEvent.click(saveButton);
    expect(mutationCall("PATCH")).toBeUndefined();
  });

  it("khóa tạo mới khi chỉ còn course đã lưu trữ", async () => {
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === "/assignments") return Promise.resolve([]);
      if (path === "/courses")
        return Promise.resolve([{ ...course, status: "ARCHIVED" }]);
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    renderPage();

    const createButton = await screen.findByRole("button", {
      name: "Tạo bài tập",
    });
    expect((createButton as HTMLButtonElement).disabled).toBe(true);
    expect(createButton.getAttribute("title")).toBe(
      "Cần ít nhất một khóa học chưa lưu trữ để tạo bài tập",
    );
  });

  it("course ARCHIVED khóa Edit assignment nhưng vẫn cho lưu trữ assignment", async () => {
    mocks.apiFetch.mockImplementation(
      (path: string, options?: { method?: string }) => {
        if (options?.method) return Promise.resolve({ archived: true });
        if (path === "/assignments") return Promise.resolve([assignment]);
        if (path === "/courses")
          return Promise.resolve([{ ...course, status: "ARCHIVED" }]);
        return Promise.reject(new Error(`Unexpected request: ${path}`));
      },
    );
    renderPage();

    const editButton = (await screen.findByRole("button", {
      name: `Chỉnh sửa bài tập ${assignment.title}`,
    })) as HTMLButtonElement;
    expect(editButton.disabled).toBe(true);
    expect(editButton.getAttribute("title")).toBe(
      "Không thể sửa bài tập thuộc khóa học đã lưu trữ",
    );
    expect(
      (
        screen.getByRole("button", {
          name: `Lưu trữ bài tập ${assignment.title}`,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("course DRAFT vẫn tạo được assignment nháp nhưng không cho công bố", async () => {
    mocks.apiFetch.mockImplementation(
      (path: string, options?: { method?: string }) => {
        if (options?.method) return Promise.resolve({});
        if (path === "/assignments") return Promise.resolve([]);
        if (path === "/courses")
          return Promise.resolve([{ ...course, status: "DRAFT" }]);
        return Promise.reject(new Error(`Unexpected request: ${path}`));
      },
    );
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Tạo bài tập" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Khóa học" }), {
      target: { value: course._id },
    });

    const publish = screen.getByRole("checkbox", {
      name: "Công bố cho học viên",
    }) as HTMLInputElement;
    expect(publish.disabled).toBe(true);
    expect(
      screen.getByText(
        "Cần mở khóa học trước khi công bố bài tập cho học viên.",
      ),
    ).toBeTruthy();
    Object.assign(mocks.formValues, {
      courseId: course._id,
      published: true,
      title: "Không được công bố",
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Tạo bài tập" }).at(-1)!,
    );
    await waitFor(() =>
      expect(mocks.message.error).toHaveBeenCalledWith(
        "Chỉ có thể công bố bài tập khi khóa học đang mở",
      ),
    );
    expect(mutationCall("POST")).toBeUndefined();
  });

  it("assignment đã publish vẫn sửa field khác khi course chuyển về DRAFT", async () => {
    mocks.apiFetch.mockImplementation(
      (path: string, options?: { method?: string }) => {
        if (options?.method) return Promise.resolve({});
        if (path === "/assignments") return Promise.resolve([assignment]);
        if (path === "/courses")
          return Promise.resolve([{ ...course, status: "DRAFT" }]);
        return Promise.reject(new Error(`Unexpected request: ${path}`));
      },
    );
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", {
        name: `Chỉnh sửa bài tập ${assignment.title}`,
      }),
    );

    const publish = screen.getByRole("checkbox", {
      name: "Công bố cho học viên",
    }) as HTMLInputElement;
    expect(publish.disabled).toBe(false);
    expect(
      screen.getByText(
        "Khóa học hiện không mở; bạn có thể giữ trạng thái hiện tại hoặc chuyển bài tập về nháp.",
      ),
    ).toBeTruthy();
    Object.assign(mocks.formValues, { title: "Đổi tiêu đề, giữ published" });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(mutationCall("PATCH")).toBeTruthy());
    const [, options] = mutationCall("PATCH")!;
    expect(JSON.parse(String(options.body))).toMatchObject({
      published: true,
      title: "Đổi tiêu đề, giữ published",
    });
  });

  it("learner có link truy cập chi tiết bài làm nhưng không thấy manager actions", async () => {
    mocks.role = "LEARNER";
    renderPage();

    const link = await screen.findByRole("link", { name: assignment.title });
    expect(link.getAttribute("href")).toBe(`/assignments/${assignment._id}`);
    expect(
      screen.queryByRole("button", {
        name: `Chỉnh sửa bài tập ${assignment.title}`,
      }),
    ).toBeNull();
    expect(
      mocks.apiFetch.mock.calls.some(([path]) => path === "/courses"),
    ).toBe(false);
  });

  it("module-off hiển thị trạng thái khóa và không phát request", async () => {
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      modules: ["COURSES", "ENROLLMENTS"],
    };
    renderPage();

    expect(
      await screen.findByText(
        "Module Bài tập không khả dụng trong workspace này.",
      ),
    ).toBeTruthy();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});
