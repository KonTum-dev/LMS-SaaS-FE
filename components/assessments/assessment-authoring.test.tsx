// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssessmentAuthoring, AssessmentDraft } from "@/lib/assessment-api";
import { ApiError } from "@/lib/api";
import type { ViewerScope } from "@/lib/query-keys";
import { AssessmentAuthoringView } from "./assessment-authoring";
import { FeedbackLanguageSwitcher, FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";

const mocks = vi.hoisted(() => ({
  archive: vi.fn(),
  getAuthoring: vi.fn(),
  publish: vi.fn(),
  push: vi.fn(),
  updateDraft: vi.fn(),
}));

vi.mock("@/lib/assessment-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/assessment-api")>()),
  assessmentApi: {
    archive: mocks.archive,
    getAuthoring: mocks.getAuthoring,
    publish: mocks.publish,
    updateDraft: mocks.updateDraft,
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@ant-design/icons", () => ({
  ArrowDownOutlined: () => null,
  ArrowLeftOutlined: () => null,
  ArrowUpOutlined: () => null,
  DeleteOutlined: () => null,
  PlusOutlined: () => null,
  ReloadOutlined: () => null,
  SaveOutlined: () => null,
  SendOutlined: () => null,
}));
vi.mock("antd", async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd);

const scope: ViewerScope = {
  membershipId: "membership-1",
  role: "INSTRUCTOR",
  tenantId: "tenant-1",
  viewerId: "instructor-1",
};

const draft: AssessmentDraft = {
  closesAt: null,
  instructions: "Chọn một đáp án.",
  maxAttempts: 2,
  opensAt: null,
  passPercent: 70,
  questions: [{
    choices: [
      { id: "22222222-2222-4222-8222-222222222222", text: "Hà Nội" },
      { id: "33333333-3333-4333-8333-333333333333", text: "Huế" },
    ],
    correctChoiceIds: ["22222222-2222-4222-8222-222222222222"],
    id: "11111111-1111-4111-8111-111111111111",
    points: 1,
    prompt: "Thủ đô Việt Nam là gì?",
    type: "SINGLE_CHOICE",
  }],
  resultVisibility: "AFTER_ATTEMPTS_EXHAUSTED",
  timeLimitSeconds: 600,
  title: "Kiểm tra Nhập môn",
};

function authoring(
  overrides: Partial<AssessmentAuthoring> = {},
): AssessmentAuthoring {
  return {
    _id: "assessment-1",
    archivedAt: null,
    courseId: "course-1",
    currentVersionId: null,
    currentVersionNumber: 0,
    draft,
    hasUnpublishedChanges: true,
    lastPublishedAt: null,
    publishedAt: null,
    revision: 3,
    status: "DRAFT",
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function renderAuthoring(readOnly = false, strict = false) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const authoringView = (
    <AssessmentAuthoringView
      assessmentId="assessment-1"
      readOnly={readOnly}
      scope={scope}
      token="tenant-token"
    />
  );
  render(
    <QueryClientProvider client={client}>
      {strict ? <StrictMode>{authoringView}</StrictMode> : authoringView}
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  mocks.archive.mockReset();
  mocks.getAuthoring.mockReset();
  mocks.getAuthoring.mockResolvedValue(authoring());
  mocks.publish.mockReset();
  mocks.push.mockReset();
  mocks.updateDraft.mockReset();
});

afterEach(cleanup);

describe("AssessmentAuthoringView", () => {
  it("retries a failed authoring load once without triggering a save", async () => {
    const pending = deferred<AssessmentAuthoring>();
    mocks.getAuthoring.mockRejectedValueOnce(new Error("Temporary outage")).mockReturnValue(pending.promise);
    renderAuthoring();
    const retry = await screen.findByRole("button", { name: "Thử lại" });
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull());
    expect(document.querySelector('[role="status"], .ant-skeleton')).toBeTruthy();
    fireEvent.click(retry);
    expect(mocks.getAuthoring).toHaveBeenCalledTimes(2);
    pending.resolve(authoring());
    expect(await screen.findByLabelText("Tên bài kiểm tra")).toBeTruthy();
    expect(mocks.updateDraft).not.toHaveBeenCalled();
  });

  it("switches English/Vietnamese authoring labels without changing authored content or unsaved input", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<FeedbackLocaleProvider initialLocale="en"><FeedbackLanguageSwitcher /><QueryClientProvider client={client}><AssessmentAuthoringView assessmentId="assessment-1" readOnly={false} scope={scope} token="tenant-token" /></QueryClientProvider></FeedbackLocaleProvider>);
    const title = await screen.findByLabelText("Assessment title") as HTMLInputElement;
    expect(title.value).toBe("Kiểm tra Nhập môn");
    expect((screen.getByLabelText("Question content") as HTMLTextAreaElement).value).toBe("Thủ đô Việt Nam là gì?");
    fireEvent.change(title, { target: { value: "Bản nháp chưa lưu {count}" } });
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    expect((screen.getByLabelText("Tên bài kiểm tra") as HTMLInputElement).value).toBe("Bản nháp chưa lưu {count}");
    expect(screen.getAllByRole("button", { name: "Lưu bản nháp" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect((screen.getByLabelText("Assessment title") as HTMLInputElement).value).toBe("Bản nháp chưa lưu {count}");
    expect(mocks.updateDraft).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    client.clear();
  });
  it("React StrictMode vẫn áp dụng canonical response sau khi lưu", async () => {
    mocks.updateDraft.mockImplementation(async (_context, _assessmentId, input) => authoring({
      draft: input,
      revision: 4,
    }));
    renderAuthoring(false, true);
    const title = await screen.findByLabelText("Tên bài kiểm tra");

    fireEvent.change(title, { target: { value: "Bản lưu trong Strict Mode" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Lưu bản nháp" })[0]);

    await waitFor(() => expect(screen.queryByText("Chưa lưu trên thiết bị này")).toBeNull());
    expect(screen.queryByText("Chưa lưu trên thiết bị này")).toBeNull();
    expect(mocks.updateDraft).toHaveBeenCalledTimes(1);
    fireEvent.change(title, { target: { value: "Bản sửa tiếp theo" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Lưu bản nháp" })[0]);
    await waitFor(() => expect(mocks.updateDraft).toHaveBeenLastCalledWith(
      expect.anything(), expect.anything(), expect.objectContaining({ expectedRevision: 4 }),
    ));
  });

  it("double click lưu chỉ phát một full-draft CAS mutation", async () => {
    const pendingSave = deferred<AssessmentAuthoring>();
    mocks.updateDraft.mockReturnValue(pendingSave.promise);
    renderAuthoring();
    const title = await screen.findByLabelText("Tên bài kiểm tra");
    fireEvent.change(title, { target: { value: "Không lưu trùng" } });
    const saveButton = screen.getAllByRole("button", { name: "Lưu bản nháp" })[0];

    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    await waitFor(() => expect(mocks.updateDraft).toHaveBeenCalledTimes(1));

    pendingSave.resolve(authoring({
      draft: { ...draft, title: "Không lưu trùng" },
      revision: 4,
    }));
    await waitFor(() => expect(screen.queryByText("Chưa lưu trên thiết bị này")).toBeNull());
    expect((screen.getByLabelText("Tên bài kiểm tra") as HTMLInputElement).value).toBe("Không lưu trùng");
  });

  it("READ_ONLY vẫn tải authoring nhưng khóa toàn bộ mutation", async () => {
    mocks.getAuthoring.mockResolvedValue(authoring({
      currentVersionId: "version-1",
      currentVersionNumber: 1,
      lastPublishedAt: "2030-08-20T08:00:00.000Z",
      publishedAt: "2030-08-20T08:00:00.000Z",
      status: "PUBLISHED",
    }));
    renderAuthoring(true);

    await screen.findByText("Chế độ chỉ đọc");
    expect(mocks.getAuthoring).toHaveBeenCalledWith({ token: "tenant-token" }, "assessment-1");
    expect((screen.getByLabelText("Tên bài kiểm tra") as HTMLInputElement).disabled).toBe(true);
    screen.getAllByRole("button", { name: /Lưu bản nháp|Xuất bản|Lưu trữ/ }).forEach((button) => {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });
    expect(mocks.updateDraft).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.archive).not.toHaveBeenCalled();
  });

  it("DRAFT không có archive và lưu đúng full aggregate với expectedRevision", async () => {
    mocks.updateDraft.mockImplementation(async (_context, _assessmentId, input) => authoring({
      draft: input,
      revision: 4,
    }));
    renderAuthoring();
    const title = await screen.findByLabelText("Tên bài kiểm tra");

    expect(screen.queryByRole("button", { name: "Lưu trữ bài kiểm tra" })).toBeNull();
    fireEvent.change(title, { target: { value: "  Kiểm tra cuối chương  " } });
    fireEvent.click(screen.getAllByRole("button", { name: "Lưu bản nháp" })[0]);

    await waitFor(() => expect(mocks.updateDraft).toHaveBeenCalledTimes(1));
    expect(mocks.updateDraft).toHaveBeenCalledWith(
      { token: "tenant-token" },
      "assessment-1",
      {
        ...draft,
        expectedRevision: 3,
        title: "Kiểm tra cuối chương",
      },
    );
  });

  it("PUBLISHED mới cho archive và gửi CAS revision hiện tại", async () => {
    const published = authoring({
      currentVersionId: "version-1",
      currentVersionNumber: 1,
      hasUnpublishedChanges: false,
      lastPublishedAt: "2030-08-20T08:00:00.000Z",
      publishedAt: "2030-08-20T08:00:00.000Z",
      status: "PUBLISHED",
    });
    mocks.getAuthoring.mockResolvedValue(published);
    mocks.archive.mockResolvedValue(authoring({
      ...published,
      archivedAt: "2030-08-21T08:00:00.000Z",
      revision: 4,
      status: "ARCHIVED",
    }));
    renderAuthoring();
    await screen.findByRole("button", { name: "Lưu trữ bài kiểm tra" });

    fireEvent.click(screen.getByRole("button", { name: "Lưu trữ" }));
    await waitFor(() => expect(mocks.archive).toHaveBeenCalledWith(
      { token: "tenant-token" },
      "assessment-1",
      { expectedRevision: 3 },
    ));
  });

  it("CAS conflict giữ bản soạn local, nạp revision mới rồi retry được", async () => {
    mocks.getAuthoring
      .mockResolvedValueOnce(authoring())
      .mockResolvedValueOnce(authoring({ revision: 4 }));
    mocks.updateDraft
      .mockRejectedValueOnce(new ApiError(
        "Bản soạn đã thay đổi",
        412,
        "ASSESSMENT_REVISION_MISMATCH",
      ))
      .mockImplementationOnce(async (_context, _assessmentId, input) => authoring({
        draft: input,
        revision: 5,
      }));
    renderAuthoring();
    const title = await screen.findByLabelText("Tên bài kiểm tra") as HTMLInputElement;
    fireEvent.change(title, { target: { value: "Bản local cần giữ" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Lưu bản nháp" })[0]);

    expect(await screen.findByText("Bản soạn trên máy chủ đã thay đổi")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Nạp revision mới" }));
    await waitFor(() => expect(mocks.getAuthoring).toHaveBeenCalledTimes(2));
    expect((screen.getByLabelText("Tên bài kiểm tra") as HTMLInputElement).value).toBe("Bản local cần giữ");

    fireEvent.click(screen.getAllByRole("button", { name: "Lưu bản nháp" })[0]);
    await waitFor(() => expect(mocks.updateDraft).toHaveBeenCalledTimes(2));
    expect(mocks.updateDraft.mock.calls[1][2]).toEqual({
      ...draft,
      expectedRevision: 4,
      title: "Bản local cần giữ",
    });
  });

  it("publish retry dùng lại clientMutationId cho duplicate-safe semantics", async () => {
    const publishedWithChanges = authoring({
      currentVersionId: "version-1",
      currentVersionNumber: 1,
      lastPublishedAt: "2030-08-20T08:00:00.000Z",
      publishedAt: "2030-08-20T08:00:00.000Z",
      status: "PUBLISHED",
    });
    mocks.getAuthoring.mockResolvedValue(publishedWithChanges);
    mocks.publish
      .mockRejectedValueOnce(new Error("Mất kết nối"))
      .mockResolvedValueOnce(authoring({
        ...publishedWithChanges,
        currentVersionId: "version-2",
        currentVersionNumber: 2,
        hasUnpublishedChanges: false,
        revision: 4,
      }));
    renderAuthoring();
    fireEvent.click(await screen.findByRole("button", { name: "Xuất bản" }));
    expect(await screen.findByText("Mất kết nối")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xuất bản" }));

    await waitFor(() => expect(mocks.publish).toHaveBeenCalledTimes(2));
    const firstInput = mocks.publish.mock.calls[0][2];
    const secondInput = mocks.publish.mock.calls[1][2];
    expect(firstInput.expectedRevision).toBe(3);
    expect(secondInput.expectedRevision).toBe(3);
    expect(secondInput.clientMutationId).toBe(firstInput.clientMutationId);
  });
});
