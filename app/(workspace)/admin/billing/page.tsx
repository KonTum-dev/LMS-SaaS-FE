"use client";

import {
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import { billingApi } from "@/lib/api";
import {
  buildBillingPlanPayload,
  type BillingPlanFormValues,
} from "@/lib/billing-plan";
import {
  formatEntitlementLimit,
  getSubscriptionAccessPresentation,
  includeLmsModulePrerequisites,
  lmsModuleLabels,
  lmsModuleOptions,
} from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import type {
  AdminOrdersQuery,
  AdminSubscriptionsQuery,
  BillingAuditEntry,
  BillingPlan,
  LmsModule,
  PaymentEventTimeline,
  PaymentOrder,
  PaymentOrderStatus,
  PaymentOrderType,
  PlanEntitlements,
  Subscription,
} from "@/lib/types";
import { getBillingStatusPresentation } from "../../billing/billing-state";

const money = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});
const date = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function tenantView(
  value: PaymentOrder["tenantId"] | Subscription["tenantId"],
) {
  return typeof value === "string"
    ? { id: value, name: null, slug: null }
    : { id: value._id, name: value.name, slug: value.slug };
}

function formatDate(value: string | null | undefined): string {
  return value ? date.format(new Date(value)) : "—";
}

function formatDuration(value: number | null | undefined): string {
  if (value == null) return "—";
  const totalMinutes = Math.max(0, Math.round(value / 60_000));
  if (totalMinutes < 1) return "Dưới 1 phút";
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  return [
    days ? `${days} ngày` : "",
    hours ? `${hours} giờ` : "",
    !days && minutes ? `${minutes} phút` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function EntitlementDetails({
  entitlements,
}: {
  entitlements: PlanEntitlements;
}) {
  return (
    <Space orientation="vertical" size={4}>
      <Space size={[4, 4]} wrap>
        {entitlements.modules.map((module) => (
          <Tag key={module}>{lmsModuleLabels[module]}</Tag>
        ))}
        {!entitlements.modules.length && <Tag>Không có module</Tag>}
      </Space>
      <span className="table-muted">
        {formatEntitlementLimit(entitlements.maxUsers, "users")}
      </span>
      <span className="table-muted">
        {formatEntitlementLimit(entitlements.maxCourses, "courses")}
      </span>
      <span className="table-muted">
        {formatEntitlementLimit(entitlements.maxBranches, "branches")}
      </span>
      <span className="table-muted">
        {formatEntitlementLimit(
          entitlements.maxActiveLearners,
          "activeLearners",
        )}
      </span>
    </Space>
  );
}

const statusOptions: Array<{ label: string; value: PaymentOrderStatus }> = [
  "PENDING",
  "PAID",
  "CANCELED",
  "EXPIRED",
  "REVIEW_REQUIRED",
  "REFUND_REQUIRED",
].map((value) => ({
  label: getBillingStatusPresentation(value as PaymentOrderStatus).label,
  value: value as PaymentOrderStatus,
}));
const typeOptions: Array<{ label: string; value: PaymentOrderType }> = [
  { label: "Mua mới", value: "NEW" },
  { label: "Gia hạn", value: "RENEWAL" },
  { label: "Nâng gói", value: "UPGRADE" },
];
const orderTypeLabels: Record<PaymentOrderType, string> = Object.fromEntries(
  typeOptions.map(({ label, value }) => [value, label]),
) as Record<PaymentOrderType, string>;
const eventStatusLabels: Record<PaymentEventTimeline["status"], string> = {
  PROCESSED: "Đã xử lý",
  RECEIVED: "Đã tiếp nhận",
};
const auditActionLabels: Record<BillingAuditEntry["action"], string> = {
  MARK_REFUND_REQUIRED: "Đánh dấu cần hoàn tiền",
  RECONCILE: "Áp dụng lại giao dịch",
};

function billingCycleLabel(value: Subscription["billingCycle"] | null): string {
  if (!value) return "—";
  return value === "MONTHLY" ? "Theo tháng" : "Theo năm";
}

function formulaLabel(value: PaymentOrder["planSnapshot"]["formula"]): string {
  return value === "FULL"
    ? "Tính trọn kỳ"
    : "Tính phần chênh lệch khi nâng gói";
}

function adminOrderActionSuccessMessage(status: PaymentOrderStatus): string {
  if (status === "PAID") return "Đã áp dụng giao dịch và cập nhật thuê bao";
  return `Đã cập nhật đơn thanh toán sang trạng thái “${getBillingStatusPresentation(status).label}”`;
}

export default function AdminBillingPage() {
  const { message, modal } = App.useApp();
  const { organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<BillingPlanFormValues>();
  const [editing, setEditing] = useState<BillingPlan | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderQuery, setOrderQuery] = useState<AdminOrdersQuery>({
    limit: 10,
    page: 1,
  });
  const [subscriptionQuery, setSubscriptionQuery] =
    useState<AdminSubscriptionsQuery>({ limit: 10, page: 1 });
  const scope = useMemo(
    () => getViewerScope(user, organization),
    [organization, user],
  );
  const adminKey = scope
    ? lmsQueryKeys.adminBilling(scope)
    : (["lms", "signed-out", "admin-billing"] as const);
  const enabled = Boolean(token && scope && user?.role === "SUPER_ADMIN");

  const plans = useQuery({
    enabled,
    queryFn: () => billingApi.adminListPlans({ token }),
    queryKey: scope
      ? lmsQueryKeys.adminBillingPlans(scope)
      : [...adminKey, "plans"],
  });
  const subscriptions = useQuery({
    enabled,
    queryFn: () =>
      billingApi.adminListSubscriptions({ token }, subscriptionQuery),
    queryKey: scope
      ? lmsQueryKeys.adminSubscriptions(scope, subscriptionQuery)
      : [...adminKey, "subscriptions", subscriptionQuery],
  });
  const orders = useQuery({
    enabled,
    queryFn: () => billingApi.adminListOrders({ token }, orderQuery),
    queryKey: scope
      ? lmsQueryKeys.adminOrders(scope, orderQuery)
      : [...adminKey, "orders", orderQuery],
  });
  const orderDetail = useQuery({
    enabled: Boolean(enabled && selectedOrderId),
    queryFn: () => billingApi.adminGetOrder({ token }, selectedOrderId!),
    queryKey:
      scope && selectedOrderId
        ? lmsQueryKeys.adminOrder(scope, selectedOrderId)
        : [...adminKey, "orders", "detail", selectedOrderId],
  });
  const planNames = useMemo(
    () => new Map((plans.data ?? []).map((plan) => [plan.code, plan.name])),
    [plans.data],
  );

  const savePlan = useMutation({
    mutationFn: async (values: BillingPlanFormValues) => {
      const input = buildBillingPlanPayload(values);
      return editing
        ? billingApi.adminUpdatePlan({ token }, editing._id, input)
        : billingApi.adminCreatePlan({ token }, input);
    },
    onError: (error) =>
      message.error(
        error instanceof Error ? error.message : "Không thể lưu gói thuê bao",
      ),
    onSuccess: async () => {
      message.success(
        editing ? "Đã cập nhật gói thuê bao" : "Đã tạo gói thuê bao",
      );
      setPlanModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: adminKey });
    },
  });
  const orderAction = useMutation({
    mutationFn: (input: {
      action: "reconcile" | "refund";
      id: string;
      reason: string;
    }) =>
      input.action === "reconcile"
        ? billingApi.adminReconcileOrder({ token }, input.id, input.reason)
        : billingApi.adminMarkRefundRequired({ token }, input.id, input.reason),
    onError: (error) =>
      message.error(
        error instanceof Error
          ? error.message
          : "Không thể xử lý đơn thanh toán",
      ),
    onSuccess: async (detail) => {
      message.success(adminOrderActionSuccessMessage(detail.order.status));
      if (scope)
        queryClient.setQueryData(
          lmsQueryKeys.adminOrder(scope, detail.order._id),
          detail,
        );
      await queryClient.invalidateQueries({ queryKey: adminKey });
    },
  });

  const showCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      active: true,
      entitlements: {
        maxActiveLearners: null,
        maxBranches: null,
        maxCourses: null,
        maxUsers: null,
        modules: lmsModuleOptions.map((item) => item.value),
      },
      tierLevel: 1,
    });
    setPlanModalOpen(true);
  };
  const showEdit = (plan: BillingPlan) => {
    setEditing(plan);
    form.setFieldsValue({
      active: plan.active,
      code: plan.code,
      description: plan.description,
      entitlements: plan.entitlements,
      featuresText: plan.features.join("\n"),
      monthlyPriceVnd: plan.monthlyPriceVnd,
      name: plan.name,
      tierLevel: plan.tierLevel,
      yearlyPriceVnd: plan.yearlyPriceVnd,
    });
    setPlanModalOpen(true);
  };
  const requestAction = (action: "reconcile" | "refund") => {
    const id = selectedOrderId;
    if (!id) return;
    let reason = "";
    modal.confirm({
      cancelText: "Hủy",
      content: (
        <Input.TextArea
          autoSize={{ maxRows: 5, minRows: 3 }}
          onChange={(event) => {
            reason = event.target.value.trim();
          }}
          placeholder="Lý do xử lý (tối thiểu 3 ký tự)"
        />
      ),
      okButtonProps: { danger: action === "refund" },
      okText:
        action === "reconcile" ? "Thử áp dụng lại" : "Đánh dấu cần hoàn tiền",
      onOk: async () => {
        if (reason.length < 3)
          throw new Error("Vui lòng nhập lý do tối thiểu 3 ký tự");
        await orderAction.mutateAsync({ action, id, reason });
      },
      title:
        action === "reconcile"
          ? "Thử áp dụng lại giao dịch đã xác minh?"
          : "Đánh dấu giao dịch cần hoàn tiền?",
    });
  };

  const planColumns: ColumnsType<BillingPlan> = [
    {
      key: "plan",
      render: (_, plan) => (
        <div>
          <strong>{plan.name}</strong>
          <div className="table-muted">
            {plan.code} · Mức {plan.tierLevel}
          </div>
        </div>
      ),
      title: "Gói",
    },
    {
      dataIndex: "monthlyPriceVnd",
      key: "month",
      render: (value: number) => money.format(value),
      title: "Giá tháng",
    },
    {
      dataIndex: "yearlyPriceVnd",
      key: "year",
      render: (value: number) => money.format(value),
      responsive: ["md"],
      title: "Giá năm",
    },
    {
      key: "entitlements",
      render: (_, plan) => (
        <EntitlementDetails entitlements={plan.entitlements} />
      ),
      responsive: ["lg"],
      title: "Quyền lợi hệ thống",
    },
    {
      dataIndex: "active",
      key: "active",
      render: (value: boolean) => (
        <Tag color={value ? "green" : "default"}>
          {value ? "Đang bán" : "Đã ẩn"}
        </Tag>
      ),
      title: "Trạng thái",
    },
    {
      align: "right",
      key: "action",
      render: (_, plan) => (
        <Button
          aria-label={`Sửa gói ${plan.name}`}
          onClick={() => showEdit(plan)}
          type="link"
        >
          Sửa
        </Button>
      ),
      title: "Thao tác",
    },
  ];
  const subscriptionColumns: ColumnsType<Subscription> = [
    {
      key: "tenant",
      render: (_, subscription) => {
        const tenant = tenantView(subscription.tenantId);
        return tenant.name ? (
          <div>
            <strong>{tenant.name}</strong>
            <div className="table-muted">{tenant.slug || tenant.id}</div>
          </div>
        ) : (
          <Typography.Text copyable>{tenant.id}</Typography.Text>
        );
      },
      title: "Tổ chức",
    },
    {
      key: "plan",
      render: (_, item) => (
        <div>
          <strong>{planNames.get(item.planCode) ?? item.planCode}</strong>
          <div className="table-muted">
            {money.format(item.currentPriceVnd)}
          </div>
        </div>
      ),
      title: "Gói",
    },
    {
      dataIndex: "billingCycle",
      key: "cycle",
      render: (value: Subscription["billingCycle"]) => billingCycleLabel(value),
      title: "Chu kỳ",
    },
    {
      dataIndex: "endAt",
      key: "end",
      render: (value: string) => date.format(new Date(value)),
      title: "Hết hạn",
    },
    {
      dataIndex: "scheduledPlanCode",
      key: "scheduled",
      render: (value: string | null) =>
        value ? (planNames.get(value) ?? value) : "—",
      title: "Hạ gói kế tiếp",
    },
    {
      key: "entitlements",
      render: (_, item) => (
        <EntitlementDetails entitlements={item.entitlements} />
      ),
      responsive: ["xl"],
      title: "Quyền theo thuê bao",
    },
    {
      key: "access",
      render: (_, item) => {
        const access = getSubscriptionAccessPresentation(
          item.effectiveAccess.state,
        );
        const isTrial = Boolean(item.isTrial || item.effectiveAccess.trial);
        const trialEnd = isTrial
          ? (item.trialEndsAt ??
            item.effectiveAccess.trialEndsAt ??
            item.endAt)
          : null;
        return (
          <div>
            <Space size={[4, 4]} wrap>
              <Tag color={access.color}>{access.label}</Tag>
              {isTrial && <Tag color="cyan">Dùng thử tự động</Tag>}
            </Space>
            {trialEnd && (
              <div className="table-muted">
                Kết thúc {formatDate(trialEnd)}
              </div>
            )}
            {item.effectiveAccess.graceEndsAt && (
              <div className="table-muted">
                Đến {formatDate(item.effectiveAccess.graceEndsAt)}
              </div>
            )}
          </div>
        );
      },
      title: "Quyền truy cập",
    },
  ];
  const orderColumns: ColumnsType<PaymentOrder> = [
    {
      dataIndex: "invoiceNumber",
      key: "invoice",
      render: (value: string) => (
        <Typography.Text copyable>{value}</Typography.Text>
      ),
      title: "Mã hóa đơn",
    },
    {
      key: "tenant",
      render: (_, order) => {
        const tenant = tenantView(order.tenantId);
        return tenant.name ? (
          <div>
            <strong>{tenant.name}</strong>
            <div className="table-muted">{tenant.slug || tenant.id}</div>
          </div>
        ) : (
          <Typography.Text copyable>{tenant.id}</Typography.Text>
        );
      },
      title: "Tổ chức",
    },
    {
      key: "plan",
      render: (_, order) => (
        <div>
          <strong>{order.planSnapshot.name}</strong>
          <div className="table-muted">
            {orderTypeLabels[order.type]} ·{" "}
            {billingCycleLabel(order.planSnapshot.billingCycle)}
          </div>
        </div>
      ),
      title: "Gói / loại",
    },
    {
      dataIndex: "amountVnd",
      key: "amount",
      render: (value: number) => money.format(value),
      title: "Số tiền",
    },
    {
      dataIndex: "status",
      key: "status",
      render: (value: PaymentOrderStatus) => {
        const item = getBillingStatusPresentation(value);
        return <Tag color={item.color}>{item.label}</Tag>;
      },
      title: "Trạng thái",
    },
    {
      dataIndex: "transactionReference",
      key: "transaction",
      render: (value: string | null) => value ?? "—",
      title: "Giao dịch",
    },
    {
      align: "right",
      key: "action",
      render: (_, order) => (
        <Button
          aria-label={`Xem chi tiết đơn ${order.invoiceNumber}`}
          icon={<EyeOutlined />}
          onClick={() => setSelectedOrderId(order._id)}
          type="link"
        >
          Chi tiết
        </Button>
      ),
      title: "Thao tác",
    },
  ];

  if (user?.role !== "SUPER_ADMIN")
    return (
      <Alert
        showIcon
        title="Bạn không có quyền quản lý thanh toán của nền tảng."
        type="warning"
      />
    );
  const error = plans.error ?? subscriptions.error ?? orders.error;
  const pagination = (
    page: number,
    limit: number,
    total = 0,
  ): TablePaginationConfig => ({
    current: page,
    pageSize: limit,
    showSizeChanger: true,
    total,
  });
  const detail = orderDetail.data;

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <h1>Quản trị thuê bao</h1>
          <p>
            Quản lý các gói dịch vụ, thuê bao của tổ chức và những giao dịch cần
            xử lý.
          </p>
        </div>
        <Button
          aria-label="Thêm gói thuê bao"
          icon={<PlusOutlined />}
          onClick={showCreate}
          type="primary"
        >
          Thêm gói
        </Button>
      </div>
      {error && (
        <Alert
          className="billing-notice"
          showIcon
          title={
            error instanceof Error
              ? error.message
              : "Không tải được dữ liệu thanh toán"
          }
          type="error"
        />
      )}
      <Card className="surface-card">
        <Tabs
          items={[
            {
              children: (
                <Table
                  columns={planColumns}
                  dataSource={plans.data ?? []}
                  loading={plans.isLoading}
                  pagination={{ pageSize: 8 }}
                  rowKey="_id"
                  scroll={{ x: 1060 }}
                />
              ),
              key: "plans",
              label: "Gói thuê bao",
            },
            {
              children: (
                <>
                  <div className="admin-filter-bar">
                    <Input.Search
                      allowClear
                      aria-label="Tìm theo mã tổ chức"
                      onSearch={(tenantId) =>
                        setSubscriptionQuery((old) => ({
                          ...old,
                          page: 1,
                          tenantId: tenantId.trim() || undefined,
                        }))
                      }
                      placeholder="Mã tổ chức"
                      style={{ width: 240 }}
                    />
                    <Select
                      allowClear
                      aria-label="Lọc thuê bao theo trạng thái"
                      onChange={(status) =>
                        setSubscriptionQuery((old) => ({
                          ...old,
                          page: 1,
                          status,
                        }))
                      }
                      options={[
                        { label: "Hiệu lực", value: "ACTIVE" },
                        { label: "Hết hạn", value: "EXPIRED" },
                      ]}
                      placeholder="Trạng thái"
                      style={{ width: 160 }}
                    />
                    <Select
                      allowClear
                      aria-label="Lọc thuê bao theo chu kỳ"
                      onChange={(billingCycle) =>
                        setSubscriptionQuery((old) => ({
                          ...old,
                          billingCycle,
                          page: 1,
                        }))
                      }
                      options={[
                        { label: "Theo tháng", value: "MONTHLY" },
                        { label: "Theo năm", value: "YEARLY" },
                      ]}
                      placeholder="Chu kỳ"
                      style={{ width: 140 }}
                    />
                  </div>
                  <Table
                    columns={subscriptionColumns}
                    dataSource={subscriptions.data?.items ?? []}
                    loading={subscriptions.isLoading}
                    onChange={(next) =>
                      setSubscriptionQuery((old) => ({
                        ...old,
                        limit: next.pageSize ?? old.limit,
                        page: next.current ?? 1,
                      }))
                    }
                    pagination={pagination(
                      subscriptionQuery.page,
                      subscriptionQuery.limit,
                      subscriptions.data?.total,
                    )}
                    rowKey="_id"
                    scroll={{ x: 1260 }}
                  />
                </>
              ),
              key: "subscriptions",
              label: "Thuê bao tổ chức",
            },
            {
              children: (
                <>
                  <div className="admin-filter-bar">
                    <Input.Search
                      allowClear
                      aria-label="Tìm theo mã hóa đơn"
                      onSearch={(search) =>
                        setOrderQuery((old) => ({
                          ...old,
                          page: 1,
                          search: search.trim() || undefined,
                        }))
                      }
                      placeholder="Tìm mã hóa đơn"
                      style={{ width: 220 }}
                    />
                    <Input.Search
                      allowClear
                      aria-label="Tìm đơn theo mã tổ chức"
                      onSearch={(tenantId) =>
                        setOrderQuery((old) => ({
                          ...old,
                          page: 1,
                          tenantId: tenantId.trim() || undefined,
                        }))
                      }
                      placeholder="Mã tổ chức"
                      style={{ width: 220 }}
                    />
                    <Select
                      allowClear
                      aria-label="Lọc đơn theo trạng thái"
                      onChange={(status) =>
                        setOrderQuery((old) => ({ ...old, page: 1, status }))
                      }
                      options={statusOptions}
                      placeholder="Trạng thái"
                      style={{ width: 180 }}
                    />
                    <Select
                      allowClear
                      aria-label="Lọc theo loại đơn"
                      onChange={(type) =>
                        setOrderQuery((old) => ({ ...old, page: 1, type }))
                      }
                      options={typeOptions}
                      placeholder="Loại đơn"
                      style={{ width: 150 }}
                    />
                    <Button
                      aria-label="Tải lại danh sách đơn thanh toán"
                      icon={<ReloadOutlined />}
                      onClick={() => void orders.refetch()}
                    >
                      Tải lại
                    </Button>
                  </div>
                  <Table
                    columns={orderColumns}
                    dataSource={orders.data?.items ?? []}
                    loading={orders.isLoading}
                    onChange={(next) =>
                      setOrderQuery((old) => ({
                        ...old,
                        limit: next.pageSize ?? old.limit,
                        page: next.current ?? 1,
                      }))
                    }
                    pagination={pagination(
                      orderQuery.page,
                      orderQuery.limit,
                      orders.data?.total,
                    )}
                    rowKey="_id"
                    scroll={{ x: 1120 }}
                  />
                </>
              ),
              key: "orders",
              label: "Đơn thanh toán",
            },
          ]}
        />
      </Card>

      <Modal
        cancelText="Hủy"
        confirmLoading={savePlan.isPending}
        okText={editing ? "Lưu thay đổi" : "Tạo gói"}
        onCancel={() => setPlanModalOpen(false)}
        onOk={() =>
          void form.validateFields().then((values) => savePlan.mutate(values))
        }
        open={planModalOpen}
        title={editing ? "Cập nhật gói" : "Tạo gói thuê bao"}
        width={680}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          style={{ marginTop: 20 }}
        >
          <Form.Item
            label="Tên gói"
            name="name"
            rules={[{ min: 2, required: true, whitespace: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Mã gói"
            name="code"
            rules={[{ pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, required: true }]}
          >
            <Input placeholder="standard" />
          </Form.Item>
          <Form.Item
            extra="Mức thấp đến cao được dùng để xác định thao tác nâng hoặc hạ gói."
            label="Mức gói"
            name="tierLevel"
            rules={[{ required: true }]}
          >
            <InputNumber
              max={1000}
              min={1}
              precision={0}
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space align="start" size={16} style={{ width: "100%" }} wrap>
            <Form.Item
              label="Giá tháng (VND)"
              name="monthlyPriceVnd"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} precision={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              label="Giá năm (VND)"
              name="yearlyPriceVnd"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          </Space>
          <Space align="start" size={16} style={{ width: "100%" }} wrap>
            <Form.Item
              extra="Để trống nếu không giới hạn số chi nhánh hoạt động."
              label="Số chi nhánh hoạt động tối đa"
              name={["entitlements", "maxBranches"]}
            >
              <InputNumber
                min={1}
                placeholder="Không giới hạn"
                precision={0}
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Form.Item
              extra="Để trống nếu không giới hạn số học viên hoạt động."
              label="Số học viên hoạt động tối đa"
              name={["entitlements", "maxActiveLearners"]}
            >
              <InputNumber
                min={1}
                placeholder="Không giới hạn"
                precision={0}
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Space>
          <Form.Item
            extra="Ghi danh cần Khóa học; Bài tập cần cả Ghi danh và Khóa học. Các module bắt buộc sẽ được chọn tự động."
            label="Module trong gói"
            name={["entitlements", "modules"]}
            normalize={(modules: LmsModule[] | undefined) =>
              includeLmsModulePrerequisites(modules ?? [])
            }
            rules={[{ required: true, message: "Chọn ít nhất một module" }]}
          >
            <Checkbox.Group options={lmsModuleOptions} />
          </Form.Item>
          <Space align="start" size={16} style={{ width: "100%" }} wrap>
            <Form.Item
              extra="Để trống nếu không giới hạn."
              label="Số người dùng tối đa"
              name={["entitlements", "maxUsers"]}
            >
              <InputNumber
                min={1}
                placeholder="Không giới hạn"
                precision={0}
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Form.Item
              extra="Để trống nếu không giới hạn."
              label="Số khóa học tối đa"
              name={["entitlements", "maxCourses"]}
            >
              <InputNumber
                min={1}
                placeholder="Không giới hạn"
                precision={0}
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Space>
          <Form.Item
            extra="Mỗi dòng là một quyền lợi."
            label="Quyền lợi"
            name="featuresText"
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label="Đang mở bán" name="active" valuePropName="checked">
            <Switch aria-label="Cho phép mở bán gói" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        footer={null}
        onCancel={() => setSelectedOrderId(null)}
        open={Boolean(selectedOrderId)}
        title="Chi tiết đơn thanh toán"
        width={860}
      >
        {orderDetail.error && (
          <Alert
            showIcon
            title={
              orderDetail.error instanceof Error
                ? orderDetail.error.message
                : "Không tải được đơn thanh toán"
            }
            type="error"
          />
        )}
        {detail && (
          <>
            <Descriptions
              bordered
              className="admin-billing-detail-summary"
              column={{ md: 2, xs: 1 }}
              size="small"
            >
              <Descriptions.Item label="Mã hóa đơn">
                {detail.order.invoiceNumber}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag
                  color={
                    getBillingStatusPresentation(detail.order.status).color
                  }
                >
                  {getBillingStatusPresentation(detail.order.status).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Loại">
                {orderTypeLabels[detail.order.type]}
              </Descriptions.Item>
              <Descriptions.Item label="Số tiền">
                {money.format(detail.order.amountVnd)}
              </Descriptions.Item>
              <Descriptions.Item label="Gói">
                {detail.order.planSnapshot.name}
              </Descriptions.Item>
              <Descriptions.Item label="Quyền trong đơn" span={2}>
                <EntitlementDetails
                  entitlements={detail.order.planSnapshot.entitlements}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Tổ chức">
                {tenantView(detail.order.tenantId).name ??
                  tenantView(detail.order.tenantId).id}
              </Descriptions.Item>
              <Descriptions.Item label="Mã giao dịch (đã ẩn bớt)">
                {detail.order.transactionReference ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Cách tính phí">
                {formulaLabel(detail.order.planSnapshot.formula)}
              </Descriptions.Item>
              <Descriptions.Item label="Hạn thanh toán">
                {date.format(new Date(detail.order.expiresAt))}
              </Descriptions.Item>
              <Descriptions.Item label="Gói trước đó">
                {detail.order.planSnapshot.sourcePlanCode
                  ? (planNames.get(detail.order.planSnapshot.sourcePlanCode) ??
                    detail.order.planSnapshot.sourcePlanCode)
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Giá nguồn">
                {detail.order.planSnapshot.sourcePriceVnd == null
                  ? "—"
                  : money.format(detail.order.planSnapshot.sourcePriceVnd)}
              </Descriptions.Item>
              <Descriptions.Item label="Chu kỳ trước đó">
                {billingCycleLabel(
                  detail.order.planSnapshot.sourceBillingCycle,
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Kỳ trước bắt đầu">
                {formatDate(
                  detail.order.planSnapshot.sourceCurrentPeriodStartAt,
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Kỳ trước kết thúc">
                {formatDate(detail.order.planSnapshot.sourceEndAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Chênh lệch giá">
                {detail.order.planSnapshot.priceDifferenceVnd == null
                  ? "—"
                  : money.format(detail.order.planSnapshot.priceDifferenceVnd)}
              </Descriptions.Item>
              <Descriptions.Item label="Thời gian còn lại trong kỳ">
                {formatDuration(detail.order.planSnapshot.remainingMs)}
              </Descriptions.Item>
              <Descriptions.Item label="Độ dài kỳ thanh toán">
                {formatDuration(detail.order.planSnapshot.fullPeriodMs)}
              </Descriptions.Item>
              <Descriptions.Item label="Xác minh thanh toán">
                {formatDate(detail.order.paymentCapturedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Áp dụng thuê bao">
                {formatDate(detail.order.subscriptionAppliedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Ghi nhận đã thanh toán">
                {formatDate(detail.order.paidAt)}
              </Descriptions.Item>
              {detail.order.reviewReason && (
                <Descriptions.Item label="Lý do cần kiểm tra" span={2}>
                  {detail.order.reviewReason}
                </Descriptions.Item>
              )}
            </Descriptions>
            {detail.order.status === "REVIEW_REQUIRED" && (
              <Space className="admin-billing-detail-actions" wrap>
                <Button
                  aria-label="Áp dụng lại giao dịch vào thuê bao"
                  icon={<ReloadOutlined />}
                  loading={orderAction.isPending}
                  onClick={() => requestAction("reconcile")}
                  type="primary"
                >
                  Áp dụng lại
                </Button>
                <Button
                  aria-label="Đánh dấu giao dịch cần hoàn tiền"
                  danger
                  icon={<WarningOutlined />}
                  loading={orderAction.isPending}
                  onClick={() => requestAction("refund")}
                >
                  Đánh dấu cần hoàn tiền
                </Button>
              </Space>
            )}
            <Divider>Diễn biến thanh toán</Divider>
            <TimelineList events={detail.events} />
            <Divider>Lịch sử xử lý của quản trị viên</Divider>
            <AuditList audits={detail.audits} />
          </>
        )}
      </Modal>
    </div>
  );
}

function TimelineList({ events }: { events: PaymentEventTimeline[] }) {
  if (events.length === 0)
    return (
      <Typography.Text type="secondary">
        Chưa có cập nhật từ cổng thanh toán.
      </Typography.Text>
    );

  return (
    <ul
      aria-label="Diễn biến thanh toán"
      className="admin-billing-history-list"
    >
      {events.map((event) => (
        <li className="admin-billing-history-item" key={event._id}>
          <strong>Cập nhật từ cổng thanh toán</strong>
          <Space orientation="vertical" size={4}>
            <span>
              {eventStatusLabels[event.status]} ·{" "}
              {event.processedAt
                ? `Xử lý lúc ${date.format(new Date(event.processedAt))}`
                : "Đang chờ xử lý"}
            </span>
            <details className="admin-billing-technical-details">
              <summary>Chi tiết kỹ thuật</summary>
              <span className="admin-billing-history-meta">
                Loại thông báo: {event.notificationType}
              </span>
              <Typography.Text className="admin-billing-technical-data" code>
                {JSON.stringify(event.payload)}
              </Typography.Text>
            </details>
          </Space>
        </li>
      ))}
    </ul>
  );
}

function AuditList({ audits }: { audits: BillingAuditEntry[] }) {
  if (audits.length === 0)
    return (
      <Typography.Text type="secondary">Chưa có lịch sử xử lý.</Typography.Text>
    );

  return (
    <ul
      aria-label="Lịch sử xử lý của quản trị viên"
      className="admin-billing-history-list"
    >
      {audits.map((audit) => (
        <li className="admin-billing-history-item" key={audit._id}>
          <strong>{auditActionLabels[audit.action]}</strong>
          <div>
            {getBillingStatusPresentation(audit.beforeStatus).label} →{" "}
            {getBillingStatusPresentation(audit.afterStatus).label}
          </div>
          <div className="admin-billing-history-meta">
            {audit.reason} · {date.format(new Date(audit.createdAt))}
          </div>
        </li>
      ))}
    </ul>
  );
}
