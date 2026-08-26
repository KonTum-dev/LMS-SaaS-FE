"use client";

import {
  CheckOutlined,
  CreditCardOutlined,
  EyeOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import { billingApi, submitCheckoutForm } from "@/lib/api";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import type {
  BillingCycle,
  BillingPlan,
  PaymentOrder,
} from "@/lib/types";
import { getBillingStatusPresentation } from "./billing-state";

const money = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});
const date = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function entityId(value: string | { _id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value._id;
}

export default function BillingPage() {
  const { message, modal } = App.useApp();
  const router = useRouter();
  const { organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const checkoutAttempt = useRef<{ fingerprint: string; idempotencyKey: string; orderId?: string } | null>(null);
  const scope = getViewerScope(user, organization);
  const billingKey = scope
    ? lmsQueryKeys.billing(scope)
    : (["lms", "signed-out", "billing"] as const);
  const enabled = Boolean(token && scope && user?.role === "TENANT_ADMIN");

  const plans = useQuery({
    enabled,
    queryFn: () => billingApi.listPlans({ token }),
    queryKey: scope ? lmsQueryKeys.billingPlans(scope) : [...billingKey, "plans"],
  });
  const subscription = useQuery({
    enabled,
    queryFn: () => billingApi.getSubscription({ token }),
    queryKey: scope ? lmsQueryKeys.billingSubscription(scope) : [...billingKey, "subscription"],
  });
  const orders = useQuery({
    enabled,
    queryFn: () => billingApi.listOrders({ token }),
    queryKey: scope ? lmsQueryKeys.billingOrders(scope) : [...billingKey, "orders"],
  });

  const refresh = async () => queryClient.invalidateQueries({ queryKey: billingKey });
  const checkout = useMutation({
    mutationFn: (input: { billingCycle: BillingCycle; idempotencyKey: string; planId: string }) =>
      billingApi.createCheckout({ token }, input),
    onError: (error) => {
      message.error(error instanceof Error ? error.message : "Không thể tạo checkout");
    },
    onSuccess: async (response) => {
      if (response.order.status !== "PENDING") {
        checkoutAttempt.current = null;
        await refresh();
        router.push(`/billing/status/${response.order._id}`);
        return;
      }
      if (checkoutAttempt.current) checkoutAttempt.current.orderId = response.order._id;
      await refresh();
      if (response.checkout.mode === "MOCK") {
        message.info("Đã tạo order mock. Order vẫn có thể xử lý sau khi tải lại trang.");
        return;
      }
      submitCheckoutForm(response.checkout);
    },
  });
  const simulate = useMutation({
    mutationFn: ({ id, result }: { id: string; result: "PAID" | "CANCELED" }) =>
      billingApi.simulate({ token }, id, result),
    onError: (error) => message.error(error instanceof Error ? error.message : "Không thể mô phỏng thanh toán"),
    onSuccess: async (order) => {
      message.success(order.status === "PAID" ? "Đã mô phỏng thanh toán thành công" : "Đã mô phỏng hủy thanh toán");
      checkoutAttempt.current = null;
      await refresh();
    },
  });
  const scheduleDowngrade = useMutation({
    mutationFn: (planId: string) => billingApi.scheduleDowngrade({ token }, planId),
    onError: (error) => message.error(error instanceof Error ? error.message : "Không thể hẹn hạ gói"),
    onSuccess: async () => {
      message.success("Đã lưu gói mong muốn cho lần gia hạn sau");
      await refresh();
    },
  });
  const cancelDowngrade = useMutation({
    mutationFn: () => billingApi.cancelScheduledDowngrade({ token }),
    onError: (error) => message.error(error instanceof Error ? error.message : "Không thể hủy lịch hạ gói"),
    onSuccess: async () => {
      message.success("Đã hủy lựa chọn hạ gói");
      await refresh();
    },
  });

  useEffect(() => {
    const attempt = checkoutAttempt.current;
    if (!attempt?.orderId) return;
    const liveOrder = orders.data?.find((order) => order._id === attempt.orderId);
    if (liveOrder && liveOrder.status !== "PENDING") checkoutAttempt.current = null;
  }, [orders.data]);

  const startCheckout = (planId: string) => {
    const fingerprint = `${planId}:${cycle}`;
    if (checkoutAttempt.current?.fingerprint !== fingerprint) {
      checkoutAttempt.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
    }
    checkout.mutate({
      billingCycle: cycle,
      idempotencyKey: checkoutAttempt.current.idempotencyKey,
      planId,
    });
  };

  const confirmDowngrade = (plan: BillingPlan) => {
    modal.confirm({
      cancelText: "Hủy",
      content: "Gói hiện tại và ngày hết hạn không thay đổi. Không phát sinh thanh toán hay hoàn tiền.",
      okText: "Hẹn hạ gói",
      onOk: () => scheduleDowngrade.mutateAsync(plan._id),
      title: `Lưu lựa chọn hạ xuống gói ${plan.name}?`,
    });
  };

  const columns: ColumnsType<PaymentOrder> = [
    {
      dataIndex: "invoiceNumber",
      key: "invoice",
      render: (value: string) => <Typography.Text copyable>{value}</Typography.Text>,
      title: "Hóa đơn",
    },
    {
      key: "plan",
      render: (_, order) => (
        <div>
          <strong>{order.planSnapshot.name}</strong>
          <div className="table-muted">{order.type} · {order.planSnapshot.billingCycle === "MONTHLY" ? "Theo tháng" : "Theo năm"}</div>
        </div>
      ),
      title: "Gói",
    },
    { dataIndex: "amountVnd", key: "amount", render: (value: number) => money.format(value), title: "Số tiền" },
    {
      dataIndex: "status",
      key: "status",
      render: (value: PaymentOrder["status"]) => {
        const state = getBillingStatusPresentation(value);
        return <Tag color={state.color}>{state.label}</Tag>;
      },
      title: "Trạng thái",
    },
    { dataIndex: "createdAt", key: "created", render: (value?: string) => value ? date.format(new Date(value)) : "—", responsive: ["md"], title: "Tạo lúc" },
    {
      key: "actions",
      render: (_, order) => (
        <Space wrap>
          <Button icon={<EyeOutlined />} onClick={() => router.push(`/billing/status/${order._id}`)} size="small">Chi tiết</Button>
          {order.provider === "MOCK" && order.status === "PENDING" && (
            <>
              <Button danger loading={simulate.isPending} onClick={() => simulate.mutate({ id: order._id, result: "CANCELED" })} size="small">Hủy mock</Button>
              <Button loading={simulate.isPending} onClick={() => simulate.mutate({ id: order._id, result: "PAID" })} size="small" type="primary">Paid mock</Button>
            </>
          )}
        </Space>
      ),
      title: "Thao tác",
    },
  ];

  if (user?.role !== "TENANT_ADMIN") {
    return <Alert message="Chỉ quản trị tổ chức được truy cập thanh toán thuê bao." showIcon type="warning" />;
  }
  const error = plans.error ?? subscription.error ?? orders.error;
  const current = subscription.data;
  const currentPlanId = entityId(current?.planId);
  const active = current?.status === "ACTIVE";
  const pendingOrder = orders.data?.find((order) => order.status === "PENDING");

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <h1>Thuê bao DX LMS</h1>
          <p>Mua mới, gia hạn hoặc nâng gói qua checkout được backend ký. Redirect không phải bằng chứng thanh toán.</p>
        </div>
        <Segmented<BillingCycle>
          onChange={setCycle}
          options={[{ label: "Theo tháng", value: "MONTHLY" }, { label: "Theo năm", value: "YEARLY" }]}
          value={cycle}
        />
      </div>
      {error && <Alert message={error instanceof Error ? error.message : "Không tải được dữ liệu billing"} showIcon style={{ marginBottom: 20 }} type="error" />}
      {current && (
        <Alert
          description={`Hiệu lực đến ${date.format(new Date(current.endAt))}. Giá kỳ hiện tại: ${money.format(current.currentPriceVnd)}.`}
          message={`Gói hiện tại: ${current.planCode} · ${current.billingCycle === "MONTHLY" ? "tháng" : "năm"}`}
          showIcon
          style={{ marginBottom: 20 }}
          type={active ? "success" : "warning"}
        />
      )}
      {current?.scheduledPlanCode && (
        <Alert
          action={<Button loading={cancelDowngrade.isPending} onClick={() => cancelDowngrade.mutate()}>Hủy lựa chọn</Button>}
          description="Không đổi quyền ngay, không hoàn tiền và không tự tạo kỳ mới. Gói này được dùng khi bạn chủ động gia hạn sau."
          message={`Lựa chọn hạ gói đã lưu: ${current.scheduledPlanCode}`}
          showIcon
          style={{ marginBottom: 20 }}
          type="info"
        />
      )}
      {pendingOrder && (
        <Alert
          action={<Button onClick={() => router.push(`/billing/status/${pendingOrder._id}`)}>Theo dõi order</Button>}
          description={`Order hết hạn lúc ${date.format(new Date(pendingOrder.expiresAt))}. Tenant chỉ có một checkout chờ tại một thời điểm.`}
          message={`Checkout đang chờ: ${pendingOrder.invoiceNumber}`}
          showIcon
          style={{ marginBottom: 20 }}
          type="info"
        />
      )}
      <Row gutter={[18, 18]}>
        {(plans.data ?? []).map((plan) => {
          const price = cycle === "MONTHLY" ? plan.monthlyPriceVnd : plan.yearlyPriceVnd;
          const crossCycleBlocked = Boolean(active && current?.billingCycle !== cycle);
          const lowerTier = Boolean(active && plan.tierLevel < (current?.currentTierLevel ?? 0));
          const higherTier = Boolean(active && plan.tierLevel > (current?.currentTierLevel ?? 0));
          const samePlan = currentPlanId === plan._id;
          const equalTierDifferentPlan = Boolean(active && !samePlan && plan.tierLevel === current?.currentTierLevel);
          const disabled = crossCycleBlocked || equalTierDifferentPlan;
          const label = lowerTier ? "Lưu lựa chọn hạ gói" : samePlan ? "Gia hạn" : higherTier ? "Nâng gói" : "Chọn gói";
          return (
            <Col key={plan._id} lg={8} md={12} xs={24}>
              <Card className="surface-card billing-plan-card" title={<span>{plan.name} <Tag>Tier {plan.tierLevel}</Tag></span>}>
                <Typography.Paragraph className="table-muted">{plan.description || "Gói vận hành LMS theo nhu cầu tổ chức."}</Typography.Paragraph>
                <div className="billing-price">{money.format(price)}<small>/{cycle === "MONTHLY" ? "tháng" : "năm"}</small></div>
                {higherTier && !crossCycleBlocked && <Typography.Text type="secondary">Số tiền thực thu được backend prorate theo thời gian còn lại.</Typography.Text>}
                <Space direction="vertical" size={8} style={{ margin: "20px 0", width: "100%" }}>
                  {plan.features.map((feature) => <span key={feature}><CheckOutlined style={{ color: "#13a56b" }} /> {feature}</span>)}
                </Space>
                <Button
                  block
                  disabled={disabled}
                  icon={<CreditCardOutlined />}
                  loading={checkout.isPending || scheduleDowngrade.isPending}
                  onClick={() => lowerTier ? confirmDowngrade(plan) : startCheckout(plan._id)}
                  type={lowerTier ? "default" : "primary"}
                >
                  {label}
                </Button>
                {crossCycleBlocked && <Typography.Text type="secondary">Không thể đổi tháng ↔ năm giữa kỳ.</Typography.Text>}
                {equalTierDifferentPlan && <Typography.Text type="secondary">Không thể đổi ngang tier giữa kỳ.</Typography.Text>}
              </Card>
            </Col>
          );
        })}
      </Row>
      {!plans.isLoading && !plans.data?.length && <Card className="surface-card"><Empty description="Chưa có gói thuê bao đang mở bán" /></Card>}
      <Card className="surface-card" style={{ marginTop: 22 }} title={<span><HistoryOutlined /> &nbsp;Lịch sử thanh toán</span>}>
        <Table columns={columns} dataSource={orders.data ?? []} loading={orders.isLoading} pagination={{ pageSize: 8 }} rowKey="_id" scroll={{ x: 1050 }} />
      </Card>
    </div>
  );
}
