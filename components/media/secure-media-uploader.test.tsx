// @vitest-environment jsdom

import {
  act,
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
  it("cancels the in-flight upload without attaching it and unlocks file selection", async () => {
    let signal!: AbortSignal;
    mocks.runMediaUpload.mockImplementation(
      (input: { signal: AbortSignal }) => {
        signal = input.signal;
        return new Promise<MediaAsset>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });
      },
    );
    renderUploader();
    const input = screen.getByLabelText("Thêm tệp bài làm") as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["pdf!"], "bai-lam.pdf", { type: "application/pdf" })],
      },
    });
    expect(input.closest("div")?.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    await screen.findByText("Đã hủy tải tệp.");
    expect(signal.aborted).toBe(true);
    expect(mocks.onAvailable).not.toHaveBeenCalled();
    expect(input.disabled).toBe(false);
    expect(input.closest("div")?.getAttribute("aria-busy")).toBe("false");
    expect(screen.getByRole("button", { name: "Ẩn" })).toBeTruthy();
  });
  it("ignores repeated file selection while an upload is pending and keeps progress/cancel visible", async () => {
    let complete!: (asset: MediaAsset) => void;
    mocks.runMediaUpload.mockImplementation(
      () =>
        new Promise<MediaAsset>((resolve) => {
          complete = resolve;
        }),
    );
    renderUploader();
    const input = screen.getByLabelText("Thêm tệp bài làm") as HTMLInputElement;
    const file = new File(["pdf!"], "bai-lam.pdf", { type: "application/pdf" });
    act(() => {
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(mocks.runMediaUpload).toHaveBeenCalledTimes(1);
    expect(input.disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Hủy" })).toBeTruthy();
    expect(
      screen.getByText("Đang tính SHA-256 trong trình duyệt"),
    ).toBeTruthy();
    await act(async () => {
      complete(availableAsset);
    });
    await screen.findByText("Đã kiểm tra an toàn");
    expect(input.disabled).toBe(false);
  });

  it("does not start a second attach retry and keeps the attaching stage visible", async () => {
    let complete!: () => void;
    mocks.runMediaUpload.mockResolvedValue(availableAsset);
    mocks.onAvailable
      .mockRejectedValueOnce(new Error("Attach unavailable"))
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            complete = resolve;
          }),
      );
    renderUploader();
    fireEvent.change(screen.getByLabelText("Thêm tệp bài làm"), {
      target: {
        files: [new File(["pdf!"], "bai-lam.pdf", { type: "application/pdf" })],
      },
    });
    const retry = await screen.findByRole("button", { name: "Thử lại" });
    act(() => {
      fireEvent.click(retry);
      fireEvent.click(retry);
    });
    expect(mocks.onAvailable).toHaveBeenCalledTimes(2);
    expect(mocks.runMediaUpload).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Đang lưu vào bản nháp")).toBeTruthy();
    expect(
      (screen.getByLabelText("Thêm tệp bài làm") as HTMLInputElement).disabled,
    ).toBe(true);
    await act(async () => {
      complete();
    });
    await screen.findByText("Đã kiểm tra an toàn");
  });
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
