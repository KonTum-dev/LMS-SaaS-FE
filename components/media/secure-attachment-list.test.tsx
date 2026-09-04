// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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

    expect(await screen.findByText("Action cho bai-lam-rieng-tu.pdf")).toBeTruthy();
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
