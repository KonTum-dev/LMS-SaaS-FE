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
import { App as AntdApp } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { EffectiveAccess, LessonDetail, UserRole } from "@/lib/types";
import LessonPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  message: { error: vi.fn(), success: vi.fn() },
  effectiveAccess: null as EffectiveAccess | null,
  role: "LEARNER" as UserRole,
  scopeMode: "GLOBAL" as "GLOBAL" | "SCOPED",
  tenantId: "tenant-1" as string | undefined,
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: mocks.apiFetch,
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "course-1", lessonId: "lesson-1" }),
  useRouter: () => ({ push: vi.fn() }),
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
      orgUnitScopeMode: mocks.scopeMode,
      role: mocks.role,
      sub: "viewer-1",
      tenantId: mocks.tenantId,
    },
  }),
}));
vi.mock("@/components/media/youtube-publish-action", () => ({
  YouTubePublishAction: ({
    asset,
    mediaEnabled,
  }: {
    asset: { contentType: string; originalFileName: string; status: string };
    mediaEnabled: boolean;
  }) =>
    mediaEnabled &&
    asset.status === "AVAILABLE" &&
    asset.contentType === "video/mp4" ? (
      <button type="button">
        Xuất bản {asset.originalFileName} lên YouTube
      </button>
    ) : null,
}));
vi.mock("@ant-design/icons", () => ({
  ArrowLeftOutlined: () => null,
  DeleteOutlined: () => null,
  EditOutlined: () => null,
  LinkOutlined: () => null,
  SendOutlined: () => null,
}));
vi.mock(
  "antd",
  async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

const baseLesson: LessonDetail = {
  _id: "lesson-1",
  attachmentIds: [],
  archivedAt: null,
  contentRevision: 2,
  course: { _id: "course-1", status: "PUBLISHED", title: "Khóa học Một" },
  courseId: "course-1",
  estimatedMinutes: 15,
  position: 0,
  progress: null,
  published: true,
  publishedAt: "2030-08-01T00:00:00.000Z",
  required: true,
  revision: 2,
  section: {
    _id: "section-1",
    archivedAt: null,
    published: true,
    title: "Chương Một",
  },
  sectionId: "section-1",
  sourceUrl: null,
  summary: "Nội dung nhập môn",
  textContent: "Nội dung an toàn",
  title: "Bài học Một",
  type: "TEXT",
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <LessonPage />
    </QueryClientProvider>,
  );
  return { client, ...view };
}

describe("lesson viewer route", () => {
  beforeEach(() => {
    notifyManager.setScheduler((callback) => queueMicrotask(callback));
    mocks.apiFetch.mockReset();
    mocks.message.error.mockReset();
    mocks.message.success.mockReset();
    vi.spyOn(AntdApp, "useApp").mockReturnValue({
      message: mocks.message,
    } as never);
    mocks.role = "LEARNER";
    mocks.scopeMode = "GLOBAL";
    mocks.tenantId = "tenant-1";
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
    mocks.apiFetch.mockResolvedValue(baseLesson);
  });

  afterEach(() => {
    notifyManager.setScheduler(defaultScheduler);
    cleanup();
    vi.restoreAllMocks();
  });

  it("recovers a failed lesson load with one guarded retry", async () => {
    let resolve!: (value: LessonDetail) => void;
    const pending = new Promise<LessonDetail>((done) => { resolve = done; });
    mocks.apiFetch.mockRejectedValueOnce(new Error("Temporary outage")).mockReturnValue(pending);
    renderPage();
    const retry = await screen.findByRole("button", { name: "Thử lại" });
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull());
    expect(document.querySelector('[role="status"], .ant-skeleton')).toBeTruthy();
    fireEvent.click(retry);
    expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
    resolve(baseLesson);
    expect(await screen.findByRole("heading", { name: baseLesson.title })).toBeTruthy();
  });

  it("module COURSES tắt thì không request lesson", () => {
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
  ])("role %s/tenant %s không request lesson", (role, tenantId) => {
    mocks.role = role;
    mocks.tenantId = tenantId;
    renderPage();

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("render TEXT như text thuần và hiện learner completion action", async () => {
    mocks.apiFetch.mockResolvedValue({
      ...baseLesson,
      textContent: "<script>window.hacked = true</script>",
    });
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Bài học Một" }),
    ).toBeTruthy();
    expect(
      screen.getByText("<script>window.hacked = true</script>"),
    ).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Đánh dấu hoàn thành" }),
    ).toBeTruthy();
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/courses/course-1/lessons/lesson-1",
      { token: "tenant-token" },
    );
  });

  it("learner PUT my-progress với expectedRevision=0 rồi invalidates lesson/tree/summary", async () => {
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/courses/course-1/lessons/lesson-1" && !options?.method) {
        return Promise.resolve(baseLesson);
      }
      if (
        path === "/courses/course-1/lessons/lesson-1/my-progress" &&
        options?.method === "PUT"
      ) {
        return Promise.resolve({
          _id: "progress-1",
          completed: true,
          completedAt: "2030-08-02T00:00:00.000Z",
          completedContentRevision: 2,
          contentChangedSinceCompletion: false,
          courseId: "course-1",
          enrollmentId: "enrollment-1",
          learnerId: "viewer-1",
          lessonId: "lesson-1",
          revision: 1,
          sectionId: "section-1",
          tenantId: "tenant-1",
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    const { client } = renderPage();
    const treeKey = [
      "lms",
      "tenant-1",
      "viewer-1",
      "membership-1",
      "LEARNER",
      "courses",
      "course-1",
      "curriculum",
      "tree",
    ];
    const summaryKey = [
      "lms",
      "tenant-1",
      "viewer-1",
      "membership-1",
      "LEARNER",
      "courses",
      "course-1",
      "curriculum",
      "progress",
      "mine",
    ];
    client.setQueryData(treeKey, {});
    client.setQueryData(summaryKey, {});

    fireEvent.click(
      await screen.findByRole("button", { name: "Đánh dấu hoàn thành" }),
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
    await waitFor(() => {
      expect(client.getQueryState(treeKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(summaryKey)?.isInvalidated).toBe(true);
    });
    expect(mocks.message.success).toHaveBeenCalledWith(
      "Đã đánh dấu bài học hoàn thành",
    );
  });

  it("learner READ_ONLY không thể gửi completion mutation", async () => {
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      readOnly: true,
      state: "READ_ONLY",
    };
    renderPage();

    const button = await screen.findByRole("button", {
      name: "Đánh dấu hoàn thành",
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).endsWith("/my-progress"),
      ),
    ).toBe(false);
  });

  it("HTTPS link mở tab mới với noopener noreferrer", async () => {
    mocks.apiFetch.mockResolvedValue({
      ...baseLesson,
      sourceUrl: "https://example.test/material?unit=1",
      textContent: null,
      type: "HTTPS_LINK",
    });
    renderPage();

    const link = await screen.findByRole("link", { name: "Mở tài liệu HTTPS" });
    expect(link.getAttribute("href")).toBe(
      "https://example.test/material?unit=1",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("response URL không an toàn không được render thành link", async () => {
    mocks.apiFetch.mockResolvedValue({
      ...baseLesson,
      sourceUrl: "http://example.test/material",
      textContent: null,
      type: "HTTPS_LINK",
    });
    renderPage();

    expect(
      await screen.findByText("Liên kết bài học không hợp lệ"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: "Mở tài liệu HTTPS" }),
    ).toBeNull();
  });

  it("manager sửa lesson bằng exact resource revision và giữ whitespace TEXT", async () => {
    mocks.role = "INSTRUCTOR";
    const updated = {
      ...baseLesson,
      estimatedMinutes: null,
      required: false,
      revision: 3,
      summary: "Mô tả mới",
      textContent: "  Nội dung giữ khoảng trắng  ",
      title: "Bài học đã sửa",
    };
    let reads = 0;
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/courses/course-1/lessons/lesson-1" && !options?.method) {
        reads += 1;
        return Promise.resolve(reads === 1 ? baseLesson : updated);
      }
      if (
        path === "/courses/course-1/lessons/lesson-1" &&
        options?.method === "PATCH"
      ) {
        return Promise.resolve(updated);
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    renderPage();
    await screen.findByRole("heading", { name: "Bài học Một" });

    fireEvent.click(screen.getByRole("button", { name: "Sửa bài học" }));
    const dialog = screen.getByRole("dialog", { name: "Sửa bài học" });
    fireEvent.change(within(dialog).getByLabelText("Tên bài học cần sửa"), {
      target: { value: "  Bài học đã sửa  " },
    });
    fireEvent.change(within(dialog).getByLabelText("Mô tả bài học cần sửa"), {
      target: { value: "  Mô tả mới  " },
    });
    fireEvent.change(
      within(dialog).getByLabelText("Nội dung bài học cần sửa"),
      {
        target: { value: "  Nội dung giữ khoảng trắng  " },
      },
    );
    fireEvent.change(
      within(dialog).getByLabelText("Thời lượng bài học cần sửa"),
      {
        target: { value: "" },
      },
    );
    fireEvent.change(
      within(dialog).getByLabelText("Yêu cầu hoàn thành bài học"),
      {
        target: { value: "optional" },
      },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Lưu thay đổi" }),
    );

    await waitFor(() =>
      expect(
        mocks.apiFetch.mock.calls.some(
          ([path, options]) =>
            path === "/courses/course-1/lessons/lesson-1" &&
            options?.method === "PATCH",
        ),
      ).toBe(true),
    );
    const updateCall = mocks.apiFetch.mock.calls.find(
      ([path, options]) =>
        path === "/courses/course-1/lessons/lesson-1" &&
        options?.method === "PATCH",
    )!;
    expect(JSON.parse(String(updateCall[1].body))).toEqual({
      estimatedMinutes: null,
      expectedRevision: 2,
      required: false,
      summary: "Mô tả mới",
      textContent: "  Nội dung giữ khoảng trắng  ",
      title: "Bài học đã sửa",
      type: "TEXT",
    });
    expect(
      mocks.apiFetch.mock.calls.some(([path]) =>
        String(path).endsWith("/attachments"),
      ),
    ).toBe(false);
    await waitFor(() =>
      expect(mocks.message.success).toHaveBeenCalledWith("Đã cập nhật bài học"),
    );
  });

  it("manager reorder attachment dùng dedicated PUT, giữ exact order và lesson revision CAS", async () => {
    mocks.role = "INSTRUCTOR";
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      modules: ["COURSES", "MEDIA"],
    };
    const ids = ["64b000000000000000000011", "64b000000000000000000012"];
    let canonical = { ...baseLesson, attachmentIds: ids };
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/courses/course-1/lessons/lesson-1" && !options?.method) {
        return Promise.resolve(canonical);
      }
      if (path.endsWith("/attachments") && options?.method === "PUT") {
        const body = JSON.parse(String(options.body)) as {
          attachmentIds: string[];
        };
        canonical = {
          ...canonical,
          attachmentIds: body.attachmentIds,
          contentRevision: 3,
          revision: 3,
        };
        return Promise.resolve(canonical);
      }
      const assetId = ids.find((item) => path.endsWith(`/assets/${item}`));
      if (assetId && !options?.method) {
        return Promise.resolve({
          _id: assetId,
          contentType: "application/pdf",
          originalFileName: `lesson-${assetId.slice(-1)}.pdf`,
          purpose: "LESSON_CONTENT",
          revision: 4,
          sizeBytes: 1024,
          status: "AVAILABLE",
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    renderPage();
    await screen.findByText("lesson-1.pdf");

    fireEvent.click(screen.getByRole("button", { name: "Đưa tệp 1 xuống" }));

    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/courses/course-1/lessons/lesson-1/attachments",
        {
          body: JSON.stringify({
            attachmentIds: [ids[1], ids[0]],
            expectedRevision: 2,
          }),
          method: "PUT",
          token: "tenant-token",
        },
      ),
    );
    expect(await screen.findByText("lesson-2.pdf")).toBeTruthy();
    expect(screen.getByLabelText("Thêm tệp cho bài học")).toBeTruthy();
    expect(mocks.message.success).toHaveBeenCalledWith(
      "Đã cập nhật tệp đính kèm của bài học",
    );
  });

  it.each([
    ["INSTRUCTOR" as const, "SCOPED" as const, true],
    ["TENANT_ADMIN" as const, "GLOBAL" as const, true],
    ["TENANT_ADMIN" as const, "SCOPED" as const, false],
  ])(
    "role %s/%s chỉ nhận sidecar YouTube khi policy cho phép = %s",
    async (role, scopeMode, allowed) => {
      mocks.role = role;
      mocks.scopeMode = scopeMode;
      mocks.effectiveAccess = {
        ...mocks.effectiveAccess!,
        modules: ["COURSES", "MEDIA"],
      };
      const attachmentId = "64b000000000000000000011";
      mocks.apiFetch.mockImplementation(
        (path: string, options?: RequestInit) => {
          if (
            path === "/courses/course-1/lessons/lesson-1" &&
            !options?.method
          ) {
            return Promise.resolve({
              ...baseLesson,
              attachmentIds: [attachmentId],
            });
          }
          if (path.endsWith(`/assets/${attachmentId}`) && !options?.method) {
            return Promise.resolve({
              _id: attachmentId,
              contentType: "video/mp4",
              originalFileName: "lesson-video.mp4",
              purpose: "LESSON_CONTENT",
              revision: 1,
              sizeBytes: 1_024,
              status: "AVAILABLE",
            });
          }
          return Promise.reject(new Error(`Unexpected request: ${path}`));
        },
      );
      renderPage();

      await screen.findByText("lesson-video.mp4");
      const publish = screen.queryByRole("button", {
        name: "Xuất bản lesson-video.mp4 lên YouTube",
      });
      expect(Boolean(publish)).toBe(allowed);
    },
  );

  it("READ_ONLY vẫn GET metadata và cấp download ticket nhưng khóa attachment mutation", async () => {
    mocks.role = "TENANT_ADMIN";
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      modules: ["COURSES", "MEDIA"],
      readOnly: true,
      state: "READ_ONLY",
    };
    const attachmentId = "64b000000000000000000011";
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/courses/course-1/lessons/lesson-1" && !options?.method) {
        return Promise.resolve({
          ...baseLesson,
          attachmentIds: [attachmentId],
        });
      }
      if (path.endsWith(`/assets/${attachmentId}`) && !options?.method) {
        return Promise.resolve({
          _id: attachmentId,
          contentType: "application/pdf",
          originalFileName: "lesson.pdf",
          purpose: "LESSON_CONTENT",
          revision: 4,
          sizeBytes: 1024,
          status: "AVAILABLE",
        });
      }
      if (
        path.endsWith(`/assets/${attachmentId}/download`) &&
        !options?.method
      ) {
        return Promise.resolve({
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          url: "http://localhost:4000/api/v1/media/local/download?ticket=short",
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    renderPage();
    const download = (await screen.findByRole("button", {
      name: "Tải xuống",
    })) as HTMLButtonElement;

    expect(download.disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "Gỡ" })).toBeNull();
    expect(
      (screen.getByLabelText("Thêm tệp cho bài học") as HTMLInputElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(download);
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(
      mocks.apiFetch.mock.calls.some(
        ([path, options]) =>
          String(path).endsWith("/attachments") && options?.method === "PUT",
      ),
    ).toBe(false);
  });

  it("lesson PATCH 412 giữ draft, reload revision mới và không blind retry", async () => {
    mocks.role = "TENANT_ADMIN";
    const fresh = { ...baseLesson, revision: 3, title: "Tên từ máy chủ" };
    let reads = 0;
    const payloads: Array<Record<string, unknown>> = [];
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/courses/course-1/lessons/lesson-1" && !options?.method) {
        reads += 1;
        return Promise.resolve(reads === 1 ? baseLesson : fresh);
      }
      if (
        path === "/courses/course-1/lessons/lesson-1" &&
        options?.method === "PATCH"
      ) {
        payloads.push(
          JSON.parse(String(options.body)) as Record<string, unknown>,
        );
        return payloads.length === 1
          ? Promise.reject(
              new ApiError(
                "Bài học đã được thay đổi",
                412,
                "LESSON_REVISION_MISMATCH",
              ),
            )
          : Promise.resolve({ ...fresh, revision: 4, title: "Draft của tôi" });
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    renderPage();
    await screen.findByRole("heading", { name: "Bài học Một" });

    fireEvent.click(screen.getByRole("button", { name: "Sửa bài học" }));
    const dialog = screen.getByRole("dialog", { name: "Sửa bài học" });
    fireEvent.change(within(dialog).getByLabelText("Tên bài học cần sửa"), {
      target: { value: "Draft của tôi" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Lưu thay đổi" }),
    );
    expect(await screen.findByText("Bài học đã được thay đổi")).toBeTruthy();
    expect(mocks.message.error).toHaveBeenCalledWith(
      "Bài học đã được thay đổi",
    );
    expect(mocks.message.success).not.toHaveBeenCalled();
    expect(payloads).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Tải lại bài học" }));
    await waitFor(() => expect(reads).toBe(2));
    expect(
      (
        within(
          screen.getByRole("dialog", { name: "Sửa bài học" }),
        ).getByLabelText("Tên bài học cần sửa") as HTMLInputElement
      ).value,
    ).toBe("Draft của tôi");
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Sửa bài học" })).getByRole(
        "button",
        { name: "Lưu thay đổi" },
      ),
    );

    await waitFor(() => expect(payloads).toHaveLength(2));
    expect(payloads[0]).toMatchObject({
      expectedRevision: 2,
      title: "Draft của tôi",
    });
    expect(payloads[1]).toMatchObject({
      expectedRevision: 3,
      title: "Draft của tôi",
    });
  });

  it("lesson PATCH lỗi mạng mơ hồ rebase expectedRevision sau refetch thành công", async () => {
    mocks.role = "INSTRUCTOR";
    const fresh = { ...baseLesson, revision: 3, title: "Tên canonical mới" };
    let reads = 0;
    const payloads: Array<Record<string, unknown>> = [];
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/courses/course-1/lessons/lesson-1" && !options?.method) {
        reads += 1;
        return Promise.resolve(reads === 1 ? baseLesson : fresh);
      }
      if (
        path === "/courses/course-1/lessons/lesson-1" &&
        options?.method === "PATCH"
      ) {
        payloads.push(
          JSON.parse(String(options.body)) as Record<string, unknown>,
        );
        return payloads.length === 1
          ? Promise.reject(new ApiError("Không thể kết nối tới máy chủ", 0))
          : Promise.resolve({ ...fresh, revision: 4, title: "Draft giữ lại" });
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    renderPage();
    await screen.findByRole("heading", { name: "Bài học Một" });
    fireEvent.click(screen.getByRole("button", { name: "Sửa bài học" }));
    const dialog = screen.getByRole("dialog", { name: "Sửa bài học" });
    fireEvent.change(within(dialog).getByLabelText("Tên bài học cần sửa"), {
      target: { value: "Draft giữ lại" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Lưu thay đổi" }),
    );
    expect(
      await screen.findByText("Không thể kết nối tới máy chủ"),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tải lại bài học" }));
    await waitFor(() => expect(reads).toBe(2));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Sửa bài học" })).getByRole(
        "button",
        { name: "Lưu thay đổi" },
      ),
    );

    await waitFor(() => expect(payloads).toHaveLength(2));
    expect(payloads[1]).toMatchObject({
      expectedRevision: 3,
      title: "Draft giữ lại",
    });
  });

  it("manager publish/archive dùng target routes; READ_ONLY khóa cả ba mutation", async () => {
    mocks.role = "TENANT_ADMIN";
    const draft = { ...baseLesson, published: false, publishedAt: null };
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/courses/course-1/lessons/lesson-1" && !options?.method)
        return Promise.resolve(draft);
      if (
        path === "/courses/course-1/lessons/lesson-1/publish" &&
        options?.method === "POST"
      ) {
        return Promise.resolve({ ...draft, published: true, revision: 3 });
      }
      if (
        path === "/courses/course-1/lessons/lesson-1/archive" &&
        options?.method === "POST"
      ) {
        return Promise.resolve({
          ...draft,
          archivedAt: "2030-09-01",
          revision: 3,
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    renderPage();
    await screen.findByRole("heading", { name: "Bài học Một" });

    fireEvent.click(screen.getByRole("button", { name: "Công bố bài học" }));
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/courses/course-1/lessons/lesson-1/publish",
        {
          body: JSON.stringify({ expectedRevision: 2 }),
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
          body: JSON.stringify({ expectedRevision: 2 }),
          method: "POST",
          token: "tenant-token",
        },
      ),
    );
    await waitFor(() =>
      expect(mocks.message.success).toHaveBeenCalledWith("Đã công bố bài học"),
    );
    expect(mocks.message.success).toHaveBeenCalledWith("Đã lưu trữ bài học");

    cleanup();
    mocks.apiFetch.mockClear();
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      readOnly: true,
      state: "READ_ONLY",
    };
    renderPage();
    await screen.findByRole("heading", { name: "Bài học Một" });
    expect(
      (screen.getByRole("button", { name: "Sửa bài học" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Công bố bài học",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Lưu trữ" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      mocks.apiFetch.mock.calls.some(([, options]) => Boolean(options?.method)),
    ).toBe(false);
  });
});
