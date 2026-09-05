// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileImageEditor } from "./profile-image-editor";
import {
  FeedbackLanguageSwitcher,
  FeedbackLocaleProvider,
} from "@/components/feedback/feedback-locale";

vi.mock("@ant-design/icons", () => ({
  DeleteOutlined: () => null,
  PictureOutlined: () => null,
  UploadOutlined: () => null,
}));
vi.mock("antd", async () => {
  const { lightweightAntd } = await import("@/test-utils/lightweight-antd");
  return {
    ...lightweightAntd,
    Avatar: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, reject, resolve };
}

const onRemove = vi.fn();
const onUpload = vi.fn();
const revokeObjectUrl = vi.fn();

function renderEditor(imageUrl: string | null = null) {
  return render(
    <ProfileImageEditor
      alt="Ảnh đại diện của Cô Mai"
      fallback="M"
      help="JPEG, PNG hoặc WebP, tối đa 5 MiB."
      imageUrl={imageUrl}
      label="Ảnh đại diện"
      onRemove={onRemove}
      onUpload={onUpload}
    />,
  );
}

beforeEach(() => {
  onRemove.mockReset();
  onRemove.mockResolvedValue(undefined);
  onUpload.mockReset();
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:avatar-preview"),
    revokeObjectURL: revokeObjectUrl,
  });
  revokeObjectUrl.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ProfileImageEditor", () => {
  it("keeps one removal in flight, shows loading and unlocks after failure", async () => {
    const removal = deferred<void>();
    onRemove.mockReturnValueOnce(removal.promise).mockResolvedValue(undefined);
    renderEditor("https://images.example.test/avatar.png");
    const remove = screen.getByRole("button", { name: "Gỡ ảnh" });
    act(() => {
      fireEvent.click(remove);
      fireEvent.click(remove);
    });
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(remove.classList.contains("ant-btn-loading")).toBe(true);
    const input = screen.getByLabelText("Thay ảnh") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    fireEvent.change(input, {
      target: {
        files: [new File(["png"], "ignored.png", { type: "image/png" })],
      },
    });
    expect(onUpload).not.toHaveBeenCalled();
    await act(async () => {
      removal.reject(new Error("storage private details"));
      await removal.promise.catch(() => undefined);
    });
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Không thể gỡ ảnh hiện tại.",
    );
    expect(remove.classList.contains("ant-btn-loading")).toBe(false);
    expect(input.disabled).toBe(false);
    fireEvent.click(remove);
    await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(2));
  });

  it("shows upload busy state and prevents a second file selection before rerender", async () => {
    const upload = deferred<void>();
    onUpload.mockReturnValue(upload.promise);
    renderEditor();
    const input = screen.getByLabelText("Chọn ảnh") as HTMLInputElement;
    const file = new File(["png"], "avatar.png", { type: "image/png" });
    act(() => {
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(input.disabled).toBe(true);
    expect(input.closest("label")?.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Đang kết nối")).toBeTruthy();
    await act(async () => {
      upload.resolve();
      await upload.promise;
    });
    expect(input.disabled).toBe(false);
    expect(input.closest("label")?.getAttribute("aria-busy")).toBe("false");
  });
  it("localizes retained upload errors without exposing backend diagnostics", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
    const diagnostic =
      "StorageFailure: private-key=not-a-real-secret /srv/private/upload.ts:42";
    onUpload.mockRejectedValue(new Error(diagnostic));
    render(
      <FeedbackLocaleProvider>
        <FeedbackLanguageSwitcher />
        <ProfileImageEditor
          alt="Mai"
          fallback="M"
          help="JPEG"
          label="Avatar"
          onRemove={onRemove}
          onUpload={onUpload}
        />
      </FeedbackLocaleProvider>,
    );
    fireEvent.change(screen.getByLabelText("Chọn ảnh"), {
      target: {
        files: [new File(["png"], "avatar.png", { type: "image/png" })],
      },
    });
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Không thể tải ảnh lên.",
    );
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "Could not upload the image.",
    );
    expect(screen.queryByText(diagnostic)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Discard selected image" }),
    ).toBeTruthy();
  });

  it("chặn định dạng không hỗ trợ trước khi gọi API", async () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText("Chọn ảnh"), {
      target: {
        files: [new File(["svg"], "avatar.svg", { type: "image/svg+xml" })],
      },
    });

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.",
    );
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("hiện tiến độ, hỗ trợ hủy và thu hồi preview sau upload", async () => {
    const upload = deferred<void>();
    let requestSignal: AbortSignal | null = null;
    onUpload.mockImplementation(
      async (
        _file: File,
        options: {
          onProgress: (percent: number) => void;
          signal: AbortSignal;
        },
      ) => {
        requestSignal = options.signal;
        options.onProgress(48);
        return upload.promise;
      },
    );
    renderEditor();
    fireEvent.change(screen.getByLabelText("Chọn ảnh"), {
      target: {
        files: [new File(["png"], "avatar.png", { type: "image/png" })],
      },
    });

    expect((await screen.findAllByText("48%")).length).toBeGreaterThan(0);
    expect(
      screen.getByText("Đang tải trực tiếp lên máy chủ riêng"),
    ).toBeTruthy();
    expect((requestSignal as AbortSignal | null)?.aborted).toBe(false);
    expect(revokeObjectUrl).not.toHaveBeenCalled();
    upload.resolve();
    await waitFor(() =>
      expect(revokeObjectUrl).toHaveBeenCalledWith("blob:avatar-preview"),
    );
    expect(screen.queryByText("Hủy tải")).toBeNull();
  });

  it("hủy upload đang chờ và trả preview về ảnh đã lưu", async () => {
    let requestSignal: AbortSignal | null = null;
    onUpload.mockImplementation(
      (
        _file: File,
        options: { onProgress: (percent: number) => void; signal: AbortSignal },
      ) => {
        requestSignal = options.signal;
        return new Promise<void>((_resolve, reject) => {
          options.signal.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        });
      },
    );
    renderEditor();
    fireEvent.change(screen.getByLabelText("Chọn ảnh"), {
      target: {
        files: [new File(["png"], "avatar.png", { type: "image/png" })],
      },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Hủy tải" }));

    expect(requestSignal).not.toBeNull();
    expect((requestSignal as AbortSignal | null)?.aborted).toBe(true);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:avatar-preview");
    await waitFor(() => expect(screen.queryByText("Hủy tải")).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("gỡ ảnh hiện tại qua callback được cấp quyền", async () => {
    renderEditor(
      "https://lms-be.example.test/api/v1/public-assets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    fireEvent.click(screen.getByRole("button", { name: "Gỡ ảnh" }));
    await waitFor(() => expect(onRemove).toHaveBeenCalledOnce());
  });

  it("giữ preview khi lỗi để người dùng quyết định bỏ, không lộ lỗi ngoài", async () => {
    onUpload.mockRejectedValue(new Error("Ảnh không hợp lệ sau khi giải mã"));
    renderEditor();
    fireEvent.change(screen.getByLabelText("Chọn ảnh"), {
      target: {
        files: [new File(["png"], "avatar.png", { type: "image/png" })],
      },
    });

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Không thể tải ảnh lên.",
    );
    expect(screen.queryByText("Ảnh không hợp lệ sau khi giải mã")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Bỏ ảnh đã chọn" }));
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:avatar-preview");
  });

  it("abort request và thu hồi object URL khi component unmount", async () => {
    let requestSignal: AbortSignal | null = null;
    onUpload.mockImplementation(
      (
        _file: File,
        options: { onProgress: (percent: number) => void; signal: AbortSignal },
      ) => {
        requestSignal = options.signal;
        return new Promise<void>((_resolve, reject) => {
          options.signal.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        });
      },
    );
    const view = renderEditor();
    fireEvent.change(screen.getByLabelText("Chọn ảnh"), {
      target: {
        files: [new File(["png"], "avatar.png", { type: "image/png" })],
      },
    });
    await screen.findByText("Hủy tải");

    view.unmount();

    expect(requestSignal).not.toBeNull();
    expect((requestSignal as AbortSignal | null)?.aborted).toBe(true);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:avatar-preview");
  });
});
