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
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { CourseCurriculum, EffectiveAccess, UserRole } from "@/lib/types";
import CourseCurriculumPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  effectiveAccess: null as EffectiveAccess | null,
  push: vi.fn(),
  role: "LEARNER" as UserRole,
  tenantId: "tenant-1" as string | undefined,
  viewerId: "viewer-1",
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: mocks.apiFetch,
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "course-1" }),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: mocks.effectiveAccess,
    organization: { _id: "tenant-1" },
    token: "tenant-token",
    user: {
      email: "viewer@example.test",
      fullName: "Viewer",
      membershipId: mocks.tenantId ? "membership-1" : undefined,
      role: mocks.role,
      sub: mocks.viewerId,
      tenantId: mocks.tenantId,
    },
  }),
}));
vi.mock("@ant-design/icons", () => ({
  ArrowLeftOutlined: () => null,
  DeleteOutlined: () => null,
  EditOutlined: () => null,
  PlusOutlined: () => null,
  SendOutlined: () => null,
}));
vi.mock(
  "antd",
  async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

const curriculum: CourseCurriculum = {
  course: { _id: "course-1", status: "PUBLISHED", title: "Khóa học Một" },
  curriculumRevision: 3,
  myProgress: {
    completed: false,
    completedRequiredLessons: 0,
    courseId: "course-1",
    percent: 0,
    requiredLessons: 1,
  },
  sections: [
    {
      _id: "section-1",
      archivedAt: null,
      courseId: "course-1",
      description: "Kiến thức nền",
      lessons: [
        {
          _id: "lesson-1",
          attachmentIds: [],
          archivedAt: null,
          contentRevision: 1,
          courseId: "course-1",
          estimatedMinutes: 10,
          position: 0,
          progress: null,
          published: true,
          publishedAt: "2030-08-01T00:00:00.000Z",
          required: true,
          revision: 1,
          sectionId: "section-1",
          summary: "Bắt đầu tại đây",
          title: "Bài học Một",
          type: "TEXT",
        },
      ],
      position: 0,
      published: true,
      publishedAt: "2030-08-01T00:00:00.000Z",
      revision: 1,
      title: "Chương Một",
    },
  ],
};

function renderPage(
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  }),
) {
  const view = render(
    <QueryClientProvider client={client}>
      <CourseCurriculumPage />
    </QueryClientProvider>,
  );
  return { client, ...view };
}

describe("course curriculum route", () => {
  beforeEach(() => {
    notifyManager.setScheduler((callback) => queueMicrotask(callback));
    mocks.apiFetch.mockReset();
    mocks.push.mockReset();
    mocks.role = "LEARNER";
    mocks.tenantId = "tenant-1";
    mocks.viewerId = "viewer-1";
    mocks.effectiveAccess = {
      graceEndsAt: null,
      limits: {
        maxActiveLearners: null,
        maxBranches: null,
        maxCourses: 10,
        maxUsers: 50,
      },
      modules: ["COURSES"],
      readOnly: false,
      state: "ACTIVE",
    };
    mocks.apiFetch.mockResolvedValue(curriculum);
  });

  afterEach(() => {
    notifyManager.setScheduler(defaultScheduler);
    cleanup();
  });

  it("module COURSES tắt thì không mount query và không request", () => {
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      modules: ["ASSIGNMENTS"],
    };
    renderPage();

    expect(
      screen.getByText("Module Khóa học không khả dụng trong workspace này."),
    ).toBeTruthy();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["SUPER_ADMIN" as const, "tenant-1"],
    ["LEARNER" as const, undefined],
  ])("role %s/tenant %s không mount curriculum query", (role, tenantId) => {
    mocks.role = role;
    mocks.tenantId = tenantId;
    renderPage();

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("learner chỉ thấy outline published và link course-scoped, không thấy builder", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Khóa học Một" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Bài học Một" }).getAttribute("href"),
    ).toBe("/courses/course-1/lessons/lesson-1");
    expect(screen.getByText("0/1 bài bắt buộc · 0%")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Đánh dấu hoàn thành Bài học Một" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Thêm chương" })).toBeNull();
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/courses/course-1/curriculum",
      { token: "tenant-token" },
    );
  });

  it("learner completion từ tree gửi exact CAS body", async () => {
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/courses/course-1/curriculum" && !options?.method) {
        return Promise.resolve(curriculum);
      }
      if (
        path === "/courses/course-1/lessons/lesson-1/my-progress" &&
        options?.method === "PUT"
      ) {
        return Promise.resolve({ completed: true, revision: 1 });
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Đánh dấu hoàn thành Bài học Một",
      }),
    );

    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/courses/course-1/lessons/lesson-1/my-progress",
        {
          body: JSON.stringify({ completed: true, expectedRevision: 0 }),
          method: "PUT",
          token: "tenant-token",
        },
      ),
    );
  });

  it("learner thấy cảnh báo content revision và READ_ONLY không PUT", async () => {
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      readOnly: true,
      state: "READ_ONLY",
    };
    mocks.apiFetch.mockResolvedValue({
      ...curriculum,
      sections: [
        {
          ...curriculum.sections[0],
          lessons: [
            {
              ...curriculum.sections[0].lessons[0],
              progress: {
                completed: true,
                completedAt: "2030-08-01T00:00:00.000Z",
                completedContentRevision: 1,
                contentChangedSinceCompletion: true,
                revision: 2,
              },
            },
          ],
        },
      ],
    });
    renderPage();

    expect(
      await screen.findByText("Nội dung mới sau khi hoàn thành"),
    ).toBeTruthy();
    const button = screen.getByRole("button", {
      name: "Đánh dấu chưa hoàn thành Bài học Một",
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).endsWith("/my-progress"),
      ),
    ).toBe(false);
  });

  it("manager READ_ONLY thấy lifecycle nhưng mọi mutation đều bị khóa", async () => {
    mocks.role = "INSTRUCTOR";
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      readOnly: true,
      state: "READ_ONLY",
    };
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Khóa học Một" }),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Thêm chương" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Thêm bài học",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText("Workspace chỉ đọc")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Sửa chương Chương Một",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Lưu trữ chương Chương Một",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Lưu trữ bài học Bài học Một",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      mocks.apiFetch.mock.calls.some(([, options]) => Boolean(options?.method)),
    ).toBe(false);
  });

  it("manager có ENROLLMENTS mở được báo cáo learner progress", async () => {
    mocks.role = "INSTRUCTOR";
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      modules: ["COURSES", "ENROLLMENTS"],
    };
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "Tiến độ học viên" }),
    );
    expect(mocks.push).toHaveBeenCalledWith("/courses/course-1/progress");
  });

  it("manager append section gửi revision và giữ clientMutationId trong request", async () => {
    mocks.role = "TENANT_ADMIN";
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/courses/course-1/curriculum" && !options?.method)
        return Promise.resolve(curriculum);
      if (
        path === "/courses/course-1/curriculum/sections" &&
        options?.method === "POST"
      ) {
        return Promise.resolve({
          curriculumRevision: 4,
          section: curriculum.sections[0],
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    renderPage();
    await screen.findByRole("heading", { name: "Khóa học Một" });

    fireEvent.click(screen.getByRole("button", { name: "Thêm chương" }));
    const dialog = screen.getByRole("dialog", { name: "Thêm chương" });
    fireEvent.change(within(dialog).getByLabelText("Tên chương"), {
      target: { value: "  Chương mới  " },
    });
    fireEvent.change(within(dialog).getByLabelText("Mô tả chương"), {
      target: { value: "  Mô tả  " },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Thêm chương" }),
    );

    await waitFor(() =>
      expect(
        mocks.apiFetch.mock.calls.some(
          ([path, options]) =>
            path === "/courses/course-1/curriculum/sections" &&
            options?.method === "POST",
        ),
      ).toBe(true),
    );
    const createCall = mocks.apiFetch.mock.calls.find(
      ([path, options]) =>
        path === "/courses/course-1/curriculum/sections" &&
        options?.method === "POST",
    )!;
    const payload = JSON.parse(String(createCall[1].body)) as Record<
      string,
      unknown
    >;
    expect(payload).toMatchObject({
      description: "Mô tả",
      expectedCurriculumRevision: 3,
      title: "Chương mới",
    });
    expect(payload.clientMutationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("manager sửa section bằng resource revision và không gửi structural revision", async () => {
    mocks.role = "TENANT_ADMIN";
    const updatedCurriculum = {
      ...curriculum,
      sections: [
        {
          ...curriculum.sections[0],
          description: "Mô tả mới",
          revision: 2,
          title: "Chương đã sửa",
        },
      ],
    };
    let reads = 0;
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/courses/course-1/curriculum" && !options?.method) {
        reads += 1;
        return Promise.resolve(reads === 1 ? curriculum : updatedCurriculum);
      }
      if (
        path === "/courses/course-1/curriculum/sections/section-1" &&
        options?.method === "PATCH"
      ) {
        return Promise.resolve(updatedCurriculum.sections[0]);
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    renderPage();
    await screen.findByRole("heading", { name: "Khóa học Một" });

    fireEvent.click(
      screen.getByRole("button", { name: "Sửa chương Chương Một" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Sửa chương" });
    fireEvent.change(within(dialog).getByLabelText("Tên chương cần sửa"), {
      target: { value: "  Chương đã sửa  " },
    });
    fireEvent.change(within(dialog).getByLabelText("Mô tả chương cần sửa"), {
      target: { value: "  Mô tả mới  " },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Lưu thay đổi" }),
    );

    await waitFor(() =>
      expect(
        mocks.apiFetch.mock.calls.some(
          ([path, options]) =>
            path === "/courses/course-1/curriculum/sections/section-1" &&
            options?.method === "PATCH",
        ),
      ).toBe(true),
    );
    const updateCall = mocks.apiFetch.mock.calls.find(
      ([path, options]) =>
        path === "/courses/course-1/curriculum/sections/section-1" &&
        options?.method === "PATCH",
    )!;
    expect(JSON.parse(String(updateCall[1].body))).toEqual({
      description: "Mô tả mới",
      expectedRevision: 1,
      title: "Chương đã sửa",
    });
  });

  it("section PATCH 412 giữ draft, refetch rồi dùng revision resource mới khi người dùng retry", async () => {
    mocks.role = "INSTRUCTOR";
    const fresh = {
      ...curriculum,
      sections: [
        { ...curriculum.sections[0], revision: 2, title: "Tên từ máy chủ" },
      ],
    };
    let reads = 0;
    const payloads: Array<Record<string, unknown>> = [];
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/courses/course-1/curriculum" && !options?.method) {
        reads += 1;
        return Promise.resolve(reads === 1 ? curriculum : fresh);
      }
      if (
        path === "/courses/course-1/curriculum/sections/section-1" &&
        options?.method === "PATCH"
      ) {
        payloads.push(
          JSON.parse(String(options.body)) as Record<string, unknown>,
        );
        return payloads.length === 1
          ? Promise.reject(
              new ApiError(
                "Chương đã được thay đổi",
                412,
                "SECTION_REVISION_MISMATCH",
              ),
            )
          : Promise.resolve({
              ...fresh.sections[0],
              title: "Draft của tôi",
              revision: 3,
            });
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    renderPage();
    await screen.findByRole("heading", { name: "Khóa học Một" });

    fireEvent.click(
      screen.getByRole("button", { name: "Sửa chương Chương Một" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Sửa chương" });
    fireEvent.change(within(dialog).getByLabelText("Tên chương cần sửa"), {
      target: { value: "Draft của tôi" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Lưu thay đổi" }),
    );
    expect(await screen.findByText("Chương đã được thay đổi")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tải lại giáo trình" }));
    await waitFor(() => expect(reads).toBe(2));
    expect(
      (
        within(
          screen.getByRole("dialog", { name: "Sửa chương" }),
        ).getByLabelText("Tên chương cần sửa") as HTMLInputElement
      ).value,
    ).toBe("Draft của tôi");
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Sửa chương" })).getByRole(
        "button",
        { name: "Lưu thay đổi" },
      ),
    );

    await waitFor(() => expect(payloads).toHaveLength(2));
    expect(payloads[0]).toMatchObject({
      expectedRevision: 1,
      title: "Draft của tôi",
    });
    expect(payloads[1]).toMatchObject({
      expectedRevision: 2,
      title: "Draft của tôi",
    });
  });

  it("section PATCH lỗi mạng mơ hồ vẫn rebase draft sau canonical refetch", async () => {
    mocks.role = "TENANT_ADMIN";
    const fresh = {
      ...curriculum,
      sections: [
        { ...curriculum.sections[0], revision: 2, title: "Tên canonical mới" },
      ],
    };
    let reads = 0;
    const payloads: Array<Record<string, unknown>> = [];
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/courses/course-1/curriculum" && !options?.method) {
        reads += 1;
        return Promise.resolve(reads === 1 ? curriculum : fresh);
      }
      if (
        path === "/courses/course-1/curriculum/sections/section-1" &&
        options?.method === "PATCH"
      ) {
        payloads.push(
          JSON.parse(String(options.body)) as Record<string, unknown>,
        );
        return payloads.length === 1
          ? Promise.reject(new ApiError("Không thể kết nối tới máy chủ", 0))
          : Promise.resolve({
              ...fresh.sections[0],
              revision: 3,
              title: "Draft giữ lại",
            });
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    renderPage();
    await screen.findByRole("heading", { name: "Khóa học Một" });
    fireEvent.click(
      screen.getByRole("button", { name: "Sửa chương Chương Một" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Sửa chương" });
    fireEvent.change(within(dialog).getByLabelText("Tên chương cần sửa"), {
      target: { value: "Draft giữ lại" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Lưu thay đổi" }),
    );
    expect(
      await screen.findByText("Không thể kết nối tới máy chủ"),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tải lại giáo trình" }));
    await waitFor(() => expect(reads).toBe(2));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Sửa chương" })).getByRole(
        "button",
        { name: "Lưu thay đổi" },
      ),
    );

    await waitFor(() => expect(payloads).toHaveLength(2));
    expect(payloads[1]).toMatchObject({
      expectedRevision: 2,
      title: "Draft giữ lại",
    });
  });

  it("manager publish section và archive lesson dùng exact target-state routes", async () => {
    mocks.role = "TENANT_ADMIN";
    const draftCurriculum: CourseCurriculum = {
      ...curriculum,
      sections: [
        {
          ...curriculum.sections[0],
          lessons: [
            {
              ...curriculum.sections[0].lessons[0],
              published: false,
              publishedAt: null,
            },
          ],
          published: false,
          publishedAt: null,
        },
      ],
    };
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/courses/course-1/curriculum" && !options?.method)
        return Promise.resolve(draftCurriculum);
      if (
        path === "/courses/course-1/curriculum/sections/section-1/publish" &&
        options?.method === "POST"
      ) {
        return Promise.resolve({
          ...draftCurriculum.sections[0],
          published: true,
          revision: 2,
        });
      }
      if (
        path === "/courses/course-1/lessons/lesson-1/archive" &&
        options?.method === "POST"
      ) {
        return Promise.resolve({
          ...draftCurriculum.sections[0].lessons[0],
          archivedAt: "2030-09-01",
          revision: 2,
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    renderPage();
    await screen.findByRole("heading", { name: "Khóa học Một" });

    fireEvent.click(
      screen.getByRole("button", { name: "Công bố chương Chương Một" }),
    );
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/courses/course-1/curriculum/sections/section-1/publish",
        {
          body: JSON.stringify({ expectedRevision: 1 }),
          method: "POST",
          token: "tenant-token",
        },
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Lưu trữ bài học" }));
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/courses/course-1/lessons/lesson-1/archive",
        {
          body: JSON.stringify({ expectedRevision: 1 }),
          method: "POST",
          token: "tenant-token",
        },
      ),
    );
  });

  it("remount builder state và dùng cache mới khi viewer scope đổi", async () => {
    mocks.role = "INSTRUCTOR";
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    const view = renderPage(client);
    await screen.findByRole("heading", { name: "Khóa học Một" });
    fireEvent.click(screen.getByRole("button", { name: "Thêm chương" }));
    expect(screen.getByRole("dialog", { name: "Thêm chương" })).toBeTruthy();

    mocks.viewerId = "viewer-2";
    view.rerender(
      <QueryClientProvider client={client}>
        <CourseCurriculumPage />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog", { name: "Thêm chương" })).toBeNull();
  });

  it("đóng draft và không POST khi workspace chuyển sang READ_ONLY", async () => {
    mocks.role = "TENANT_ADMIN";
    const view = renderPage();
    await screen.findByRole("heading", { name: "Khóa học Một" });
    fireEvent.click(screen.getByRole("button", { name: "Thêm chương" }));
    fireEvent.change(
      within(
        screen.getByRole("dialog", { name: "Thêm chương" }),
      ).getByLabelText("Tên chương"),
      {
        target: { value: "Chương chưa gửi" },
      },
    );

    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      readOnly: true,
      state: "READ_ONLY",
    };
    view.rerender(
      <QueryClientProvider client={view.client}>
        <CourseCurriculumPage />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Thêm chương" })).toBeNull(),
    );
    expect(
      (screen.getByRole("button", { name: "Thêm chương" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      mocks.apiFetch.mock.calls.some(
        ([, options]) => options?.method === "POST",
      ),
    ).toBe(false);
  });

  it("sau revision mismatch giữ nội dung nhưng đổi UUID và revision trước retry", async () => {
    mocks.role = "TENANT_ADMIN";
    const refreshedCurriculum = { ...curriculum, curriculumRevision: 4 };
    let curriculumReads = 0;
    const createPayloads: Array<Record<string, unknown>> = [];
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/courses/course-1/curriculum" && !options?.method) {
        curriculumReads += 1;
        return Promise.resolve(
          curriculumReads === 1 ? curriculum : refreshedCurriculum,
        );
      }
      if (
        path === "/courses/course-1/curriculum/sections" &&
        options?.method === "POST"
      ) {
        createPayloads.push(
          JSON.parse(String(options.body)) as Record<string, unknown>,
        );
        return createPayloads.length === 1
          ? Promise.reject(
              new ApiError(
                "Phiên bản chương trình đã thay đổi",
                412,
                "CURRICULUM_REVISION_MISMATCH",
              ),
            )
          : Promise.resolve({
              curriculumRevision: 5,
              section: curriculum.sections[0],
            });
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    renderPage();
    await screen.findByRole("heading", { name: "Khóa học Một" });

    fireEvent.click(screen.getByRole("button", { name: "Thêm chương" }));
    const dialog = screen.getByRole("dialog", { name: "Thêm chương" });
    fireEvent.change(within(dialog).getByLabelText("Tên chương"), {
      target: { value: "Nội dung được giữ" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Thêm chương" }),
    );
    expect(
      await screen.findByText("Phiên bản chương trình đã thay đổi"),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tải lại giáo trình" }));
    await waitFor(() => expect(curriculumReads).toBe(2));
    expect(
      (
        within(
          screen.getByRole("dialog", { name: "Thêm chương" }),
        ).getByLabelText("Tên chương") as HTMLInputElement
      ).value,
    ).toBe("Nội dung được giữ");
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Thêm chương" })).getByRole(
        "button",
        { name: "Thêm chương" },
      ),
    );

    await waitFor(() => expect(createPayloads).toHaveLength(2));
    expect(createPayloads[0]).toMatchObject({
      expectedCurriculumRevision: 3,
      title: "Nội dung được giữ",
    });
    expect(createPayloads[1]).toMatchObject({
      expectedCurriculumRevision: 4,
      title: "Nội dung được giữ",
    });
    expect(createPayloads[1].clientMutationId).not.toBe(
      createPayloads[0].clientMutationId,
    );
  });

  it("reload lỗi sau 412 giữ nguyên conflict và không xoay draft bằng cache cũ", async () => {
    mocks.role = "TENANT_ADMIN";
    let curriculumReads = 0;
    const createPayloads: Array<Record<string, unknown>> = [];
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/courses/course-1/curriculum" && !options?.method) {
        curriculumReads += 1;
        return curriculumReads === 1
          ? Promise.resolve(curriculum)
          : Promise.reject(new ApiError("Không thể kết nối tới máy chủ", 0));
      }
      if (
        path === "/courses/course-1/curriculum/sections" &&
        options?.method === "POST"
      ) {
        createPayloads.push(
          JSON.parse(String(options.body)) as Record<string, unknown>,
        );
        return Promise.reject(
          new ApiError(
            "Phiên bản chương trình đã thay đổi",
            412,
            "CURRICULUM_REVISION_MISMATCH",
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    renderPage();
    await screen.findByRole("heading", { name: "Khóa học Một" });

    fireEvent.click(screen.getByRole("button", { name: "Thêm chương" }));
    const dialog = screen.getByRole("dialog", { name: "Thêm chương" });
    fireEvent.change(within(dialog).getByLabelText("Tên chương"), {
      target: { value: "Giữ draft stale" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Thêm chương" }),
    );
    expect(
      await screen.findByText("Phiên bản chương trình đã thay đổi"),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tải lại giáo trình" }));
    await waitFor(() => expect(curriculumReads).toBe(2));

    expect(screen.getByText("Phiên bản chương trình đã thay đổi")).toBeTruthy();
    expect(createPayloads).toHaveLength(1);
    expect(createPayloads[0]).toMatchObject({
      expectedCurriculumRevision: 3,
      title: "Giữ draft stale",
    });
    expect(
      (
        within(
          screen.getByRole("dialog", { name: "Thêm chương" }),
        ).getByLabelText("Tên chương") as HTMLInputElement
      ).value,
    ).toBe("Giữ draft stale");
  });
});
