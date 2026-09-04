// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationInboxItem, NotificationListResponse } from "@/lib/types";
import type { NotificationViewerScope } from "@/lib/query-keys";
import { NotificationCenter } from "./notification-center";

const mocks = vi.hoisted(() => ({
  getUnreadCount: vi.fn(),
  list: vi.fn(),
  markAllRead: vi.fn(),
  markRead: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/notification-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notification-api")>();
  return {
    ...actual,
    notificationApi: {
      getUnreadCount: mocks.getUnreadCount,
      list: mocks.list,
      markAllRead: mocks.markAllRead,
      markRead: mocks.markRead,
    },
  };
});

const scopeA: NotificationViewerScope = {
  membershipId: "membership-a",
  role: "LEARNER",
  tenantId: "tenant-a",
  viewerId: "learner-a",
};

const scopeB: NotificationViewerScope = {
  membershipId: "membership-b",
  role: "INSTRUCTOR",
  tenantId: "tenant-b",
  viewerId: "learner-a",
};

function notification(
  id: string,
  overrides: Partial<NotificationInboxItem> = {},
): NotificationInboxItem {
  return {
    _id: id,
    action: { label: "Mở bài tập", path: `/assignments/${id}` },
    body: "Nội dung thông báo an toàn.",
    createdAt: "2030-01-02T09:00:00.000Z",
    occurredAt: "2030-01-02T09:00:00.000Z",
    readAt: null,
    resource: { id, kind: "ASSIGNMENT" },
    title: `Thông báo ${id}`,
    type: "ASSIGNMENT_PUBLISHED",
    ...overrides,
  };
}

function queryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
}

function renderCenter(
  scope = scopeA,
  token = "token-a",
  client = queryClient(),
) {
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <NotificationCenter scope={scope} token={token} />
      </QueryClientProvider>,
    ),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

beforeAll(() => {
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
  vi.stubGlobal("ResizeObserver", class {
    disconnect() {}
    observe() {}
    unobserve() {}
  });
});

beforeEach(() => {
  mocks.getUnreadCount.mockReset();
  mocks.list.mockReset();
  mocks.markAllRead.mockReset();
  mocks.markRead.mockReset();
  mocks.push.mockReset();
  mocks.getUnreadCount.mockResolvedValue({ unreadCount: 2 });
  mocks.list.mockResolvedValue({
    items: [notification("assignment-1"), notification("assignment-2")],
    nextCursor: null,
  });
  mocks.markAllRead.mockResolvedValue({
    readAt: "2030-01-02T10:00:00.000Z",
    updatedCount: 2,
  });
  mocks.markRead.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe("NotificationCenter", () => {
  it("có bell/drawer accessible, render text-only và chỉ điều hướng action nội bộ an toàn", async () => {
    mocks.list.mockResolvedValue({
      items: [
        notification("unsafe", {
          action: { label: "Mở trang ngoài", path: "https://attacker.example/steal" },
          body: "<script>window.stolen = true</script>",
          title: "<img src=x onerror=alert(1)>",
        }),
        notification("safe", {
          action: { label: "Xem kết quả", path: "/assignments/safe?tab=result" },
        }),
      ],
      nextCursor: null,
    });
    renderCenter();

    const trigger = await screen.findByRole("button", {
      name: "Mở trung tâm thông báo, 2 chưa đọc",
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);

    expect(await screen.findByRole("dialog", { name: "Thông báo" })).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(screen.getByText("<script>window.stolen = true</script>")).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("img[src='x']")).toBeNull();
    expect(screen.queryByRole("button", { name: "Mở trang ngoài" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Xem kết quả" }));
    expect(mocks.push).toHaveBeenCalledWith("/assignments/safe?tab=result");
    await waitFor(() => expect(mocks.markRead).toHaveBeenCalledWith({ token: "token-a" }, "safe"));
  });

  it("phân trang bằng cursor opaque và không đưa cursor vào query key", async () => {
    mocks.list.mockImplementation((_context, query: { cursor?: string }) => Promise.resolve(
      query.cursor
        ? { items: [notification("assignment-2")], nextCursor: null }
        : { items: [notification("assignment-1")], nextCursor: "v1_next-cursor" },
    ));
    const { client } = renderCenter();
    fireEvent.click(await screen.findByRole("button", { name: /Mở trung tâm thông báo/ }));

    expect(await screen.findByText("Thông báo assignment-1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tải thêm" }));
    expect(await screen.findByText("Thông báo assignment-2")).toBeTruthy();
    expect(mocks.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ token: "token-a" }),
      { cursor: "v1_next-cursor", limit: 20, unreadOnly: false },
    );
    expect(JSON.stringify(client.getQueryCache().getAll().map((query) => query.queryKey)))
      .not.toContain("v1_next-cursor");
  });

  it("đánh dấu một/tất cả đã đọc và cho lọc unread trong READ_ONLY-independent UI", async () => {
    let items = [notification("assignment-1"), notification("assignment-2")];
    let unreadCount = 2;
    mocks.getUnreadCount.mockImplementation(() => Promise.resolve({ unreadCount }));
    mocks.list.mockImplementation((_context, query: { unreadOnly?: boolean }) => Promise.resolve({
      items: query.unreadOnly ? items.filter((item) => !item.readAt) : items,
      nextCursor: null,
    }));
    mocks.markRead.mockImplementation((_context, id: string) => {
      items = items.map((item) => item._id === id
        ? { ...item, readAt: "2030-01-02T09:30:00.000Z" }
        : item);
      unreadCount -= 1;
      return Promise.resolve(undefined);
    });
    mocks.markAllRead.mockImplementation(() => {
      const readAt = "2030-01-02T10:00:00.000Z";
      const updatedCount = unreadCount;
      items = items.map((item) => ({ ...item, readAt: item.readAt ?? readAt }));
      unreadCount = 0;
      return Promise.resolve({ readAt, updatedCount });
    });
    renderCenter();
    fireEvent.click(await screen.findByRole("button", { name: /Mở trung tâm thông báo/ }));
    await screen.findByText("Thông báo assignment-1");

    fireEvent.click(screen.getByRole("button", {
      name: "Đánh dấu “Thông báo assignment-1” đã đọc",
    }));
    await waitFor(() => expect(mocks.markRead).toHaveBeenCalledWith(
      { token: "token-a" },
      "assignment-1",
    ));
    await waitFor(() => expect(screen.queryByRole("button", {
      name: "Đánh dấu “Thông báo assignment-1” đã đọc",
    })).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Chưa đọc" }));
    await waitFor(() => expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ token: "token-a" }),
      { cursor: undefined, limit: 20, unreadOnly: true },
    ));
    expect(await screen.findByText("Thông báo assignment-2")).toBeTruthy();
    expect(screen.queryByText("Thông báo assignment-1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" }));
    await waitFor(() => expect(mocks.markAllRead).toHaveBeenCalledWith({ token: "token-a" }));
    expect(await screen.findByText("Bạn đã đọc hết thông báo")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", {
      name: "Mở trung tâm thông báo",
    })).toBeTruthy());
  });

  it("QueryClient rotation chặn list tenant cũ đến muộn làm bẩn scope mới", async () => {
    const oldList = deferred<NotificationListResponse>();
    mocks.getUnreadCount.mockImplementation(({ token }: { token: string }) => Promise.resolve({
      unreadCount: token === "token-a" ? 1 : 0,
    }));
    mocks.list.mockImplementation(({ token }: { token: string }) => token === "token-a"
      ? oldList.promise
      : Promise.resolve({ items: [notification("tenant-b")], nextCursor: null }));
    const oldClient = queryClient();
    const newClient = queryClient();
    const view = render(
      <QueryClientProvider client={oldClient} key="tenant-a">
        <NotificationCenter scope={scopeA} token="token-a" />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Mở trung tâm thông báo/ }));
    await waitFor(() => expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ token: "token-a" }),
      expect.any(Object),
    ));

    view.rerender(
      <QueryClientProvider client={newClient} key="tenant-b">
        <NotificationCenter scope={scopeB} token="token-b" />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Mở trung tâm thông báo" }));
    expect(await screen.findByText("Thông báo tenant-b")).toBeTruthy();

    act(() => oldList.resolve({
      items: [notification("tenant-a-late", { title: "Dữ liệu tenant A đến muộn" })],
      nextCursor: null,
    }));
    await act(async () => { await Promise.resolve(); });

    expect(screen.queryByText("Dữ liệu tenant A đến muộn")).toBeNull();
    expect(screen.getByText("Thông báo tenant-b")).toBeTruthy();
    const newKeys = JSON.stringify(newClient.getQueryCache().getAll().map((query) => query.queryKey));
    expect(newKeys).toContain("membership-b");
    expect(newKeys).not.toContain("membership-a");
  });
});
