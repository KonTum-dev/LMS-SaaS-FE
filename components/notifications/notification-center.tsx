"use client";

import { BellOutlined, CheckOutlined, ReloadOutlined, RightOutlined } from "@ant-design/icons";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { Alert, Badge, Button, Drawer, Empty, Spin } from "antd";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  notificationApi,
  safeNotificationActionPath,
} from "@/lib/notification-api";
import {
  lmsQueryKeys,
  type NotificationViewerScope,
} from "@/lib/query-keys";
import type {
  NotificationInboxItem,
  NotificationListResponse,
  NotificationUnreadCountResponse,
} from "@/lib/types";

const PAGE_SIZE = 20;
const notificationTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export interface NotificationCenterProps {
  scope: NotificationViewerScope;
  token: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Không thể tải thông báo";
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Thời gian không xác định" : notificationTime.format(date);
}

function normalizeUnreadCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function updateNotificationPages(
  queryClient: QueryClient,
  scope: NotificationViewerScope,
  update: (item: NotificationInboxItem) => NotificationInboxItem,
) {
  queryClient.setQueriesData<InfiniteData<NotificationListResponse>>(
    { queryKey: lmsQueryKeys.notificationLists(scope) },
    (current) => current ? {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        items: page.items.map(update),
      })),
    } : current,
  );
}

function NotificationItem({
  item,
  markingRead,
  onMarkRead,
  onNavigate,
}: {
  item: NotificationInboxItem;
  markingRead: boolean;
  onMarkRead: (item: NotificationInboxItem) => void;
  onNavigate: (item: NotificationInboxItem, path: string) => void;
}) {
  const actionPath = item.action ? safeNotificationActionPath(item.action.path) : null;

  return (
    <article className={`notification-item${item.readAt ? " is-read" : " is-unread"}`}>
      <span aria-hidden="true" className="notification-item-dot" />
      <div className="notification-item-content">
        <div className="notification-item-heading">
          <h3>{item.title}</h3>
          <span className="visually-hidden">{item.readAt ? "Đã đọc" : "Chưa đọc"}</span>
          <time dateTime={item.occurredAt}>{formatTime(item.occurredAt)}</time>
        </div>
        <p>{item.body}</p>
        <div className="notification-item-actions">
          {actionPath ? (
            <Button
              icon={<RightOutlined aria-hidden="true" />}
              iconPlacement="end"
              onClick={() => onNavigate(item, actionPath)}
              size="small"
              type="link"
            >
              {item.action?.label || "Mở chi tiết"}
            </Button>
          ) : null}
          {!item.readAt ? (
            <Button
              aria-label={`Đánh dấu “${item.title}” đã đọc`}
              disabled={markingRead}
              icon={<CheckOutlined aria-hidden="true" />}
              loading={markingRead}
              onClick={() => onMarkRead(item)}
              size="small"
              type="text"
            >
              Đã đọc
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function NotificationCenter({ scope, token }: NotificationCenterProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const listKey = lmsQueryKeys.notificationsList(scope, {
    limit: PAGE_SIZE,
    unreadOnly,
  });
  const unreadCountKey = lmsQueryKeys.notificationUnreadCount(scope);
  const unreadQuery = useQuery({
    queryKey: unreadCountKey,
    queryFn: ({ signal }) => notificationApi.getUnreadCount({ signal, token }),
    refetchInterval: 60_000,
  });
  const listQuery = useInfiniteQuery({
    enabled: open,
    initialPageParam: null as string | null,
    queryKey: listKey,
    queryFn: ({ pageParam, signal }) => notificationApi.list(
      { signal, token },
      {
        cursor: pageParam ?? undefined,
        limit: PAGE_SIZE,
        unreadOnly,
      },
    ),
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
  });

  const markRead = useMutation({
    mutationFn: (notificationId: string) => notificationApi.markRead({ token }, notificationId),
    onSuccess: async (_result, notificationId) => {
      const readAt = new Date().toISOString();
      updateNotificationPages(queryClient, scope, (item) => item._id === notificationId
        ? { ...item, readAt: item.readAt ?? readAt }
        : item);
      queryClient.setQueryData<NotificationUnreadCountResponse>(unreadCountKey, (current) => current
        ? { unreadCount: Math.max(0, normalizeUnreadCount(current.unreadCount) - 1) }
        : current);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: lmsQueryKeys.notificationLists(scope) }),
        queryClient.invalidateQueries({ queryKey: unreadCountKey }),
      ]);
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationApi.markAllRead({ token }),
    onSuccess: async (result) => {
      const cutoff = Date.parse(result.readAt);
      updateNotificationPages(queryClient, scope, (item) => (
        !item.readAt && Number.isFinite(cutoff) && Date.parse(item.createdAt) <= cutoff
          ? { ...item, readAt: result.readAt }
          : item
      ));
      queryClient.setQueryData<NotificationUnreadCountResponse>(unreadCountKey, (current) => current
        ? { unreadCount: Math.max(0, normalizeUnreadCount(current.unreadCount) - result.updatedCount) }
        : current);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: lmsQueryKeys.notificationLists(scope) }),
        queryClient.invalidateQueries({ queryKey: unreadCountKey }),
      ]);
    },
  });

  const items = useMemo(() => {
    const unique = new Map<string, NotificationInboxItem>();
    for (const page of listQuery.data?.pages ?? []) {
      for (const item of page.items) {
        if (!unique.has(item._id)) unique.set(item._id, item);
      }
    }
    return [...unique.values()].filter((item) => !unreadOnly || !item.readAt);
  }, [listQuery.data?.pages, unreadOnly]);
  const unreadCount = normalizeUnreadCount(unreadQuery.data?.unreadCount);
  const mutationError = markRead.error ?? markAllRead.error;
  const markingId = markRead.isPending ? markRead.variables : null;

  const openCenter = () => {
    markRead.reset();
    markAllRead.reset();
    setOpen(true);
  };
  const markItemRead = (item: NotificationInboxItem) => {
    if (!item.readAt && !markRead.isPending) markRead.mutate(item._id);
  };
  const navigate = (item: NotificationInboxItem, path: string) => {
    if (!item.readAt && !markRead.isPending) markRead.mutate(item._id);
    setOpen(false);
    router.push(path);
  };

  return (
    <div className="notification-center">
      <button
        aria-controls="workspace-notification-drawer"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unreadCount
          ? `Mở trung tâm thông báo, ${unreadCount} chưa đọc`
          : "Mở trung tâm thông báo"}
        className="notification-trigger"
        onClick={openCenter}
        type="button"
      >
        <Badge count={unreadCount} overflowCount={99} size="small">
          <BellOutlined aria-hidden="true" />
        </Badge>
      </button>
      <span aria-live="polite" className="visually-hidden">
        {unreadCount ? `${unreadCount} thông báo chưa đọc` : "Không có thông báo chưa đọc"}
      </span>

      <Drawer
        className="notification-drawer"
        destroyOnHidden
        extra={(
          <Button
            disabled={!unreadCount || markAllRead.isPending}
            loading={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
            size="small"
            type="text"
          >
            Đánh dấu tất cả đã đọc
          </Button>
        )}
        id="workspace-notification-drawer"
        onClose={() => setOpen(false)}
        open={open}
        placement="right"
        size={420}
        title="Thông báo"
      >
        <div aria-label="Lọc thông báo" className="notification-filters" role="group">
          <button
            aria-pressed={!unreadOnly}
            onClick={() => setUnreadOnly(false)}
            type="button"
          >
            Tất cả
          </button>
          <button
            aria-pressed={unreadOnly}
            onClick={() => setUnreadOnly(true)}
            type="button"
          >
            Chưa đọc
          </button>
        </div>

        {mutationError ? (
          <Alert
            closable
            description={errorMessage(mutationError)}
            onClose={() => { markRead.reset(); markAllRead.reset(); }}
            showIcon
            title="Chưa cập nhật được trạng thái"
            type="error"
          />
        ) : null}

        {listQuery.isLoading ? (
          <div aria-live="polite" className="notification-loading">
            <Spin />
            <span>Đang tải thông báo...</span>
          </div>
        ) : listQuery.isError ? (
          <Alert
            action={(
              <Button
                icon={<ReloadOutlined aria-hidden="true" />}
                onClick={() => void listQuery.refetch()}
                size="small"
              >
                Thử lại
              </Button>
            )}
            description={errorMessage(listQuery.error)}
            showIcon
            title="Không thể tải thông báo"
            type="error"
          />
        ) : items.length ? (
          <div className="notification-list">
            {items.map((item) => (
              <NotificationItem
                item={item}
                key={item._id}
                markingRead={markingId === item._id}
                onMarkRead={markItemRead}
                onNavigate={navigate}
              />
            ))}
            {listQuery.hasNextPage ? (
              <Button
                block
                loading={listQuery.isFetchingNextPage}
                onClick={() => void listQuery.fetchNextPage()}
              >
                Tải thêm
              </Button>
            ) : null}
          </div>
        ) : (
          <Empty
            description={unreadOnly ? "Bạn đã đọc hết thông báo" : "Chưa có thông báo"}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Drawer>
    </div>
  );
}
