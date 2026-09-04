"use client";

import { ReloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Progress,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import {
  operationsReportApi,
  operationsReportQueryKeys,
  type OperationsReportOverview,
  type OperationsReportQuery,
  type OperationsReportUnit,
} from "@/lib/operations-report-api";
import {
  orgUnitQueryKeys,
  orgUnitsApi,
  type OrgUnitTreeNode,
  type OrgUnitType,
} from "@/lib/org-units-api";
import { getViewerScope, type ViewerScope } from "@/lib/query-keys";

const money = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});
const number = new Intl.NumberFormat("vi-VN");
const date = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeZone: "UTC",
});
const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

const TYPE_PRESENTATION: Record<OrgUnitType, { color: string; label: string }> = {
  BRANCH: { color: "blue", label: "Chi nhánh" },
  DEPARTMENT: { color: "purple", label: "Phòng ban" },
  ROOT: { color: "gold", label: "Trung tâm" },
};

interface ReportFilters {
  from: string;
  orgUnitId: string;
  to: string;
}

interface ReportViewProps {
  isTenantAdmin: boolean;
  readOnly: boolean;
  scope: ViewerScope;
  token: string;
}

const EMPTY_FILTERS: ReportFilters = { from: "", orgUnitId: "", to: "" };
const UTC_DAY_START = "T00:00:00.000Z";
const UTC_DAY_END = "T23:59:59.999Z";

function OperationsReport({
  isTenantAdmin,
  readOnly,
  scope,
  token,
}: ReportViewProps) {
  const { message } = App.useApp();
  const [draftFilters, setDraftFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<ReportFilters>(EMPTY_FILTERS);
  const reportQuery = useMemo<OperationsReportQuery>(
    () => ({
      ...(appliedFilters.from && appliedFilters.to
        ? {
            from: `${appliedFilters.from}${UTC_DAY_START}`,
            to: `${appliedFilters.to}${UTC_DAY_END}`,
          }
        : {}),
      ...(appliedFilters.orgUnitId
        ? { orgUnitId: appliedFilters.orgUnitId }
        : {}),
    }),
    [appliedFilters],
  );

  const unitsQuery = useQuery({
    queryFn: ({ signal }) => orgUnitsApi.tree({ token }, false, { signal }),
    queryKey: orgUnitQueryKeys.tree(scope, false),
  });
  const report = useQuery<OperationsReportOverview>({
    placeholderData: (previous) => previous,
    queryFn: ({ signal }) =>
      operationsReportApi.overview({ token }, reportQuery, { signal }),
    queryKey: operationsReportQueryKeys.overview(scope, reportQuery),
  });
  const unitOptions = useMemo(
    () => buildUnitOptions(unitsQuery.data?.items ?? []),
    [unitsQuery.data?.items],
  );

  const columns = useMemo<ColumnsType<OperationsReportUnit>>(() => {
    const base: ColumnsType<OperationsReportUnit> = [
      {
        key: "unit",
        render: (_, unit) => (
          <div>
            <strong>{unit.name}</strong>
            <div className="table-muted">
              {unit.code}
              {unit.type ? (
                <>
                  {" · "}
                  <Tag color={TYPE_PRESENTATION[unit.type].color}>
                    {TYPE_PRESENTATION[unit.type].label}
                  </Tag>
                </>
              ) : (
                " · Chưa gắn đơn vị"
              )}
            </div>
          </div>
        ),
        title: "Đơn vị",
      },
      {
        align: "right",
        key: "cohorts",
        render: (_, unit) => number.format(unit.operations.activeCohorts),
        title: "Lớp hoạt động",
      },
      {
        align: "right",
        key: "learners",
        render: (_, unit) => number.format(unit.operations.activeLearners),
        title: "Học viên",
      },
      {
        align: "right",
        key: "sessions",
        render: (_, unit) => (
          <span>
            {number.format(unit.operations.completedSessions)} / {" "}
            {number.format(unit.operations.scheduledSessions)}
          </span>
        ),
        title: "Buổi hoàn thành / lịch",
      },
      {
        align: "right",
        key: "attendance",
        render: (_, unit) => (
          <span>
            <strong>{formatPercent(unit.attendance.attendanceRatePercent)}</strong>
            <span className="table-muted">
              {" · "}
              {number.format(unit.attendance.marked)} lượt
            </span>
          </span>
        ),
        title: "Chuyên cần",
      },
    ];

    if (isTenantAdmin) {
      base.push(
        {
          align: "right",
          key: "collected",
          render: (_, unit) =>
            unit.tuition ? money.format(unit.tuition.collectedAmountVnd) : "—",
          title: "Đã thu",
        },
        {
          align: "right",
          key: "outstanding",
          render: (_, unit) =>
            unit.tuition
              ? money.format(unit.tuition.outstandingAmountVnd)
              : "—",
          title: "Còn phải thu",
        },
      );
    }

    return base;
  }, [isTenantAdmin]);

  const applyFilters = () => {
    if (Boolean(draftFilters.from) !== Boolean(draftFilters.to)) {
      message.error("Vui lòng chọn đủ ngày bắt đầu và ngày kết thúc");
      return;
    }
    if (
      draftFilters.from &&
      draftFilters.to &&
      draftFilters.from > draftFilters.to
    ) {
      message.error("Ngày bắt đầu phải trước hoặc trùng ngày kết thúc");
      return;
    }
    setAppliedFilters({ ...draftFilters });
  };
  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const overview = report.data;
  const isEmpty = Boolean(
    overview &&
      overview.units.length === 0 &&
      overview.operations.activeCohorts === 0 &&
      overview.operations.activeLearners === 0 &&
      overview.operations.scheduledSessions === 0 &&
      overview.attendance.marked === 0 &&
      (!overview.tuition || overview.tuition.invoiceCount === 0),
  );

  return (
    <main aria-labelledby="operations-report-title" className="page-shell">
      <header className="page-heading">
        <div className="page-heading-copy">
          <h1 id="operations-report-title">Báo cáo vận hành</h1>
          <p>
            Theo dõi quy mô lớp, lịch học, chuyên cần và tình hình thu học phí
            theo từng đơn vị.
          </p>
        </div>
        <Button
          icon={<ReloadOutlined />}
          loading={report.isFetching}
          onClick={() => void report.refetch()}
        >
          Làm mới
        </Button>
      </header>

      {readOnly && (
        <Alert
          description="Bạn vẫn có thể xem, lọc và làm mới báo cáo; trang này không thay đổi dữ liệu vận hành."
          showIcon
          title="Workspace chỉ đọc"
          type="info"
        />
      )}

      <Card className="surface-card" title="Phạm vi báo cáo">
        <Row gutter={[16, 16]}>
          <Col lg={6} md={12} xs={24}>
            <Typography.Text strong>Từ ngày</Typography.Text>
            <Input
              aria-label="Từ ngày"
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  from: event.target.value,
                }))
              }
              type="date"
              value={draftFilters.from}
            />
          </Col>
          <Col lg={6} md={12} xs={24}>
            <Typography.Text strong>Đến ngày</Typography.Text>
            <Input
              aria-label="Đến ngày"
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  to: event.target.value,
                }))
              }
              type="date"
              value={draftFilters.to}
            />
          </Col>
          <Col lg={8} md={12} xs={24}>
            <Typography.Text strong>Đơn vị</Typography.Text>
            <Select
              allowClear
              aria-label="Đơn vị báo cáo"
              loading={unitsQuery.isLoading}
              onChange={(value) =>
                setDraftFilters((current) => ({
                  ...current,
                  orgUnitId: value ?? "",
                }))
              }
              optionFilterProp="label"
              options={unitOptions}
              placeholder="Tất cả đơn vị"
              showSearch
              style={{ width: "100%" }}
              value={draftFilters.orgUnitId || undefined}
            />
          </Col>
          <Col lg={4} md={12} xs={24}>
            <Space>
              <Button onClick={applyFilters} type="primary">
                Áp dụng
              </Button>
              <Button onClick={clearFilters}>Xóa lọc</Button>
            </Space>
          </Col>
        </Row>
        <Typography.Paragraph type="secondary">
          Khoảng ngày được tính từ 00:00:00 đến 23:59:59 theo UTC.
        </Typography.Paragraph>
      </Card>

      {unitsQuery.error && (
        <Alert
          action={
            <Button onClick={() => void unitsQuery.refetch()}>
              Tải lại đơn vị
            </Button>
          }
          description="Báo cáo vẫn dùng được, nhưng chưa thể chọn phạm vi chi nhánh hoặc phòng ban."
          showIcon
          title="Không tải được cơ cấu tổ chức"
          type="warning"
        />
      )}

      {report.error && (
        <Alert
          action={
            <Button icon={<ReloadOutlined />} onClick={() => void report.refetch()}>
              Thử lại
            </Button>
          }
          description={
            report.error instanceof Error
              ? report.error.message
              : "Không thể tải dữ liệu báo cáo."
          }
          showIcon
          title="Không tải được báo cáo vận hành"
          type="error"
        />
      )}

      {report.isLoading && !overview ? (
        <Card className="surface-card">
          <Skeleton active />
        </Card>
      ) : null}

      {overview ? (
        <>
          <Card className="surface-card">
            <Space size="large" wrap>
              <Typography.Text type="secondary">
                {formatScope(overview.scope.from, overview.scope.to)}
              </Typography.Text>
              <Typography.Text type="secondary">
                Phạm vi: {findScopeName(overview.scope.orgUnitId, unitOptions)}
              </Typography.Text>
              <Typography.Text type="secondary">
                Cập nhật {formatDateTime(overview.generatedAt)}
              </Typography.Text>
            </Space>
          </Card>

          {isEmpty ? (
            <Card className="surface-card">
              <Empty description="Chưa có dữ liệu vận hành trong phạm vi đã chọn" />
            </Card>
          ) : (
            <>
              <Row gutter={[16, 16]}>
                <Col lg={6} sm={12} xs={24}>
                  <Card className="surface-card">
                    <Statistic
                      title="Lớp đang hoạt động"
                      value={overview.operations.activeCohorts}
                    />
                  </Card>
                </Col>
                <Col lg={6} sm={12} xs={24}>
                  <Card className="surface-card">
                    <Statistic
                      title="Học viên đang học"
                      value={overview.operations.activeLearners}
                    />
                  </Card>
                </Col>
                <Col lg={6} sm={12} xs={24}>
                  <Card className="surface-card">
                    <Statistic
                      suffix={`· ${number.format(overview.operations.completedSessions)} hoàn thành`}
                      title="Buổi học trong lịch"
                      value={overview.operations.scheduledSessions}
                    />
                  </Card>
                </Col>
                <Col lg={6} sm={12} xs={24}>
                  <Card className="surface-card">
                    <Statistic
                      suffix="%"
                      title="Tỷ lệ chuyên cần"
                      value={safePercent(overview.attendance.attendanceRatePercent)}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]}>
                <Col lg={isTenantAdmin ? 12 : 24} xs={24}>
                  <Card className="surface-card" title="Chuyên cần">
                    <Progress
                      percent={safePercent(
                        overview.attendance.attendanceRatePercent,
                      )}
                      status="normal"
                    />
                    <Space size="large" wrap>
                      <Statistic
                        title="Đã điểm danh"
                        value={overview.attendance.marked}
                      />
                      <Statistic
                        title="Có mặt"
                        value={overview.attendance.present}
                      />
                      <Statistic title="Đi muộn" value={overview.attendance.late} />
                      <Statistic title="Vắng" value={overview.attendance.absent} />
                      <Statistic
                        title="Có phép"
                        value={overview.attendance.excused}
                      />
                    </Space>
                  </Card>
                </Col>

                {isTenantAdmin ? (
                  <Col lg={12} xs={24}>
                    <Card className="surface-card" title="Học phí">
                      {overview.tuition ? (
                        <>
                          <Typography.Paragraph type="secondary">
                            {number.format(overview.tuition.invoiceCount)} hóa đơn
                            trong kỳ
                          </Typography.Paragraph>
                          <Row gutter={[12, 12]}>
                            <Col sm={12} xs={24}>
                              <Statistic
                                title="Đã phát hành"
                                value={money.format(
                                  overview.tuition.issuedAmountVnd,
                                )}
                              />
                            </Col>
                            <Col sm={12} xs={24}>
                              <Statistic
                                title="Đã thu"
                                value={money.format(
                                  overview.tuition.collectedAmountVnd,
                                )}
                              />
                            </Col>
                            <Col sm={12} xs={24}>
                              <Statistic
                                title="Còn phải thu"
                                value={money.format(
                                  overview.tuition.outstandingAmountVnd,
                                )}
                              />
                            </Col>
                            <Col sm={12} xs={24}>
                              <Statistic
                                title="Quá hạn"
                                value={money.format(
                                  overview.tuition.overdueAmountVnd,
                                )}
                              />
                            </Col>
                          </Row>
                        </>
                      ) : (
                        <Alert
                          showIcon
                          title="Chưa có số liệu học phí cho phạm vi này"
                          type="warning"
                        />
                      )}
                    </Card>
                  </Col>
                ) : null}
              </Row>

              {!isTenantAdmin && (
                <Alert
                  description="Giảng viên chỉ xem số liệu lớp học và chuyên cần theo phạm vi được cấp quyền."
                  showIcon
                  title="Số liệu học phí chỉ dành cho quản trị tổ chức"
                  type="info"
                />
              )}

              <Card
                className="surface-card table-surface"
                title="So sánh theo đơn vị"
              >
                <Table<OperationsReportUnit>
                  columns={columns}
                  dataSource={overview.units}
                  locale={{
                    emptyText: "Chưa có đơn vị để so sánh trong phạm vi đã chọn",
                  }}
                  pagination={false}
                  rowKey={(unit) => unit.orgUnitId ?? "unassigned"}
                  scroll={{ x: isTenantAdmin ? 1080 : 780 }}
                />
              </Card>
            </>
          )}
        </>
      ) : null}
    </main>
  );
}

export default function OperationsReportPage() {
  const { effectiveAccess, organization, token, user } = useAuth();
  const scope = getViewerScope(user, organization);
  const isTenantAdmin = user?.role === "TENANT_ADMIN";
  const supportedRole = isTenantAdmin || user?.role === "INSTRUCTOR";

  if (!supportedRole) {
    return (
      <Alert
        showIcon
        title="Báo cáo vận hành chỉ dành cho quản trị tổ chức và giảng viên."
        type="error"
      />
    );
  }
  if (!token || !scope) {
    return (
      <Alert
        showIcon
        title="Phiên thành viên không hợp lệ. Vui lòng đăng nhập lại."
        type="error"
      />
    );
  }

  const readOnly = effectiveAccess?.readOnly ?? false;
  const authorityKey = `${scope.tenantId}:${scope.membershipId}:${scope.viewerId}:${scope.role}:${readOnly ? "READ_ONLY" : "WRITABLE"}`;
  return (
    <OperationsReport
      isTenantAdmin={isTenantAdmin}
      key={authorityKey}
      readOnly={readOnly}
      scope={scope}
      token={token}
    />
  );
}

function buildUnitOptions(
  roots: OrgUnitTreeNode[],
): Array<{ label: string; value: string }> {
  const options: Array<{ label: string; value: string }> = [];
  const visit = (units: OrgUnitTreeNode[], names: string[]) => {
    for (const unit of units) {
      const path = [...names, unit.name];
      if (unit.status === "ACTIVE") {
        options.push({ label: path.join(" / "), value: unit._id });
      }
      visit(unit.children, path);
    }
  };
  visit(roots, []);
  return options;
}

function findScopeName(
  orgUnitId: string | null,
  options: Array<{ label: string; value: string }>,
): string {
  if (!orgUnitId) return "Tất cả đơn vị";
  return options.find((option) => option.value === orgUnitId)?.label ?? orgUnitId;
}

function formatScope(from: string, to: string): string {
  return `${formatDate(from)} – ${formatDate(to)}`;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : date.format(parsed);
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : dateTime.format(parsed);
}

function safePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function formatPercent(value: number): string {
  return `${number.format(safePercent(value))}%`;
}
