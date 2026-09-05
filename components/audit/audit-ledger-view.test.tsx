// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AuditEventsResponse,
  AuditIntegrityResponse,
} from "@/lib/audit-api";
import type { ViewerScope } from "@/lib/query-keys";
import { AuditLedgerView } from "./audit-ledger-view";
import {
  FeedbackLanguageSwitcher,
  FeedbackLocaleProvider,
} from "@/components/feedback/feedback-locale";

const api = vi.hoisted(() => ({
  listEvents: vi.fn(),
  verifyIntegrity: vi.fn(),
}));

vi.mock("@/lib/audit-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/audit-api")>();
  return { ...original, auditApi: api };
});
vi.mock(
  "antd",
  async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

const viewer: ViewerScope = {
  membershipId: "membership-1",
  role: "TENANT_ADMIN",
  tenantId: "507f1f77bcf86cd799439011",
  viewerId: "507f1f77bcf86cd799439012",
};

function response(nextCursor: string | null = null): AuditEventsResponse {
  return {
    items: [
      {
        action: "MEMBERSHIP_ROLE_CHANGED",
        actor: { kind: "USER", role: "TENANT_ADMIN", userId: viewer.viewerId },
        changedFields: ["role"],
        details: {
          afterRole: "INSTRUCTOR",
          beforeRole: "LEARNER",
          revision: 4,
        },
        eventHash: "b".repeat(64),
        id: "507f1f77bcf86cd799439020",
        keyId: "audit-v1",
        outcome: "SUCCEEDED",
        previousHash: "a".repeat(64),
        recordedAt: "2030-08-20T08:00:00.000Z",
        sequence: 12,
        target: { id: "507f1f77bcf86cd799439021", type: "MEMBERSHIP" },
      },
    ],
    nextCursor,
    snapshot: {
      chainId: "507f1f77bcf86cd799439030",
      checkpoint: "signed-checkpoint",
      throughHash: "b".repeat(64),
      throughSequence: 12,
    },
  };
}

function verified(
  checkpoint = "new-signed-checkpoint",
): AuditIntegrityResponse {
  return {
    checkpoint,
    complete: true,
    continuation: null,
    headSequence: 12,
    issue: null,
    valid: true,
    verifiedFromSequence: 1,
    verifiedThroughSequence: 12,
  };
}

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
}

function renderView(client = createClient()) {
  return render(
    <QueryClientProvider client={client}>
      <AuditLedgerView
        scope={{ kind: "CURRENT_TENANT" }}
        token="tenant-token"
        viewerScope={viewer}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  api.listEvents.mockReset();
  api.verifyIntegrity.mockReset();
  api.listEvents.mockResolvedValue(response());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AuditLedgerView", () => {
  it("localizes audit controls while preserving evidence, checkpoints and filter identifiers", async () => {
    render(
      <FeedbackLocaleProvider initialLocale="en">
        <FeedbackLanguageSwitcher />
        <QueryClientProvider client={createClient()}>
          <AuditLedgerView
            scope={{ kind: "CURRENT_TENANT" }}
            token="tenant-token"
            viewerScope={viewer}
          />
        </QueryClientProvider>
      </FeedbackLocaleProvider>,
    );
    expect(await screen.findByText("#12")).toBeTruthy();
    expect(screen.getAllByText("Change member role").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("signed-checkpoint")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Audit action"), {
      target: { value: "INVITATION_REVOKED" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() =>
      expect(api.listEvents).toHaveBeenLastCalledWith(
        { token: "tenant-token" },
        { kind: "CURRENT_TENANT" },
        expect.objectContaining({ action: "INVITATION_REVOKED", limit: 50 }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    expect(screen.getByLabelText("Hành động audit")).toBeTruthy();
    expect(
      (screen.getByLabelText("Hành động audit") as HTMLSelectElement).value,
    ).toBe("INVITATION_REVOKED");
    expect(screen.getByDisplayValue("signed-checkpoint")).toBeTruthy();
  });

  it("renders only redacted typed evidence and applies first-page filters", async () => {
    renderView();

    expect(await screen.findByText("#12")).toBeTruthy();
    expect(
      screen.getAllByText("Đổi vai trò thành viên").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Đã thay đổi").length).toBeGreaterThan(1);
    expect(screen.getByDisplayValue("signed-checkpoint")).toBeTruthy();
    expect(
      screen.getByText(
        "Checkpoint snapshot chưa xác minh — hãy kiểm tra chuỗi trước khi lưu",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("option", { name: "Chấp nhận lời mời" }),
    ).toBeNull();

    fireEvent.change(screen.getByLabelText("Hành động audit"), {
      target: { value: "INVITATION_REVOKED" },
    });
    fireEvent.change(screen.getByLabelText("Mã đối tượng"), {
      target: { value: " 507f1f77bcf86cd799439099 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));

    await waitFor(() =>
      expect(api.listEvents).toHaveBeenLastCalledWith(
        { token: "tenant-token" },
        { kind: "CURRENT_TENANT" },
        expect.objectContaining({
          action: "INVITATION_REVOKED",
          limit: 50,
          targetId: "507f1f77bcf86cd799439099",
        }),
      ),
    );
  });

  it("uses only the opaque cursor for the next immutable snapshot page", async () => {
    api.listEvents
      .mockResolvedValueOnce(response("signed-next-cursor"))
      .mockResolvedValueOnce({ ...response(null), items: [] });
    renderView();

    fireEvent.click(
      await screen.findByRole("button", { name: "Tải thêm sự kiện" }),
    );

    await waitFor(() =>
      expect(api.listEvents).toHaveBeenNthCalledWith(
        2,
        { token: "tenant-token" },
        { kind: "CURRENT_TENANT" },
        { cursor: "signed-next-cursor", limit: 50 },
      ),
    );
  });

  it("verifies with an external checkpoint and exposes the new anchor", async () => {
    api.verifyIntegrity.mockResolvedValue(verified());
    renderView();
    await screen.findByText("Đổi vai trò thành viên");

    fireEvent.change(
      screen.getByPlaceholderText("Dán checkpoint từ lần kiểm tra trước"),
      {
        target: { value: "external-checkpoint" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra chuỗi" }));

    expect(
      await screen.findByText("Phạm vi incremental từ checkpoint hợp lệ"),
    ).toBeTruthy();
    expect(api.verifyIntegrity).toHaveBeenCalledWith(
      { token: "tenant-token" },
      { kind: "CURRENT_TENANT" },
      { checkpoint: "external-checkpoint", maxEvents: 5000 },
    );
    expect(screen.getByDisplayValue("new-signed-checkpoint")).toBeTruthy();
    expect(
      screen.getByText("Checkpoint incremental đã xác minh — lưu ngoài Mongo"),
    ).toBeTruthy();
  });

  it("labels a paginated genesis verification separately from an anchored range", async () => {
    api.verifyIntegrity
      .mockResolvedValueOnce({
        checkpoint: null,
        complete: false,
        continuation: "signed-continuation",
        headSequence: 12,
        issue: null,
        valid: true,
        verifiedFromSequence: 1,
        verifiedThroughSequence: 5,
      } satisfies AuditIntegrityResponse)
      .mockResolvedValueOnce({
        ...verified("genesis-checkpoint"),
        verifiedFromSequence: 6,
      });
    renderView();
    await screen.findByText("Đổi vai trò thành viên");

    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra chuỗi" }));
    expect(
      await screen.findByText("Phần đã kiểm tra hợp lệ; cần tiếp tục"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục kiểm tra" }));

    expect(await screen.findByText("Đã hoàn tất quét từ genesis")).toBeTruthy();
    expect(api.verifyIntegrity).toHaveBeenNthCalledWith(
      2,
      { token: "tenant-token" },
      { kind: "CURRENT_TENANT" },
      { continuation: "signed-continuation", maxEvents: 5000 },
    );
    expect(
      screen.getByText("Checkpoint sau lần quét từ genesis — lưu ngoài Mongo"),
    ).toBeTruthy();
  });

  it("does not present the list snapshot checkpoint after integrity verification fails", async () => {
    api.verifyIntegrity.mockResolvedValue({
      checkpoint: null,
      complete: false,
      continuation: null,
      headSequence: 12,
      issue: { code: "EVENT_HASH_MISMATCH", sequence: 8 },
      valid: false,
      verifiedFromSequence: 1,
      verifiedThroughSequence: 7,
    } satisfies AuditIntegrityResponse);
    renderView();
    await screen.findByText("Đổi vai trò thành viên");

    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra chuỗi" }));

    expect(
      await screen.findByText(/Hash nội dung sự kiện không khớp/),
    ).toBeTruthy();
    expect(screen.queryByDisplayValue("signed-checkpoint")).toBeNull();
    expect(screen.queryByText(/Checkpoint .*lưu ngoài Mongo/)).toBeNull();
  });

  it("drops a late verification result after the authority scope changes", async () => {
    let resolveVerification:
      ((value: AuditIntegrityResponse) => void) | undefined;
    api.verifyIntegrity.mockReturnValue(
      new Promise((resolve) => {
        resolveVerification = resolve;
      }),
    );
    const client = createClient();
    const rendered = renderView(client);
    await screen.findByText("Đổi vai trò thành viên");
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra chuỗi" }));

    rendered.rerender(
      <QueryClientProvider client={client}>
        <AuditLedgerView
          scope={{
            kind: "PLATFORM_TENANT",
            tenantId: "507f1f77bcf86cd799439088",
          }}
          token="platform-token"
          viewerScope={{
            membershipId: "platform",
            role: "SUPER_ADMIN",
            tenantId: "platform",
            viewerId: "root-user",
          }}
        />
      </QueryClientProvider>,
    );
    resolveVerification?.(verified("stale-checkpoint"));

    await waitFor(() => expect(api.verifyIntegrity).toHaveBeenCalledTimes(1));
    expect(screen.queryByDisplayValue("stale-checkpoint")).toBeNull();
    expect(screen.queryByText("Đã hoàn tất quét từ genesis")).toBeNull();
  });
});
