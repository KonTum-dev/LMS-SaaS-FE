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
import {
  formatEntitlementLimit,
  getSubscriptionAccessPresentation,
  lmsModuleLabels,
} from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import type { BillingCycle, BillingPlan, PaymentOrder } from "@/lib/types";
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
const orderTypeLabel: Record<PaymentOrder["type"], string> = {
  NEW: "Đăng ký mới",
  RENEWAL: "Gia hạn",
  UPGRADE: "Nâng gói",
};

function entityId(
  value: string | { _id: string } | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value._id;
}

export default function BillingPage() {
  const { message, modal } = App.useApp();
  const router = useRouter();
  const { effectiveAccess, organization, token, updateEffectiveAccess, user } =
    useAuth();
  const queryClient = useQueryClient();
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const checkoutAttempt = useRef<{
    fingerprint: string;
    idempotencyKey: string;
    orderId?: string;
  } | null>(null);
  const scope = getViewerScope(user, organization);
  const billingKey = scope
    ? lmsQueryKeys.billing(scope)
    : (["lms", "signed-out", "billing"] as const);
  const enabled = Boolean(token && scope && user?.role === "TENANT_ADMIN");

  const plans = useQuery({
    enabled,
    queryFn: () => billingApi.listPlans({ token }),
    queryKey: scope
      ? lmsQueryKeys.billingPlans(scope)
      : [...billingKey, "plans"],
  });
  const subscription = useQuery({
    enabled,
    queryFn: () => billingApi.getSubscription({ token }),
    queryKey: scope
      ? lmsQueryKeys.billingSubscription(scope)
      : [...billingKey, "subscription"],
  });
  const orders = useQuery({
    enabled,
    queryFn: () => billingApi.listOrders({ token }),
    queryKey: scope
      ? lmsQueryKeys.billingOrders(scope)
      : [...billingKey, "orders"],
  });

  const refresh = async () =>
    queryClient.invalidateQueries({ queryKey: billingKey });
  const checkout = useMutation({
    mutationFn: (input: {
      billingCycle: BillingCycle;
      idempotencyKey: string;
      planId: string;
    }) => billingApi.createCheckout({ token }, input),
    onError: (error) => {
      message.error(
        error instanceof Error
          ? error.message
          : "Không thể tạo yêu cầu thanh toán",
      );
    },
    onSuccess: async (response) => {
      if (response.order.status !== "PENDING") {
        checkoutAttempt.current = null;
        await refresh();
        router.push(`/billing/status/${response.order._id}`);
        return;
      }
      if (checkoutAttempt.current)
        checkoutAttempt.current.orderId = response.order._id;
      await refresh();
      if (response.checkout.mode === "MOCK") {
        message.info(
          "Đã tạo đơn thanh toán mô phỏng và đang chờ xử lý. Hãy dùng nút “Mô phỏng đã thanh toán” trong lịch sử đơn để hoàn tất.",
        );
        return;
      }
      submitCheckoutForm(response.checkout);
    },
  });
  const simulate = useMutation({
    mutationFn: ({ id, result }: { id: string; result: "PAID" | "CANCELED" }) =>
      billingApi.simulate({ token }, id, result),
    onError: (error) =>
      message.error(
        error instanceof Error
          ? error.message
          : "Không thể mô phỏng thanh toán",
      ),
    onSuccess: async (order) => {
      message.success(
        order.status === "PAID"
          ? "Đã mô phỏng thanh toán thành công"
          : "Đã mô phỏng hủy thanh toán",
      );
      checkoutAttempt.current = null;
      await refresh();
    },
  });
  const scheduleDowngrade = useMutation({
    mutationFn: (planId: string) =>
      billingApi.scheduleDowngrade({ token }, planId),
    onError: (error) =>
      message.error(
        error instanceof Error ? error.message : "Không thể hẹn hạ gói",
      ),
    onSuccess: async () => {
      message.success("Đã hẹn hạ gói; gói hiện tại vẫn giữ nguyên đến hết kỳ");
      await refresh();
    },
  });
  const cancelDowngrade = useMutation({
    mutationFn: () => billingApi.cancelScheduledDowngrade({ token }),
    onError: (error) =>
      message.error(
        error instanceof Error ? error.message : "Không thể hủy lịch hạ gói",
      ),
    onSuccess: async () => {
      message.success("Đã hủy lịch hạ gói");
      await refresh();
    },
  });

  useEffect(() => {
    const attempt = checkoutAttempt.current;
    if (!attempt?.orderId) return;
    const liveOrder = orders.data?.find(
      (order) => order._id === attempt.orderId,
    );
    if (liveOrder && liveOrder.status !== "PENDING")
      checkoutAttempt.current = null;
  }, [orders.data]);

  useEffect(() => {
    if (!subscription.data) return;
    if (organization)
      updateEffectiveAccess(
        subscription.data.effectiveAccess,
        organization._id,
      );
  }, [organization, subscription.data, updateEffectiveAccess]);

  const startCheckout = (planId: string) => {
    const fingerprint = `${planId}:${cycle}`;
    if (checkoutAttempt.current?.fingerprint !== fingerprint) {
      checkoutAttempt.current = {
        fingerprint,
        idempotencyKey: crypto.randomUUID(),
      };
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
      content:
        "Gói hiện tại và ngày hết hạn không thay đổi. Không phát sinh thanh toán hay hoàn tiền.",
      okText: "Hẹn hạ gói",
      onOk: () => scheduleDowngrade.mutateAsync(plan._id),
      title: `Lưu lựa chọn hạ xuống gói ${plan.name}?`,
    });
  };

  const columns: ColumnsType<PaymentOrder> = [
    {
      dataIndex: "invoiceNumber",
      key: "invoice",
      render: (value: string) => (
        <Typography.Text copyable>{value}</Typography.Text>
      ),
      title: "Hóa đơn",
    },
    {
      key: "plan",
      render: (_, order) => (
        <div>
          <strong>{order.planSnapshot.name}</strong>
          <div className="table-muted">
            {orderTypeLabel[order.type]} ·{" "}
            {order.planSnapshot.billingCycle === "MONTHLY"
              ? "Theo tháng"
              : "Theo năm"}
          </div>
        </div>
      ),
      title: "Gói",
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
      render: (value: PaymentOrder["status"]) => {
        const state = getBillingStatusPresentation(value);
        return <Tag color={state.color}>{state.label}</Tag>;
      },
      title: "Trạng thái",
    },
    {
      dataIndex: "createdAt",
      key: "created",
      render: (value?: string) => (value ? date.format(new Date(value)) : "—"),
      responsive: ["md"],
      title: "Tạo lúc",
    },
    {
      key: "actions",
      render: (_, order) => (
        <Space wrap>
          <Button
            icon={<EyeOutlined />}
            onClick={() => router.push(`/billing/status/${order._id}`)}
            size="small"
          >
            Chi tiết
          </Button>
          {process.env.NEXT_PUBLIC_ENABLE_BILLING_SIMULATOR === "true" &&
            order.provider === "MOCK" &&
            order.status === "PENDING" && (
              <>
                <Button
                  danger
                  loading={simulate.isPending}
                  onClick={() =>
                    simulate.mutate({ id: order._id, result: "CANCELED" })
                  }
                  size="small"
                >
                  Mô phỏng hủy
                </Button>
                <Button
                  loading={simulate.isPending}
                  onClick={() =>
                    simulate.mutate({ id: order._id, result: "PAID" })
                  }
                  size="small"
                  type="primary"
                >
                  Mô phỏng đã thanh toán
                </Button>
              </>
            )}
        </Space>
      ),
      title: "Thao tác",
    },
  ];

  if (user?.role !== "TENANT_ADMIN") {
    return (
      <Alert
        showIcon
        title="Chỉ quản trị tổ chức được truy cập thanh toán thuê bao."
        type="warning"
      />
    );
  }
  const error = plans.error ?? subscription.error ?? orders.error;
  const current = subscription.data;
  const currentPlanId = entityId(current?.planId);
  const currentPlanName =
    (plans.data ?? []).find(
      (plan) => plan._id === currentPlanId || plan.code === current?.planCode,
    )?.name ?? current?.planCode;
  const scheduledPlanName =
    (plans.data ?? []).find((plan) => plan.code === current?.scheduledPlanCode)
      ?.name ?? current?.scheduledPlanCode;
  const active = current?.status === "ACTIVE";
  const currentAccess = current?.effectiveAccess ?? effectiveAccess;
  const isTrial = currentAccess?.trial ?? current?.isTrial ?? false;
  const trialEnd = isTrial
    ? (current?.trialEndsAt ??
      currentAccess?.trialEndsAt ??
      current?.endAt ??
      null)
    : null;
  const currentModules = currentAccess
    ? currentAccess.modules
    : (current?.entitlements.modules ?? []);
  const currentMaxUsers = currentAccess
    ? currentAccess.limits.maxUsers
    : (current?.entitlements.maxUsers ?? null);
  const currentMaxCourses = currentAccess
    ? currentAccess.limits.maxCourses
    : (current?.entitlements.maxCourses ?? null);
  const accessPresentation = currentAccess
    ? getSubscriptionAccessPresentation(currentAccess.state)
    : null;
  const pendingOrder = orders.data?.find((order) => order.status === "PENDING");

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <h1>Thuê bao DX LMS</h1>
          <p>
            Theo dõi gói hiện tại, chọn chu kỳ và điều chỉnh thuê bao theo nhu
            cầu vận hành.
          </p>
        </div>
        <Segmented<BillingCycle>
          onChange={setCycle}
          options={[
            { label: "Theo tháng", value: "MONTHLY" },
            { label: "Theo năm", value: "YEARLY" },
          ]}
          value={cycle}
        />
      </div>
      {error && (
        <Alert
          className="billing-notice"
          showIcon
          title={
            error instanceof Error
              ? error.message
              : "Không tải được dữ liệu thuê bao"
          }
          type="error"
        />
      )}
      {!subscription.isLoading && !current && (
        <Alert
          className="billing-notice"
          description="Chọn một gói bên dưới để cấp module và hạn mức vận hành cho workspace."
          showIcon
          title="Tổ chức chưa có thuê bao"
          type="warning"
        />
      )}
      {current && (
        <section
          className="billing-current-summary"
          aria-label="Thuê bao hiện tại"
        >
          <div>
            <span>Gói hiện tại</span>
            <strong>{currentPlanName}</strong>
            <p>
              {isTrial ? "Dùng thử miễn phí đến" : "Hiệu lực đến"}{" "}
              {date.format(new Date(trialEnd ?? current.endAt))} ·{" "}
              {money.format(current.currentPriceVnd)}/
              {current.billingCycle === "MONTHLY" ? "tháng" : "năm"}
            </p>
            <p>
              {formatEntitlementLimit(currentMaxUsers, "users")} ·{" "}
              {formatEntitlementLimit(currentMaxCourses, "courses")}
            </p>
            <Space size={[4, 4]} wrap>
              {currentModules.map((module) => (
                <Tag key={module}>{lmsModuleLabels[module]}</Tag>
              ))}
            </Space>
          </div>
          <Space wrap>
            {isTrial && <Tag color="cyan">Dùng thử miễn phí</Tag>}
            {accessPresentation && (
              <Tag color={accessPresentation.color}>
                {accessPresentation.label}
              </Tag>
            )}
          </Space>
        </section>
      )}
      {isTrial && current && trialEnd && (
        <Alert
          className="billing-notice"
          description={`Workspace đang dùng các quyền hiện được cấp theo gói ${currentPlanName}. Chọn gói bên dưới để chuyển sang thuê bao trả phí trước ngày ${date.format(new Date(trialEnd))}.`}
          showIcon
          title="Bạn đang dùng thử miễn phí"
          type="info"
        />
      )}
      {currentAccess?.state === "GRACE" && (
        <Alert
          className="billing-notice"
          description={`Workspace vẫn có quyền ghi${currentAccess.graceEndsAt ? ` đến ${date.format(new Date(currentAccess.graceEndsAt))}` : " trong thời gian gia hạn"}. Gia hạn để tránh chuyển sang chỉ đọc.`}
          showIcon
          title="Thuê bao đang trong thời gian gia hạn"
          type="warning"
        />
      )}
      {currentAccess?.state === "READ_ONLY" && (
        <Alert
          className="billing-notice"
          description="Dữ liệu vẫn xem được, nhưng các thao tác tạo, sửa và xóa sẽ chỉ mở lại sau khi thuê bao được gia hạn."
          showIcon
          title="Workspace đang ở chế độ chỉ đọc"
          type="error"
        />
      )}
      {current?.scheduledPlanCode && (
        <Alert
          action={
            <Button
              loading={cancelDowngrade.isPending}
              onClick={() => cancelDowngrade.mutate()}
            >
              Hủy lựa chọn
            </Button>
          }
          className="billing-notice"
          description="Quyền hiện tại không thay đổi. Gói mới sẽ được dùng khi bạn chủ động gia hạn."
          showIcon
          title={`Lựa chọn hạ gói đã lưu: ${scheduledPlanName}`}
          type="info"
        />
      )}
      {pendingOrder && (
        <Alert
          action={
            <Button
              onClick={() => router.push(`/billing/status/${pendingOrder._id}`)}
            >
              Theo dõi thanh toán
            </Button>
          }
          className="billing-notice"
          description={`Yêu cầu sẽ hết hạn lúc ${date.format(new Date(pendingOrder.expiresAt))}.`}
          showIcon
          title={`Thanh toán đang chờ: ${pendingOrder.invoiceNumber}`}
          type="info"
        />
      )}
      <Row gutter={[18, 18]}>
        {(plans.data ?? []).map((plan) => {
          const price =
            cycle === "MONTHLY" ? plan.monthlyPriceVnd : plan.yearlyPriceVnd;
          const crossCycleBlocked = Boolean(
            active && !isTrial && current?.billingCycle !== cycle,
          );
          const lowerTier = Boolean(
            active &&
            !isTrial &&
            plan.tierLevel < (current?.currentTierLevel ?? 0),
          );
          const higherTier = Boolean(
            active &&
            !isTrial &&
            plan.tierLevel > (current?.currentTierLevel ?? 0),
          );
          const samePlan = currentPlanId === plan._id;
          const equalTierDifferentPlan = Boolean(
            active &&
            !isTrial &&
            !samePlan &&
            plan.tierLevel === current?.currentTierLevel,
          );
          const disabled = crossCycleBlocked || equalTierDifferentPlan;
          const label = isTrial
            ? "Bắt đầu trả phí"
            : lowerTier
              ? "Lưu lựa chọn hạ gói"
              : samePlan
                ? "Gia hạn"
                : higherTier
                  ? "Nâng gói"
                  : "Chọn gói";
          return (
            <Col key={plan._id} lg={8} md={12} xs={24}>
              <Card
                className={`surface-card billing-plan-card ${samePlan ? "billing-plan-card--current" : ""}`}
                extra={
                  samePlan ? <Tag color="blue">Đang sử dụng</Tag> : undefined
                }
                title={plan.name}
              >
                <Typography.Paragraph className="table-muted">
                  {plan.description || "Gói vận hành LMS theo nhu cầu tổ chức."}
                </Typography.Paragraph>
                <div className="billing-price">
                  {money.format(price)}
                  <small>/{cycle === "MONTHLY" ? "tháng" : "năm"}</small>
                </div>
                {higherTier && !crossCycleBlocked && (
                  <Typography.Text type="secondary">
                    Chi phí nâng gói được tính theo thời gian còn lại của kỳ
                    hiện tại.
                  </Typography.Text>
                )}
                <Space
                  aria-label={`Hạn mức gói ${plan.name}`}
                  className="billing-feature-list"
                  orientation="vertical"
                  size={8}
                >
                  {plan.entitlements.modules.map((module) => (
                    <span key={module}>
                      <CheckOutlined /> {lmsModuleLabels[module]}
                    </span>
                  ))}
                  <span>
                    <CheckOutlined />{" "}
                    {formatEntitlementLimit(
                      plan.entitlements.maxUsers,
                      "users",
                    )}
                  </span>
                  <span>
                    <CheckOutlined />{" "}
                    {formatEntitlementLimit(
                      plan.entitlements.maxCourses,
                      "courses",
                    )}
                  </span>
                  {plan.features.map((feature) => (
                    <span key={feature}>
                      <CheckOutlined /> {feature}
                    </span>
                  ))}
                </Space>
                <Button
                  block
                  disabled={disabled}
                  icon={<CreditCardOutlined />}
                  loading={checkout.isPending || scheduleDowngrade.isPending}
                  onClick={() =>
                    lowerTier ? confirmDowngrade(plan) : startCheckout(plan._id)
                  }
                  type={lowerTier ? "default" : "primary"}
                >
                  {label}
                </Button>
                {crossCycleBlocked && (
                  <Typography.Text type="secondary">
                    Bạn có thể đổi chu kỳ khi kỳ hiện tại kết thúc.
                  </Typography.Text>
                )}
                {equalTierDifferentPlan && (
                  <Typography.Text type="secondary">
                    Gói cùng cấp sẽ khả dụng khi kỳ hiện tại kết thúc.
                  </Typography.Text>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>
      {!plans.isLoading && !plans.data?.length && (
        <Card className="surface-card">
          <Empty description="Chưa có gói thuê bao đang mở bán" />
        </Card>
      )}
      <Card
        className="surface-card table-surface billing-history-card"
        title={
          <span>
            <HistoryOutlined /> &nbsp;Lịch sử thanh toán
          </span>
        }
      >
        <Table
          columns={columns}
          dataSource={orders.data ?? []}
          loading={orders.isLoading}
          pagination={{ pageSize: 8 }}
          rowKey="_id"
          scroll={{ x: 1050 }}
        />
      </Card>
    </div>
  );
}
