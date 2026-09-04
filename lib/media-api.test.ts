// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import {
  mediaApi,
  requestAndOpenMediaDownload,
  runMediaUpload,
  sha256Base64,
  validateMediaFiles,
  type MediaAsset,
} from "./media-api";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiFetch: mocks.apiFetch };
});

const context = { token: "tenant-token" };
const target = {
  assignmentId: "assignment/one",
  kind: "LEARNER_SUBMISSION" as const,
};
const assetId = "64b000000000000000000011";

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    _id: assetId,
    contentType: "application/pdf",
    originalFileName: "bai-lam.pdf",
    purpose: "SUBMISSION_ATTACHMENT",
    revision: 2,
    sizeBytes: 4,
    status: "AVAILABLE",
    ...overrides,
  };
}

function future(milliseconds: number) {
  return new Date(Date.now() + milliseconds).toISOString();
}

function localTicket(kind: "download" | "upload", ticket: string) {
  return kind === "upload"
    ? "http://localhost:4000/api/v1/media/local/upload"
    : `http://localhost:4000/api/v1/media/local/download?ticket=${encodeURIComponent(ticket)}`;
}

describe("secure media API and browser workflow", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("dùng target-scoped route và no-store/no-referrer cho metadata, finalize, cancel và ticket", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(asset())
      .mockResolvedValueOnce(asset({ status: "QUARANTINED" }))
      .mockResolvedValueOnce(asset({ status: "DELETING" }))
      .mockResolvedValueOnce({
        expiresAt: future(60_000),
        url: localTicket("download", "secret"),
      });

    await mediaApi.getAsset(context, target, assetId);
    await mediaApi.finalizeUpload(context, target, assetId);
    await mediaApi.cancelAsset(context, target, assetId);
    await mediaApi.requestDownload(context, target, assetId);

    const root =
      "/assignments/assignment%2Fone/my-submission/attachments/64b000000000000000000011";
    expect(mocks.apiFetch.mock.calls.map(([path]) => path)).toEqual([
      root,
      `${root}/finalize`,
      root,
      `${root}/download`,
    ]);
    for (const [, options] of mocks.apiFetch.mock.calls) {
      expect(options).toMatchObject({
        cache: "no-store",
        credentials: "same-origin",
        referrerPolicy: "no-referrer",
        token: "tenant-token",
      });
    }
  });

  it("fail closed với malformed asset/ticket mà không đưa secret vào lỗi", async () => {
    const secretUrl = "http://localhost/private?token=SIGNED_SECRET";
    mocks.apiFetch.mockResolvedValueOnce({
      asset: asset({ status: "PENDING_UPLOAD" }),
      upload: {
        expiresAt: future(60_000),
        headers: { authorization: "Bearer HEADER_SECRET" },
        method: "PUT",
        url: secretUrl,
      },
    });

    let caught: unknown;
    try {
      await mediaApi.initiateUpload(context, target, {
        clientMutationId: "ed0ce85a-7043-4eed-9cf4-0cba8bf60882",
        contentType: "application/pdf",
        originalFileName: "bai-lam.pdf",
        sha256Base64: `${"A".repeat(43)}=`,
        sizeBytes: 4,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({ code: "MEDIA_RESPONSE_INVALID" });
    const serialized = `${String(caught)} ${JSON.stringify(caught)}`;
    expect(serialized).not.toContain("SIGNED_SECRET");
    expect(serialized).not.toContain("HEADER_SECRET");
  });

  it.each([
    {
      headers: {
        "content-type": "application/pdf",
        "x-checksum-sha256": "CHECKSUM",
      },
      label: "thiếu x-media-upload-ticket",
      url: localTicket("upload", "SAFE"),
    },
    {
      headers: {
        "content-length": "4",
        "content-type": "application/pdf",
        "x-checksum-sha256": "CHECKSUM",
        "x-media-upload-ticket": "SAFE",
      },
      label: "content-length do trình duyệt quản lý",
      url: localTicket("upload", "SAFE"),
    },
    {
      headers: {
        "content-type": "application/pdf",
        "x-checksum-sha256": "CHECKSUM",
        "x-media-upload-ticket": "SAFE",
      },
      label: "origin bên thứ ba",
      url: "https://files.attacker.test/api/v1/media/local/upload",
    },
    {
      headers: {
        "content-type": "application/pdf",
        "x-checksum-sha256": "CHECKSUM",
        "x-media-upload-ticket": "SAFE",
      },
      label: "sai đường dẫn local media",
      url: "http://localhost:4000/api/v1/media/local/download?ticket=SAFE",
    },
    {
      headers: {
        "content-type": "application/pdf",
        "x-checksum-sha256": "CHECKSUM",
        "x-media-upload-ticket": "SAFE",
      },
      label: "query trên upload endpoint",
      url: "http://localhost:4000/api/v1/media/local/upload?ticket=SAFE",
    },
  ])("từ chối upload ticket có $label", async ({ headers, url }) => {
    mocks.apiFetch.mockResolvedValueOnce({
      asset: asset({ status: "PENDING_UPLOAD" }),
      upload: {
        expiresAt: future(60_000),
        headers,
        method: "PUT",
        url,
      },
    });

    await expect(
      mediaApi.initiateUpload(context, target, {
        clientMutationId: "ed0ce85a-7043-4eed-9cf4-0cba8bf60882",
        contentType: "application/pdf",
        originalFileName: "bai-lam.pdf",
        sha256Base64: `${"A".repeat(43)}=`,
        sizeBytes: 4,
      }),
    ).rejects.toMatchObject({ code: "MEDIA_RESPONSE_INVALID" });
  });

  it.each([
    "http://localhost:4000/api/v1/media/local/download",
    "http://localhost:4000/api/v1/media/local/download?ticket=SAFE&ticket=SECOND",
    "http://localhost:4000/api/v1/media/local/download?ticket=SAFE&next=outside",
    "http://localhost:4000/api/v1/media/local/upload",
  ])("từ chối download ticket sai path/query: %s", async (url) => {
    mocks.apiFetch.mockResolvedValueOnce({
      expiresAt: future(60_000),
      url,
    });

    await expect(
      mediaApi.requestDownload(context, target, assetId),
    ).rejects.toMatchObject({ code: "MEDIA_RESPONSE_INVALID" });
  });

  it("fail closed nếu metadata asset không đúng purpose của target", async () => {
    mocks.apiFetch.mockResolvedValue(asset({ purpose: "LESSON_CONTENT" }));

    await expect(
      mediaApi.getAsset(context, target, assetId),
    ).rejects.toMatchObject({
      code: "MEDIA_RESPONSE_INVALID",
    });
  });

  it("tính SHA-256 base64 rồi direct PUT không credential/referrer trước finalize và bounded poll", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], "bai-lam.pdf", {
      lastModified: 1,
      type: "application/pdf",
    });
    const checksum = await sha256Base64(file);
    expect(checksum).toMatch(/^[A-Za-z0-9+/]{43}=$/u);
    const signedUrl = localTicket("upload", "DO_NOT_LOG");
    mocks.apiFetch
      .mockResolvedValueOnce({
        asset: asset({ status: "PENDING_UPLOAD" }),
        upload: {
          expiresAt: future(60_000),
          headers: {
            "content-type": "application/pdf",
            "x-checksum-sha256": checksum,
            "x-media-upload-ticket": "UPLOAD_TICKET",
          },
          method: "PUT",
          url: signedUrl,
        },
      })
      .mockResolvedValueOnce(asset({ status: "QUARANTINED" }))
      .mockResolvedValueOnce(asset());
    const storageFetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", storageFetch);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const consoleLog = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    const stages: string[] = [];

    await expect(
      runMediaUpload({
        clientMutationId: "ed0ce85a-7043-4eed-9cf4-0cba8bf60882",
        context,
        file,
        maxPollAttempts: 2,
        onProgress: ({ stage }) => stages.push(stage),
        pollIntervalMs: 1,
        target,
      }),
    ).resolves.toMatchObject({ _id: assetId, status: "AVAILABLE" });

    expect(storageFetch).toHaveBeenCalledOnce();
    const [url, options] = storageFetch.mock.calls[0];
    expect(url).toBe(signedUrl);
    expect(options).toMatchObject({
      body: file,
      cache: "no-store",
      credentials: "omit",
      headers: {
        "content-type": "application/pdf",
        "x-checksum-sha256": checksum,
        "x-media-upload-ticket": "UPLOAD_TICKET",
      },
      method: "PUT",
      mode: "cors",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
    expect(
      Object.keys(options.headers as Record<string, string>),
    ).not.toContain("content-length");
    expect(stages).toEqual([
      "HASHING",
      "INITIATING",
      "UPLOADING",
      "FINALIZING",
      "SCANNING",
      "AVAILABLE",
    ]);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it("abort direct PUT bị treo theo hạn ticket mà không abort signal của caller", async () => {
    const file = new File(["safe bytes"], "bai-lam.txt", {
      type: "text/plain",
    });
    mocks.apiFetch.mockResolvedValueOnce({
      asset: asset({
        contentType: "text/plain",
        originalFileName: "bai-lam.txt",
        status: "PENDING_UPLOAD",
      }),
      upload: {
        expiresAt: future(1_100),
        headers: {
          "content-type": "text/plain",
          "x-checksum-sha256": "CHECKSUM",
          "x-media-upload-ticket": "UPLOAD_TICKET",
        },
        method: "PUT",
        url: localTicket("upload", "SHORT"),
      },
    });
    let storageSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, options?: RequestInit) => {
        storageSignal = options?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          const abort = () =>
            reject(
              storageSignal?.reason instanceof Error
                ? storageSignal.reason
                : new DOMException("aborted", "AbortError"),
            );
          if (storageSignal?.aborted) abort();
          else storageSignal?.addEventListener("abort", abort, { once: true });
        });
      }),
    );
    const caller = new AbortController();

    await expect(
      runMediaUpload({ context, file, signal: caller.signal, target }),
    ).rejects.toMatchObject({
      code: "MEDIA_DIRECT_UPLOAD_TIMEOUT",
      stage: "UPLOADING",
    });

    expect(caller.signal.aborted).toBe(false);
    expect(storageSignal?.aborted).toBe(true);
    expect(mocks.apiFetch).toHaveBeenCalledOnce();
  });

  it("dọn deadline và listener của direct PUT sau khi upload thành công", async () => {
    vi.useFakeTimers();
    const file = new File(["safe bytes"], "bai-lam.txt", {
      type: "text/plain",
    });
    mocks.apiFetch
      .mockResolvedValueOnce({
        asset: asset({
          contentType: "text/plain",
          originalFileName: "bai-lam.txt",
          status: "PENDING_UPLOAD",
        }),
        upload: {
          expiresAt: future(60_000),
          headers: {
            "content-type": "text/plain",
            "x-checksum-sha256": "CHECKSUM",
            "x-media-upload-ticket": "UPLOAD_TICKET",
          },
          method: "PUT",
          url: localTicket("upload", "SHORT"),
        },
      })
      .mockResolvedValueOnce(
        asset({
          contentType: "text/plain",
          originalFileName: "bai-lam.txt",
          status: "AVAILABLE",
        }),
      );
    let storageSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, options?: RequestInit) => {
        storageSignal = options?.signal ?? undefined;
        return Promise.resolve(new Response(null, { status: 204 }));
      }),
    );
    const caller = new AbortController();

    await expect(
      runMediaUpload({ context, file, signal: caller.signal, target }),
    ).resolves.toMatchObject({ status: "AVAILABLE" });

    await vi.advanceTimersByTimeAsync(60_000);
    caller.abort();
    expect(storageSignal?.aborted).toBe(false);
  });

  it("upload failure chỉ trả lỗi stage an toàn, không leak ticket/header/checksum", async () => {
    const file = new File(["safe bytes"], "bai-lam.txt", {
      type: "text/plain",
    });
    const ticketSecret = "URL_SECRET";
    const headerSecret = "HEADER_SECRET";
    mocks.apiFetch.mockResolvedValueOnce({
      asset: asset({
        contentType: "text/plain",
        originalFileName: "bai-lam.txt",
        status: "PENDING_UPLOAD",
      }),
      upload: {
        expiresAt: future(60_000),
        headers: {
          "content-type": "text/plain",
          "x-checksum-sha256": "CHECKSUM",
          "x-media-upload-ticket": headerSecret,
        },
        method: "PUT",
        url: localTicket("upload", ticketSecret),
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error(`network ${ticketSecret}`)),
    );

    let caught: unknown;
    try {
      await runMediaUpload({ context, file, target });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      code: "MEDIA_DIRECT_UPLOAD_FAILED",
      stage: "UPLOADING",
    });
    const output = `${String(caught)} ${JSON.stringify(caught)}`;
    expect(output).not.toContain(ticketSecret);
    expect(output).not.toContain(headerSecret);
  });

  it("abort polling gọi cancel bounded và không tiếp tục GET", async () => {
    const file = new File(["safe bytes"], "bai-lam.txt", {
      type: "text/plain",
    });
    mocks.apiFetch
      .mockResolvedValueOnce({
        asset: asset({
          contentType: "text/plain",
          originalFileName: "bai-lam.txt",
          status: "QUARANTINED",
        }),
        upload: null,
      })
      .mockResolvedValueOnce(asset({ status: "DELETING" }));
    const controller = new AbortController();
    const promise = runMediaUpload({
      context,
      file,
      maxPollAttempts: 10,
      pollIntervalMs: 100,
      signal: controller.signal,
      target,
    });
    await vi.waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledOnce());
    controller.abort();

    await expect(promise).rejects.toMatchObject({
      code: "MEDIA_UPLOAD_CANCELLED",
    });
    expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
    expect(mocks.apiFetch).toHaveBeenLastCalledWith(
      "/assignments/assignment%2Fone/my-submission/attachments/64b000000000000000000011",
      expect.objectContaining({ method: "DELETE", token: "tenant-token" }),
    );
  });

  it("download ticket chỉ tồn tại trong event, mở no-referrer rồi xóa href khỏi DOM", async () => {
    const signedUrl = localTicket("download", "SHORT_LIVED");
    mocks.apiFetch.mockResolvedValue({
      expiresAt: future(60_000),
      url: signedUrl,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    await requestAndOpenMediaDownload(
      context,
      {
        kind: "GRADING",
        submissionId: "submission/one",
      },
      assetId,
    );

    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector(`a[href="${signedUrl}"]`)).toBeNull();
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/grading/submissions/submission%2Fone/attachments/64b000000000000000000011/download",
      expect.objectContaining({
        cache: "no-store",
        referrerPolicy: "no-referrer",
      }),
    );
  });

  it("preflight chặn count, size, MIME và duplicate trước khi đọc bytes", () => {
    const first = new File(["one"], "bai-lam.txt", {
      lastModified: 1,
      type: "text/plain",
    });
    const duplicate = new File(["one"], "bai-lam.txt", {
      lastModified: 1,
      type: "text/plain",
    });
    const invalidMime = new File(["one"], "script.html", { type: "text/html" });
    const oversized = new File([new Uint8Array(6)], "large.txt", {
      type: "text/plain",
    });

    expect(
      validateMediaFiles({
        allowedContentTypes: ["text/plain"],
        currentCount: 4,
        files: [first, duplicate],
        maxBytes: 5,
        maxCount: 5,
      }),
    ).toContain("tối đa 5");
    expect(
      validateMediaFiles({
        allowedContentTypes: ["text/plain"],
        currentCount: 0,
        files: [first, duplicate],
        maxBytes: 5,
        maxCount: 5,
      }),
    ).toContain("cùng một tệp");
    expect(
      validateMediaFiles({
        allowedContentTypes: ["text/plain"],
        currentCount: 0,
        files: [invalidMime],
        maxBytes: 5,
        maxCount: 5,
      }),
    ).toContain("định dạng");
    expect(
      validateMediaFiles({
        allowedContentTypes: ["text/plain"],
        currentCount: 0,
        files: [oversized],
        maxBytes: 5,
        maxCount: 5,
      }),
    ).toContain("không vượt quá");
  });
});
