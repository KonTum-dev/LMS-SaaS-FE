// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaAsset } from "@/lib/media-api";
import { SecureMediaUploader } from "./secure-media-uploader";

const mocks = vi.hoisted(() => ({
  cancelAsset: vi.fn(),
  mutationIndex: 0,
  onAvailable: vi.fn(),
  runMediaUpload: vi.fn(),
}));

vi.mock("@/lib/media-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/media-api")>();
  return {
    ...original,
    createMediaMutationId: () =>
      `00000000-0000-4000-8000-${String(++mocks.mutationIndex).padStart(12, "0")}`,
    mediaApi: { ...original.mediaApi, cancelAsset: mocks.cancelAsset },
    runMediaUpload: mocks.runMediaUpload,
  };
});
vi.mock(
  "antd",
  async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

const availableAsset: MediaAsset = {
  _id: "64b000000000000000000011",
  contentType: "application/pdf",
  originalFileName: "bai-lam.pdf",
  purpose: "SUBMISSION_ATTACHMENT",
  revision: 4,
  sizeBytes: 4,
  status: "AVAILABLE",
};

function renderUploader(strict = false) {
  const uploader = (
    <SecureMediaUploader
      allowedContentTypes={["application/pdf"]}
      currentAssetIds={[]}
      label="Thêm tệp bài làm"
      maxBytes={25 * 1024 * 1024}
      maxCount={5}
      onAvailable={mocks.onAvailable}
      target={{ assignmentId: "assignment-1", kind: "LEARNER_SUBMISSION" }}
      token="tenant-token"
    />
  );
  return render(strict ? <StrictMode>{uploader}</StrictMode> : uploader);
}

describe("SecureMediaUploader lifecycle", () => {
  beforeEach(() => {
    mocks.mutationIndex = 0;
    mocks.cancelAsset.mockReset().mockResolvedValue(undefined);
    mocks.onAvailable.mockReset().mockResolvedValue(undefined);
    mocks.runMediaUpload.mockReset();
  });

  afterEach(() => cleanup());

  it("abort workflow khi unmount và không gọi callback sau đó", async () => {
    let observedSignal: AbortSignal | undefined;
    let resolveUpload!: (asset: MediaAsset) => void;
    mocks.runMediaUpload.mockImplementation(
      ({ signal }: { signal?: AbortSignal }) => {
        observedSignal = signal;
        return new Promise((resolve) => {
          resolveUpload = resolve;
        });
      },
    );
    const view = renderUploader();
    fireEvent.change(screen.getByLabelText("Thêm tệp bài làm"), {
      target: {
        files: [new File(["pdf!"], "bai-lam.pdf", { type: "application/pdf" })],
      },
    });
    await waitFor(() => expect(mocks.runMediaUpload).toHaveBeenCalledOnce());

    view.unmount();

    expect(observedSignal?.aborted).toBe(true);
    resolveUpload(availableAsset);
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.onAvailable).not.toHaveBeenCalled();
  });

  it("React StrictMode vẫn cập nhật stage và attach asset AVAILABLE", async () => {
    mocks.runMediaUpload.mockResolvedValue(availableAsset);
    renderUploader(true);

    fireEvent.change(screen.getByLabelText("Thêm tệp bài làm"), {
      target: {
        files: [new File(["pdf!"], "bai-lam.pdf", { type: "application/pdf" })],
      },
    });

    await waitFor(() => expect(mocks.onAvailable).toHaveBeenCalledOnce());
    expect(await screen.findByText("Đã kiểm tra an toàn")).toBeTruthy();
    expect(
      (screen.getByLabelText("Thêm tệp bài làm") as HTMLInputElement).disabled,
    ).toBe(false);
  });

  it("liên kết mỗi input với mô tả riêng khi có nhiều uploader", () => {
    render(
      <>
        <SecureMediaUploader
          allowedContentTypes={["application/pdf"]}
          currentAssetIds={[]}
          label="Thêm tệp thứ nhất"
          maxBytes={25 * 1024 * 1024}
          maxCount={5}
          onAvailable={mocks.onAvailable}
          target={{ assignmentId: "assignment-1", kind: "LEARNER_SUBMISSION" }}
          token="tenant-token"
        />
        <SecureMediaUploader
          allowedContentTypes={["application/pdf"]}
          currentAssetIds={[]}
          label="Thêm tệp thứ hai"
          maxBytes={25 * 1024 * 1024}
          maxCount={5}
          onAvailable={mocks.onAvailable}
          target={{ assignmentId: "assignment-2", kind: "LEARNER_SUBMISSION" }}
          token="tenant-token"
        />
      </>,
    );

    const firstDescription = screen
      .getByLabelText("Thêm tệp thứ nhất")
      .getAttribute("aria-describedby");
    const secondDescription = screen
      .getByLabelText("Thêm tệp thứ hai")
      .getAttribute("aria-describedby");
    expect(firstDescription).toBeTruthy();
    expect(secondDescription).toBeTruthy();
    expect(firstDescription).not.toBe(secondDescription);
    expect(document.getElementById(firstDescription!)?.textContent).toContain(
      "Tối đa 5 tệp",
    );
    expect(document.getElementById(secondDescription!)?.textContent).toContain(
      "Tối đa 5 tệp",
    );
  });

  it("retry lỗi CAS ở bước attach không upload lại bytes", async () => {
    mocks.runMediaUpload.mockResolvedValue(availableAsset);
    mocks.onAvailable
      .mockRejectedValueOnce(
        Object.assign(new Error("Revision đã thay đổi"), {
          code: "SUBMISSION_REVISION_MISMATCH",
        }),
      )
      .mockResolvedValueOnce(undefined);
    renderUploader();
    fireEvent.change(screen.getByLabelText("Thêm tệp bài làm"), {
      target: {
        files: [new File(["pdf!"], "bai-lam.pdf", { type: "application/pdf" })],
      },
    });

    expect(await screen.findByText("Revision đã thay đổi")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(mocks.onAvailable).toHaveBeenCalledTimes(2));

    expect(mocks.runMediaUpload).toHaveBeenCalledOnce();
    expect(await screen.findByText("Đã kiểm tra an toàn")).toBeTruthy();
  });
});
