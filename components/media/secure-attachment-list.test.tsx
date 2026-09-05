// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import type { MediaAsset } from "@/lib/media-api";
import { lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";
import { SecureAttachmentList } from "./secure-attachment-list";

const mocks = vi.hoisted(() => ({
  getAsset: vi.fn(),
  openMediaDownload: vi.fn(),
  requestDownload: vi.fn(),
}));

vi.mock("@/lib/media-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/media-api")>();
  return {
    ...original,
    mediaApi: {
      ...original.mediaApi,
      getAsset: mocks.getAsset,
      requestDownload: mocks.requestDownload,
    },
    openMediaDownload: mocks.openMediaDownload,
  };
});
vi.mock(
  "antd",
  async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

const scope: ViewerScope = {
  membershipId: "membership-1",
  role: "LEARNER",
  tenantId: "tenant-1",
  viewerId: "learner-1",
};
const assetId = "64b000000000000000000011";
const availableAsset: MediaAsset = {
  _id: assetId,
  contentType: "application/pdf",
  originalFileName: "bai-lam-rieng-tu.pdf",
  purpose: "SUBMISSION_ATTACHMENT",
  revision: 4,
  sizeBytes: 1_024,
  status: "AVAILABLE",
};
const target = {
  assignmentId: "assignment-1",
  kind: "LEARNER_SUBMISSION" as const,
};

function attachmentList(mediaEnabled: boolean) {
  return (
    <SecureAttachmentList
      assetIds={[assetId]}
      mediaEnabled={mediaEnabled}
      scope={scope}
      target={target}
      token="tenant-token"
    />
  );
}

describe("SecureAttachmentList authority lifecycle", () => {
  it.each(["remove", "up", "down"] as const)(
    "shows pending for %s and prevents overlapping replacements until settlement",
    async (action) => {
      let fail!: (error: Error) => void;
      const pending = new Promise<void>((_resolve, reject) => {
        fail = reject;
      });
      const onReplace = vi
        .fn()
        .mockReturnValueOnce(pending)
        .mockResolvedValue(undefined);
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <QueryClientProvider client={client}>
          <SecureAttachmentList
            assetIds={[assetId, "asset-2"]}
            canMutate
            mediaEnabled
            onReplace={onReplace}
            scope={scope}
            target={target}
            token="tenant-token"
          />
        </QueryClientProvider>,
      );
      await screen.findAllByText("bai-lam-rieng-tu.pdf");
      const button =
        action === "remove"
          ? screen.getAllByRole("button", { name: "Gỡ" })[0]
          : screen.getByRole("button", {
              name: action === "up" ? "Đưa tệp 2 lên" : "Đưa tệp 1 xuống",
            });
      act(() => {
        fireEvent.click(button);
        fireEvent.click(button);
      });
      expect(onReplace).toHaveBeenCalledTimes(1);
      expect(onReplace).toHaveBeenCalledWith(
        action === "remove" ? ["asset-2"] : ["asset-2", assetId],
      );
      expect(button.classList.contains("ant-btn-loading")).toBe(true);
      for (const group of screen.getAllByRole("group")) {
        for (const control of within(group).getAllByRole("button"))
          expect((control as HTMLButtonElement).disabled).toBe(true);
      }
      await act(async () => {
        fail(new Error("Không thể cập nhật danh sách tệp."));
        await pending.catch(() => undefined);
      });
      expect((await screen.findByRole("alert")).textContent).toContain(
        "Không thể cập nhật danh sách tệp.",
      );
      expect(button.classList.contains("ant-btn-loading")).toBe(false);
      expect((button as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(button);
      await waitFor(() => expect(onReplace).toHaveBeenCalledTimes(2));
      await waitFor(() =>
        expect(button.classList.contains("ant-btn-loading")).toBe(false),
      );
    },
  );

  it("shows metadata retry loading and shares an in-flight retry instead of cancelling it", async () => {
    let complete!: (asset: MediaAsset) => void;
    mocks.getAsset
      .mockRejectedValueOnce(new Error("metadata unavailable"))
      .mockImplementationOnce(
        () =>
          new Promise<MediaAsset>((resolve) => {
            complete = resolve;
          }),
      );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        {attachmentList(true)}
      </QueryClientProvider>,
    );
    const retry = await screen.findByRole("button", { name: "Thử lại" });
    act(() => {
      fireEvent.click(retry);
      fireEvent.click(retry);
    });
    await waitFor(() => expect(mocks.getAsset).toHaveBeenCalledTimes(2));
    expect(retry.classList.contains("ant-btn-loading")).toBe(true);
    await act(async () => {
      complete(availableAsset);
    });
    await screen.findByText("bai-lam-rieng-tu.pdf");
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
  });
  beforeEach(() => {
    mocks.getAsset.mockReset().mockResolvedValue(availableAsset);
    mocks.openMediaDownload.mockReset();
    mocks.requestDownload.mockReset();
  });

  afterEach(() => cleanup());

  it("chỉ truyền asset đã parse cho action sidecar", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <SecureAttachmentList
          assetIds={[assetId]}
          mediaEnabled
          renderAssetAction={(asset) => (
            <span>Action cho {asset.originalFileName}</span>
          )}
          scope={scope}
          target={target}
          token="tenant-token"
        />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("Action cho bai-lam-rieng-tu.pdf"),
    ).toBeTruthy();
  });

  it("thu hồi MEDIA ẩn metadata cache và chặn ticket stale mở sau revocation", async () => {
    let resolveTicket!: (ticket: { expiresAt: string; url: string }) => void;
    let ticketSignal: AbortSignal | undefined;
    mocks.requestDownload.mockImplementation(
      (
        _context: unknown,
        _target: unknown,
        _assetId: string,
        signal?: AbortSignal,
      ) => {
        ticketSignal = signal;
        return new Promise((resolve) => {
          resolveTicket = resolve;
        });
      },
    );
    const client = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { gcTime: Infinity, retry: false },
      },
    });
    const view = render(
      <QueryClientProvider client={client}>
        {attachmentList(true)}
      </QueryClientProvider>,
    );

    expect(await screen.findByText("bai-lam-rieng-tu.pdf")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tải xuống" }));
    await waitFor(() => expect(mocks.requestDownload).toHaveBeenCalledOnce());

    view.rerender(
      <QueryClientProvider client={client}>
        {attachmentList(false)}
      </QueryClientProvider>,
    );

    expect(screen.queryByText("bai-lam-rieng-tu.pdf")).toBeNull();
    expect(screen.getByText(/Mã tệp …00000011/u)).toBeTruthy();
    expect(ticketSignal?.aborted).toBe(true);
    await waitFor(() =>
      expect(
        client.getQueryData(
          lmsQueryKeys.mySubmissionAsset(scope, "assignment-1", assetId),
        ),
      ).toBeUndefined(),
    );

    await act(async () => {
      resolveTicket({
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        url: "http://localhost:4000/api/v1/media/local/download?ticket=STALE",
      });
      await Promise.resolve();
    });

    expect(mocks.openMediaDownload).not.toHaveBeenCalled();
  });
});
