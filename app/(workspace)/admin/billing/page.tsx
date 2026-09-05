"use client";
import { describeOperationsError } from "@/lib/i18n/operations-errors";
import { useI18n } from "@/components/i18n/i18n-provider";
import { operationsMessages } from "@/lib/i18n/operations-messages";
import { workspacePolishMessages } from "@/lib/i18n/workspace-polish-messages";
import { useMemo as useI18nMemo } from "react";

import {
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { Form } from "@/components/form/localized-form";
import { ModulePicker } from "@/components/form/module-picker";
import { isFormValidationError } from "@/components/form/validation-error";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { useMemo, useRef, useState } from "react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useAuth } from "@/components/providers/app-providers";
import { ApiError, billingApi } from "@/lib/api";
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
import { listPageSizes } from "@/lib/list-controls";
const billingMessages = { ...operationsMessages, ...workspacePolishMessages };

function EntitlementDetails({
  compact = false,
  entitlements,
}: {
  compact?: boolean;
  entitlements: PlanEntitlements;
}) {
  const { t, lmsModuleLabels, formatEntitlementLimit } = useOperationsCopy();
  if (compact) return (
    <div>
      <strong>{t("{count} tính năng", { count: entitlements.modules.length })}</strong>
      <div className="table-muted">{formatEntitlementLimit(entitlements.maxUsers, "users")}</div>
      <div className="table-muted">{formatEntitlementLimit(entitlements.maxCourses, "courses")}</div>
    </div>
  );
  return (
    <Space orientation="vertical" size={4}>
      <Space size={[4, 4]} wrap>
        {entitlements.modules.map((module) => (
          <Tag key={module}>{lmsModuleLabels[module]}</Tag>
        ))}
        {!entitlements.modules.length && <Tag>{t("Không có module")}</Tag>}
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

export default function AdminBillingPage() {
  const {
    t,
    money,
    date,
    tenantView,
    formatDate,
    formatDuration,
    typeOptions,
    statusOptions,
    orderTypeLabels,
    billingCycleLabel,
    formulaLabel,
    adminOrderActionSuccessMessage,
    planMutationNeedsReview,
    lmsModuleOptions,
    getSubscriptionAccessPresentation,
    getBillingStatusPresentation,
    locale,
  } = useOperationsCopy();
  const { message, modal, reportError } = useFeedback();
  const { organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<BillingPlanFormValues>();
  const [editing, setEditing] = useState<BillingPlan | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planSubmitting, setPlanSubmitting] = useState(false);
  const planSubmissionInFlight = useRef(false);
  const planLifecycleInFlight = useRef<Promise<void> | null>(null);
  const orderActionInFlight = useRef<Promise<void> | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planSearch, setPlanSearch] = useState("");
  const [planStatus, setPlanStatus] = useState<string>();
  const [planPagination, setPlanPagination] = useState({ page: 1, size: 10 });
  const [activeTab, setActiveTab] = useState("plans");
  const [subscriptionTenantSearch, setSubscriptionTenantSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderTenantSearch, setOrderTenantSearch] = useState("");
  const [planReviewNotice, setPlanReviewNotice] = useState<Error | null>(null);
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
  const planDetail = useQuery({
    enabled: Boolean(enabled && selectedPlanId),
    queryFn: () => billingApi.adminGetPlan({ token }, selectedPlanId!),
    queryKey: [...adminKey, "plans", "detail", selectedPlanId],
  });
  const visiblePlans = (plans.data ?? []).filter(
    (plan) =>
      (!planStatus || String(plan.active) === planStatus) &&
      `${plan.name} ${plan.code}`
        .toLocaleLowerCase("vi")
        .includes(planSearch.trim().toLocaleLowerCase("vi")),
  );
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
    onError: (error) => {
      reportError(error, "Không thể lưu gói thuê bao");
      if (planMutationNeedsReview(error)) {
        setPlanModalOpen(false);
        setPlanReviewNotice(error);
      }
    },
    onSuccess: async () => {
      message.success(
        editing ? "Đã cập nhật gói thuê bao" : "Đã tạo gói thuê bao",
      );
      setPlanModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: adminKey });
    },
  });
  const submitPlan = async () => {
    if (planSubmissionInFlight.current) return;
    planSubmissionInFlight.current = true;
    setPlanSubmitting(true);
    let validated = false;
    try {
      const values = await form.validateFields();
      validated = true;
      await savePlan.mutateAsync(values);
    } catch (error) {
      if (!validated && isFormValidationError(error)) {
        const firstField = (
          error as { errorFields: Array<{ name?: Array<string | number> }> }
        ).errorFields[0]?.name;
        if (firstField?.length)
          form.scrollToField(firstField, {
            block: "nearest",
            behavior: "auto",
            focus: true,
          });
      } else if (!validated) {
        reportError(error, "Không thể lưu gói thuê bao");
      }
      // Mutation failures already have feedback and uncertainty handling in onError.
    } finally {
      planSubmissionInFlight.current = false;
      setPlanSubmitting(false);
    }
  };
  const planLocked = planSubmitting || savePlan.isPending;
  const planLifecycle = useMutation({
    mutationFn: (plan: BillingPlan) =>
      plan.active
        ? billingApi.adminDisablePlan({ token }, plan._id)
        : billingApi.adminRestorePlan({ token }, plan._id),
    onError: (error) => {
      reportError(error, "Không thể cập nhật trạng thái gói");
      if (planMutationNeedsReview(error)) setPlanReviewNotice(error);
    },
    onSuccess: async (plan) => {
      message.success(
        plan.active
          ? "Đã mở bán lại gói thuê bao"
          : "Đã ngừng bán gói thuê bao",
      );
      await queryClient.invalidateQueries({ queryKey: adminKey });
    },
  });
  const requestPlanLifecycle = (plan: BillingPlan) => {
    modal.confirm({
      cancelText: t("Hủy"),
      content: plan.active
        ? t(
            "Gói sẽ ngừng nhận đăng ký mới. Dữ liệu gói và snapshot quyền lợi của các thuê bao hiện có được giữ nguyên.",
          )
        : t(
            "Gói sẽ được mở bán trở lại với giá và quyền lợi hiện tại. Dữ liệu cũ được giữ nguyên.",
          ),
      okButtonProps: { danger: plan.active },
      okText: plan.active ? t("Ngừng bán") : t("Mở bán lại"),
      onOk: () => {
        if (planLifecycleInFlight.current) return planLifecycleInFlight.current;
        const pending = planLifecycle.mutateAsync(plan)
          .then(() => undefined)
          .catch((error) => {
            // Close an uncertain confirmation so a repeated click cannot replay it.
            if (!planMutationNeedsReview(error)) throw error;
          })
          .finally(() => { planLifecycleInFlight.current = null; });
        planLifecycleInFlight.current = pending;
        return pending;
      },
      title: t("{value0} gói {value1}?", {
        value0: plan.active ? t("Ngừng bán") : t("Mở bán lại"),
        value1: plan.name,
      }),
    });
  };
  const orderAction = useMutation({
    mutationFn: (input: {
      action: "reconcile" | "refund";
      id: string;
      reason: string;
    }) =>
      input.action === "reconcile"
        ? billingApi.adminReconcileOrder({ token }, input.id, input.reason)
        : billingApi.adminMarkRefundRequired({ token }, input.id, input.reason),
    onError: (error) => reportError(error, "Không thể xử lý đơn thanh toán"),
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
      cancelText: t("Hủy"),
      content: (
        <Input.TextArea
          autoSize={{ maxRows: 5, minRows: 3 }}
          onChange={(event) => {
            reason = event.target.value.trim();
          }}
          placeholder={t("Lý do xử lý (tối thiểu 3 ký tự)")}
        />
      ),
      okButtonProps: { danger: action === "refund" },
      okText:
        action === "reconcile"
          ? t("Thử áp dụng lại")
          : t("Đánh dấu cần hoàn tiền"),
      onOk: async () => {
        if (orderActionInFlight.current) return orderActionInFlight.current;
        if (reason.length < 3) {
          message.error("Vui lòng nhập lý do tối thiểu 3 ký tự");
          throw new Error(t("Vui lòng nhập lý do tối thiểu 3 ký tự"));
        }
        const pending = orderAction.mutateAsync({ action, id, reason })
          .then(() => undefined)
          .finally(() => { orderActionInFlight.current = null; });
        orderActionInFlight.current = pending;
        return pending;
      },
      title:
        action === "reconcile"
          ? t("Thử áp dụng lại giao dịch đã xác minh?")
          : t("Đánh dấu giao dịch cần hoàn tiền?"),
    });
  };

  const planColumns: ColumnsType<BillingPlan> = [
    {
      key: "plan",
      render: (_, plan) => (
        <div>
          <strong>{plan.name}</strong>
          <div className="table-muted">
            {plan.code} {t("· Mức")} {plan.tierLevel}
          </div>
        </div>
      ),
      title: t("Gói"),
    },
    {
      dataIndex: "monthlyPriceVnd",
      key: "month",
      render: (value: number) => money.format(value),
      title: t("Giá tháng"),
    },
    {
      dataIndex: "yearlyPriceVnd",
      key: "year",
      render: (value: number) => money.format(value),
      responsive: ["md"],
      title: t("Giá năm"),
    },
    {
      key: "entitlements",
      render: (_, plan) => (
        <EntitlementDetails compact entitlements={plan.entitlements} />
      ),
      responsive: ["lg"],
      title: t("Quyền lợi hệ thống"),
    },
    {
      dataIndex: "active",
      key: "active",
      render: (value: boolean) => (
        <Tag color={value ? "green" : "default"}>
          {value ? t("Đang bán") : t("Đã ẩn")}
        </Tag>
      ),
      title: t("Trạng thái"),
    },
    {
      align: "right",
      key: "action",
      render: (_, plan) => (
        <Space size={0} wrap>
          <Button
            aria-label={t("Xem chi tiết gói {value0}", { value0: plan.name })}
            onClick={() => setSelectedPlanId(plan._id)}
            type="link"
          >
            {t("Chi tiết")}{" "}
          </Button>
          <Button
            aria-label={t("Sửa gói {value0}", { value0: plan.name })}
            disabled={planLifecycle.isPending || Boolean(planReviewNotice)}
            onClick={() => showEdit(plan)}
            type="link"
          >
            {t("Sửa")}{" "}
          </Button>
          <Button
            aria-label={t("{value0} gói {value1}", {
              value0: plan.active ? t("Ngừng bán") : t("Mở bán lại"),
              value1: plan.name,
            })}
            danger={plan.active}
            disabled={
              planLifecycle.isPending ||
              savePlan.isPending ||
              Boolean(planReviewNotice)
            }
            loading={
              planLifecycle.isPending &&
              planLifecycle.variables?._id === plan._id
            }
            onClick={() => requestPlanLifecycle(plan)}
            type="link"
          >
            {plan.active ? t("Ngừng bán") : t("Mở bán lại")}
          </Button>
        </Space>
      ),
      title: t("Thao tác"),
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
      title: t("Tổ chức"),
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
      title: t("Gói"),
    },
    {
      dataIndex: "billingCycle",
      key: "cycle",
      render: (value: Subscription["billingCycle"]) => billingCycleLabel(value),
      title: t("Chu kỳ"),
    },
    {
      dataIndex: "endAt",
      key: "end",
      render: (value: string) => date.format(new Date(value)),
      title: t("Hết hạn"),
    },
    {
      dataIndex: "scheduledPlanCode",
      key: "scheduled",
      render: (value: string | null) =>
        value ? (planNames.get(value) ?? value) : "—",
      title: t("Hạ gói kế tiếp"),
    },
    {
      key: "entitlements",
      render: (_, item) => (
        <EntitlementDetails entitlements={item.entitlements} />
      ),
      responsive: ["xl"],
      title: t("Quyền theo thuê bao"),
    },
    {
      key: "access",
      render: (_, item) => {
        const access = getSubscriptionAccessPresentation(
          item.effectiveAccess.state,
        );
        const isTrial = Boolean(item.isTrial || item.effectiveAccess.trial);
        const trialEnd = isTrial
          ? (item.trialEndsAt ?? item.effectiveAccess.trialEndsAt ?? item.endAt)
          : null;
        return (
          <div>
            <Space size={[4, 4]} wrap>
              <Tag color={access.color}>{access.label}</Tag>
              {isTrial && <Tag color="cyan">{t("Dùng thử tự động")}</Tag>}
            </Space>
            {trialEnd && (
              <div className="table-muted">
                {t("Kết thúc")} {formatDate(trialEnd)}
              </div>
            )}
            {item.effectiveAccess.graceEndsAt && (
              <div className="table-muted">
                {t("Đến")} {formatDate(item.effectiveAccess.graceEndsAt)}
              </div>
            )}
          </div>
        );
      },
      title: t("Quyền truy cập"),
    },
  ];
  const orderColumns: ColumnsType<PaymentOrder> = [
    {
      dataIndex: "invoiceNumber",
      key: "invoice",
      render: (value: string) => (
        <Typography.Text copyable>{value}</Typography.Text>
      ),
      title: t("Mã hóa đơn"),
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
      title: t("Tổ chức"),
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
      title: t("Gói / loại"),
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
      render: (value: PaymentOrderStatus) => {
        const item = getBillingStatusPresentation(value);
        return <Tag color={item.color}>{item.label}</Tag>;
      },
      title: t("Trạng thái"),
    },
    {
      dataIndex: "transactionReference",
      key: "transaction",
      render: (value: string | null) => value ?? "—",
      title: t("Giao dịch"),
    },
    {
      align: "right",
      key: "action",
      render: (_, order) => (
        <Button
          aria-label={t("Xem chi tiết đơn {value0}", {
            value0: order.invoiceNumber,
          })}
          icon={<EyeOutlined />}
          onClick={() => setSelectedOrderId(order._id)}
          type="link"
        >
          {t("Chi tiết")}{" "}
        </Button>
      ),
      title: t("Thao tác"),
    },
  ];

  if (user?.role !== "SUPER_ADMIN")
    return (
      <Alert
        showIcon
        title={t("Bạn không có quyền quản lý thanh toán của nền tảng.")}
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
    pageSizeOptions: listPageSizes(limit),
    responsive: true,
    showLessItems: true,
    showSizeChanger: { "aria-label": t("Số dòng mỗi trang"), showSearch: false },
    showTotal: (itemTotal, range) => t("{p0}–{p1} trên {p2} mục", { p0: range[0], p1: range[1], p2: itemTotal }),
    total,
  });
  const detail = orderDetail.data;

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <h1>{t("Quản trị thuê bao")}</h1>
          <p>{t("Quản lý gói, thuê bao và thanh toán.")}</p>
        </div>
        {activeTab === "plans" && <Button
          aria-label={t("Thêm gói thuê bao")}
          disabled={Boolean(planReviewNotice)}
          icon={<PlusOutlined />}
          onClick={showCreate}
          type="primary"
        >
          {t("Thêm gói")}{" "}
        </Button>}
      </div>
      {planReviewNotice && (
        <Alert
          className="billing-notice"
          showIcon
          type="warning"
          title={t("Cần kiểm tra kết quả thay đổi gói")}
          description={t(
            "{value0} Hộp xác nhận đã đóng. Không gửi lại ngay; hãy tải lại danh sách và kiểm tra trạng thái. Nếu audit còn chờ đối soát, cần quản trị viên vận hành xử lý trước khi sửa tiếp.",
            { value0: describeOperationsError(planReviewNotice, locale) },
          )}
          action={
            <Button
              loading={plans.isFetching}
              onClick={async () => {
                const result = await plans.refetch({ cancelRefetch: false });
                if (!result.error) setPlanReviewNotice(null);
              }}
            >
              {t("Tải lại và kiểm tra")}{" "}
            </Button>
          }
        />
      )}
      {error && (
        <Alert
          className="billing-notice"
          showIcon
          title={
            error instanceof Error
              ? describeOperationsError(
                  error,
                  locale,
                  t("Không tải được dữ liệu thanh toán"),
                )
              : t("Không tải được dữ liệu thanh toán")
          }
          type="error"
        />
      )}
      <Card className="surface-card admin-billing-tabs">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              children: (
                <>
                  <div className="admin-filter-bar list-filter-bar">
                    <Input
                      allowClear
                      aria-label={t("Tìm gói thuê bao")}
                      onChange={(event) => { setPlanSearch(event.target.value); setPlanPagination((old) => ({ ...old, page: 1 })); }}
                      placeholder={t("Tên hoặc mã gói")}
                      value={planSearch}
                      style={{ width: 260 }}
                    />
                    <Select
                      allowClear
                      aria-label={t("Lọc trạng thái gói")}
                      onChange={(value) => { setPlanStatus(value); setPlanPagination((old) => ({ ...old, page: 1 })); }}
                      options={[
                        { label: t("Đang bán"), value: "true" },
                        { label: t("Đã ẩn"), value: "false" },
                      ]}
                      placeholder={t("Trạng thái")}
                      value={planStatus}
                      style={{ width: 180 }}
                    />
                    {(planSearch || planStatus) && <Button onClick={() => { setPlanSearch(""); setPlanStatus(undefined); setPlanPagination((old) => ({ ...old, page: 1 })); }}>{t("Xóa bộ lọc")}</Button>}
                  </div>
                  <Table
                    className="data-table"
                    columns={planColumns}
                    dataSource={visiblePlans}
                    loading={plans.isFetching}
                    onChange={(next) => setPlanPagination((old) => ({ page: (next.pageSize ?? old.size) !== old.size ? 1 : next.current ?? 1, size: next.pageSize ?? old.size }))}
                    pagination={{ ...pagination(planPagination.page, planPagination.size, visiblePlans.length), disabled: plans.isFetching }}
                    rowKey="_id"
                    scroll={{ x: 1060 }}
                  />
                </>
              ),
              key: "plans",
              label: t("Gói thuê bao"),
            },
            {
              children: (
                <>
                  <div className="admin-filter-bar list-filter-bar">
                    <Input.Search
                      allowClear
                      aria-label={t("Tìm theo mã tổ chức")}
                      value={subscriptionTenantSearch}
                      onChange={(event) => {
                        setSubscriptionTenantSearch(event.target.value);
                        if (!event.target.value.trim()) setSubscriptionQuery((old) => ({ ...old, page: 1, tenantId: undefined }));
                      }}
                      onSearch={(tenantId) =>
                        setSubscriptionQuery((old) => ({
                          ...old,
                          page: 1,
                          tenantId: tenantId.trim() || undefined,
                        }))
                      }
                      placeholder={t("Mã tổ chức")}
                      style={{ width: 240 }}
                    />
                    <Select
                      allowClear
                      aria-label={t("Lọc thuê bao theo trạng thái")}
                      onChange={(status) =>
                        setSubscriptionQuery((old) => ({
                          ...old,
                          page: 1,
                          status,
                        }))
                      }
                      options={[
                        { label: t("Hiệu lực"), value: "ACTIVE" },
                        { label: t("Hết hạn"), value: "EXPIRED" },
                      ]}
                      placeholder={t("Trạng thái")}
                      value={subscriptionQuery.status}
                      style={{ width: 160 }}
                    />
                    <Select
                      allowClear
                      aria-label={t("Lọc thuê bao theo chu kỳ")}
                      onChange={(billingCycle) =>
                        setSubscriptionQuery((old) => ({
                          ...old,
                          billingCycle,
                          page: 1,
                        }))
                      }
                      options={[
                        { label: t("Theo tháng"), value: "MONTHLY" },
                        { label: t("Theo năm"), value: "YEARLY" },
                      ]}
                      placeholder={t("Chu kỳ")}
                      value={subscriptionQuery.billingCycle}
                      style={{ width: 140 }}
                    />
                    {(subscriptionTenantSearch || subscriptionQuery.tenantId || subscriptionQuery.status || subscriptionQuery.billingCycle) && <Button onClick={() => { setSubscriptionTenantSearch(""); setSubscriptionQuery((old) => ({ page: 1, limit: old.limit })); }}>{t("Xóa bộ lọc")}</Button>}
                  </div>
                  <Table
                    className="data-table"
                    columns={subscriptionColumns}
                    dataSource={subscriptions.data?.items ?? []}
                    loading={subscriptions.isFetching}
                    onChange={(next) =>
                      setSubscriptionQuery((old) => ({
                        ...old,
                        limit: next.pageSize ?? old.limit,
                        page: (next.pageSize ?? old.limit) !== old.limit ? 1 : next.current ?? 1,
                      }))
                    }
                    pagination={{ ...pagination(
                      subscriptionQuery.page,
                      subscriptionQuery.limit,
                      subscriptions.data?.total,
                    ), disabled: subscriptions.isFetching }}
                    rowKey="_id"
                    scroll={{ x: 1260 }}
                  />
                </>
              ),
              key: "subscriptions",
              label: t("Thuê bao tổ chức"),
            },
            {
              children: (
                <>
                  <div className="admin-filter-bar list-filter-bar">
                    <Input.Search
                      allowClear
                      aria-label={t("Tìm theo mã hóa đơn")}
                      value={orderSearch}
                      onChange={(event) => { setOrderSearch(event.target.value); if (!event.target.value.trim()) setOrderQuery((old) => ({ ...old, page: 1, search: undefined })); }}
                      onSearch={(search) =>
                        setOrderQuery((old) => ({
                          ...old,
                          page: 1,
                          search: search.trim() || undefined,
                        }))
                      }
                      placeholder={t("Tìm mã hóa đơn")}
                      style={{ width: 220 }}
                    />
                    <Input.Search
                      allowClear
                      aria-label={t("Tìm đơn theo mã tổ chức")}
                      value={orderTenantSearch}
                      onChange={(event) => { setOrderTenantSearch(event.target.value); if (!event.target.value.trim()) setOrderQuery((old) => ({ ...old, page: 1, tenantId: undefined })); }}
                      onSearch={(tenantId) =>
                        setOrderQuery((old) => ({
                          ...old,
                          page: 1,
                          tenantId: tenantId.trim() || undefined,
                        }))
                      }
                      placeholder={t("Mã tổ chức")}
                      style={{ width: 220 }}
                    />
                    <Select
                      allowClear
                      aria-label={t("Lọc đơn theo trạng thái")}
                      onChange={(status) =>
                        setOrderQuery((old) => ({ ...old, page: 1, status }))
                      }
                      options={statusOptions}
                      placeholder={t("Trạng thái")}
                      value={orderQuery.status}
                      style={{ width: 180 }}
                    />
                    <Select
                      allowClear
                      aria-label={t("Lọc theo loại đơn")}
                      onChange={(type) =>
                        setOrderQuery((old) => ({ ...old, page: 1, type }))
                      }
                      options={typeOptions}
                      placeholder={t("Loại đơn")}
                      value={orderQuery.type}
                      style={{ width: 150 }}
                    />
                    {(orderSearch || orderTenantSearch || orderQuery.search || orderQuery.tenantId || orderQuery.status || orderQuery.type) && <Button onClick={() => { setOrderSearch(""); setOrderTenantSearch(""); setOrderQuery((old) => ({ page: 1, limit: old.limit })); }}>{t("Xóa bộ lọc")}</Button>}
                    <Button
                      aria-label={t("Tải lại danh sách đơn thanh toán")}
                      icon={<ReloadOutlined />}
                      loading={orders.isFetching}
                      onClick={() => void orders.refetch({ cancelRefetch: false })}
                    >
                      {t("Tải lại")}{" "}
                    </Button>
                  </div>
                  <Table
                    className="data-table"
                    columns={orderColumns}
                    dataSource={orders.data?.items ?? []}
                    loading={orders.isFetching}
                    onChange={(next) =>
                      setOrderQuery((old) => ({
                        ...old,
                        limit: next.pageSize ?? old.limit,
                        page: (next.pageSize ?? old.limit) !== old.limit ? 1 : next.current ?? 1,
                      }))
                    }
                    pagination={{ ...pagination(
                      orderQuery.page,
                      orderQuery.limit,
                      orders.data?.total,
                    ), disabled: orders.isFetching }}
                    rowKey="_id"
                    scroll={{ x: 1120 }}
                  />
                </>
              ),
              key: "orders",
              label: t("Đơn thanh toán"),
            },
          ]}
        />
      </Card>

      <Modal
        footer={null}
        onCancel={() => setSelectedPlanId(null)}
        open={Boolean(selectedPlanId)}
        title={t("Chi tiết gói thuê bao")}
        width={720}
      >
        {planDetail.isPending ? (
          <p role="status">{t("Đang tải chi tiết gói…")}</p>
        ) : planDetail.error ? (
          <Alert
            showIcon
            title={
              planDetail.error instanceof Error
                ? describeOperationsError(
                    planDetail.error,
                    locale,
                    t("Không tải được chi tiết gói"),
                  )
                : t("Không tải được chi tiết gói")
            }
            type="error"
          />
        ) : planDetail.data ? (
          <Descriptions bordered column={1}>
            <Descriptions.Item label={t("Tên gói")}>
              {planDetail.data.name}
            </Descriptions.Item>
            <Descriptions.Item label={t("Mã gói")}>
              {planDetail.data.code}
            </Descriptions.Item>
            <Descriptions.Item label="ID">
              {planDetail.data._id}
            </Descriptions.Item>
            <Descriptions.Item label={t("Trạng thái")}>
              {planDetail.data.active ? t("Đang bán") : t("Đã ẩn")}
            </Descriptions.Item>
            <Descriptions.Item label={t("Mức gói")}>
              {planDetail.data.tierLevel}
            </Descriptions.Item>
            <Descriptions.Item label={t("Giá tháng / năm")}>
              {money.format(planDetail.data.monthlyPriceVnd)} /{" "}
              {money.format(planDetail.data.yearlyPriceVnd)}
            </Descriptions.Item>
            <Descriptions.Item label={t("Mô tả")}>
              {planDetail.data.description || "—"}
            </Descriptions.Item>
            <Descriptions.Item label={t("Quyền lợi")}>
              <EntitlementDetails entitlements={planDetail.data.entitlements} />
            </Descriptions.Item>
            <Descriptions.Item label={t("Tính năng")}>
              {planDetail.data.features.join(" · ") || "—"}
            </Descriptions.Item>
            <Descriptions.Item label={t("Tạo lúc")}>
              {formatDate(planDetail.data.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label={t("Cập nhật lúc")}>
              {formatDate(planDetail.data.updatedAt)}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
      <Modal
        cancelText={t("Hủy")}
        cancelButtonProps={{ disabled: planLocked }}
        className="admin-form-modal"
        closable={!planLocked}
        confirmLoading={planLocked}
        keyboard={!planLocked}
        mask={{ closable: !planLocked }}
        okButtonProps={{ disabled: planLocked }}
        okText={editing ? t("Lưu thay đổi") : t("Tạo gói")}
        onCancel={() => {
          if (!planSubmissionInFlight.current) setPlanModalOpen(false);
        }}
        onOk={() => void submitPlan()}
        open={planModalOpen}
        title={editing ? t("Cập nhật gói") : t("Tạo gói thuê bao")}
        width={720}
      >
        <Form
          className="admin-entity-form"
          disabled={savePlan.isPending}
          form={form}
          layout="vertical"
          requiredMark
          style={{ marginTop: 20 }}
        >
          <section className="form-section">
            <h3 className="form-section-title">{t("Thông tin gói")}</h3>
            <div className="form-field-grid">
              <Form.Item
                label={t("Tên gói")}
                name="name"
                rules={[{ min: 2, required: true, whitespace: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label={t("Mã gói")}
                name="code"
                rules={[
                  { pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, required: true },
                ]}
              >
                <Input placeholder="standard" />
              </Form.Item>
            </div>
            <Form.Item
              extra={t(
                "Mức thấp đến cao được dùng để xác định thao tác nâng hoặc hạ gói.",
              )}
              label={t("Mức gói")}
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
            <Form.Item label={t("Mô tả")} name="description">
              <Input.TextArea rows={2} />
            </Form.Item>
          </section>
          <section className="form-section">
            <h3 className="form-section-title">{t("Giá dịch vụ")}</h3>
            <div className="form-field-grid">
              <Form.Item
                label={t("Giá tháng (VND)")}
                name="monthlyPriceVnd"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} precision={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item
                label={t("Giá năm (VND)")}
                name="yearlyPriceVnd"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} precision={0} style={{ width: "100%" }} />
              </Form.Item>
            </div>
          </section>
          <section className="form-section">
            <h3 className="form-section-title">{t("Giới hạn sử dụng")}</h3>
            <div className="form-field-grid">
              <Form.Item
                extra={t("Để trống nếu không giới hạn số chi nhánh hoạt động.")}
                label={t("Số chi nhánh hoạt động tối đa")}
                name={["entitlements", "maxBranches"]}
              >
                <InputNumber
                  min={1}
                  placeholder={t("Không giới hạn")}
                  precision={0}
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item
                extra={t("Để trống nếu không giới hạn số học viên hoạt động.")}
                label={t("Số học viên hoạt động tối đa")}
                name={["entitlements", "maxActiveLearners"]}
              >
                <InputNumber
                  min={1}
                  placeholder={t("Không giới hạn")}
                  precision={0}
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item
                extra={t("Để trống nếu không giới hạn.")}
                label={t("Số người dùng tối đa")}
                name={["entitlements", "maxUsers"]}
              >
                <InputNumber
                  min={1}
                  placeholder={t("Không giới hạn")}
                  precision={0}
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item
                extra={t("Để trống nếu không giới hạn.")}
                label={t("Số khóa học tối đa")}
                name={["entitlements", "maxCourses"]}
              >
                <InputNumber
                  min={1}
                  placeholder={t("Không giới hạn")}
                  precision={0}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </div>
          </section>
          <section className="form-section">
            <Form.Item
              extra={t("Tính năng phụ thuộc sẽ được tự động chọn.")}
              label={t("Tính năng trong gói")}
              name={["entitlements", "modules"]}
              normalize={(modules: LmsModule[] | undefined) =>
                includeLmsModulePrerequisites(modules ?? [])
              }
              rules={[
                { required: true, message: t("Chọn ít nhất một module") },
              ]}
            >
              <ModulePicker
                aria-label={t("Tính năng trong gói")}
                disabled={savePlan.isPending}
                options={lmsModuleOptions}
              />
            </Form.Item>
            <Form.Item
              extra={t("Mỗi dòng là một quyền lợi.")}
              label={t("Quyền lợi")}
              name="featuresText"
            >
              <Input.TextArea rows={4} />
            </Form.Item>
            <Form.Item
              label={t("Đang mở bán")}
              name="active"
              valuePropName="checked"
            >
              <Switch aria-label={t("Cho phép mở bán gói")} />
            </Form.Item>
          </section>
        </Form>
      </Modal>

      <Modal
        footer={null}
        onCancel={() => setSelectedOrderId(null)}
        open={Boolean(selectedOrderId)}
        title={t("Chi tiết đơn thanh toán")}
        width={860}
      >
        {orderDetail.isFetching ? <Spin aria-label={t("Đang tải")} /> : null}
        {orderDetail.error && (
          <Alert
            showIcon
            title={
              orderDetail.error instanceof Error
                ? describeOperationsError(
                    orderDetail.error,
                    locale,
                    t("Không tải được đơn thanh toán"),
                  )
                : t("Không tải được đơn thanh toán")
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
              <Descriptions.Item label={t("Mã hóa đơn")}>
                {detail.order.invoiceNumber}
              </Descriptions.Item>
              <Descriptions.Item label={t("Trạng thái")}>
                <Tag
                  color={
                    getBillingStatusPresentation(detail.order.status).color
                  }
                >
                  {getBillingStatusPresentation(detail.order.status).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t("Loại")}>
                {orderTypeLabels[detail.order.type]}
              </Descriptions.Item>
              <Descriptions.Item label={t("Số tiền")}>
                {money.format(detail.order.amountVnd)}
              </Descriptions.Item>
              <Descriptions.Item label={t("Gói")}>
                {detail.order.planSnapshot.name}
              </Descriptions.Item>
              <Descriptions.Item label={t("Quyền trong đơn")} span={2}>
                <EntitlementDetails
                  entitlements={detail.order.planSnapshot.entitlements}
                />
              </Descriptions.Item>
              <Descriptions.Item label={t("Tổ chức")}>
                {tenantView(detail.order.tenantId).name ??
                  tenantView(detail.order.tenantId).id}
              </Descriptions.Item>
              <Descriptions.Item label={t("Mã giao dịch (đã ẩn bớt)")}>
                {detail.order.transactionReference ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label={t("Cách tính phí")}>
                {formulaLabel(detail.order.planSnapshot.formula)}
              </Descriptions.Item>
              <Descriptions.Item label={t("Hạn thanh toán")}>
                {date.format(new Date(detail.order.expiresAt))}
              </Descriptions.Item>
              <Descriptions.Item label={t("Gói trước đó")}>
                {detail.order.planSnapshot.sourcePlanCode
                  ? (planNames.get(detail.order.planSnapshot.sourcePlanCode) ??
                    detail.order.planSnapshot.sourcePlanCode)
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label={t("Giá nguồn")}>
                {detail.order.planSnapshot.sourcePriceVnd == null
                  ? "—"
                  : money.format(detail.order.planSnapshot.sourcePriceVnd)}
              </Descriptions.Item>
              <Descriptions.Item label={t("Chu kỳ trước đó")}>
                {billingCycleLabel(
                  detail.order.planSnapshot.sourceBillingCycle,
                )}
              </Descriptions.Item>
              <Descriptions.Item label={t("Kỳ trước bắt đầu")}>
                {formatDate(
                  detail.order.planSnapshot.sourceCurrentPeriodStartAt,
                )}
              </Descriptions.Item>
              <Descriptions.Item label={t("Kỳ trước kết thúc")}>
                {formatDate(detail.order.planSnapshot.sourceEndAt)}
              </Descriptions.Item>
              <Descriptions.Item label={t("Chênh lệch giá")}>
                {detail.order.planSnapshot.priceDifferenceVnd == null
                  ? "—"
                  : money.format(detail.order.planSnapshot.priceDifferenceVnd)}
              </Descriptions.Item>
              <Descriptions.Item label={t("Thời gian còn lại trong kỳ")}>
                {formatDuration(detail.order.planSnapshot.remainingMs)}
              </Descriptions.Item>
              <Descriptions.Item label={t("Độ dài kỳ thanh toán")}>
                {formatDuration(detail.order.planSnapshot.fullPeriodMs)}
              </Descriptions.Item>
              <Descriptions.Item label={t("Xác minh thanh toán")}>
                {formatDate(detail.order.paymentCapturedAt)}
              </Descriptions.Item>
              <Descriptions.Item label={t("Áp dụng thuê bao")}>
                {formatDate(detail.order.subscriptionAppliedAt)}
              </Descriptions.Item>
              <Descriptions.Item label={t("Ghi nhận đã thanh toán")}>
                {formatDate(detail.order.paidAt)}
              </Descriptions.Item>
              {detail.order.reviewReason && (
                <Descriptions.Item label={t("Lý do cần kiểm tra")} span={2}>
                  {detail.order.reviewReason}
                </Descriptions.Item>
              )}
            </Descriptions>
            {detail.order.status === "REVIEW_REQUIRED" && (
              <Space className="admin-billing-detail-actions" wrap>
                <Button
                  aria-label={t("Áp dụng lại giao dịch vào thuê bao")}
                  icon={<ReloadOutlined />}
                  disabled={orderAction.isPending}
                  loading={orderAction.isPending && orderAction.variables?.action === "reconcile"}
                  onClick={() => requestAction("reconcile")}
                  type="primary"
                >
                  {t("Áp dụng lại")}{" "}
                </Button>
                <Button
                  aria-label={t("Đánh dấu giao dịch cần hoàn tiền")}
                  danger
                  icon={<WarningOutlined />}
                  disabled={orderAction.isPending}
                  loading={orderAction.isPending && orderAction.variables?.action === "refund"}
                  onClick={() => requestAction("refund")}
                >
                  {t("Đánh dấu cần hoàn tiền")}{" "}
                </Button>
              </Space>
            )}
            <Divider>{t("Diễn biến thanh toán")}</Divider>
            <TimelineList events={detail.events} />
            <Divider>{t("Lịch sử xử lý của quản trị viên")}</Divider>
            <AuditList audits={detail.audits} />
          </>
        )}
      </Modal>
    </div>
  );
}

function TimelineList({ events }: { events: PaymentEventTimeline[] }) {
  const { t, date, eventStatusLabels } = useOperationsCopy();
  if (events.length === 0)
    return (
      <Typography.Text type="secondary">
        {t("Chưa có cập nhật từ cổng thanh toán.")}{" "}
      </Typography.Text>
    );

  return (
    <ul
      aria-label={t("Diễn biến thanh toán")}
      className="admin-billing-history-list"
    >
      {events.map((event) => (
        <li className="admin-billing-history-item" key={event._id}>
          <strong>{t("Cập nhật từ cổng thanh toán")}</strong>
          <Space orientation="vertical" size={4}>
            <span>
              {eventStatusLabels[event.status]} ·{" "}
              {event.processedAt
                ? t("Xử lý lúc {value0}", {
                    value0: date.format(new Date(event.processedAt)),
                  })
                : t("Đang chờ xử lý")}
            </span>
            <details className="admin-billing-technical-details">
              <summary>{t("Chi tiết kỹ thuật")}</summary>
              <span className="admin-billing-history-meta">
                {t("Loại thông báo:")} {event.notificationType}
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
  const { t, date, auditActionLabels, getBillingStatusPresentation } =
    useOperationsCopy();
  if (audits.length === 0)
    return (
      <Typography.Text type="secondary">
        {t("Chưa có lịch sử xử lý.")}
      </Typography.Text>
    );

  return (
    <ul
      aria-label={t("Lịch sử xử lý của quản trị viên")}
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

function useOperationsCopy() {
  const i18n = useI18n(billingMessages);
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
      if (totalMinutes < 1) return t("Dưới 1 phút");
      const days = Math.floor(totalMinutes / 1_440);
      const hours = Math.floor((totalMinutes % 1_440) / 60);
      const minutes = totalMinutes % 60;
      return [
        days ? t("{value0} ngày", { value0: days }) : "",
        hours ? t("{value0} giờ", { value0: hours }) : "",
        !days && minutes ? t("{value0} phút", { value0: minutes }) : "",
      ]
        .filter(Boolean)
        .join(" ");
    }

    const typeOptions: Array<{ label: string; value: PaymentOrderType }> = [
      { label: t("Mua mới"), value: "NEW" },
      { label: t("Gia hạn"), value: "RENEWAL" },
      { label: t("Nâng gói"), value: "UPGRADE" },
    ];

    const eventStatusLabels: Record<PaymentEventTimeline["status"], string> = {
      PROCESSED: t("Đã xử lý"),
      RECEIVED: t("Đã tiếp nhận"),
    };

    const auditActionLabels: Record<BillingAuditEntry["action"], string> = {
      MARK_REFUND_REQUIRED: t("Đánh dấu cần hoàn tiền"),
      RECONCILE: t("Áp dụng lại giao dịch"),
    };

    function billingCycleLabel(
      value: Subscription["billingCycle"] | null,
    ): string {
      if (!value) return "—";
      return value === "MONTHLY" ? t("Theo tháng") : t("Theo năm");
    }

    function formulaLabel(
      value: PaymentOrder["planSnapshot"]["formula"],
    ): string {
      return value === "FULL"
        ? t("Tính trọn kỳ")
        : t("Tính phần chênh lệch khi nâng gói");
    }

    function adminOrderActionSuccessMessage(
      status: PaymentOrderStatus,
    ): string {
      if (status === "PAID")
        return t("Đã áp dụng giao dịch và cập nhật thuê bao");
      // The feedback catalog translates this allowlisted status template together.
      return `Đã cập nhật đơn thanh toán sang trạng thái “${getBillingStatusPresentation(status).label}”`;
    }

    function planMutationNeedsReview(error: unknown): boolean {
      return (
        error instanceof ApiError &&
        (error.status === 0 ||
          error.status >= 500 ||
          error.code === "PLAN_AUDIT_PENDING")
      );
    }
    const statusOptions = [
      "PENDING",
      "PAID",
      "CANCELED",
      "EXPIRED",
      "REVIEW_REQUIRED",
      "REFUND_REQUIRED",
    ].map((value) => ({
      label: t(getBillingStatusPresentation(value as PaymentOrderStatus).label),
      value: value as PaymentOrderStatus,
    }));
    const orderTypeLabels = Object.fromEntries(
      typeOptions.map(({ label, value }) => [value, label]),
    ) as Record<PaymentOrderType, string>;
    const translatedLmsModuleLabels = Object.fromEntries(
      Object.entries(lmsModuleLabels).map(([key, label]) => [key, t(label)]),
    ) as typeof lmsModuleLabels;
    const translatedLmsModuleOptions = lmsModuleOptions.map((option) => ({
      ...option,
      label: t(option.label),
    }));
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
      lmsModuleOptions: translatedLmsModuleOptions,
      getSubscriptionAccessPresentation:
        translatedGetSubscriptionAccessPresentation,
      getBillingStatusPresentation: translatedGetBillingStatusPresentation,
      formatEntitlementLimit: translatedFormatEntitlementLimit,
      money,
      date,
      tenantView,
      formatDate,
      formatDuration,
      typeOptions,
      statusOptions,
      orderTypeLabels,
      eventStatusLabels,
      auditActionLabels,
      billingCycleLabel,
      formulaLabel,
      adminOrderActionSuccessMessage,
      planMutationNeedsReview,
    };
  }, [i18n]);
}
