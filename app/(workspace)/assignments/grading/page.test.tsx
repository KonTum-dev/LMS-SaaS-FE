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
import { lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";
import type {
  Assignment,
  Course,
  EffectiveAccess,
  GradingSubmissionDetail,
  GradingSubmissionRow,
  Paginated,
  UserRole,
} from "@/lib/types";
import GradingPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  assignment: null as Assignment | null,
  course: null as Course | null,
  currentDetail: null as
    (GradingSubmissionDetail & { draftContent?: string }) | null,
  detailError: null as Error | null,
  effectiveAccess: null as EffectiveAccess | null,
  gradeError: null as Error | null,
  listError: null as Error | null,
  listItems: [] as GradingSubmissionRow[],
  role: "TENANT_ADMIN" as UserRole,
  tenantId: "tenant-1",
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiFetch: mocks.apiFetch };
});
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: mocks.effectiveAccess,
    organization: { _id: mocks.tenantId },
    token: "tenant-token",
    user: {
      email: "manager@example.test",
      fullName: "Manager One",
      membershipId: mocks.role === "SUPER_ADMIN" ? undefined : "membership-1",
      role: mocks.role,
      sub: "manager-1",
      tenantId: mocks.role === "SUPER_ADMIN" ? undefined : mocks.tenantId,
    },
  }),
}));
vi.mock("@ant-design/icons", () => ({ ReloadOutlined: () => null }));
vi.mock(
  "antd",
  async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

const scope: ViewerScope = {
  membershipId: "membership-1",
  role: "TENANT_ADMIN",
  tenantId: "tenant-1",
  viewerId: "manager-1",
};

function row(
  overrides: Partial<GradingSubmissionRow> = {},
): GradingSubmissionRow {
  return {
    _id: "submission-1",
    assignment: { _id: "assignment-1", title: "Bài tập Một" },
    attemptCount: 2,
    course: { _id: "course-1", title: "Khóa học Một" },
    learner: {
      _id: "learner-1",
      email: "lan@example.test",
      fullName: "Lan Nguyễn",
    },
    maxPoints: 100,
    revision: 7,
    score: null,
    status: "SUBMITTED",
    submissionMode: "TEXT",
    submittedAttachmentIds: [],
    submittedAt: "2030-08-20T10:00:00.000Z",
    wasLate: false,
    ...overrides,
  };
}

function detail(
  overrides: Partial<GradingSubmissionDetail> = {},
): GradingSubmissionDetail & {
  draftAttachmentIds?: string[];
  draftContent?: string;
} {
  return {
    ...row(),
    draftContent: "BẢN NHÁP RIÊNG TƯ KHÔNG ĐƯỢC HIỆN",
    draftAttachmentIds: ["64b000000000000000000099"],
    gradedAt: null,
    gradingFeedback: null,
    history: [
      {
        action: "SUBMIT",
        actorId: "learner-1",
        at: "2030-08-20T10:00:00.000Z",
        revision: 7,
      },
    ],
    returnFeedback: null,
    submissionMode: "TEXT",
    submittedContent: "SNAPSHOT ĐÃ NỘP",
    ...overrides,
  };
}

function setupApi() {
  mocks.apiFetch.mockImplementation(
    (path: string, options?: { body?: string; method?: string }) => {
      if (path === "/courses") return Promise.resolve([mocks.course]);
      if (path === "/assignments") return Promise.resolve([mocks.assignment]);
      if (path.startsWith("/grading/submissions?")) {
        if (mocks.listError) return Promise.reject(mocks.listError);
        const page = Number(
          new URLSearchParams(path.split("?", 2)[1]).get("page") ?? "1",
        );
        const response: Paginated<GradingSubmissionRow> = {
          items: mocks.listItems,
          limit: Number(new URLSearchParams(path.split("?", 2)[1]).get("limit") ?? "20"),
          page,
          total: 41,
        };
        return Promise.resolve(response);
      }
      if (path === "/grading/submissions/submission-1" && !options?.method) {
        return mocks.detailError
          ? Promise.reject(mocks.detailError)
          : Promise.resolve(mocks.currentDetail);
      }
      if (path === "/grading/submissions/submission-1/return") {
        const input = JSON.parse(options?.body ?? "{}") as {
          feedback: string;
          expectedRevision: number;
        };
        mocks.currentDetail = {
          ...mocks.currentDetail!,
          returnFeedback: input.feedback,
          revision: input.expectedRevision + 1,
          status: "RETURNED",
        };
        mocks.listItems = [row(mocks.currentDetail)];
        return Promise.resolve(mocks.currentDetail);
      }
      if (path === "/grading/submissions/submission-1/grade") {
        if (mocks.gradeError) {
          const error = mocks.gradeError;
          mocks.gradeError = null;
          return Promise.reject(error);
        }
        const input = JSON.parse(options?.body ?? "{}") as {
          expectedRevision: number;
          feedback: string;
          score: number;
        };
        mocks.currentDetail = {
          ...mocks.currentDetail!,
          gradedAt: "2030-08-21T08:00:00.000Z",
          gradingFeedback: input.feedback,
          revision: input.expectedRevision + 1,
          score: input.score,
          status: "GRADED",
        };
        mocks.listItems = [row(mocks.currentDetail)];
        return Promise.resolve(mocks.currentDetail);
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    },
  );
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <GradingPage />
    </QueryClientProvider>,
  );
  return client;
}

function gradingListCalls() {
  return mocks.apiFetch.mock.calls.filter(([path]) =>
    String(path).startsWith("/grading/submissions?"),
  );
}

async function openSubmission() {
  fireEvent.click(
    await screen.findByRole("button", { name: "Mở bài nộp của Lan Nguyễn" }),
  );
  expect(await screen.findByText("SNAPSHOT ĐÃ NỘP")).toBeTruthy();
}

describe("manager grading queue", () => {
  beforeEach(() => {
    notifyManager.setScheduler((callback) => queueMicrotask(callback));
    mocks.apiFetch.mockReset();
    mocks.assignment = {
      _id: "assignment-1",
      allowLate: true,
      courseId: { _id: "course-1", slug: "course-one", title: "Khóa học Một" },
      description: "",
      maxPoints: 100,
      published: true,
      submissionMode: "TEXT",
      title: "Bài tập Một",
    };
    mocks.course = {
      _id: "course-1",
      description: "",
      slug: "course-one",
      status: "PUBLISHED",
      title: "Khóa học Một",
    };
    mocks.currentDetail = detail();
    mocks.detailError = null;
    mocks.effectiveAccess = {
      graceEndsAt: null,
      limits: {
        maxActiveLearners: null,
        maxBranches: null,
        maxCourses: 10,
        maxUsers: 100,
      },
      modules: ["COURSES", "ENROLLMENTS", "ASSIGNMENTS"],
      readOnly: false,
      state: "ACTIVE",
    };
    mocks.gradeError = null;
    mocks.listError = null;
    mocks.listItems = [row()];
    mocks.role = "TENANT_ADMIN";
    mocks.tenantId = "tenant-1";
    setupApi();
  });

  afterEach(() => {
    vi.useRealTimers();
    notifyManager.setScheduler(defaultScheduler);
    cleanup();
  });

  it("dùng mặc định SUBMITTED/OLDEST, key scoped và pagination server", async () => {
    const client = renderPage();
    expect(await screen.findByText("Lan Nguyễn")).toBeTruthy();
    expect(gradingListCalls()[0]?.[0]).toBe(
      "/grading/submissions?limit=20&page=1&sort=OLDEST&status=SUBMITTED",
    );
    expect(
      within(screen.getByLabelText("Lọc trạng thái")).queryByRole("option", {
        name: "Mọi trạng thái",
      }),
    ).toBeNull();
    expect(
      client.getQueryData(
        lmsQueryKeys.gradingList(scope, {
          limit: 20,
          page: 1,
          sort: "OLDEST",
          status: "SUBMITTED",
        }),
      ),
    ).toMatchObject({ page: 1, total: 41 });

    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() =>
      expect(
        gradingListCalls().some(
          ([path]) =>
            path ===
            "/grading/submissions?limit=20&page=2&sort=OLDEST&status=SUBMITTED",
        ),
      ).toBe(true),
    );
  });

  it("đổi số dòng và xóa lọc giữ số dòng, trả hàng đợi về mặc định", async () => {
    renderPage();
    await screen.findByText("Lan Nguyễn");
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() => expect(gradingListCalls().at(-1)?.[0]).toContain("page=2"));
    fireEvent.change(screen.getByLabelText("Số dòng mỗi trang"), { target: { value: "50" } });
    await waitFor(() => expect(gradingListCalls().at(-1)?.[0]).toBe("/grading/submissions?limit=50&page=1&sort=OLDEST&status=SUBMITTED"));
    fireEvent.change(screen.getByLabelText("Lọc trạng thái"), { target: { value: "RETURNED" } });
    fireEvent.change(screen.getByLabelText("Sắp xếp bài nộp"), { target: { value: "NEWEST" } });
    fireEvent.change(screen.getByLabelText("Lọc khóa học"), { target: { value: "course-1" } });
    fireEvent.change(screen.getByLabelText("Lọc bài tập"), { target: { value: "assignment-1" } });
    fireEvent.change(screen.getByLabelText("Tìm học viên"), { target: { value: " Lan " } });
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
    await waitFor(() => expect(gradingListCalls().at(-1)?.[0]).toContain("search=Lan"));
    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    await waitFor(() => expect(gradingListCalls().at(-1)?.[0]).toBe("/grading/submissions?limit=50&page=1&sort=OLDEST&status=SUBMITTED"));
    expect((screen.getByLabelText("Tìm học viên") as HTMLInputElement).value).toBe("");
  });

  it("serialize filter/search/sort vào URL và query key ổn định", async () => {
    const client = renderPage();
    await screen.findByText("Lan Nguyễn");
    fireEvent.change(screen.getByLabelText("Lọc trạng thái"), {
      target: { value: "RETURNED" },
    });
    fireEvent.change(screen.getByLabelText("Sắp xếp bài nộp"), {
      target: { value: "NEWEST" },
    });
    fireEvent.change(screen.getByLabelText("Lọc khóa học"), {
      target: { value: "course-1" },
    });
    fireEvent.change(screen.getByLabelText("Lọc bài tập"), {
      target: { value: "assignment-1" },
    });
    fireEvent.change(screen.getByLabelText("Tìm học viên"), {
      target: { value: "  Lan  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));

    const path =
      "/grading/submissions?assignmentId=assignment-1&courseId=course-1&limit=20&page=1&search=Lan&sort=NEWEST&status=RETURNED";
    await waitFor(() =>
      expect(
        gradingListCalls().some(([calledPath]) => calledPath === path),
      ).toBe(true),
    );
    expect(
      client.getQueryData(
        lmsQueryKeys.gradingList(scope, {
          assignmentId: "assignment-1",
          courseId: "course-1",
          limit: 20,
          page: 1,
          search: "Lan",
          sort: "NEWEST",
          status: "RETURNED",
        }),
      ),
    ).toBeTruthy();
  });

  it("manual refresh gọi lại queue", async () => {
    renderPage();
    await screen.findByText("Lan Nguyễn");
    const initialCalls = gradingListCalls().length;
    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
    await waitFor(() =>
      expect(gradingListCalls()).toHaveLength(initialCalls + 1),
    );
  });

  it("poll queue mỗi 30 giây khi mounted", async () => {
    vi.useFakeTimers();
    renderPage();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(gradingListCalls()).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(gradingListCalls()).toHaveLength(2);
  });

  it("chỉ fetch detail khi mở row và không lộ draft riêng tư", async () => {
    renderPage();
    await screen.findByText("Lan Nguyễn");
    expect(
      mocks.apiFetch.mock.calls.some(
        ([path]) => path === "/grading/submissions/submission-1",
      ),
    ).toBe(false);

    await openSubmission();
    expect(screen.queryByText("BẢN NHÁP RIÊNG TƯ KHÔNG ĐƯỢC HIỆN")).toBeNull();
    expect(document.body.textContent).not.toContain("00000099");
    expect(
      mocks.apiFetch.mock.calls.filter(
        ([path]) => path === "/grading/submissions/submission-1",
      ),
    ).toHaveLength(1);
  });

  it("MEDIA off giữ FILES snapshot/grade nhưng khóa return và asset route", async () => {
    const submittedId = "64b000000000000000000011";
    mocks.assignment = { ...mocks.assignment!, submissionMode: "FILES" };
    mocks.currentDetail = detail({
      submissionMode: "FILES",
      submittedAttachmentIds: [submittedId],
      submittedContent: null,
    });
    mocks.listItems = [
      row({
        submissionMode: "FILES",
        submittedAttachmentIds: [submittedId],
      }),
    ];
    renderPage();

    expect(await screen.findByText("1 tệp trong snapshot")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Mở bài nộp của Lan Nguyễn" }),
    );
    expect(await screen.findByText(/Mã tệp …00000011/u)).toBeTruthy();
    expect(screen.getByText("Tải tệp đang tạm khóa")).toBeTruthy();
    expect(document.body.textContent).not.toContain("00000099");
    expect(
      (screen.getByRole("button", { name: "Tải xuống" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      mocks.apiFetch.mock.calls.filter(([path]) =>
        String(path).includes("/attachments/"),
      ),
    ).toHaveLength(0);
    expect(
      screen.getByText(
        "Không thể trả lại bài nhận tệp khi Tài liệu riêng tư đang tắt",
      ),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText("Phản hồi trả bài") as HTMLTextAreaElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "Trả lại cho học viên" }),
    ).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Điểm trên 100"), {
      target: { value: "88" },
    });
    fireEvent.change(screen.getByLabelText("Phản hồi chấm điểm"), {
      target: { value: "Snapshot đạt yêu cầu" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Chấm điểm" }));
    await waitFor(() =>
      expect(
        mocks.apiFetch.mock.calls.some(
          ([path]) => path === "/grading/submissions/submission-1/grade",
        ),
      ).toBe(true),
    );
    expect(
      mocks.apiFetch.mock.calls.some(
        ([path]) => path === "/grading/submissions/submission-1/return",
      ),
    ).toBe(false);
  });

  it("return gửi feedback và revision lấy từ detail", async () => {
    renderPage();
    await openSubmission();
    const feedback = screen.getByLabelText("Phản hồi trả bài");
    expect(feedback.getAttribute("maxlength")).toBe("4000");
    fireEvent.change(feedback, {
      target: { value: "Bổ sung nguồn tham khảo" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Trả lại cho học viên" }),
    );

    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/grading/submissions/submission-1/return",
        {
          body: JSON.stringify({
            expectedRevision: 7,
            feedback: "Bổ sung nguồn tham khảo",
          }),
          cache: "no-store",
          credentials: "same-origin",
          method: "POST",
          referrerPolicy: "no-referrer",
          token: "tenant-token",
        },
      ),
    );
  });

  it("grade bắt buộc feedback, chặn score ngoài maxPoints và gửi detail revision", async () => {
    renderPage();
    await openSubmission();
    const score = screen.getByLabelText("Điểm trên 100");
    const feedback = screen.getByLabelText("Phản hồi chấm điểm");
    const grade = screen.getByRole("button", {
      name: "Chấm điểm",
    }) as HTMLButtonElement;
    expect(feedback.getAttribute("maxlength")).toBe("4000");

    fireEvent.change(score, { target: { value: "101" } });
    fireEvent.change(feedback, { target: { value: "Đạt yêu cầu" } });
    expect(await screen.findByText("Điểm phải từ 0 đến 100.")).toBeTruthy();
    expect(grade.disabled).toBe(true);
    fireEvent.change(score, { target: { value: "85" } });
    expect(grade.disabled).toBe(false);
    fireEvent.click(grade);

    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/grading/submissions/submission-1/grade",
        {
          body: JSON.stringify({
            expectedRevision: 7,
            feedback: "Đạt yêu cầu",
            score: 85,
          }),
          cache: "no-store",
          credentials: "same-origin",
          method: "POST",
          referrerPolicy: "no-referrer",
          token: "tenant-token",
        },
      ),
    );
  });

  it.each([
    ["RETURNED", "Chấm điểm"],
    ["GRADED", "Lưu điểm chấm lại"],
  ] as const)(
    "cho phép grade trạng thái %s và prefill kết quả hiện tại",
    async (status, buttonName) => {
      mocks.currentDetail = detail({
        gradedAt: "2030-08-21T08:00:00.000Z",
        gradingFeedback: "Nhận xét hiện tại",
        returnFeedback: status === "RETURNED" ? "Cần bổ sung" : null,
        history:
          status === "RETURNED"
            ? [
                {
                  action: "SUBMIT",
                  actorId: "learner-1",
                  at: "2030-08-20T10:00:00.000Z",
                  revision: 5,
                },
                {
                  action: "GRADE",
                  actorId: "teacher-1",
                  at: "2030-08-21T08:00:00.000Z",
                  revision: 6,
                  score: 80,
                },
                {
                  action: "RETURN",
                  actorId: "teacher-1",
                  at: "2030-08-21T09:00:00.000Z",
                  revision: 7,
                },
              ]
            : [
                {
                  action: "SUBMIT",
                  actorId: "learner-1",
                  at: "2030-08-20T10:00:00.000Z",
                  revision: 6,
                },
                {
                  action: "GRADE",
                  actorId: "teacher-1",
                  at: "2030-08-21T08:00:00.000Z",
                  revision: 7,
                  score: 80,
                },
              ],
        revision: 7,
        score: 80,
        status,
      });
      mocks.listItems = [row(mocks.currentDetail)];
      renderPage();
      await openSubmission();

      expect(
        (screen.getByLabelText("Điểm trên 100") as HTMLInputElement).value,
      ).toBe("80");
      expect(
        (screen.getByLabelText("Phản hồi chấm điểm") as HTMLTextAreaElement)
          .value,
      ).toBe("Nhận xét hiện tại");
      expect(screen.getByRole("button", { name: buttonName })).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Trả lại cho học viên" }),
      ).toBeNull();
    },
  );

  it("revision conflict giữ score/feedback và có explicit reload", async () => {
    mocks.gradeError = Object.assign(new Error("Revision mismatch"), {
      code: "SUBMISSION_REVISION_MISMATCH",
    });
    renderPage();
    await openSubmission();
    fireEvent.change(screen.getByLabelText("Điểm trên 100"), {
      target: { value: "91" },
    });
    fireEvent.change(screen.getByLabelText("Phản hồi chấm điểm"), {
      target: { value: "Phản hồi chưa lưu" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Chấm điểm" }));

    expect(
      await screen.findByText("Bài nộp đã thay đổi ở một phiên khác"),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText("Điểm trên 100") as HTMLInputElement).value,
    ).toBe("91");
    expect(
      (screen.getByLabelText("Phản hồi chấm điểm") as HTMLTextAreaElement)
        .value,
    ).toBe("Phản hồi chưa lưu");
    const detailCalls = mocks.apiFetch.mock.calls.filter(
      ([path]) => path === "/grading/submissions/submission-1",
    ).length;
    fireEvent.click(
      screen.getByRole("button", { name: "Tải lại revision mới nhất" }),
    );
    await waitFor(() =>
      expect(
        mocks.apiFetch.mock.calls.filter(
          ([path]) => path === "/grading/submissions/submission-1",
        ),
      ).toHaveLength(detailCalls + 1),
    );
    expect(
      (screen.getByLabelText("Điểm trên 100") as HTMLInputElement).value,
    ).toBe("91");
    expect(
      (screen.getByLabelText("Phản hồi chấm điểm") as HTMLTextAreaElement)
        .value,
    ).toBe("Phản hồi chưa lưu");
  });

  it("READ_ONLY vẫn GET list/detail nhưng khóa cả return và grade", async () => {
    mocks.effectiveAccess = {
      ...mocks.effectiveAccess!,
      readOnly: true,
      state: "READ_ONLY",
    };
    renderPage();
    await openSubmission();

    expect(screen.getByText("Workspace chỉ đọc")).toBeTruthy();
    expect(
      (screen.getByLabelText("Phản hồi trả bài") as HTMLTextAreaElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Điểm trên 100") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Trả lại cho học viên",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Chấm điểm" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      mocks.apiFetch.mock.calls.some(
        ([path]) => path === "/grading/submissions/submission-1",
      ),
    ).toBe(true);
    expect(
      mocks.apiFetch.mock.calls.some(
        ([path]) =>
          String(path).endsWith("/return") || String(path).endsWith("/grade"),
      ),
    ).toBe(false);
  });

  it("detail error cô lập, queue vẫn hiển thị", async () => {
    mocks.detailError = new Error("Không tải được snapshot");
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Mở bài nộp của Lan Nguyễn" }),
    );

    expect(await screen.findByText("Không tải được snapshot")).toBeTruthy();
    expect(screen.getByText("Lan Nguyễn")).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Danh sách bài nộp cần chấm" }),
    ).toBeTruthy();
  });

  it("list refresh error không làm mất detail đã mở", async () => {
    renderPage();
    await openSubmission();
    mocks.listError = new Error("Không refresh được queue");
    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));

    expect(await screen.findByText("Không refresh được queue")).toBeTruthy();
    expect(screen.getByText("SNAPSHOT ĐÃ NỘP")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Chi tiết bài nộp" }),
    ).toBeTruthy();
  });

  it.each<UserRole>(["LEARNER", "SUPER_ADMIN"])(
    "%s không phát sinh manager request",
    async (role) => {
      mocks.role = role;
      renderPage();

      expect(
        await screen.findByText(
          "Khu vực chấm bài chỉ dành cho quản trị tổ chức và giảng viên.",
        ),
      ).toBeTruthy();
      expect(mocks.apiFetch).not.toHaveBeenCalled();
    },
  );

  it("module-off không phát sinh manager request", async () => {
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

  it("đổi workspace xóa detail/filter cũ và không render tạm dữ liệu tenant trước", async () => {
    const client = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { gcTime: Infinity, retry: false },
      },
    });
    const view = render(
      <QueryClientProvider client={client}>
        <GradingPage />
      </QueryClientProvider>,
    );
    await screen.findByText("Lan Nguyễn");
    fireEvent.change(screen.getByLabelText("Lọc khóa học"), {
      target: { value: "course-1" },
    });
    fireEvent.change(screen.getByLabelText("Lọc bài tập"), {
      target: { value: "assignment-1" },
    });
    await openSubmission();
    const callsBeforeSwitch = mocks.apiFetch.mock.calls.length;

    mocks.tenantId = "tenant-2";
    mocks.listItems = [
      row({
        _id: "submission-2",
        learner: {
          _id: "learner-2",
          email: "binh@example.test",
          fullName: "Bình Trần",
        },
      }),
    ];
    view.rerender(
      <QueryClientProvider client={client}>
        <GradingPage />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Chi tiết bài nộp" }),
      ).toBeNull(),
    );
    expect(screen.queryByText("Lan Nguyễn")).toBeNull();
    expect(await screen.findByText("Bình Trần")).toBeTruthy();
    const callsAfterSwitch = mocks.apiFetch.mock.calls.slice(callsBeforeSwitch);
    const switchedQueuePaths = callsAfterSwitch
      .map(([path]) => String(path))
      .filter((path) => path.startsWith("/grading/submissions?"));
    expect(switchedQueuePaths).toContain(
      "/grading/submissions?limit=20&page=1&sort=OLDEST&status=SUBMITTED",
    );
    expect(
      switchedQueuePaths.every(
        (path) =>
          !path.includes("courseId=") && !path.includes("assignmentId="),
      ),
    ).toBe(true);
    expect(
      callsAfterSwitch.some(
        ([path]) => path === "/grading/submissions/submission-1",
      ),
    ).toBe(false);
  });

  it("đổi vai trò trong cùng workspace cũng remount và xóa manager draft cũ", async () => {
    const client = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { gcTime: Infinity, retry: false },
      },
    });
    const view = render(
      <QueryClientProvider client={client}>
        <GradingPage />
      </QueryClientProvider>,
    );
    await screen.findByText("Lan Nguyễn");
    fireEvent.change(screen.getByLabelText("Lọc khóa học"), {
      target: { value: "course-1" },
    });
    await openSubmission();
    fireEvent.change(screen.getByLabelText("Phản hồi chấm điểm"), {
      target: { value: "Draft thuộc quyền admin" },
    });
    const callsBeforeSwitch = mocks.apiFetch.mock.calls.length;

    mocks.role = "INSTRUCTOR";
    mocks.listItems = [
      row({
        _id: "submission-2",
        learner: {
          _id: "learner-2",
          email: "binh@example.test",
          fullName: "Bình Trần",
        },
      }),
    ];
    view.rerender(
      <QueryClientProvider client={client}>
        <GradingPage />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Chi tiết bài nộp" }),
      ).toBeNull(),
    );
    expect(screen.queryByText("Draft thuộc quyền admin")).toBeNull();
    expect(await screen.findByText("Bình Trần")).toBeTruthy();
    const callsAfterSwitch = mocks.apiFetch.mock.calls.slice(callsBeforeSwitch);
    expect(
      callsAfterSwitch.some(([path]) =>
        String(path).includes("courseId=course-1"),
      ),
    ).toBe(false);
    expect(
      callsAfterSwitch.some(
        ([path]) => path === "/grading/submissions/submission-1",
      ),
    ).toBe(false);
  });
});
