"use client";
import { describeOperationsError } from "@/lib/i18n/operations-errors";
import { useI18n } from "@/components/i18n/i18n-provider";
import { operationsMessages } from "@/lib/i18n/operations-messages";
import { useMemo as useI18nMemo } from "react";

import { useFeedback } from "@/components/feedback/feedback-provider";

import {
  CheckOutlined,
  CreditCardOutlined,
  EyeOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { listPageCount } from "@/lib/list-controls";
import { useAuth } from "@/components/providers/app-providers";
import {
  billingApi,
  submitCheckoutForm,
  type TenantOrdersQuery,
} from "@/lib/api";
import {
  formatEntitlementLimit,
  getSubscriptionAccessPresentation,
  lmsModuleLabels,
} from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import type { BillingCycle, BillingPlan, PaymentOrder } from "@/lib/types";
import { getBillingStatusPresentation } from "./billing-state";
import styles from "./billing-layout.module.css";

function BillingOnboardingNotice() {
  const { t } = useOperationsCopy();
  const searchParams = useSearchParams();
  if (searchParams.get("onboarding") !== "1") return null;
  return (
    <Alert
      className="billing-notice"
      description={t(
        "Kỳ dùng thử đã được gắn với workspace này. Bạn có thể tiếp tục dùng thử hoặc chọn một gói bên dưới; hệ thống chỉ tạo đơn khi bạn xác nhận thanh toán.",
      )}
      showIcon
      title={t("Workspace đã sẵn sàng")}
      type="success"
    />
  );
}

export default function BillingPage() {
  const {
    t,
    money,
    date,
    orderTypeLabel,
    entityId,
    lmsModuleLabels,
    getSubscriptionAccessPresentation,
    getBillingStatusPresentation,
    formatEntitlementLimit,
    locale,
  } = useOperationsCopy();
  const { message, modal, reportError } = useFeedback();
  const router = useRouter();
  const { effectiveAccess, organization, token, updateEffectiveAccess, user } =
    useAuth();
  const queryClient = useQueryClient();
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const [historyQuery, setHistoryQuery] = useState<TenantOrdersQuery>({
    page: 1,
    limit: 20,
  });
  const [historySearch, setHistorySearch] = useState("");
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
  // History filters must not hide the pending order used by checkout controls.
  const history = useQuery({
    enabled,
    queryFn: ({ signal }) =>
      billingApi.listOrdersDirectory({ token }, historyQuery, { signal }),
    queryKey: [
      ...(scope
        ? lmsQueryKeys.billingOrders(scope)
        : [...billingKey, "orders"]),
      "directory",
      historyQuery,
    ],
  });
  useEffect(() => {
    if (history.isFetching || !history.data) return;
    const lastPage = listPageCount(history.data.total, historyQuery.limit);
    if (historyQuery.page > lastPage) {
      // Synchronize pagination with the completed server query after records disappear.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHistoryQuery((current) => ({ ...current, page: lastPage }));
    }
  }, [history.data, history.isFetching, historyQuery.limit, historyQuery.page]);

  const refresh = async () =>
    queryClient.invalidateQueries({ queryKey: billingKey });
  const checkout = useMutation({
    mutationFn: (input: {
      billingCycle: BillingCycle;
      idempotencyKey: string;
      planId: string;
    }) => billingApi.createCheckout({ token }, input),
    onError: (error) => {
      reportError(error, "Không thể tạo yêu cầu thanh toán");
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
    onError: (error) => reportError(error, "Không thể mô phỏng thanh toán"),
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
    onError: (error) => reportError(error, "Không thể hẹn hạ gói"),
    onSuccess: async () => {
      message.success("Đã hẹn hạ gói; gói hiện tại vẫn giữ nguyên đến hết kỳ");
      await refresh();
    },
  });
  const cancelDowngrade = useMutation({
    mutationFn: () => billingApi.cancelScheduledDowngrade({ token }),
    onError: (error) => reportError(error, "Không thể hủy lịch hạ gói"),
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
      cancelText: t("Hủy"),
      content: t(
        "Gói hiện tại và ngày hết hạn không thay đổi. Không phát sinh thanh toán hay hoàn tiền.",
      ),
      okText: t("Hẹn hạ gói"),
      onOk: () => scheduleDowngrade.mutateAsync(plan._id),
      title: t("Lưu lựa chọn hạ xuống gói {value0}?", { value0: plan.name }),
    });
  };

  const columns: ColumnsType<PaymentOrder> = [
    {
      dataIndex: "invoiceNumber",
      key: "invoice",
      render: (value: string) => (
        <Typography.Text copyable>{value}</Typography.Text>
      ),
      title: t("Hóa đơn"),
    },
    {
      key: "plan",
      render: (_, order) => (
        <div>
          <strong>{order.planSnapshot.name}</strong>
          <div className="table-muted">
            {orderTypeLabel[order.type]} ·{" "}
            {order.planSnapshot.billingCycle === "MONTHLY"
              ? t("Theo tháng")
              : t("Theo năm")}
          </div>
        </div>
      ),
      title: t("Gói"),
    },
    {
      dataIndex: "amountVnd",
      key: "amount",
      render: (value: number) => money.format(value),
      title: t("Số tiền"),
    },
    {
      dataIndex: "status",
      key: "status",
      render: (value: PaymentOrder["status"]) => {
        const state = getBillingStatusPresentation(value);
        return <Tag color={state.color}>{state.label}</Tag>;
      },
      title: t("Trạng thái"),
    },
    {
      dataIndex: "createdAt",
      key: "created",
      render: (value?: string) => (value ? date.format(new Date(value)) : "—"),
      responsive: ["md"],
      title: t("Tạo lúc"),
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
            {t("Chi tiết")}{" "}
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
                  {t("Mô phỏng hủy")}{" "}
                </Button>
                <Button
                  loading={simulate.isPending}
                  onClick={() =>
                    simulate.mutate({ id: order._id, result: "PAID" })
                  }
                  size="small"
                  type="primary"
                >
                  {t("Mô phỏng đã thanh toán")}{" "}
                </Button>
              </>
            )}
        </Space>
      ),
      title: t("Thao tác"),
    },
  ];

  if (user?.role !== "TENANT_ADMIN") {
    return (
      <Alert
        showIcon
        title={t("Chỉ quản trị tổ chức được truy cập thanh toán thuê bao.")}
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
  const currentMaxActiveLearners = currentAccess
    ? currentAccess.limits.maxActiveLearners
    : (current?.entitlements.maxActiveLearners ?? null);
  const currentMaxBranches = currentAccess
    ? currentAccess.limits.maxBranches
    : (current?.entitlements.maxBranches ?? null);
  const accessPresentation = currentAccess
    ? getSubscriptionAccessPresentation(currentAccess.state)
    : null;
  const pendingOrder = orders.data?.find((order) => order.status === "PENDING");

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <h1>{t("Thuê bao DX LMS")}</h1>
          <p>
            {t(
              "Theo dõi gói hiện tại, chọn chu kỳ và điều chỉnh thuê bao theo nhu cầu vận hành.",
            )}{" "}
          </p>
        </div>
        <Segmented<BillingCycle>
          onChange={setCycle}
          options={[
            { label: t("Theo tháng"), value: "MONTHLY" },
            { label: t("Theo năm"), value: "YEARLY" },
          ]}
          value={cycle}
        />
      </div>
      <Suspense fallback={null}>
        <BillingOnboardingNotice />
      </Suspense>
      {error && (
        <Alert
          className="billing-notice"
          showIcon
          title={
            error instanceof Error
              ? describeOperationsError(
                  error,
                  locale,
                  t("Không tải được dữ liệu thuê bao"),
                )
              : t("Không tải được dữ liệu thuê bao")
          }
          type="error"
        />
      )}
      {!subscription.isLoading && !current && (
        <Alert
          className="billing-notice"
          description={t(
            "Chọn một gói bên dưới để cấp module và hạn mức vận hành cho workspace.",
          )}
          showIcon
          title={t("Tổ chức chưa có thuê bao")}
          type="warning"
        />
      )}
      {current && (
        <section
          className={`billing-current-summary ${styles.currentSummary}`}
          aria-label={t("Thuê bao hiện tại")}
        >
          <div>
            <span>{t("Gói hiện tại")}</span>
            <strong>{currentPlanName}</strong>
            <p>
              {isTrial ? t("Dùng thử miễn phí đến") : t("Hiệu lực đến")}{" "}
              {date.format(new Date(trialEnd ?? current.endAt))} ·{" "}
              {money.format(current.currentPriceVnd)}/
              {current.billingCycle === "MONTHLY" ? t("tháng") : t("năm")}
            </p>
            <p>
              {formatEntitlementLimit(currentMaxUsers, "users")} ·{" "}
              {formatEntitlementLimit(currentMaxCourses, "courses")}
            </p>
            <p>
              {formatEntitlementLimit(
                currentMaxActiveLearners,
                "activeLearners",
              )}{" "}
              · {formatEntitlementLimit(currentMaxBranches, "branches")}
            </p>
            <Space size={[4, 4]} wrap>
              {currentModules.map((module) => (
                <Tag key={module}>{lmsModuleLabels[module]}</Tag>
              ))}
            </Space>
          </div>
          <Space wrap>
            {isTrial && <Tag color="cyan">{t("Dùng thử miễn phí")}</Tag>}
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
          description={t(
            "Workspace đang dùng các quyền hiện được cấp theo gói {value0}. Chọn gói bên dưới để chuyển sang thuê bao trả phí trước ngày {value1}.",
            {
              value0: currentPlanName ?? "—",
              value1: date.format(new Date(trialEnd)),
            },
          )}
          showIcon
          title={t("Bạn đang dùng thử miễn phí")}
          type="info"
        />
      )}
      {currentAccess?.state === "GRACE" && (
        <Alert
          className="billing-notice"
          description={t(
            "Workspace vẫn có quyền ghi{value0}. Gia hạn để tránh chuyển sang chỉ đọc.",
            {
              value0: currentAccess.graceEndsAt
                ? t(" đến {value0}", {
                    value0: date.format(new Date(currentAccess.graceEndsAt)),
                  })
                : t(" trong thời gian gia hạn"),
            },
          )}
          showIcon
          title={t("Thuê bao đang trong thời gian gia hạn")}
          type="warning"
        />
      )}
      {currentAccess?.state === "READ_ONLY" && (
        <Alert
          className="billing-notice"
          description={t(
            "Dữ liệu vẫn xem được, nhưng các thao tác tạo, sửa và xóa sẽ chỉ mở lại sau khi thuê bao được gia hạn.",
          )}
          showIcon
          title={t("Workspace đang ở chế độ chỉ đọc")}
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
              {t("Hủy lựa chọn")}{" "}
            </Button>
          }
          className="billing-notice"
          description={t(
            "Quyền hiện tại không thay đổi. Gói mới sẽ được dùng khi bạn chủ động gia hạn.",
          )}
          showIcon
          title={t("Lựa chọn hạ gói đã lưu: {value0}", {
            value0: scheduledPlanName ?? "—",
          })}
          type="info"
        />
      )}
      {pendingOrder && (
        <Alert
          action={
            <Button
              onClick={() => router.push(`/billing/status/${pendingOrder._id}`)}
            >
              {t("Theo dõi thanh toán")}{" "}
            </Button>
          }
          className="billing-notice"
          description={t("Yêu cầu sẽ hết hạn lúc {value0}.", {
            value0: date.format(new Date(pendingOrder.expiresAt)),
          })}
          showIcon
          title={t("Thanh toán đang chờ: {value0}", {
            value0: pendingOrder.invoiceNumber,
          })}
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
            ? t("Bắt đầu trả phí")
            : lowerTier
              ? t("Lưu lựa chọn hạ gói")
              : samePlan
                ? t("Gia hạn")
                : higherTier
                  ? t("Nâng gói")
                  : t("Chọn gói");
          return (
            <Col key={plan._id} lg={8} md={12} xs={24}>
              <Card
                className={`surface-card billing-plan-card ${samePlan ? "billing-plan-card--current" : ""}`}
                extra={
                  samePlan ? (
                    <Tag color="blue">{t("Đang sử dụng")}</Tag>
                  ) : undefined
                }
                title={plan.name}
              >
                <Typography.Paragraph className="table-muted">
                  {plan.description ||
                    t("Gói vận hành LMS theo nhu cầu tổ chức.")}
                </Typography.Paragraph>
                <div className="billing-price">
                  {money.format(price)}
                  <small>/{cycle === "MONTHLY" ? t("tháng") : t("năm")}</small>
                </div>
                {higherTier && !crossCycleBlocked && (
                  <Typography.Text type="secondary">
                    {t(
                      "Chi phí nâng gói được tính theo thời gian còn lại của kỳ hiện tại.",
                    )}{" "}
                  </Typography.Text>
                )}
                <Space
                  aria-label={t("Hạn mức gói {value0}", { value0: plan.name })}
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
                  <span>
                    <CheckOutlined />{" "}
                    {formatEntitlementLimit(
                      plan.entitlements.maxActiveLearners,
                      "activeLearners",
                    )}
                  </span>
                  <span>
                    <CheckOutlined />{" "}
                    {formatEntitlementLimit(
                      plan.entitlements.maxBranches,
                      "branches",
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
                    {t("Bạn có thể đổi chu kỳ khi kỳ hiện tại kết thúc.")}{" "}
                  </Typography.Text>
                )}
                {equalTierDifferentPlan && (
                  <Typography.Text type="secondary">
                    {t(
                      "Gói cùng cấp sẽ khả dụng khi kỳ hiện tại kết thúc.",
                    )}{" "}
                  </Typography.Text>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>
      {!plans.isLoading && !plans.data?.length && (
        <Card className="surface-card">
          <Empty description={t("Chưa có gói thuê bao đang mở bán")} />
        </Card>
      )}
      <Card
        className="surface-card table-surface billing-history-card"
        title={
          <span>
            <HistoryOutlined /> {t("Lịch sử thanh toán")}{" "}
          </span>
        }
      >
        <div className="list-filter-bar">
          <Input.Search
            allowClear
            aria-label={t("Tìm mã hóa đơn")}
            placeholder={t("Tìm mã hóa đơn")}
            maxLength={100}
            value={historySearch}
            onChange={(event) => {
              setHistorySearch(event.target.value);
              if (!event.target.value)
                setHistoryQuery((current) => ({
                  ...current,
                  page: 1,
                  search: undefined,
                }));
            }}
            onSearch={(value) =>
              setHistoryQuery((current) => ({
                ...current,
                page: 1,
                search: value.trim() || undefined,
              }))
            }
          />
          <Select<PaymentOrder["status"]>
            allowClear
            aria-label={t("Trạng thái")}
            placeholder={t("Mọi trạng thái")}
            value={historyQuery.status}
            style={{ minWidth: 160 }}
            onChange={(status) =>
              setHistoryQuery((current) => ({ ...current, page: 1, status }))
            }
            options={(
              [
                "PENDING",
                "PAID",
                "CANCELED",
                "EXPIRED",
                "REVIEW_REQUIRED",
                "REFUND_REQUIRED",
              ] as const
            ).map((value) => ({
              value,
              label: getBillingStatusPresentation(value).label,
            }))}
          />
          <Select<PaymentOrder["type"]>
            allowClear
            aria-label={t("Loại đơn")}
            placeholder={t("Mọi loại đơn")}
            value={historyQuery.type}
            style={{ minWidth: 160 }}
            onChange={(type) =>
              setHistoryQuery((current) => ({ ...current, page: 1, type }))
            }
            options={(["NEW", "RENEWAL", "UPGRADE"] as const).map((value) => ({
              value,
              label: orderTypeLabel[value],
            }))}
          />
          <Button
            onClick={() => {
              setHistorySearch("");
              setHistoryQuery((current) => ({ page: 1, limit: current.limit }));
            }}
          >
            {t("Xóa bộ lọc")}
          </Button>
        </div>
        {history.error && (
          <Alert
            showIcon
            type="error"
            title={t("Không thể tải lịch sử thanh toán")}
            action={
              <Button onClick={() => void history.refetch()}>
                {t("Thử lại")}
              </Button>
            }
          />
        )}
        <Table
          className="data-table"
          columns={columns}
          dataSource={history.error ? [] : (history.data?.items ?? [])}
          loading={history.isFetching}
          pagination={{
            current: historyQuery.page,
            pageSize: historyQuery.limit,
            total: history.data?.total ?? 0,
            showSizeChanger: { "aria-label": t("Số dòng mỗi trang") },
            pageSizeOptions: [10, 20, 50, 100],
            responsive: true,
            disabled: history.isFetching,
            onChange: (page, limit) =>
              setHistoryQuery((current) => ({
                ...current,
                page: limit === current.limit ? page : 1,
                limit,
              })),
            showTotal: (total, range) =>
              t("{p0}–{p1} trên {p2} mục", {
                p0: range[0],
                p1: range[1],
                p2: total,
              }),
          }}
          rowKey="_id"
          scroll={{ x: 1050 }}
        />
      </Card>
    </div>
  );
}

function useOperationsCopy() {
  const i18n = useI18n(operationsMessages);
  return useI18nMemo(() => {
    const { t, locale } = i18n;
    const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN", {
      currency: "VND",
      maximumFractionDigits: 0,
      style: "currency",
    });

    const date = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const orderTypeLabel: Record<PaymentOrder["type"], string> = {
      NEW: t("Đăng ký mới"),
      RENEWAL: t("Gia hạn"),
      UPGRADE: t("Nâng gói"),
    };

    function entityId(
      value: string | { _id: string } | null | undefined,
    ): string | null {
      if (!value) return null;
      return typeof value === "string" ? value : value._id;
    }
    const translatedLmsModuleLabels = Object.fromEntries(
      Object.entries(lmsModuleLabels).map(([key, label]) => [key, t(label)]),
    ) as typeof lmsModuleLabels;
    const translatedGetSubscriptionAccessPresentation = (
      state: Parameters<typeof getSubscriptionAccessPresentation>[0],
    ) => {
      const presentation = getSubscriptionAccessPresentation(state);
      return {
        ...presentation,
        label: t(presentation.label),
        description: t(presentation.description),
      };
    };
    const translatedGetBillingStatusPresentation = (
      state: Parameters<typeof getBillingStatusPresentation>[0],
    ) => {
      const presentation = getBillingStatusPresentation(state);
      return {
        ...presentation,
        label: t(presentation.label),
        description: t(presentation.description),
      };
    };
    const translatedFormatEntitlementLimit = (
      value: number | null,
      resource: Parameters<typeof formatEntitlementLimit>[1],
    ) => {
      const label = t(
        {
          activeLearners: "học viên hoạt động",
          branches: "chi nhánh hoạt động",
          courses: "khóa học",
          users: "người dùng",
        }[resource],
      );
      return value === null
        ? t("Không giới hạn {resource}", { resource: label })
        : t("Tối đa {count} {resource}", {
            count: i18n.formatNumber(value),
            resource: label,
          });
    };
    return {
      ...i18n,
      lmsModuleLabels: translatedLmsModuleLabels,
      getSubscriptionAccessPresentation:
        translatedGetSubscriptionAccessPresentation,
      getBillingStatusPresentation: translatedGetBillingStatusPresentation,
      formatEntitlementLimit: translatedFormatEntitlementLimit,
      money,
      date,
      orderTypeLabel,
      entityId,
    };
  }, [i18n]);
}
