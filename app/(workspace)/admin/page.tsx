"use client";
import { describeOperationsError } from "@/lib/i18n/operations-errors";
import { useI18n } from "@/components/i18n/i18n-provider";
import { operationsMessages } from "@/lib/i18n/operations-messages";
import { workspacePolishMessages } from "@/lib/i18n/workspace-polish-messages";
import { useMemo as useI18nMemo } from "react";

import {
  ApartmentOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Skeleton,
  Tag,
} from "antd";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import { DataTable } from "@/components/table/data-table";
import {
  adminCrmApi,
  adminCrmQueryKeys,
  type AdminCrmAccessState,
  type AdminCrmActivity,
  type AdminCrmDashboard,
  type AdminCrmQuery,
  type AdminCrmTenant,
} from "@/lib/admin-crm-api";
import { getViewerScope } from "@/lib/query-keys";
const crmMessages = { ...operationsMessages, ...workspacePolishMessages };

export default function AdminCrmPage() {
  const {
    t,
    currency,
    compactNumber,
    shortDate,
    accessPresentation,
    safeDate,
    tenantAccessTag,
    activityCopy,
    locale,
  } = useOperationsCopy();
  const { organization, token, user } = useAuth();
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState<AdminCrmQuery>({ limit: 12, page: 1 });
  const scope = useMemo(
    () => getViewerScope(user, organization),
    [organization, user],
  );
  const enabled = Boolean(token && scope && user?.role === "SUPER_ADMIN");
  const dashboard = useQuery<AdminCrmDashboard>({
    enabled,
    placeholderData: (previous) => previous,
    queryFn: ({ signal }) => adminCrmApi.overview(token, query, { signal }),
    queryKey: scope
      ? adminCrmQueryKeys.overview(scope, query)
      : ["lms", "signed-out", "admin-crm"],
  });

  const columns = useMemo<ColumnDef<StockFeatures, AdminCrmTenant>[]>(
    () => [
      {
        accessorKey: "name",
        cell: ({ row }) => (
          <div className="table-primary-cell">
            <strong>{row.original.name}</strong>
            <div className="table-muted">{row.original.slug}</div>
          </div>
        ),
        header: t("Tổ chức"),
      },
      {
        accessorKey: "accessState",
        cell: ({ getValue }) =>
          tenantAccessTag(getValue<AdminCrmAccessState>()),
        header: t("Truy cập"),
        meta: { width: 150 },
      },
      {
        accessorKey: "memberCount",
        cell: ({ getValue }) => compactNumber.format(getValue<number>()),
        header: t("Thành viên"),
        meta: { responsive: ["md"], width: 110 },
      },
      {
        accessorKey: "subscription",
        cell: ({ row }) => (
          <div className="table-primary-cell">
            <strong>{row.original.subscription?.planCode ?? "—"}</strong>
            <div className="table-muted">
              {row.original.subscription
                ? t("{value0} · hết hạn {value1}", {
                    value0:
                      row.original.subscription.billingCycle === "MONTHLY"
                        ? t("Theo tháng")
                        : t("Theo năm"),
                    value1: shortDate.format(
                      new Date(row.original.subscription.endAt),
                    ),
                  })
                : t("Chưa có thuê bao")}
            </div>
          </div>
        ),
        header: t("Gói hiện tại"),
        meta: { responsive: ["lg"], width: 230 },
      },
      {
        accessorKey: "revenueVnd",
        cell: ({ getValue }) => currency.format(getValue<number>()),
        header: t("Đã thu"),
        meta: { responsive: ["md"], width: 150 },
      },
      {
        accessorKey: "status",
        cell: ({ getValue }) => {
          const value = getValue<AdminCrmTenant["status"]>();
          return (
            <Tag color={value === "ACTIVE" ? "green" : "red"}>
              {value === "ACTIVE" ? t("Hoạt động") : t("Tạm khóa")}
            </Tag>
          );
        },
        header: t("Trạng thái"),
        meta: { width: 110 },
      },
    ],
    [compactNumber, currency, shortDate, t, tenantAccessTag],
  );

  if (user?.role !== "SUPER_ADMIN") {
    return (
      <Alert
        showIcon
        title={t("Khu vực CRM chỉ dành cho quản trị viên nền tảng.")}
        type="warning"
      />
    );
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery((current) => ({
      ...current,
      page: 1,
      search: searchInput.trim() || undefined,
    }));
  };
  const data = dashboard.data;
  const error =
    dashboard.error instanceof Error
      ? describeOperationsError(dashboard.error, locale, "")
      : "";

  return (
    <main className="admin-crm-page page-shell">
      <header className="page-heading admin-crm-heading">
        <div className="page-heading-copy">
          <h1>{t("Tổng quan CRM")}</h1>
          <p>{t("Theo dõi tổ chức, thuê bao và thanh toán.")}</p>
        </div>
        <div className="page-actions">
          <Button onClick={() => router.push("/admin/tenants")}>
            {t("Quản lý tổ chức")}{" "}
          </Button>
          <Button
            icon={<DollarOutlined />}
            onClick={() => router.push("/admin/billing")}
            type="primary"
          >
            {t("Thuê bao & thanh toán")}{" "}
          </Button>
        </div>
      </header>

      {error && (
        <Alert
          action={
            <Button
              icon={<ReloadOutlined />}
              loading={dashboard.isFetching}
              onClick={() => void dashboard.refetch()}
              size="small"
            >
              {t("Thử lại")}{" "}
            </Button>
          }
          className="dashboard-alert"
          showIcon
          title={error}
          type="error"
        />
      )}

      {!data && dashboard.isPending ? (
        <Skeleton active paragraph={{ rows: 12 }} />
      ) : (
        data && (
            <section aria-label={t("Chỉ số CRM")} className="admin-crm-metrics">
              <Row gutter={[16, 16]}>
                <CrmMetric
                  detail={t("{value0} hoạt động · {value1} tạm khóa", {
                    value0: data.metrics.activeTenants,
                    value1: data.metrics.suspendedTenants,
                  })}
                  icon={<ApartmentOutlined />}
                  label={t("Tổng tổ chức")}
                  value={compactNumber.format(data.metrics.totalTenants)}
                />
                <CrmMetric
                  detail={t("{value0} thuê bao trả phí hiệu lực", {
                    value0: data.metrics.activeSubscriptions,
                  })}
                  icon={<CheckCircleOutlined />}
                  label={t("Đang dùng thử")}
                  value={compactNumber.format(data.metrics.trialWorkspaces)}
                />
                <CrmMetric
                  detail={t("{value0} đơn đã thanh toán · tổng {value1}", {
                    value0: data.metrics.paidOrders,
                    value1: currency.format(data.metrics.grossRevenueVnd),
                  })}
                  icon={<DollarOutlined />}
                  label={t("Doanh thu 30 ngày")}
                  value={currency.format(data.metrics.recentRevenueVnd)}
                  wideOnMobile
                />
                <CrmMetric
                  detail={t("Đối soát hoặc hoàn tiền")}
                  icon={<ExclamationCircleOutlined />}
                  label={t("Cần xử lý")}
                  tone={data.metrics.reviewOrders ? "danger" : "default"}
                  value={compactNumber.format(data.metrics.reviewOrders)}
                  wideOnMobile
                />
              </Row>
              <div className="admin-crm-secondary-summary" aria-label={t("Thông tin bổ sung")}>
                <span>{t("{members} thành viên hoạt động", { members: compactNumber.format(data.metrics.activeMembers) })}</span>
                <span>{t("{readOnly} chỉ đọc · {grace} đang gia hạn", { readOnly: compactNumber.format(data.metrics.readOnlyWorkspaces), grace: compactNumber.format(data.metrics.graceWorkspaces) })}</span>
              </div>
            </section>
        )
      )}
            <section className="admin-crm-grid">
              <Card
                className="surface-card table-surface admin-crm-tenants"
                title={t("Tình trạng tổ chức")}
              >
                <form
                  className="admin-filter-bar admin-crm-filter list-filter-bar"
                  onSubmit={submitSearch}
                >
                  <Input
                    allowClear
                    aria-label={t("Tìm tổ chức")}
                    maxLength={100}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSearchInput(value);
                      if (!value.trim()) {
                        setQuery((current) => ({ ...current, page: 1, search: undefined }));
                      }
                    }}
                    placeholder={t("Tên hoặc mã tổ chức")}
                    prefix={<SearchOutlined />}
                    value={searchInput}
                  />
                  <Select
                    allowClear
                    aria-label={t("Lọc trạng thái tổ chức")}
                    onChange={(status) =>
                      setQuery((current) => ({
                        ...current,
                        page: 1,
                        status,
                      }))
                    }
                    options={[
                      { label: t("Đang hoạt động"), value: "ACTIVE" },
                      { label: t("Tạm khóa"), value: "SUSPENDED" },
                    ]}
                    placeholder={t("Trạng thái tổ chức")}
                    value={query.status}
                  />
                  <Select
                    allowClear
                    aria-label={t("Lọc trạng thái truy cập")}
                    onChange={(access) =>
                      setQuery((current) => ({
                        ...current,
                        access,
                        page: 1,
                      }))
                    }
                    options={Object.entries(accessPresentation).map(
                      ([value, presentation]) => ({
                        label: presentation.label,
                        value,
                      }),
                    )}
                    placeholder={t("Trạng thái truy cập")}
                    value={query.access}
                  />
                  <Button htmlType="submit" loading={dashboard.isFetching}>
                    {t("Tìm kiếm")}{" "}
                  </Button>
                  {(searchInput || query.search || query.status || query.access) ? (
                    <Button onClick={() => {
                      setSearchInput("");
                      setQuery((current) => ({ limit: current.limit, page: 1 }));
                    }}>
                      {t("Xóa bộ lọc")}
                    </Button>
                  ) : null}
                </form>
                {!dashboard.isError && (
                <DataTable
                  ariaLabel={t("Danh sách tổ chức")}
                  columns={columns}
                  data={data?.tenants.items ?? []}
                  emptyText={t(query.search || query.status || query.access ? "Không tìm thấy tổ chức phù hợp" : "Chưa có tổ chức")}
                  loading={dashboard.isFetching}
                  onPageChange={(page, limit) =>
                    setQuery((current) => ({ ...current, limit, page: limit === current.limit ? page : 1 }))
                  }
                  page={query.page}
                  pageSize={query.limit}
                  rowKey="id"
                  scrollX={920}
                  total={data?.tenants.total ?? 0}
                />
                )}
              </Card>

              {data && !dashboard.isError && (
              <Card
                className="surface-card admin-crm-activity"
                title={t("Hoạt động gần đây")}
              >
                {data.recentActivity.length ? (
                  <ol className="admin-crm-activity-list">
                    {data.recentActivity.map((activity) => {
                      const copy = activityCopy(activity);
                      return (
                        <li key={activity.id}>
                          <span
                            aria-hidden="true"
                            className={`admin-crm-activity-dot admin-crm-activity-dot--${copy.tone}`}
                          />
                          <div>
                            <div className="admin-crm-activity-title">
                              <strong>{activity.tenant.name}</strong>
                              <Tag color={copy.tone}>{copy.label}</Tag>
                            </div>
                            <p>
                              {activity.amountVnd !== null
                                ? currency.format(activity.amountVnd)
                                : `/${activity.tenant.slug}`}
                            </p>
                            <time dateTime={activity.occurredAt}>
                              {safeDate(activity.occurredAt)}
                            </time>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <Empty description={t("Chưa có hoạt động gần đây")} />
                )}
              </Card>
              )}
            </section>
    </main>
  );
}

function CrmMetric({
  detail,
  icon,
  label,
  tone = "default",
  value,
  wideOnMobile = false,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  tone?: "danger" | "default" | "warning";
  value: string;
  wideOnMobile?: boolean;
}) {
  return (
    <Col xl={6} md={12} xs={wideOnMobile ? 24 : 12}>
      <Card
        className={`surface-card admin-crm-metric admin-crm-metric--${tone}`}
      >
        <div className="admin-crm-metric-heading">
          <span>{label}</span>
          <span aria-hidden="true" className="admin-crm-metric-icon">
            {icon}
          </span>
        </div>
        <strong className="admin-crm-metric-value">{value}</strong>
        <small>{detail}</small>
      </Card>
    </Col>
  );
}

function useOperationsCopy() {
  const i18n = useI18n(crmMessages);
  return useI18nMemo(() => {
    const { t, locale } = i18n;
    const currency = new Intl.NumberFormat(
      locale === "en" ? "en-US" : "vi-VN",
      {
        currency: "VND",
        maximumFractionDigits: 0,
        style: "currency",
      },
    );

    const compactNumber = new Intl.NumberFormat(
      locale === "en" ? "en-US" : "vi-VN",
      {
        maximumFractionDigits: 1,
        notation: "compact",
      },
    );

    const dateTime = new Intl.DateTimeFormat(
      locale === "en" ? "en-US" : "vi-VN",
      {
        dateStyle: "short",
        timeStyle: "short",
      },
    );

    const shortDate = new Intl.DateTimeFormat(
      locale === "en" ? "en-US" : "vi-VN",
      { dateStyle: "medium" },
    );

    const accessPresentation: Record<
      AdminCrmAccessState,
      { color?: string; label: string }
    > = {
      ACTIVE: { color: "green", label: t("Đang trả phí") },
      GRACE: { color: "gold", label: t("Đang gia hạn") },
      NONE: { label: t("Chưa có gói") },
      READ_ONLY: { color: "red", label: t("Chỉ đọc") },
      TRIAL: { color: "blue", label: t("Đang dùng thử") },
    };

    function safeDate(value: string): string {
      const parsed = new Date(value);
      return Number.isFinite(parsed.getTime()) ? dateTime.format(parsed) : "—";
    }

    function tenantAccessTag(state: AdminCrmAccessState) {
      const presentation = accessPresentation[state];
      return <Tag color={presentation.color}>{presentation.label}</Tag>;
    }

    function activityCopy(activity: AdminCrmActivity) {
      if (activity.kind === "TENANT_CREATED") {
        return { label: t("Tổ chức mới"), tone: "blue" };
      }
      if (activity.kind === "PAYMENT_PAID") {
        return { label: t("Đã thanh toán"), tone: "green" };
      }
      return { label: t("Cần xử lý"), tone: "red" };
    }
    return {
      ...i18n,
      currency,
      compactNumber,
      dateTime,
      shortDate,
      accessPresentation,
      safeDate,
      tenantAccessTag,
      activityCopy,
    };
  }, [i18n]);
}
