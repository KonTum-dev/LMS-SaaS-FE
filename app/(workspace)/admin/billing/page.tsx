"use client";

import { EyeOutlined, PlusOutlined, ReloadOutlined, WarningOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  List,
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
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import type {
  AdminOrdersQuery,
  AdminSubscriptionsQuery,
  BillingAuditEntry,
  BillingPlan,
  BillingPlanInput,
  PaymentEventTimeline,
  PaymentOrder,
  PaymentOrderStatus,
  PaymentOrderType,
  Subscription,
} from "@/lib/types";
import { getBillingStatusPresentation } from "../../billing/billing-state";

const money = new Intl.NumberFormat("vi-VN", { currency: "VND", maximumFractionDigits: 0, style: "currency" });
const date = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" });

function tenantView(value: PaymentOrder["tenantId"] | Subscription["tenantId"]) {
  return typeof value === "string"
    ? { id: value, name: null, slug: null }
    : { id: value._id, name: value.name, slug: value.slug };
}

function formatDate(value: string | null | undefined): string {
  return value ? date.format(new Date(value)) : "—";
}

interface PlanForm extends Omit<BillingPlanInput, "features"> { featuresText?: string }

const statusOptions: Array<{ label: string; value: PaymentOrderStatus }> = [
  "PENDING", "PAID", "CANCELED", "EXPIRED", "REVIEW_REQUIRED", "REFUND_REQUIRED",
].map((value) => ({ label: getBillingStatusPresentation(value as PaymentOrderStatus).label, value: value as PaymentOrderStatus }));
const typeOptions: Array<{ label: string; value: PaymentOrderType }> = [
  { label: "Mua mới", value: "NEW" },
  { label: "Gia hạn", value: "RENEWAL" },
  { label: "Nâng gói", value: "UPGRADE" },
];

export default function AdminBillingPage() {
  const { message, modal } = App.useApp();
  const { organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<PlanForm>();
  const [editing, setEditing] = useState<BillingPlan | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderQuery, setOrderQuery] = useState<AdminOrdersQuery>({ limit: 10, page: 1 });
  const [subscriptionQuery, setSubscriptionQuery] = useState<AdminSubscriptionsQuery>({ limit: 10, page: 1 });
  const scope = useMemo(() => getViewerScope(user, organization), [organization, user]);
  const adminKey = scope ? lmsQueryKeys.adminBilling(scope) : (["lms", "signed-out", "admin-billing"] as const);
  const enabled = Boolean(token && scope && user?.role === "SUPER_ADMIN");

  const plans = useQuery({
    enabled,
    queryFn: () => billingApi.adminListPlans({ token }),
    queryKey: scope ? lmsQueryKeys.adminBillingPlans(scope) : [...adminKey, "plans"],
  });
  const subscriptions = useQuery({
    enabled,
    queryFn: () => billingApi.adminListSubscriptions({ token }, subscriptionQuery),
    queryKey: scope ? lmsQueryKeys.adminSubscriptions(scope, subscriptionQuery) : [...adminKey, "subscriptions", subscriptionQuery],
  });
  const orders = useQuery({
    enabled,
    queryFn: () => billingApi.adminListOrders({ token }, orderQuery),
    queryKey: scope ? lmsQueryKeys.adminOrders(scope, orderQuery) : [...adminKey, "orders", orderQuery],
  });
  const orderDetail = useQuery({
    enabled: Boolean(enabled && selectedOrderId),
    queryFn: () => billingApi.adminGetOrder({ token }, selectedOrderId!),
    queryKey: scope && selectedOrderId ? lmsQueryKeys.adminOrder(scope, selectedOrderId) : [...adminKey, "orders", "detail", selectedOrderId],
  });

  const savePlan = useMutation({
    mutationFn: async (values: PlanForm) => {
      const input: BillingPlanInput = {
        ...values,
        features: values.featuresText?.split("\n").map((item) => item.trim()).filter(Boolean) ?? [],
      };
      delete (input as BillingPlanInput & { featuresText?: string }).featuresText;
      return editing
        ? billingApi.adminUpdatePlan({ token }, editing._id, input)
        : billingApi.adminCreatePlan({ token }, input);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "Không thể lưu gói"),
    onSuccess: async () => {
      message.success(editing ? "Đã cập nhật gói" : "Đã tạo gói");
      setPlanModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: adminKey });
    },
  });
  const orderAction = useMutation({
    mutationFn: (input: { action: "reconcile" | "refund"; id: string; reason: string }) =>
      input.action === "reconcile"
        ? billingApi.adminReconcileOrder({ token }, input.id, input.reason)
        : billingApi.adminMarkRefundRequired({ token }, input.id, input.reason),
    onError: (error) => message.error(error instanceof Error ? error.message : "Không thể xử lý order"),
    onSuccess: async (detail) => {
      message.success(detail.order.status === "PAID" ? "Đã reconcile và áp dụng thuê bao" : "Đã cập nhật trạng thái vận hành");
      if (scope) queryClient.setQueryData(lmsQueryKeys.adminOrder(scope, detail.order._id), detail);
      await queryClient.invalidateQueries({ queryKey: adminKey });
    },
  });

  const showCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ active: true, tierLevel: 1 });
    setPlanModalOpen(true);
  };
  const showEdit = (plan: BillingPlan) => {
    setEditing(plan);
    form.setFieldsValue({
      active: plan.active,
      code: plan.code,
      description: plan.description,
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
      content: <Input.TextArea autoSize={{ maxRows: 5, minRows: 3 }} onChange={(event) => { reason = event.target.value.trim(); }} placeholder="Lý do vận hành (tối thiểu 3 ký tự)" />,
      okButtonProps: { danger: action === "refund" },
      okText: action === "reconcile" ? "Thử reconcile" : "Đánh dấu cần hoàn tiền",
      onOk: async () => {
        if (reason.length < 3) throw new Error("Vui lòng nhập lý do tối thiểu 3 ký tự");
        await orderAction.mutateAsync({ action, id, reason });
      },
      title: action === "reconcile" ? "Thử áp dụng lại payment đã xác minh?" : "Đánh dấu cần hoàn tiền thủ công?",
    });
  };

  const planColumns: ColumnsType<BillingPlan> = [
    { key: "plan", render: (_, plan) => <div><strong>{plan.name}</strong><div className="table-muted">{plan.code} · tier {plan.tierLevel}</div></div>, title: "Gói" },
    { dataIndex: "monthlyPriceVnd", key: "month", render: (value: number) => money.format(value), title: "Giá tháng" },
    { dataIndex: "yearlyPriceVnd", key: "year", render: (value: number) => money.format(value), responsive: ["md"], title: "Giá năm" },
    { dataIndex: "active", key: "active", render: (value: boolean) => <Tag color={value ? "green" : "default"}>{value ? "Đang bán" : "Đã ẩn"}</Tag>, title: "Trạng thái" },
    { key: "action", render: (_, plan) => <Button onClick={() => showEdit(plan)} type="link">Sửa</Button>, title: "" },
  ];
  const subscriptionColumns: ColumnsType<Subscription> = [
    { key: "tenant", render: (_, subscription) => { const tenant = tenantView(subscription.tenantId); return tenant.name ? <div><strong>{tenant.name}</strong><div className="table-muted">{tenant.slug || tenant.id}</div></div> : <Typography.Text copyable>{tenant.id}</Typography.Text>; }, title: "Tổ chức" },
    { key: "plan", render: (_, item) => <div><strong>{item.planCode}</strong><div className="table-muted">Tier {item.currentTierLevel} · {money.format(item.currentPriceVnd)}</div></div>, title: "Gói" },
    { dataIndex: "billingCycle", key: "cycle", render: (value: Subscription["billingCycle"]) => value === "MONTHLY" ? "Tháng" : "Năm", title: "Chu kỳ" },
    { dataIndex: "endAt", key: "end", render: (value: string) => date.format(new Date(value)), title: "Hết hạn" },
    { dataIndex: "scheduledPlanCode", key: "scheduled", render: (value: string | null) => value ?? "—", title: "Hạ gói kế tiếp" },
    { dataIndex: "status", key: "status", render: (value: Subscription["status"]) => <Tag color={value === "ACTIVE" ? "green" : "red"}>{value === "ACTIVE" ? "Hiệu lực" : "Hết hạn"}</Tag>, title: "Trạng thái" },
  ];
  const orderColumns: ColumnsType<PaymentOrder> = [
    { dataIndex: "invoiceNumber", key: "invoice", render: (value: string) => <Typography.Text copyable>{value}</Typography.Text>, title: "Invoice" },
    { key: "tenant", render: (_, order) => { const tenant = tenantView(order.tenantId); return tenant.name ? <div><strong>{tenant.name}</strong><div className="table-muted">{tenant.slug || tenant.id}</div></div> : <Typography.Text copyable>{tenant.id}</Typography.Text>; }, title: "Tổ chức" },
    { key: "plan", render: (_, order) => <div><strong>{order.planSnapshot.name}</strong><div className="table-muted">{order.type} · {order.planSnapshot.billingCycle}</div></div>, title: "Gói / loại" },
    { dataIndex: "amountVnd", key: "amount", render: (value: number) => money.format(value), title: "Số tiền" },
    { dataIndex: "status", key: "status", render: (value: PaymentOrderStatus) => { const item = getBillingStatusPresentation(value); return <Tag color={item.color}>{item.label}</Tag>; }, title: "Trạng thái" },
    { dataIndex: "transactionReference", key: "transaction", render: (value: string | null) => value ?? "—", title: "Giao dịch" },
    { key: "action", render: (_, order) => <Button icon={<EyeOutlined />} onClick={() => setSelectedOrderId(order._id)} type="link">Chi tiết</Button>, title: "" },
  ];

  if (user?.role !== "SUPER_ADMIN") return <Alert message="Bạn không có quyền quản trị billing nền tảng." showIcon type="warning" />;
  const error = plans.error ?? subscriptions.error ?? orders.error;
  const pagination = (page: number, limit: number, total = 0): TablePaginationConfig => ({ current: page, pageSize: limit, showSizeChanger: true, total });
  const detail = orderDetail.data;

  return (
    <div className="page-shell">
      <div className="page-heading"><div><h1>Quản trị thuê bao</h1><p>Quản lý tier, thuê bao, order cần đối soát và audit vận hành.</p></div><Button icon={<PlusOutlined />} onClick={showCreate} type="primary">Thêm gói</Button></div>
      {error && <Alert message={error instanceof Error ? error.message : "Không tải được billing"} showIcon style={{ marginBottom: 20 }} type="error" />}
      <Card className="surface-card">
        <Tabs items={[
          { children: <Table columns={planColumns} dataSource={plans.data ?? []} loading={plans.isLoading} pagination={{ pageSize: 8 }} rowKey="_id" scroll={{ x: 760 }} />, key: "plans", label: "Gói thuê bao" },
          { children: <><Space wrap style={{ marginBottom: 16 }}><Input.Search allowClear onSearch={(tenantId) => setSubscriptionQuery((old) => ({ ...old, page: 1, tenantId: tenantId.trim() || undefined }))} placeholder="Tenant ID" style={{ width: 240 }} /><Select allowClear onChange={(status) => setSubscriptionQuery((old) => ({ ...old, page: 1, status }))} options={[{ label: "Hiệu lực", value: "ACTIVE" }, { label: "Hết hạn", value: "EXPIRED" }]} placeholder="Trạng thái" style={{ width: 160 }} /><Select allowClear onChange={(billingCycle) => setSubscriptionQuery((old) => ({ ...old, billingCycle, page: 1 }))} options={[{ label: "Tháng", value: "MONTHLY" }, { label: "Năm", value: "YEARLY" }]} placeholder="Chu kỳ" style={{ width: 140 }} /></Space><Table columns={subscriptionColumns} dataSource={subscriptions.data?.items ?? []} loading={subscriptions.isLoading} onChange={(next) => setSubscriptionQuery((old) => ({ ...old, limit: next.pageSize ?? old.limit, page: next.current ?? 1 }))} pagination={pagination(subscriptionQuery.page, subscriptionQuery.limit, subscriptions.data?.total)} rowKey="_id" scroll={{ x: 980 }} /></>, key: "subscriptions", label: "Thuê bao tổ chức" },
          { children: <><Space wrap style={{ marginBottom: 16 }}><Input.Search allowClear onSearch={(search) => setOrderQuery((old) => ({ ...old, page: 1, search: search.trim() || undefined }))} placeholder="Tìm invoice" style={{ width: 220 }} /><Input.Search allowClear onSearch={(tenantId) => setOrderQuery((old) => ({ ...old, page: 1, tenantId: tenantId.trim() || undefined }))} placeholder="Tenant ID" style={{ width: 220 }} /><Select allowClear onChange={(status) => setOrderQuery((old) => ({ ...old, page: 1, status }))} options={statusOptions} placeholder="Trạng thái" style={{ width: 180 }} /><Select allowClear onChange={(type) => setOrderQuery((old) => ({ ...old, page: 1, type }))} options={typeOptions} placeholder="Loại order" style={{ width: 150 }} /><Button icon={<ReloadOutlined />} onClick={() => void orders.refetch()}>Tải lại</Button></Space><Table columns={orderColumns} dataSource={orders.data?.items ?? []} loading={orders.isLoading} onChange={(next) => setOrderQuery((old) => ({ ...old, limit: next.pageSize ?? old.limit, page: next.current ?? 1 }))} pagination={pagination(orderQuery.page, orderQuery.limit, orders.data?.total)} rowKey="_id" scroll={{ x: 1120 }} /></>, key: "orders", label: "Đơn thanh toán" },
        ]} />
      </Card>

      <Modal cancelText="Hủy" confirmLoading={savePlan.isPending} okText={editing ? "Lưu thay đổi" : "Tạo gói"} onCancel={() => setPlanModalOpen(false)} onOk={() => void form.validateFields().then((values) => savePlan.mutate(values))} open={planModalOpen} title={editing ? "Cập nhật gói" : "Tạo gói thuê bao"}>
        <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 20 }}>
          <Form.Item label="Tên gói" name="name" rules={[{ min: 2, required: true, whitespace: true }]}><Input /></Form.Item>
          <Form.Item label="Mã gói" name="code" rules={[{ pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, required: true }]}><Input placeholder="standard" /></Form.Item>
          <Form.Item label="Tier" name="tierLevel" rules={[{ required: true }]}><InputNumber max={1000} min={1} precision={0} style={{ width: "100%" }} /></Form.Item>
          <Form.Item label="Mô tả" name="description"><Input.TextArea rows={2} /></Form.Item>
          <Space align="start" size={16} style={{ width: "100%" }}><Form.Item label="Giá tháng (VND)" name="monthlyPriceVnd" rules={[{ required: true }]}><InputNumber min={1} precision={0} style={{ width: "100%" }} /></Form.Item><Form.Item label="Giá năm (VND)" name="yearlyPriceVnd" rules={[{ required: true }]}><InputNumber min={1} precision={0} style={{ width: "100%" }} /></Form.Item></Space>
          <Form.Item extra="Mỗi dòng là một quyền lợi." label="Quyền lợi" name="featuresText"><Input.TextArea rows={4} /></Form.Item>
          <Form.Item label="Đang mở bán" name="active" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>

      <Modal footer={null} onCancel={() => setSelectedOrderId(null)} open={Boolean(selectedOrderId)} title="Chi tiết order" width={860}>
        {orderDetail.error && <Alert message={orderDetail.error instanceof Error ? orderDetail.error.message : "Không tải được order"} showIcon type="error" />}
        {detail && <>
          <Descriptions bordered column={{ md: 2, xs: 1 }} size="small">
            <Descriptions.Item label="Invoice">{detail.order.invoiceNumber}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái"><Tag color={getBillingStatusPresentation(detail.order.status).color}>{getBillingStatusPresentation(detail.order.status).label}</Tag></Descriptions.Item>
            <Descriptions.Item label="Loại">{detail.order.type}</Descriptions.Item>
            <Descriptions.Item label="Số tiền">{money.format(detail.order.amountVnd)}</Descriptions.Item>
            <Descriptions.Item label="Gói">{detail.order.planSnapshot.name} · tier {detail.order.planSnapshot.tierLevel}</Descriptions.Item>
            <Descriptions.Item label="Tenant">{tenantView(detail.order.tenantId).name ?? tenantView(detail.order.tenantId).id}</Descriptions.Item>
            <Descriptions.Item label="Giao dịch redacted">{detail.order.transactionReference ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Công thức">{detail.order.planSnapshot.formula}</Descriptions.Item>
            <Descriptions.Item label="Hết hạn checkout">{date.format(new Date(detail.order.expiresAt))}</Descriptions.Item>
            <Descriptions.Item label="Gói nguồn">{detail.order.planSnapshot.sourcePlanCode ?? "—"} · tier {detail.order.planSnapshot.sourceTierLevel ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Giá nguồn">{detail.order.planSnapshot.sourcePriceVnd == null ? "—" : money.format(detail.order.planSnapshot.sourcePriceVnd)}</Descriptions.Item>
            <Descriptions.Item label="Chu kỳ nguồn">{detail.order.planSnapshot.sourceBillingCycle ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Bắt đầu kỳ nguồn">{formatDate(detail.order.planSnapshot.sourceCurrentPeriodStartAt)}</Descriptions.Item>
            <Descriptions.Item label="Kết thúc kỳ nguồn">{formatDate(detail.order.planSnapshot.sourceEndAt)}</Descriptions.Item>
            <Descriptions.Item label="Chênh lệch giá">{detail.order.planSnapshot.priceDifferenceVnd == null ? "—" : money.format(detail.order.planSnapshot.priceDifferenceVnd)}</Descriptions.Item>
            <Descriptions.Item label="Thời gian còn lại / toàn kỳ">{detail.order.planSnapshot.remainingMs ?? "—"} / {detail.order.planSnapshot.fullPeriodMs ?? "—"} ms</Descriptions.Item>
            <Descriptions.Item label="Server xác minh lúc">{formatDate(detail.order.paymentCapturedAt)}</Descriptions.Item>
            <Descriptions.Item label="Áp thuê bao lúc">{formatDate(detail.order.subscriptionAppliedAt)}</Descriptions.Item>
            <Descriptions.Item label="Đánh dấu paid lúc">{formatDate(detail.order.paidAt)}</Descriptions.Item>
            {detail.order.reviewReason && <Descriptions.Item label="Lý do review" span={2}>{detail.order.reviewReason}</Descriptions.Item>}
          </Descriptions>
          {detail.order.status === "REVIEW_REQUIRED" && <Space wrap style={{ marginTop: 16 }}><Button icon={<ReloadOutlined />} loading={orderAction.isPending} onClick={() => requestAction("reconcile")} type="primary">Reconcile</Button><Button danger icon={<WarningOutlined />} loading={orderAction.isPending} onClick={() => requestAction("refund")}>Đánh dấu cần hoàn tiền</Button></Space>}
          <Divider>Timeline provider</Divider>
          <TimelineList events={detail.events} />
          <Divider>Audit quản trị</Divider>
          <AuditList audits={detail.audits} />
        </>}
      </Modal>
    </div>
  );
}

function TimelineList({ events }: { events: PaymentEventTimeline[] }) {
  return <List dataSource={events} locale={{ emptyText: "Chưa có event" }} renderItem={(event) => <List.Item><List.Item.Meta description={<Space direction="vertical" size={2}><span>{event.status} · {event.processedAt ? date.format(new Date(event.processedAt)) : "chưa xử lý"}</span><Typography.Text code>{JSON.stringify(event.payload)}</Typography.Text></Space>} title={event.notificationType} /></List.Item>} />;
}

function AuditList({ audits }: { audits: BillingAuditEntry[] }) {
  return <List dataSource={audits} locale={{ emptyText: "Chưa có audit" }} renderItem={(audit) => <List.Item><List.Item.Meta description={`${audit.reason} · ${date.format(new Date(audit.createdAt))}`} title={`${audit.action}: ${audit.beforeStatus} → ${audit.afterStatus}`} /></List.Item>} />;
}
