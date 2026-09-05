"use client";
import { describeOperationsError } from "@/lib/i18n/operations-errors";
import { useI18n } from "@/components/i18n/i18n-provider";
import { operationsMessages } from "@/lib/i18n/operations-messages";
import { workspacePolishMessages } from "@/lib/i18n/workspace-polish-messages";
import { listPageSizes } from "@/lib/list-controls";
import { useMemo as useI18nMemo } from "react";

import { ReloadOutlined, RedoOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TablePaginationConfig } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import { ApiError } from "@/lib/api";
import {
  adminNotificationEventsApi,
  notificationRetryReasonCodes,
  notificationEventTypes,
  type AdminNotificationEvent,
  type AdminNotificationEventsQuery,
  type NotificationRetryReasonCode,
} from "@/lib/notification-operations-api";
import {
  getViewerScope,
  lmsQueryKeys,
  type ViewerScope,
} from "@/lib/query-keys";
import type { NotificationType } from "@/lib/types";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const MAX_ADMIN_NOTIFICATION_PAGES = 100;
const notificationMessages = { ...operationsMessages, ...workspacePolishMessages };

type ActionNotice = {
  description?: string;
  operationId?: string;
  title: string;
  type: "error" | "success" | "warning";
};

export default function AdminNotificationEventsPage() {
  const { t } = useOperationsCopy();
  const { captureAuthGeneration, organization, token, user } = useAuth();
  const scope = getViewerScope(user, organization);

  if (user?.role !== "SUPER_ADMIN" || !scope) {
    return (
      <Alert
        showIcon
        title={t("Chỉ quản trị viên nền tảng được vận hành sự kiện thông báo.")}
        type="warning"
      />
    );
  }

  return (
    <PlatformNotificationEventsPage
      key={`${user.sub}:${captureAuthGeneration()}`}
      scope={scope}
      token={token}
    />
  );
}

function PlatformNotificationEventsPage({
  scope,
  token,
}: {
  scope: ViewerScope;
  token: string;
}) {
  const {
    t,
    locale,
    typeLabels,
    pipelineLabels,
    retryReasonLabels,
    safeErrorMessage,
    formattedDate,
    createIdempotencyKey,
  } = useOperationsCopy();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState<AdminNotificationEventsQuery>({
    limit: 20,
    page: 1,
  });
  const [tenantDraft, setTenantDraft] = useState("");
  const [filterError, setFilterError] = useState("");
  const [selectedEvent, setSelectedEvent] =
    useState<AdminNotificationEvent | null>(null);
  const [reasonCode, setReasonCode] = useState<
    NotificationRetryReasonCode | ""
  >("");
  const [reasonError, setReasonError] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null);
  const retryInFlight = useRef(false);
  const retryController = useRef<AbortController | null>(null);
  const operationController = useRef<AbortController | null>(null);
  const retryKey = useRef<string | null>(null);
  const mounted = useRef(true);
  const [checkingOperation, setCheckingOperation] = useState(false);
  const eventsRoot = lmsQueryKeys.adminNotificationEventsRoot(scope);
  const eventsKey = lmsQueryKeys.adminNotificationEvents(scope, query);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      retryController.current?.abort();
      operationController.current?.abort();
    };
  }, []);

  const events = useQuery({
    enabled: Boolean(token),
    queryFn: ({ signal }) =>
      adminNotificationEventsApi.list({ signal, token }, query),
    queryKey: eventsKey,
    retry: false,
  });

  const applyTenantFilter = () => {
    const tenantId = tenantDraft.trim();
    if (tenantId && !OBJECT_ID.test(tenantId)) {
      setFilterError(t("Mã tổ chức phải gồm đúng 24 ký tự hex."));
      return;
    }
    setFilterError("");
    setQuery((current) => ({
      ...current,
      page: 1,
      tenantId: tenantId ? tenantId.toLowerCase() : undefined,
    }));
  };

  const updateType = (value: string | { target: { value: string } }) => {
    const requested = typeof value === "string" ? value : value.target.value;
    const type = notificationEventTypes.find(
      (candidate) => candidate === requested,
    );
    setQuery((current) => ({ ...current, page: 1, type }));
  };

  const updatePage = (page: number, pageSize: number) => {
    setQuery((current) => ({
      ...current,
      limit: pageSize,
      page:
        pageSize === current.limit
          ? Math.min(MAX_ADMIN_NOTIFICATION_PAGES, Math.max(1, page))
          : 1,
    }));
  };

  const openRetry = useCallback(
    (event: AdminNotificationEvent) => {
      if (retryInFlight.current || operationController.current) return;
      setSelectedEvent(event);
      setReasonCode("");
      setReasonError("");
      setActionNotice(null);
      retryKey.current = createIdempotencyKey();
    },
    [createIdempotencyKey],
  );

  const closeRetry = () => {
    if (retryInFlight.current || operationController.current) return;
    setSelectedEvent(null);
    setReasonCode("");
    setReasonError("");
    retryKey.current = null;
  };

  const checkRetryOperation = async (operationId: string) => {
    if (operationController.current) return;
    const controller = new AbortController();
    operationController.current = controller;
    setCheckingOperation(true);
    try {
      const operation = await adminNotificationEventsApi.getRetryOperation(
        { signal: controller.signal, token },
        operationId,
      );
      if (!mounted.current || controller.signal.aborted) return;
      if (operation.status === "SUCCEEDED") {
        setSelectedEvent(null);
        setReasonCode("");
        retryKey.current = null;
        setActionNotice({
          description: t(
            "Operation {value0} đã hoàn tất và sự kiện đã được đưa lại vào pipeline.",
            { value0: operation.operationId },
          ),
          title: t("Retry đã hoàn tất"),
          type: "success",
        });
        await queryClient
          .invalidateQueries({ queryKey: eventsRoot })
          .catch(() => undefined);
      } else if (operation.status === "FAILED") {
        setActionNotice({
          description: operation.failureCode
            ? t("Operation {value0} thất bại với mã {value1}.", {
                value0: operation.operationId,
                value1: operation.failureCode,
              })
            : t("Operation {value0} đã kết thúc nhưng không có mã lỗi.", {
                value0: operation.operationId,
              }),
          operationId: operation.operationId,
          title: t("Retry không thành công"),
          type: "error",
        });
      } else {
        setActionNotice({
          description: t(
            "Operation {value0} vẫn đang xử lý ở bước {value1}. Kiểm tra lại sau ít phút.",
            { value0: operation.operationId, value1: operation.phase },
          ),
          operationId: operation.operationId,
          title: t("Retry đang được xử lý"),
          type: "warning",
        });
      }
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return;
      setActionNotice({
        description: safeErrorMessage(
          error,
          t("Không thể kiểm tra trạng thái operation."),
        ),
        operationId,
        title: t("Không thể kiểm tra operation"),
        type: "error",
      });
    } finally {
      if (operationController.current === controller) {
        operationController.current = null;
        if (mounted.current) setCheckingOperation(false);
      }
    }
  };

  const submitRetry = async () => {
    const event = selectedEvent;
    if (!event || retryInFlight.current || operationController.current) return;
    if (!reasonCode) {
      setReasonError(t("Chọn một mã lý do retry."));
      return;
    }

    retryInFlight.current = true;
    const controller = new AbortController();
    retryController.current = controller;
    setReasonError("");
    setRetryingId(event._id);
    try {
      const operation = await adminNotificationEventsApi.retry(
        { signal: controller.signal, token },
        event._id,
        event.retryToken,
        reasonCode,
        retryKey.current ?? createIdempotencyKey(),
      );
      if (!mounted.current || controller.signal.aborted) return;
      if (operation.status !== "SUCCEEDED") {
        setActionNotice({
          description:
            operation.status === "FAILED"
              ? operation.failureCode
                ? t("Operation {value0} thất bại với mã {value1}.", {
                    value0: operation.operationId,
                    value1: operation.failureCode,
                  })
                : t("Operation {value0} đã thất bại.", {
                    value0: operation.operationId,
                  })
              : t("Operation {value0} vẫn đang xử lý ở bước {value1}.", {
                  value0: operation.operationId,
                  value1: operation.phase,
                }),
          operationId:
            operation.status === "PENDING" ? operation.operationId : undefined,
          title:
            operation.status === "FAILED"
              ? t("Retry không thành công")
              : t("Retry đang được xử lý"),
          type: operation.status === "FAILED" ? "error" : "warning",
        });
        return;
      }
      setSelectedEvent(null);
      setReasonCode("");
      setActionNotice({
        description: t(
          "Operation {value0} đã thành công. Danh sách đang được làm mới để phản ánh trạng thái mới nhất.",
          { value0: operation.operationId },
        ),
        title: t("Đã đưa sự kiện vào hàng đợi lại."),
        type: "success",
      });
      await queryClient
        .invalidateQueries({ queryKey: eventsRoot })
        .catch(() => undefined);
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return;
      const unknown =
        error instanceof ApiError &&
        (error.status === 0 || error.status === 503);
      setActionNotice({
        description:
          unknown && error instanceof ApiError && error.operationId
            ? t(
                "Kết quả chưa rõ. Kiểm tra operationId {value0} trước khi gửi lại.",
                { value0: error.operationId },
              )
            : safeErrorMessage(
                error,
                t("Không thể đưa sự kiện vào hàng đợi lại."),
              ),
        operationId:
          unknown && error instanceof ApiError ? error.operationId : undefined,
        title: unknown
          ? t("Cần kiểm tra trạng thái retry")
          : t("Retry sự kiện thất bại"),
        type: unknown ? "warning" : "error",
      });
    } finally {
      if (retryController.current === controller) {
        retryController.current = null;
        retryInFlight.current = false;
        if (mounted.current) setRetryingId(null);
      }
    }
  };

  const columns = useMemo<ColumnsType<AdminNotificationEvent>>(
    () => [
      {
        key: "event",
        render: (_, event) => (
          <div>
            <strong>{typeLabels[event.type]}</strong>
            <div className="table-muted">
              <Typography.Text code>{event.eventId}</Typography.Text>
            </div>
            <details className="table-metadata-disclosure">
              <summary>{t("Tổ chức …")}{event.tenantId.slice(-8)}</summary>
              <div><Typography.Text code>{event.tenantId}</Typography.Text></div>
              <div>{t("Nguồn:")} {event.sourceKind} · {event.sourceId}</div>
            </details>
          </div>
        ),
        title: t("Sự kiện"),
      },
      {
        key: "pipeline",
        render: (_, event) => (
          <div>
            <Tag color={event.pipeline === "DISPATCH" ? "blue" : "purple"}>
              {pipelineLabels[event.pipeline]}
            </Tag>
          </div>
        ),
        title: t("Luồng xử lý"),
      },
      {
        key: "failure",
        render: (_, event) => (
          <div>
            <strong>
              {event.failureCount} {t("lần lỗi")}
            </strong>
            <div className="table-muted">
              {event.lastErrorCode ?? t("Không có mã lỗi")}
            </div>
          </div>
        ),
        title: t("Lỗi gần nhất"),
      },
      {
        key: "time",
        render: (_, event) => (
          <div>
            <strong>{formattedDate(event.deadLetteredAt)}</strong>
            <div className="table-muted">
              {t("Xảy ra:")} {formattedDate(event.occurredAt)}
            </div>
          </div>
        ),
        responsive: ["md"],
        title: t("Thời điểm lỗi"),
      },
      {
        align: "right",
        key: "action",
        render: (_, event) => (
          <Button
            aria-label={t(
              "Retry sự kiện {value0} của tổ chức {value1} ({value2})",
              {
                value0: event.eventId,
                value1: event.tenantId,
                value2: pipelineLabels[event.pipeline],
              },
            )}
            disabled={retryingId !== null || checkingOperation}
            icon={<RedoOutlined />}
            loading={retryingId === event._id}
            onClick={() => openRetry(event)}
            type="link"
          >
            {t("Thử lại")}
          </Button>
        ),
        title: t("Thao tác"),
      },
    ],
    [checkingOperation, formattedDate, openRetry, pipelineLabels, retryingId, t, typeLabels],
  );

  const totalEvents = events.data?.total ?? 0;
  const maximumBrowsableEvents = query.limit * MAX_ADMIN_NOTIFICATION_PAGES;
  const pagination: TablePaginationConfig = {
    current: query.page,
    onChange: updatePage,
    pageSize: query.limit,
    disabled: events.isFetching,
    responsive: true,
    showLessItems: true,
    pageSizeOptions: listPageSizes(query.limit),
    showSizeChanger: { "aria-label": t("Số dòng mỗi trang"), showSearch: false },
    showTotal: (total, range) => t("{p0}–{p1} trên {p2} mục", { p0: range[0], p1: range[1], p2: total }),
    total: Math.min(totalEvents, maximumBrowsableEvents),
  };

  const operationAction = actionNotice?.operationId ? (
    <Button
      disabled={checkingOperation}
      loading={checkingOperation}
      onClick={() => void checkRetryOperation(actionNotice.operationId!)}
      size="small"
    >
      {t("Kiểm tra operation")}{" "}
    </Button>
  ) : undefined;

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div className="page-heading-copy">
          <h1>{t("Vận hành thông báo")}</h1>
          <p>
            {t(
              "Theo dõi lỗi gửi thông báo và thử gửi lại.",
            )}{" "}
          </p>
        </div>
        <Button
          aria-label={t("Tải lại sự kiện thông báo")}
          icon={<ReloadOutlined />}
          loading={events.isFetching}
          onClick={() => void events.refetch({ cancelRefetch: false })}
        >
          {t("Tải lại")}{" "}
        </Button>
      </div>

      {actionNotice && !selectedEvent ? (
        <Alert
          closable
          description={actionNotice.description && t(actionNotice.description)}
          action={operationAction}
          onClose={() => setActionNotice(null)}
          showIcon
          title={t(actionNotice.title)}
          type={actionNotice.type}
        />
      ) : null}
      {filterError ? (
        <Alert
          closable
          onClose={() => setFilterError("")}
          showIcon
          title={t(filterError)}
          type="error"
        />
      ) : null}
      {events.error ? (
        <Alert
          action={
            <Button
              loading={events.isFetching}
              onClick={() => void events.refetch({ cancelRefetch: false })}
              size="small"
            >
              {t("Thử lại")}{" "}
            </Button>
          }
          description={safeErrorMessage(
            events.error,
            t("Không tải được danh sách sự kiện thông báo."),
          )}
          showIcon
          title={t("Không tải được dead-letter")}
          type="error"
        />
      ) : null}
      {totalEvents > maximumBrowsableEvents ? (
        <Alert
          description={t(
            "API chỉ cho duyệt tối đa {value0} trang ({value1} sự kiện với kích thước trang hiện tại). Hãy lọc theo tổ chức hoặc loại sự kiện để xem đúng tập cần xử lý.",
            {
              value0: MAX_ADMIN_NOTIFICATION_PAGES,
              value1: maximumBrowsableEvents.toLocaleString(
                locale === "en" ? "en-US" : "vi-VN",
              ),
            },
          )}
          showIcon
          title={t("Có {value0} sự kiện phù hợp", {
            value0: totalEvents.toLocaleString(
              locale === "en" ? "en-US" : "vi-VN",
            ),
          })}
          type="warning"
        />
      ) : null}

      <Card className="surface-card">
        <div className="admin-filter-bar list-filter-bar" role="search" aria-label={t("Sự kiện thông báo")}>
          <Space.Compact>
            <Input
              allowClear
              aria-label={t("Lọc sự kiện theo mã tổ chức")}
              disabled={events.isFetching}
              onChange={(event) => {
                setTenantDraft(event.target.value);
                setFilterError("");
                if (!event.target.value.trim()) setQuery((current) => ({ ...current, page: 1, tenantId: undefined }));
              }}
              onPressEnter={applyTenantFilter}
              placeholder={t("Mã tổ chức")}
              value={tenantDraft}
            />
            <Button disabled={events.isFetching} onClick={applyTenantFilter}>
              {t("Áp dụng")}{" "}
            </Button>
          </Space.Compact>
          <Select
            aria-label={t("Lọc theo loại sự kiện thông báo")}
            disabled={events.isFetching}
            onChange={updateType}
            options={[
              { label: t("Tất cả loại sự kiện"), value: "" },
              ...notificationEventTypes.map((value) => ({
                label: typeLabels[value],
                value,
              })),
            ]}
            style={{ minWidth: 230 }}
            value={query.type ?? ""}
          />
          {(tenantDraft || query.tenantId || query.type) && <Button onClick={() => { setTenantDraft(""); setFilterError(""); setQuery((current) => ({ limit: current.limit, page: 1 })); }}>{t("Xóa bộ lọc")}</Button>}
        </div>

        {events.isLoading ? (
          <p aria-live="polite" role="status">
            {t("Đang tải metadata sự kiện thông báo...")}{" "}
          </p>
        ) : null}
        {!events.isLoading &&
        !events.error &&
        events.data?.items.length === 0 ? (
          <Empty
            description={t("Không có sự kiện dead-letter phù hợp bộ lọc.")}
          />
        ) : null}
        {events.data && !events.error ? (
          <Table
            className="data-table"
            columns={columns}
            dataSource={events.data.items}
            loading={events.isFetching}
            locale={{ emptyText: null }}
            pagination={pagination}
            rowKey={(event) => `${event.pipeline}:${event._id}`}
            scroll={{ x: 880 }}
          />
        ) : null}
      </Card>

      <Modal
        cancelText={t("Hủy")}
        cancelButtonProps={{ disabled: Boolean(retryingId) || checkingOperation }}
        closable={!retryingId && !checkingOperation}
        confirmLoading={Boolean(retryingId)}
        keyboard={!retryingId && !checkingOperation}
        mask={{ closable: !retryingId && !checkingOperation }}
        okButtonProps={{
          disabled: !reasonCode || Boolean(retryingId) || checkingOperation,
        }}
        okText={t("Đưa vào hàng đợi lại")}
        onCancel={closeRetry}
        onOk={() => void submitRetry()}
        open={Boolean(selectedEvent)}
        title={t("Retry sự kiện thông báo")}
      >
        {selectedEvent ? (
          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            <Alert
              description={
                <Space direction="vertical" size={0}>
                  <span>
                    {pipelineLabels[selectedEvent.pipeline]} ·{" "}
                    {typeLabels[selectedEvent.type]}
                  </span>
                  <span>
                    {t("Tổ chức:")}{" "}
                    <Typography.Text
                      code
                      copyable={{ text: selectedEvent.tenantId }}
                    >
                      {selectedEvent.tenantId}
                    </Typography.Text>
                  </span>
                  <span>
                    {t("Nguồn")} {selectedEvent.sourceKind}:{" "}
                    <Typography.Text
                      code
                      copyable={{ text: selectedEvent.sourceId }}
                    >
                      {selectedEvent.sourceId}
                    </Typography.Text>
                  </span>
                </Space>
              }
              showIcon
              title={t("Sự kiện {value0}", { value0: selectedEvent.eventId })}
              type="warning"
            />
            {actionNotice && actionNotice.type !== "success" ? (
              <Alert
                action={operationAction}
                description={
                  actionNotice.description && t(actionNotice.description)
                }
                showIcon
                title={t(actionNotice.title)}
                type={actionNotice.type}
              />
            ) : null}
            <label htmlFor="notification-retry-reason">
              <strong>{t("Mã lý do retry")}</strong>
            </label>
            <Select
              aria-describedby={
                reasonError ? "notification-retry-reason-error" : undefined
              }
              aria-invalid={Boolean(reasonError)}
              aria-label={t("Chọn mã lý do retry")}
              disabled={Boolean(retryingId) || checkingOperation}
              id="notification-retry-reason"
              onChange={(value) => {
                const requested =
                  typeof value === "string"
                    ? value
                    : (value as unknown as { target: { value: string } }).target
                        .value;
                setReasonCode(requested as NotificationRetryReasonCode);
                if (reasonError) setReasonError("");
              }}
              options={notificationRetryReasonCodes.map((value) => ({
                label: retryReasonLabels[value],
                value,
              }))}
              placeholder={t("Chọn lý do đã được chuẩn hóa")}
              value={reasonCode || undefined}
            />
            {reasonError ? (
              <Typography.Text
                id="notification-retry-reason-error"
                type="danger"
              >
                {t(reasonError)}
              </Typography.Text>
            ) : null}
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}

function useOperationsCopy() {
  const i18n = useI18n(notificationMessages);
  return useI18nMemo(() => {
    const { t, locale } = i18n;
    const dateTime = new Intl.DateTimeFormat(
      locale === "en" ? "en-US" : "vi-VN",
      {
        dateStyle: "short",
        timeStyle: "medium",
      },
    );

    const typeLabels: Record<NotificationType, string> = {
      ASSIGNMENT_PUBLISHED: t("Bài tập được xuất bản"),
      COURSE_ENROLLED: t("Ghi danh khóa học"),
      COURSE_WITHDRAWN: t("Rút khỏi khóa học"),
      SUBMISSION_GRADED: t("Bài nộp đã chấm"),
      SUBMISSION_RETURNED: t("Bài nộp được trả lại"),
    };

    const pipelineLabels: Record<AdminNotificationEvent["pipeline"], string> = {
      DISPATCH: t("Phân phối"),
      SOURCE_RELAY: t("Relay nguồn"),
    };

    const retryReasonLabels: Record<NotificationRetryReasonCode, string> = {
      CONFIGURATION_CORRECTED: t("Đã sửa cấu hình worker / kênh gửi"),
      DATA_RECONCILED: t("Đã đối soát và khôi phục dữ liệu"),
      DEPENDENCY_RECOVERED: t("Dependency đã hoạt động trở lại"),
      TRANSIENT_FAILURE_RESOLVED: t("Lỗi tạm thời đã được xử lý"),
    };

    function safeErrorMessage(error: unknown, fallback: string) {
      return error instanceof Error
        ? describeOperationsError(error, locale, fallback)
        : fallback;
    }

    function formattedDate(value: string | null) {
      return value ? dateTime.format(new Date(value)) : "—";
    }

    function createIdempotencyKey() {
      const candidate = globalThis.crypto?.randomUUID?.();
      if (
        candidate &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          candidate,
        )
      ) {
        return candidate;
      }
      if (typeof globalThis.crypto?.getRandomValues !== "function") {
        throw new Error(t("Trình duyệt không hỗ trợ tạo khóa retry an toàn"));
      }
      const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return {
      ...i18n,
      dateTime,
      typeLabels,
      pipelineLabels,
      retryReasonLabels,
      safeErrorMessage,
      formattedDate,
      createIdempotencyKey,
    };
  }, [i18n]);
}
