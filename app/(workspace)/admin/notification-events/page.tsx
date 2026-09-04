"use client";

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
import { useEffect, useMemo, useRef, useState } from "react";
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
const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "medium",
});

const typeLabels: Record<NotificationType, string> = {
  ASSIGNMENT_PUBLISHED: "Bài tập được xuất bản",
  COURSE_ENROLLED: "Ghi danh khóa học",
  COURSE_WITHDRAWN: "Rút khỏi khóa học",
  SUBMISSION_GRADED: "Bài nộp đã chấm",
  SUBMISSION_RETURNED: "Bài nộp được trả lại",
};

const pipelineLabels: Record<AdminNotificationEvent["pipeline"], string> = {
  DISPATCH: "Phân phối",
  SOURCE_RELAY: "Relay nguồn",
};

const retryReasonLabels: Record<NotificationRetryReasonCode, string> = {
  CONFIGURATION_CORRECTED: "Đã sửa cấu hình worker / kênh gửi",
  DATA_RECONCILED: "Đã đối soát và khôi phục dữ liệu",
  DEPENDENCY_RECOVERED: "Dependency đã hoạt động trở lại",
  TRANSIENT_FAILURE_RESOLVED: "Lỗi tạm thời đã được xử lý",
};

type ActionNotice = {
  description?: string;
  operationId?: string;
  title: string;
  type: "error" | "success" | "warning";
};

function safeErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formattedDate(value: string | null) {
  return value ? dateTime.format(new Date(value)) : "—";
}

export default function AdminNotificationEventsPage() {
  const { captureAuthGeneration, organization, token, user } = useAuth();
  const scope = getViewerScope(user, organization);

  if (user?.role !== "SUPER_ADMIN" || !scope) {
    return (
      <Alert
        showIcon
        title="Chỉ quản trị viên nền tảng được vận hành sự kiện thông báo."
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
      setFilterError("Mã tổ chức phải gồm đúng 24 ký tự hex.");
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

  const openRetry = (event: AdminNotificationEvent) => {
    if (retryInFlight.current) return;
    setSelectedEvent(event);
    setReasonCode("");
    setReasonError("");
    setActionNotice(null);
    retryKey.current = createIdempotencyKey();
  };

  const closeRetry = () => {
    if (retryInFlight.current || checkingOperation) return;
    setSelectedEvent(null);
    setReasonCode("");
    setReasonError("");
    retryKey.current = null;
  };

  const checkRetryOperation = async (operationId: string) => {
    if (checkingOperation) return;
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
          description: `Operation ${operation.operationId} đã hoàn tất và sự kiện đã được đưa lại vào pipeline.`,
          title: "Retry đã hoàn tất",
          type: "success",
        });
        await queryClient
          .invalidateQueries({ queryKey: eventsRoot })
          .catch(() => undefined);
      } else if (operation.status === "FAILED") {
        setActionNotice({
          description: operation.failureCode
            ? `Operation ${operation.operationId} thất bại với mã ${operation.failureCode}.`
            : `Operation ${operation.operationId} đã kết thúc nhưng không có mã lỗi.`,
          operationId: operation.operationId,
          title: "Retry không thành công",
          type: "error",
        });
      } else {
        setActionNotice({
          description: `Operation ${operation.operationId} vẫn đang xử lý ở bước ${operation.phase}. Kiểm tra lại sau ít phút.`,
          operationId: operation.operationId,
          title: "Retry đang được xử lý",
          type: "warning",
        });
      }
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return;
      setActionNotice({
        description: safeErrorMessage(
          error,
          "Không thể kiểm tra trạng thái operation.",
        ),
        operationId,
        title: "Không thể kiểm tra operation",
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
    if (!event || retryInFlight.current) return;
    if (!reasonCode) {
      setReasonError("Chọn một mã lý do retry.");
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
                ? `Operation ${operation.operationId} thất bại với mã ${operation.failureCode}.`
                : `Operation ${operation.operationId} đã thất bại.`
              : `Operation ${operation.operationId} vẫn đang xử lý ở bước ${operation.phase}.`,
          operationId:
            operation.status === "PENDING" ? operation.operationId : undefined,
          title:
            operation.status === "FAILED"
              ? "Retry không thành công"
              : "Retry đang được xử lý",
          type: operation.status === "FAILED" ? "error" : "warning",
        });
        return;
      }
      setSelectedEvent(null);
      setReasonCode("");
      setActionNotice({
        description: `Operation ${operation.operationId} đã thành công. Danh sách đang được làm mới để phản ánh trạng thái mới nhất.`,
        title: "Đã đưa sự kiện vào hàng đợi lại.",
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
            ? `Kết quả chưa rõ. Kiểm tra operationId ${error.operationId} trước khi gửi lại.`
            : safeErrorMessage(
                error,
                "Không thể đưa sự kiện vào hàng đợi lại.",
              ),
        operationId:
          unknown && error instanceof ApiError ? error.operationId : undefined,
        title: unknown
          ? "Cần kiểm tra trạng thái retry"
          : "Retry sự kiện thất bại",
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
            <div className="table-muted">
              Tổ chức …{event.tenantId.slice(-8)}
            </div>
          </div>
        ),
        title: "Sự kiện",
      },
      {
        key: "pipeline",
        render: (_, event) => (
          <div>
            <Tag color={event.pipeline === "DISPATCH" ? "blue" : "purple"}>
              {pipelineLabels[event.pipeline]}
            </Tag>
            <div className="table-muted">{event.sourceKind}</div>
          </div>
        ),
        title: "Pipeline",
      },
      {
        key: "tenant",
        render: (_, event) => (
          <div>
            <Typography.Text code>{event.tenantId}</Typography.Text>
            <div className="table-muted">Nguồn: {event.sourceId}</div>
          </div>
        ),
        responsive: ["lg"],
        title: "Tổ chức / nguồn",
      },
      {
        key: "failure",
        render: (_, event) => (
          <div>
            <strong>{event.failureCount} lần lỗi</strong>
            <div className="table-muted">
              {event.lastErrorCode ?? "Không có mã lỗi"}
            </div>
          </div>
        ),
        title: "Lỗi gần nhất",
      },
      {
        key: "time",
        render: (_, event) => (
          <div>
            <strong>{formattedDate(event.deadLetteredAt)}</strong>
            <div className="table-muted">
              Xảy ra: {formattedDate(event.occurredAt)}
            </div>
          </div>
        ),
        responsive: ["md"],
        title: "Dead-letter lúc",
      },
      {
        align: "right",
        key: "action",
        render: (_, event) => (
          <Button
            aria-label={`Retry sự kiện ${event.eventId} của tổ chức ${event.tenantId} (${pipelineLabels[event.pipeline]})`}
            disabled={retryingId !== null}
            icon={<RedoOutlined />}
            loading={retryingId === event._id}
            onClick={() => openRetry(event)}
            type="link"
          >
            Retry
          </Button>
        ),
        title: "Thao tác",
      },
    ],
    [retryingId],
  );

  const totalEvents = events.data?.total ?? 0;
  const maximumBrowsableEvents = query.limit * MAX_ADMIN_NOTIFICATION_PAGES;
  const pagination: TablePaginationConfig = {
    current: query.page,
    onChange: updatePage,
    pageSize: query.limit,
    showSizeChanger: true,
    total: Math.min(totalEvents, maximumBrowsableEvents),
  };

  const operationAction = actionNotice?.operationId ? (
    <Button
      disabled={checkingOperation}
      loading={checkingOperation}
      onClick={() => void checkRetryOperation(actionNotice.operationId!)}
      size="small"
    >
      Kiểm tra operation
    </Button>
  ) : undefined;

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div className="page-heading-copy">
          <h1>Vận hành thông báo</h1>
          <p>
            Theo dõi metadata dead-letter và đưa sự kiện lỗi trở lại đúng
            pipeline mà không truy cập nội dung thông báo.
          </p>
        </div>
        <Button
          aria-label="Tải lại sự kiện thông báo"
          icon={<ReloadOutlined />}
          loading={events.isFetching}
          onClick={() => void events.refetch()}
        >
          Tải lại
        </Button>
      </div>

      {actionNotice && !selectedEvent ? (
        <Alert
          closable
          description={actionNotice.description}
          action={operationAction}
          onClose={() => setActionNotice(null)}
          showIcon
          title={actionNotice.title}
          type={actionNotice.type}
        />
      ) : null}
      {filterError ? (
        <Alert
          closable
          onClose={() => setFilterError("")}
          showIcon
          title={filterError}
          type="error"
        />
      ) : null}
      {events.error ? (
        <Alert
          action={
            <Button onClick={() => void events.refetch()} size="small">
              Thử lại
            </Button>
          }
          description={safeErrorMessage(
            events.error,
            "Không tải được danh sách sự kiện thông báo.",
          )}
          showIcon
          title="Không tải được dead-letter"
          type="error"
        />
      ) : null}
      {totalEvents > maximumBrowsableEvents ? (
        <Alert
          description={`API chỉ cho duyệt tối đa ${MAX_ADMIN_NOTIFICATION_PAGES} trang (${maximumBrowsableEvents.toLocaleString("vi-VN")} sự kiện với kích thước trang hiện tại). Hãy lọc theo tổ chức hoặc loại sự kiện để xem đúng tập cần xử lý.`}
          showIcon
          title={`Có ${totalEvents.toLocaleString("vi-VN")} sự kiện phù hợp`}
          type="warning"
        />
      ) : null}

      <Card className="surface-card">
        <div className="admin-filter-bar">
          <Space.Compact>
            <Input
              aria-label="Lọc sự kiện theo mã tổ chức"
              disabled={events.isFetching}
              onChange={(event) => setTenantDraft(event.target.value)}
              onPressEnter={applyTenantFilter}
              placeholder="ObjectId tổ chức"
              value={tenantDraft}
            />
            <Button disabled={events.isFetching} onClick={applyTenantFilter}>
              Áp dụng
            </Button>
          </Space.Compact>
          <Select
            aria-label="Lọc theo loại sự kiện thông báo"
            disabled={events.isFetching}
            onChange={updateType}
            options={[
              { label: "Tất cả loại sự kiện", value: "" },
              ...notificationEventTypes.map((value) => ({
                label: typeLabels[value],
                value,
              })),
            ]}
            style={{ minWidth: 230 }}
            value={query.type ?? ""}
          />
          <Tag color="red">DEAD_LETTER</Tag>
        </div>

        {events.isLoading ? (
          <p aria-live="polite" role="status">
            Đang tải metadata sự kiện thông báo...
          </p>
        ) : null}
        {!events.isLoading &&
        !events.error &&
        events.data?.items.length === 0 ? (
          <Empty description="Không có sự kiện dead-letter phù hợp bộ lọc." />
        ) : null}
        {events.data && !events.error ? (
          <Table
            columns={columns}
            dataSource={events.data.items}
            loading={events.isFetching}
            locale={{ emptyText: null }}
            pagination={pagination}
            rowKey={(event) => `${event.pipeline}:${event._id}`}
            scroll={{ x: 1120 }}
          />
        ) : null}
      </Card>

      <Modal
        cancelText="Hủy"
        closable={!retryingId && !checkingOperation}
        confirmLoading={Boolean(retryingId)}
        maskClosable={!retryingId && !checkingOperation}
        okButtonProps={{
          disabled: !reasonCode || Boolean(retryingId) || checkingOperation,
        }}
        okText="Đưa vào hàng đợi lại"
        onCancel={closeRetry}
        onOk={() => void submitRetry()}
        open={Boolean(selectedEvent)}
        title="Retry sự kiện thông báo"
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
                    Tổ chức:{" "}
                    <Typography.Text
                      code
                      copyable={{ text: selectedEvent.tenantId }}
                    >
                      {selectedEvent.tenantId}
                    </Typography.Text>
                  </span>
                  <span>
                    Nguồn {selectedEvent.sourceKind}:{" "}
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
              title={`Sự kiện ${selectedEvent.eventId}`}
              type="warning"
            />
            {actionNotice && actionNotice.type !== "success" ? (
              <Alert
                action={operationAction}
                description={actionNotice.description}
                showIcon
                title={actionNotice.title}
                type={actionNotice.type}
              />
            ) : null}
            <label htmlFor="notification-retry-reason">
              <strong>Mã lý do retry</strong>
            </label>
            <Select
              aria-describedby={
                reasonError ? "notification-retry-reason-error" : undefined
              }
              aria-invalid={Boolean(reasonError)}
              aria-label="Chọn mã lý do retry"
              disabled={Boolean(retryingId)}
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
              placeholder="Chọn lý do đã được chuẩn hóa"
              value={reasonCode || undefined}
            />
            {reasonError ? (
              <Typography.Text
                id="notification-retry-reason-error"
                type="danger"
              >
                {reasonError}
              </Typography.Text>
            ) : null}
          </Space>
        ) : null}
      </Modal>
    </div>
  );
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
    throw new Error("Trình duyệt không hỗ trợ tạo khóa retry an toàn");
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
