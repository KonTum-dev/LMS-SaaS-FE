"use client";

import {
  ApartmentOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
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

const currency = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});
const compactNumber = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 1,
  notation: "compact",
});
const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});
const shortDate = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" });

const accessPresentation: Record<
  AdminCrmAccessState,
  { color?: string; label: string }
> = {
  ACTIVE: { color: "green", label: "Đang trả phí" },
  GRACE: { color: "gold", label: "Đang gia hạn" },
  NONE: { label: "Chưa có gói" },
  READ_ONLY: { color: "red", label: "Chỉ đọc" },
  TRIAL: { color: "blue", label: "Đang dùng thử" },
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
    return { label: "Workspace mới", tone: "blue" };
  }
  if (activity.kind === "PAYMENT_PAID") {
    return { label: "Thanh toán thành công", tone: "green" };
  }
  return { label: "Thanh toán cần xử lý", tone: "red" };
}

export default function AdminCrmPage() {
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
        header: "Workspace",
      },
      {
        accessorKey: "accessState",
        cell: ({ getValue }) =>
          tenantAccessTag(getValue<AdminCrmAccessState>()),
        header: "Truy cập",
        meta: { width: 150 },
      },
      {
        accessorKey: "memberCount",
        cell: ({ getValue }) => compactNumber.format(getValue<number>()),
        header: "Thành viên",
        meta: { responsive: ["md"], width: 110 },
      },
      {
        accessorKey: "subscription",
        cell: ({ row }) => (
          <div className="table-primary-cell">
            <strong>{row.original.subscription?.planCode ?? "—"}</strong>
            <div className="table-muted">
              {row.original.subscription
                ? `${row.original.subscription.billingCycle === "MONTHLY" ? "Theo tháng" : "Theo năm"} · hết hạn ${shortDate.format(new Date(row.original.subscription.endAt))}`
                : "Chưa có thuê bao"}
            </div>
          </div>
        ),
        header: "Gói hiện tại",
        meta: { responsive: ["lg"], width: 230 },
      },
      {
        accessorKey: "revenueVnd",
        cell: ({ getValue }) => currency.format(getValue<number>()),
        header: "Đã thu",
        meta: { responsive: ["md"], width: 150 },
      },
      {
        accessorKey: "status",
        cell: ({ getValue }) => {
          const value = getValue<AdminCrmTenant["status"]>();
          return (
            <Tag color={value === "ACTIVE" ? "green" : "red"}>
              {value === "ACTIVE" ? "Hoạt động" : "Tạm khóa"}
            </Tag>
          );
        },
        header: "Tenant",
        meta: { width: 110 },
      },
    ],
    [],
  );

  if (user?.role !== "SUPER_ADMIN") {
    return (
      <Alert
        showIcon
        title="Khu vực CRM chỉ dành cho quản trị viên nền tảng."
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
  const error = dashboard.error instanceof Error ? dashboard.error.message : "";

  return (
    <main className="admin-crm-page page-shell">
      <header className="page-heading admin-crm-heading">
        <div className="page-heading-copy">
          <span className="page-eyebrow">Điều hành nền tảng</span>
          <h1>CRM tổng quan</h1>
          <p>
            Theo dõi workspace, vòng đời thuê bao và giao dịch cần chú ý trên
            một màn hình.
          </p>
        </div>
        <div className="page-actions">
          <Button onClick={() => router.push("/admin/tenants")}>
            Quản lý tổ chức
          </Button>
          <Button
            icon={<DollarOutlined />}
            onClick={() => router.push("/admin/billing")}
            type="primary"
          >
            Thuê bao &amp; thanh toán
          </Button>
        </div>
      </header>

      {error && (
        <Alert
          action={
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void dashboard.refetch()}
              size="small"
            >
              Thử lại
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
          <>
            <section aria-label="Chỉ số CRM" className="admin-crm-metrics">
              <Row gutter={[16, 16]}>
                <CrmMetric
                  detail={`${data.metrics.activeTenants} hoạt động · ${data.metrics.suspendedTenants} tạm khóa`}
                  icon={<ApartmentOutlined />}
                  label="Tổng workspace"
                  value={compactNumber.format(data.metrics.totalTenants)}
                />
                <CrmMetric
                  detail={`${data.metrics.activeSubscriptions} gói trả phí đang hiệu lực`}
                  icon={<CheckCircleOutlined />}
                  label="Đang dùng thử"
                  value={compactNumber.format(data.metrics.trialWorkspaces)}
                />
                <CrmMetric
                  detail={`${data.metrics.graceWorkspaces} đang gia hạn`}
                  icon={<ClockCircleOutlined />}
                  label="Workspace chỉ đọc"
                  tone={data.metrics.readOnlyWorkspaces ? "warning" : "default"}
                  value={compactNumber.format(data.metrics.readOnlyWorkspaces)}
                />
                <CrmMetric
                  detail="Thành viên đang hoạt động trên toàn nền tảng"
                  icon={<TeamOutlined />}
                  label="Thành viên"
                  value={compactNumber.format(data.metrics.activeMembers)}
                />
                <CrmMetric
                  detail={`${data.metrics.paidOrders} đơn PAID · tổng ${currency.format(data.metrics.grossRevenueVnd)}`}
                  icon={<DollarOutlined />}
                  label="Doanh thu 30 ngày"
                  value={currency.format(data.metrics.recentRevenueVnd)}
                />
                <CrmMetric
                  detail="Review hoặc hoàn tiền cần can thiệp"
                  icon={<ExclamationCircleOutlined />}
                  label="Hàng chờ xử lý"
                  tone={data.metrics.reviewOrders ? "danger" : "default"}
                  value={compactNumber.format(data.metrics.reviewOrders)}
                />
              </Row>
            </section>

            <section className="admin-crm-grid">
              <Card
                className="surface-card table-surface admin-crm-tenants"
                title="Sức khỏe workspace"
              >
                <form
                  className="admin-filter-bar admin-crm-filter"
                  onSubmit={submitSearch}
                >
                  <Input
                    aria-label="Tìm workspace"
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Tên hoặc slug workspace"
                    prefix={<SearchOutlined />}
                    value={searchInput}
                  />
                  <Select
                    allowClear
                    aria-label="Lọc trạng thái tenant"
                    onChange={(status) =>
                      setQuery((current) => ({
                        ...current,
                        page: 1,
                        status,
                      }))
                    }
                    options={[
                      { label: "Đang hoạt động", value: "ACTIVE" },
                      { label: "Tạm khóa", value: "SUSPENDED" },
                    ]}
                    placeholder="Trạng thái tenant"
                    value={query.status}
                  />
                  <Select
                    allowClear
                    aria-label="Lọc trạng thái truy cập"
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
                    placeholder="Trạng thái truy cập"
                    value={query.access}
                  />
                  <Button htmlType="submit" loading={dashboard.isFetching}>
                    Tìm kiếm
                  </Button>
                </form>
                <DataTable
                  ariaLabel="Danh sách sức khỏe workspace"
                  columns={columns}
                  data={data.tenants.items}
                  emptyText="Không tìm thấy workspace phù hợp"
                  loading={dashboard.isFetching}
                  onPageChange={(page) =>
                    setQuery((current) => ({ ...current, page }))
                  }
                  page={data.tenants.page}
                  pageSize={data.tenants.limit}
                  rowKey="id"
                  scrollX={920}
                  total={data.tenants.total}
                />
              </Card>

              <Card
                className="surface-card admin-crm-activity"
                title="Hoạt động gần đây"
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
                  <Empty description="Chưa có hoạt động gần đây" />
                )}
              </Card>
            </section>
          </>
        )
      )}
    </main>
  );
}

function CrmMetric({
  detail,
  icon,
  label,
  tone = "default",
  value,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  tone?: "danger" | "default" | "warning";
  value: string;
}) {
  return (
    <Col lg={8} md={12} xs={24}>
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
