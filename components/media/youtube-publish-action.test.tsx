// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { MediaAsset } from "@/lib/media-api";
import type { ViewerScope } from "@/lib/query-keys";
import type { YouTubeUploadJob } from "@/lib/youtube-api";
import { YouTubePublishAction } from "./youtube-publish-action";

const mocks = vi.hoisted(() => ({
  createMutationId: vi.fn(),
  createUpload: vi.fn(),
  getStatus: vi.fn(),
  getUpload: vi.fn(),
  listUploads: vi.fn(),
}));

vi.mock("@/lib/youtube-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/youtube-api")>();
  return {
    ...original,
    createYouTubeMutationId: mocks.createMutationId,
    youtubeApi: {
      ...original.youtubeApi,
      createUpload: mocks.createUpload,
      getStatus: mocks.getStatus,
      getUpload: mocks.getUpload,
      listUploads: mocks.listUploads,
    },
  };
});

const scope: ViewerScope = {
  membershipId: "membership-1",
  role: "INSTRUCTOR",
  tenantId: "tenant-1",
  viewerId: "teacher-1",
};
const asset: MediaAsset = {
  _id: "64b000000000000000000003",
  contentType: "video/mp4",
  originalFileName: "bai-hoc.mp4",
  purpose: "LESSON_CONTENT",
  revision: 1,
  sizeBytes: 1_000,
  status: "AVAILABLE",
};
const completedJob: YouTubeUploadJob = {
  assetId: asset._id,
  attempts: 1,
  courseId: "course-1",
  createdAt: "2030-08-16T00:00:00.000Z",
  failureCode: null,
  failureMessage: null,
  jobId: "job-1",
  lessonId: "lesson-1",
  madeForKids: false,
  nextAttemptAt: null,
  privacyStatus: "PRIVATE",
  status: "SUCCEEDED",
  title: "Bài học Một",
  totalBytes: 1_000,
  updatedAt: "2030-08-16T00:05:00.000Z",
  uploadedBytes: 1_000,
  videoId: "abcDEF_123-",
  watchUrl: "https://www.youtube.com/watch?v=abcDEF_123-",
};

function renderAction(overrides: Partial<{ mediaEnabled: boolean }> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App>
        <YouTubePublishAction
          asset={asset}
          courseId="course-1"
          description="Mô tả bài học"
          lessonId="lesson-1"
          mediaEnabled={overrides.mediaEnabled ?? true}
          scope={scope}
          title="Bài học Một"
          token="session-token"
        />
      </App>
    </QueryClientProvider>,
  );
}

async function submitDefaultPrivateUpload(description?: string) {
  const button = await screen.findByRole("button", {
    name: /Xuất bản lên YouTube/,
  });
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(button);
  if (description !== undefined) {
    fireEvent.change(screen.getByLabelText("Mô tả"), {
      target: { value: description },
    });
  }
  fireEvent.click(screen.getByLabelText("Không"));
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: /Xác nhận xuất bản/ }));
}

beforeEach(() => {
  sessionStorage.clear();
  mocks.createMutationId
    .mockReset()
    .mockReturnValue("11111111-1111-4111-8111-111111111111");
  mocks.createUpload.mockReset().mockResolvedValue(completedJob);
  mocks.getStatus.mockReset().mockResolvedValue({
    channel: { id: "UC-safe", title: "Kênh giáo viên" },
    connectedAt: "2030-08-16T00:00:00.000Z",
    state: "CONNECTED",
    uploadEnabled: true,
  });
  mocks.getUpload.mockReset().mockResolvedValue(completedJob);
  mocks.listUploads.mockReset().mockResolvedValue([]);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("YouTubePublishAction", () => {
  it("không gọi YouTube khi MEDIA tắt", () => {
    renderAction({ mediaEnabled: false });

    expect(
      screen.queryByRole("button", { name: "Xuất bản lên YouTube" }),
    ).toBeNull();
    expect(mocks.getStatus).not.toHaveBeenCalled();
    expect(mocks.listUploads).not.toHaveBeenCalled();
  });

  it("khôi phục job bằng exact-source query sau reload và chỉ mở watch URL đã parse", async () => {
    mocks.listUploads.mockResolvedValue([completedJob]);
    renderAction();

    const link = await screen.findByRole("link", {
      name: "Mở video trên YouTube",
    });
    expect(mocks.getUpload).toHaveBeenCalledWith(
      { token: "session-token" },
      "job-1",
      expect.any(AbortSignal),
    );
    expect(mocks.listUploads).toHaveBeenCalledWith(
      { token: "session-token" },
      expect.any(AbortSignal),
      {
        assetId: asset._id,
        courseId: "course-1",
        lessonId: "lesson-1",
      },
    );
    expect(link.getAttribute("href")).toBe(completedJob.watchUrl);
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("chặn xuất bản lại khi YouTube có thể đã nhận video nhưng kết quả chưa xác định", async () => {
    const rawProviderMessage = "upstream socket reset after final response";
    const completionUnknownJob: YouTubeUploadJob = {
      ...completedJob,
      failureCode: "YOUTUBE_COMPLETION_UNKNOWN",
      failureMessage: rawProviderMessage,
      status: "FAILED",
      videoId: null,
      watchUrl: null,
    };
    mocks.listUploads.mockResolvedValue([completionUnknownJob]);
    mocks.getUpload.mockResolvedValue(completionUnknownJob);
    renderAction();

    expect(
      await screen.findByText(/YouTube có thể đã nhận video này/i),
    ).toBeTruthy();
    expect(screen.getByText(/Không xuất bản lại/i)).toBeTruthy();
    expect(screen.getByText(/quản trị viên hoặc bộ phận hỗ trợ/i)).toBeTruthy();
    expect(document.body.textContent).not.toContain(rawProviderMessage);
    expect(
      (
        screen.getByRole("button", {
          name: /Xuất bản lên YouTube/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("hiện đủ liên kết chính sách trước khi người dùng đồng ý", async () => {
    renderAction();
    const button = await screen.findByRole("button", {
      name: /Xuất bản lên YouTube/,
    });
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(button);

    expect(screen.getByText(/Kênh đích:/).textContent).toContain(
      "Kênh giáo viên",
    );
    expect(screen.getByText("ID: UC-safe")).toBeTruthy();

    expect(
      screen
        .getByRole("link", { name: "Điều khoản dịch vụ YouTube" })
        .getAttribute("href"),
    ).toBe("https://www.youtube.com/static?template=terms");
    expect(
      screen
        .getByRole("link", { name: "Nguyên tắc cộng đồng" })
        .getAttribute("href"),
    ).toBe("https://www.youtube.com/howyoutubeworks/our-policies/");
    expect(
      screen
        .getByRole("link", {
          name: "Chính sách quyền riêng tư của Google",
        })
        .getAttribute("href"),
    ).toBe("https://policies.google.com/privacy");
  });

  it("retry đúng cùng UUID khi POST timeout sau commit", async () => {
    mocks.createUpload.mockRejectedValueOnce(
      new ApiError("request timeout", 0, "API_TIMEOUT"),
    );
    renderAction();

    await submitDefaultPrivateUpload();

    expect(
      await screen.findByRole("link", { name: "Mở video trên YouTube" }),
    ).toBeTruthy();
    expect(mocks.createUpload).toHaveBeenCalledTimes(2);
    expect(mocks.createUpload.mock.calls[1][1]).toEqual(
      mocks.createUpload.mock.calls[0][1],
    );
    expect(mocks.listUploads).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toContain("request timeout");
  });

  it("giữ cùng mutation UUID sau lỗi mơ hồ, đóng và mở lại modal", async () => {
    mocks.createUpload.mockRejectedValue(
      new ApiError("request timeout", 0, "API_TIMEOUT"),
    );
    renderAction();

    await submitDefaultPrivateUpload();
    expect(
      await screen.findByText(/lần thử lại sẽ dùng cùng mã an toàn/i),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));

    await submitDefaultPrivateUpload();
    await waitFor(() => expect(mocks.createUpload).toHaveBeenCalledTimes(4));
    const firstInput = mocks.createUpload.mock.calls[0][1];
    const secondInput = mocks.createUpload.mock.calls[2][1];
    expect(firstInput.clientMutationId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(secondInput.clientMutationId).toBe(firstInput.clientMutationId);
    expect(mocks.createMutationId).toHaveBeenCalledOnce();
  });

  it("không retry tự động khi máy chủ trả lỗi HTTP xác định", async () => {
    mocks.createUpload.mockRejectedValue(
      new ApiError("provider details", 409, "YOUTUBE_REAUTH_REQUIRED"),
    );
    renderAction();

    await submitDefaultPrivateUpload();

    expect(
      await screen.findByText(
        "Quyền YouTube đã hết hiệu lực. Hãy kết nối lại để tiếp tục.",
      ),
    ).toBeTruthy();
    expect(mocks.createUpload).toHaveBeenCalledOnce();
    expect(mocks.listUploads).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toContain("provider details");
  });

  it("đổi nội dung yêu cầu sau lỗi mơ hồ sẽ dùng UUID mới", async () => {
    mocks.createMutationId
      .mockReset()
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");
    mocks.createUpload.mockRejectedValue(
      new ApiError("request timeout", 0, "API_TIMEOUT"),
    );
    renderAction();

    await submitDefaultPrivateUpload();
    await screen.findByText(/lần thử lại sẽ dùng cùng mã an toàn/i);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    await submitDefaultPrivateUpload("Mô tả đã thay đổi");
    await waitFor(() => expect(mocks.createUpload).toHaveBeenCalledTimes(4));

    expect(mocks.createUpload.mock.calls[0][1].clientMutationId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(mocks.createUpload.mock.calls[2][1].clientMutationId).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
    expect(mocks.createUpload.mock.calls[2][1].description).toBe(
      "Mô tả đã thay đổi",
    );
  });
});
