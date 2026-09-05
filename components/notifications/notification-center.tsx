"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { authMessages } from "@/lib/i18n/auth-messages";
import { describeFeedbackError } from "@/lib/feedback-errors";


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

export interface NotificationCenterProps {
  scope: NotificationViewerScope;
  token: string;
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
  const { t, formatDate } = useI18n(authMessages);
  const actionPath = item.action ? safeNotificationActionPath(item.action.path) : null;

  return (
    <article className={`notification-item${item.readAt ? " is-read" : " is-unread"}`}>
      <span aria-hidden="true" className="notification-item-dot" />
      <div className="notification-item-content">
        <div className="notification-item-heading">
          <h3>{item.title}</h3>
          <span className="visually-hidden">{item.readAt ? t("Đã đọc") : t("Chưa đọc")}</span>
          <time dateTime={item.occurredAt}>{Number.isNaN(new Date(item.occurredAt).getTime()) ? t("Thời gian không xác định") : formatDate(item.occurredAt, { dateStyle: "medium", timeStyle: "short" })}</time>
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
              {item.action?.label ? t(item.action.label) : t("Mở chi tiết")}
            </Button>
          ) : null}
          {!item.readAt ? (
            <Button
              aria-label={t("Đánh dấu “{title}” đã đọc", { title: item.title })}
              disabled={markingRead}
              icon={<CheckOutlined aria-hidden="true" />}
              loading={markingRead}
              onClick={() => onMarkRead(item)}
              size="small"
              type="text"
            >
              {t("Đã đọc")}</Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function NotificationCenter({ scope, token }: NotificationCenterProps) {
  const { t, locale, formatNumber } = useI18n(authMessages);
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
          ? t("Mở trung tâm thông báo, {count} chưa đọc", { count: formatNumber(unreadCount) })
          : t("Mở trung tâm thông báo")}
        className="notification-trigger"
        onClick={openCenter}
        type="button"
      >
        <Badge count={unreadCount} overflowCount={99} size="small">
          <BellOutlined aria-hidden="true" />
        </Badge>
      </button>
      <span aria-live="polite" className="visually-hidden">
        {unreadCount ? t("{count} thông báo chưa đọc", { count: formatNumber(unreadCount) }) : t("Không có thông báo chưa đọc")}
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
            {t("Đánh dấu tất cả đã đọc")}</Button>
        )}
        id="workspace-notification-drawer"
        onClose={() => setOpen(false)}
        open={open}
        placement="right"
        size={420}
        title={t("Thông báo")}
      >
        <div aria-label={t("Lọc thông báo")} className="notification-filters" role="group">
          <button
            aria-pressed={!unreadOnly}
            onClick={() => setUnreadOnly(false)}
            type="button"
          >
            {t("Tất cả")}</button>
          <button
            aria-pressed={unreadOnly}
            onClick={() => setUnreadOnly(true)}
            type="button"
          >
            {t("Chưa đọc")}</button>
        </div>

        {mutationError ? (
          <Alert
            closable
            description={describeFeedbackError(mutationError, locale, t("Chưa cập nhật được trạng thái")).message}
            onClose={() => { markRead.reset(); markAllRead.reset(); }}
            showIcon
            title={t("Chưa cập nhật được trạng thái")}
            type="error"
          />
        ) : null}

        {listQuery.isLoading ? (
          <div aria-live="polite" className="notification-loading">
            <Spin />
            <span>{t("Đang tải thông báo...")}</span>
          </div>
        ) : listQuery.isError ? (
          <Alert
            action={(
              <Button
                icon={<ReloadOutlined aria-hidden="true" />}
                onClick={() => void listQuery.refetch()}
                size="small"
              >
                {t("Thử lại")}</Button>
            )}
            description={describeFeedbackError(listQuery.error, locale, t("Không thể tải thông báo")).message}
            showIcon
            title={t("Không thể tải thông báo")}
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
                {t("Tải thêm")}</Button>
            ) : null}
          </div>
        ) : (
          <Empty
            description={unreadOnly ? t("Bạn đã đọc hết thông báo") : t("Chưa có thông báo")}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Drawer>
    </div>
  );
}
