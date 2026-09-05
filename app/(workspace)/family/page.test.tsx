// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";
import type { GuardianLearning } from "@/lib/guardian-portal-api";
import type { LmsModule, UserRole } from "@/lib/types";
import { createLmsQueryClient } from "@/lib/query-client";
import FamilyPage from "./page";

const mocks = vi.hoisted(() => ({
  children: vi.fn(),
  learning: vi.fn(),
  role: "GUARDIAN" as UserRole,
  tenantId: "tenant-1",
  membershipId: "membership-1",
  token: "guardian-token",
  modules: ["GUARDIANS", "COURSES", "ENROLLMENTS"] as LmsModule[],
}));
vi.mock("@/lib/guardian-portal-api", async (load) => ({
  ...(await load<typeof import("@/lib/guardian-portal-api")>()),
  guardianPortalApi: { children: mocks.children, learning: mocks.learning },
}));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    token: mocks.token,
    organization: { _id: mocks.tenantId },
    user: {
      sub: "guardian-1",
      role: mocks.role,
      tenantId: mocks.tenantId,
      membershipId: mocks.membershipId,
    },
    effectiveAccess: { modules: mocks.modules, readOnly: false },
  }),
}));
vi.mock("antd", async () => ({
  ...(await import("@/test-utils/lightweight-antd")).lightweightAntd,
  Select: (props: {
    "aria-label": string;
    value?: string;
    onChange: (value: string) => void;
    options: Array<{ label: string; value: string }>;
  }) => (
    <select
      aria-label={props["aria-label"]}
      value={props.value ?? ""}
      onChange={(event) => props.onChange(event.target.value)}
    >
      <option value="" />
      {props.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));
const child = { learnerId: "child-1", fullName: "Learner One" };
const result: GuardianLearning = {
  child,
  courses: {
    items: [
      {
        courseId: "course-1",
        title: "Mathematics",
        progress: {
          requiredLessons: 8,
          completedRequiredLessons: 4,
          percent: 50,
          completed: false,
        },
      },
    ],
    page: 1,
    limit: 10,
    total: 1,
  },
  results: {
    items: [
      {
        submissionId: "submission-1",
        assignmentId: "assignment-1",
        assignmentTitle: "Fractions",
        courseId: "course-1",
        courseTitle: "Mathematics",
        state: "GRADED",
        feedback: "Great progress",
        releasedAt: "2026-09-05T01:00:00Z",
        grade: { score: 8, maxPoints: 10, percent: 80 },
      },
    ],
    page: 1,
    limit: 10,
    total: 1,
  },
  assessments: {
    items: [
      {
        attemptId: "attempt-1",
        assessmentId: "assessment-1",
        assessmentTitle: "Weekly test",
        courseId: "course-1",
        courseTitle: "Mathematics",
        attemptNumber: 1,
        status: "SUBMITTED",
        submittedAt: "2026-09-05T01:00:00Z",
        grade: {
          score: 9,
          maxScore: 10,
          percentage: 90,
          passed: true,
          scoredAt: "2026-09-05T01:00:00Z",
        },
      },
    ],
    page: 1,
    limit: 10,
    total: 1,
  },
  capabilities: { assignmentResults: true, assessmentResults: true },
};
function deferred<T>() {
  let resolve!: (data: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { resolve, reject, promise };
}
function renderPage(locale: "vi" | "en" = "vi") {
  const client = createLmsQueryClient();
  const node = (
    <QueryClientProvider client={client}>
      <FeedbackLocaleProvider initialLocale={locale}>
        <FamilyPage />
      </FeedbackLocaleProvider>
    </QueryClientProvider>
  );
  return { client, ...render(node), redraw: () => node };
}
async function selectChild(locale: "vi" | "en" = "vi", id = "child-1") {
  await screen.findByRole("option", { name: "Learner One" });
  fireEvent.change(
    screen.getByRole("combobox", {
      name: locale === "en" ? "Choose a learner" : "Chọn học viên",
    }),
    { target: { value: id } },
  );
}
beforeEach(() => {
  mocks.role = "GUARDIAN";
  mocks.tenantId = "tenant-1";
  mocks.membershipId = "membership-1";
  mocks.token = "guardian-token";
  mocks.modules = ["GUARDIANS", "COURSES", "ENROLLMENTS"];
  mocks.children.mockReset();
  mocks.learning.mockReset();
  mocks.children.mockResolvedValue({
    items: [child, { learnerId: "child-2", fullName: "Learner Two" }],
    page: 1,
    limit: 20,
    total: 2,
  });
  mocks.learning.mockResolvedValue(result);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("guardian family view", () => {
  it.each(["vi", "en"] as const)(
    "shows released progress, grades and teacher feedback (%s)",
    async (locale) => {
      renderPage(locale);
      await selectChild(locale);
      expect(await screen.findByText("Fractions")).toBeTruthy();
      expect(screen.getByText("8/10")).toBeTruthy();
      expect(screen.getByText("9/10")).toBeTruthy();
      expect(screen.getByText("Great progress")).toBeTruthy();
      expect(
        screen.getByText(
          locale === "en" ? "4/8 required lessons" : "4/8 bài học bắt buộc",
        ),
      ).toBeTruthy();
      expect(mocks.learning).toHaveBeenCalledWith(
        "guardian-token",
        "child-1",
        { coursesPage: 1, resultsPage: 1, assessmentsPage: 1 },
        expect.any(AbortSignal),
      );
    },
  );
  it.each(["TENANT_ADMIN", "INSTRUCTOR", "LEARNER", "SUPER_ADMIN"] as const)(
    "does not query private children for role %s",
    (role) => {
      mocks.role = role;
      renderPage();
      expect(
        screen.getByText(
          "Trang này chỉ dành cho phụ huynh đã đăng nhập trong tổ chức.",
        ),
      ).toBeTruthy();
      expect(mocks.children).not.toHaveBeenCalled();
    },
  );
  it("does not query when the guardian module is disabled", () => {
    mocks.modules = [];
    renderPage();
    expect(
      screen.getByText("Tổ chức chưa bật tính năng phụ huynh."),
    ).toBeTruthy();
    expect(mocks.children).not.toHaveBeenCalled();
  });
  it("shows a useful empty state instead of assuming a child is linked", async () => {
    mocks.children.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
    renderPage();
    expect(
      await screen.findByText("Chưa có học viên được chia sẻ"),
    ).toBeTruthy();
    expect(mocks.learning).not.toHaveBeenCalled();
  });
  it("does not load learning when course access is unavailable", async () => {
    mocks.modules = ["GUARDIANS"];
    renderPage();
    await selectChild();
    expect(
      screen.getByText(
        "Tổ chức chưa bật khóa học hoặc ghi danh để xem tiến độ.",
      ),
    ).toBeTruthy();
    expect(mocks.learning).not.toHaveBeenCalled();
  });
  it.each([401, 403, 404])(
    "removes all private UI and query cache after access response %s",
    async (status) => {
      const { client } = renderPage();
      await selectChild();
      await screen.findByText("Great progress");
      mocks.learning.mockRejectedValueOnce({ status });
      await act(async () => {
        await client.invalidateQueries({ queryKey: ["lms"] });
      });
      expect(await screen.findByText(/Quyền xem đã thay đổi/)).toBeTruthy();
      expect(screen.queryByText("Great progress")).toBeNull();
      expect(screen.queryByText("Learner One")).toBeNull();
      await waitFor(() =>
        expect(client.getQueryCache().getAll()).toHaveLength(0),
      );
    },
  );
  it("hides previous results while another child loads", async () => {
    renderPage();
    await selectChild();
    await screen.findByText("Great progress");
    const next = deferred<GuardianLearning>();
    mocks.learning.mockReturnValueOnce(next.promise);
    fireEvent.change(screen.getByRole("combobox", { name: "Chọn học viên" }), {
      target: { value: "child-2" },
    });
    expect(screen.queryByText("Great progress")).toBeNull();
    expect(await screen.findByText("Đang tải kết quả học tập…")).toBeTruthy();
    await act(async () => {
      next.resolve({
        ...result,
        child: { learnerId: "child-2", fullName: "Learner Two" },
        results: { items: [], total: 0, page: 1, limit: 10 },
      });
    });
    expect(
      await screen.findByText("Chưa có bài tập được trả kết quả."),
    ).toBeTruthy();
  });
  it("clears private state immediately on tenant and membership changes", async () => {
    const view = renderPage();
    await selectChild();
    await screen.findByText("Great progress");
    mocks.tenantId = "tenant-2";
    mocks.membershipId = "membership-2";
    mocks.token = "new-token";
    mocks.children.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
    view.rerender(
      <QueryClientProvider client={view.client}>
        <FamilyPage />
      </QueryClientProvider>,
    );
    expect(screen.queryByText("Great progress")).toBeNull();
    expect(
      await screen.findByText("Chưa có học viên được chia sẻ"),
    ).toBeTruthy();
    expect(mocks.children).toHaveBeenLastCalledWith(
      "new-token",
      1,
      expect.any(AbortSignal),
    );
  });

  it("aborts the old child request and ignores its late result after a scope change", async () => {
    const pending = deferred<GuardianLearning>();
    mocks.learning.mockReturnValueOnce(pending.promise);
    const view = renderPage();
    await selectChild();
    await waitFor(() => expect(mocks.learning).toHaveBeenCalledOnce());
    const oldSignal = mocks.learning.mock.calls[0][3] as AbortSignal;
    mocks.tenantId = "tenant-2";
    mocks.membershipId = "membership-2";
    mocks.children.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
    view.rerender(
      <QueryClientProvider client={view.client}>
        <FamilyPage />
      </QueryClientProvider>,
    );
    expect(oldSignal.aborted).toBe(true);
    await act(async () => {
      pending.resolve(result);
    });
    expect(
      await screen.findByText("Chưa có học viên được chia sẻ"),
    ).toBeTruthy();
    expect(screen.queryByText("Great progress")).toBeNull();
  });

  it("allows returning to the first page when linked learners disappear from a later page", async () => {
    mocks.children.mockResolvedValueOnce({
      items: [child],
      page: 1,
      limit: 20,
      total: 21,
    });
    mocks.children.mockResolvedValueOnce({
      items: [],
      page: 2,
      limit: 20,
      total: 20,
    });
    renderPage();
    await screen.findByRole("option", { name: "Learner One" });
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Về trang đầu" }),
    );
    await screen.findByRole("option", { name: "Learner One" });
    expect(mocks.children).toHaveBeenLastCalledWith(
      "guardian-token",
      1,
      expect.any(AbortSignal),
    );
  });
  it("supports retry without retaining results and respects disabled result modules", async () => {
    mocks.learning.mockRejectedValueOnce({ status: 503 });
    renderPage();
    await selectChild();
    expect(
      await screen.findByText(
        "Không tải được kết quả học tập. Vui lòng thử lại.",
      ),
    ).toBeTruthy();
    mocks.learning.mockResolvedValueOnce({
      ...result,
      capabilities: { assignmentResults: false, assessmentResults: false },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByText("4/8 bài học bắt buộc");
    expect(screen.queryByText("Kết quả bài tập")).toBeNull();
    expect(screen.queryByText("Kết quả bài kiểm tra")).toBeNull();
  });
  it("paginates assignment results independently of courses and assessments", async () => {
    mocks.learning.mockResolvedValue({
      ...result,
      results: { ...result.results, total: 11 },
    });
    renderPage();
    await selectChild();
    await screen.findByText("Great progress");
    const section = screen.getByText("Kết quả bài tập").closest("section")!;
    fireEvent.click(within(section).getByRole("button", { name: "Trang sau" }));
    await waitFor(() =>
      expect(mocks.learning).toHaveBeenLastCalledWith(
        "guardian-token",
        "child-1",
        { coursesPage: 1, resultsPage: 2, assessmentsPage: 1 },
        expect.any(AbortSignal),
      ),
    );
  });

  it("keeps selection and three pages through a deduplicated manual refresh", async () => {
    mocks.learning.mockResolvedValue({
      ...result,
      courses: { ...result.courses, total: 11 },
      results: { ...result.results, total: 11 },
      assessments: { ...result.assessments, total: 11 },
    });
    renderPage();
    await selectChild();
    for (const title of [
      "Tiến độ khóa học",
      "Kết quả bài tập",
      "Kết quả bài kiểm tra",
    ]) {
      const section = (await screen.findByText(title)).closest("section")!;
      fireEvent.click(
        within(section).getByRole("button", { name: "Trang sau" }),
      );
      await screen.findByText("Great progress");
    }
    const pending = deferred<{
      items: (typeof child)[];
      total: number;
      page: number;
      limit: number;
    }>();
    mocks.children.mockReturnValueOnce(pending.promise);
    const before = mocks.children.mock.calls.length;
    const refresh = screen.getByRole("button", { name: "Làm mới" });
    fireEvent.click(refresh);
    fireEvent.click(refresh);
    fireEvent(window, new Event("focus"));
    expect((refresh as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("Great progress")).toBeNull();
    expect(screen.queryByRole("option", { name: "Learner One" })).toBeNull();
    await waitFor(() =>
      expect(mocks.children).toHaveBeenCalledTimes(before + 1),
    );
    await act(async () =>
      pending.resolve({ items: [child], total: 1, page: 1, limit: 20 }),
    );
    await screen.findByText("Great progress");
    expect(
      (
        screen.getByRole("combobox", {
          name: "Chọn học viên",
        }) as HTMLSelectElement
      ).value,
    ).toBe("child-1");
    expect(mocks.learning).toHaveBeenLastCalledWith(
      "guardian-token",
      "child-1",
      { coursesPage: 2, resultsPage: 2, assessmentsPage: 2 },
      expect.any(AbortSignal),
    );
  });

  it("revalidates on focus with production QueryClient defaults and clears failed results", async () => {
    renderPage();
    await selectChild();
    await screen.findByText("Great progress");
    const before = mocks.learning.mock.calls.length;
    mocks.learning.mockRejectedValueOnce({ status: 503 });
    fireEvent(window, new Event("focus"));
    expect(screen.queryByText("Great progress")).toBeNull();
    await screen.findByText(
      "Không tải được kết quả học tập. Vui lòng thử lại.",
    );
    expect(mocks.learning).toHaveBeenCalledTimes(before + 1);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByText("Great progress");
  });

  it("automatically revalidates every sixty seconds while visible", async () => {
    renderPage();
    await selectChild();
    await screen.findByText("Great progress");
    const before = mocks.children.mock.calls.length;
    // Install fake timing before remount so the interval itself is controlled.
    cleanup();
    vi.useFakeTimers();
    renderPage();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    const mounted = mocks.children.mock.calls.length;
    expect(mounted).toBe(before + 1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mocks.children).toHaveBeenCalledTimes(mounted + 1);
  });

  it("unmounts private data while hidden and validates before showing it on return", async () => {
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("visible");
    const { client } = renderPage();
    await selectChild();
    await screen.findByText("Great progress");
    visibility.mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.queryByText("Great progress")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    await waitFor(() =>
      expect(client.getQueryCache().getAll()).toHaveLength(0),
    );
    const before = mocks.children.mock.calls.length;
    vi.useFakeTimers();
    fireEvent(window, new Event("focus"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mocks.children).toHaveBeenCalledTimes(before);
    vi.useRealTimers();
    const pending = deferred<{
      items: (typeof child)[];
      total: number;
      page: number;
      limit: number;
    }>();
    mocks.children.mockReturnValueOnce(pending.promise);
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.queryByText("Great progress")).toBeNull();
    await screen.findByText("Đang tải học viên…");
    await act(async () =>
      pending.resolve({ items: [child], total: 1, page: 1, limit: 20 }),
    );
    await screen.findByText("Great progress");
    expect(
      (
        screen.getByRole("combobox", {
          name: "Chọn học viên",
        }) as HTMLSelectElement
      ).value,
    ).toBe("child-1");
  });

  it("ignores a late access error from an aborted hidden-page request", async () => {
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("visible");
    const old = deferred<GuardianLearning>();
    mocks.learning.mockReturnValueOnce(old.promise);
    renderPage();
    await selectChild();
    await waitFor(() => expect(mocks.learning).toHaveBeenCalledOnce());
    const signal = mocks.learning.mock.calls[0][3] as AbortSignal;
    visibility.mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(signal.aborted).toBe(true);
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    await screen.findByText("Great progress");
    await act(async () => {
      old.reject({ status: 403 });
    });
    expect(screen.queryByText(/Quyền xem đã thay đổi/)).toBeNull();
    expect(screen.getByText("Great progress")).toBeTruthy();
  });

  it("isolates pending queries when only the session token changes", async () => {
    const old = deferred<GuardianLearning>();
    mocks.learning.mockReturnValueOnce(old.promise);
    const view = renderPage();
    await selectChild();
    await waitFor(() => expect(mocks.learning).toHaveBeenCalledOnce());
    const oldSignal = mocks.learning.mock.calls[0][3] as AbortSignal;
    mocks.token = "replacement-token-same-membership";
    view.rerender(
      <QueryClientProvider client={view.client}>
        <FamilyPage />
      </QueryClientProvider>,
    );
    expect(oldSignal.aborted).toBe(true);
    await selectChild();
    await screen.findByText("Great progress");
    expect(mocks.learning).toHaveBeenLastCalledWith(
      "replacement-token-same-membership",
      "child-1",
      initialPagesForTest(),
      expect.any(AbortSignal),
    );
    await act(async () =>
      old.resolve({
        ...result,
        child: { ...child, fullName: "OLD SESSION ONLY" },
      }),
    );
    expect(screen.queryByText("OLD SESSION ONLY")).toBeNull();
    expect(
      JSON.stringify(
        view.client
          .getQueryCache()
          .getAll()
          .map((query) => query.queryKey),
      ),
    ).not.toContain("replacement-token-same-membership");
  });
});

function initialPagesForTest() {
  return { coursesPage: 1, resultsPage: 1, assessmentsPage: 1 };
}
