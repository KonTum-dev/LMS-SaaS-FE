"use client";

import {
  ArrowRightOutlined,
  BookOutlined,
  DollarOutlined,
  RiseOutlined,
  TeamOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Skeleton,
  Statistic,
  Tag,
} from "antd";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/app-providers";
import { apiFetch } from "@/lib/api";
import { getSubscriptionAccessPresentation } from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import type { DashboardData } from "@/lib/types";
import { tenantModuleEnabled } from "@/lib/workspace";

const statusLabel = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đang mở",
  ARCHIVED: "Đã lưu trữ",
} as const;
const roleLabel = {
  SUPER_ADMIN: "Quản trị nền tảng",
  TENANT_ADMIN: "Quản trị tổ chức",
  INSTRUCTOR: "Giảng viên",
  LEARNER: "Học viên",
  GUARDIAN: "Phụ huynh",
} as const;

export default function DashboardPage() {
  const { effectiveAccess, organization, token, user } = useAuth();
  const router = useRouter();
  const scope = getViewerScope(user, organization);
  const dashboard = useQuery({
    enabled: Boolean(token && scope),
    queryKey: scope
      ? lmsQueryKeys.dashboard(scope)
      : ["lms", "signed-out", "dashboard"],
    queryFn: () => apiFetch<DashboardData>("/dashboard", { token }),
  });
  const data = dashboard.data;
  const error = dashboard.error instanceof Error ? dashboard.error.message : "";
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isTenantAdmin = user?.role === "TENANT_ADMIN";
  const isGlobalTenantAdmin =
    isTenantAdmin && user?.orgUnitScopeMode !== "SCOPED";
  const isLearner = user?.role === "LEARNER";
  const isGuardian = user?.role === "GUARDIAN";
  const readOnly = effectiveAccess?.readOnly ?? false;
  const coursesEnabled =
    isSuperAdmin ||
    tenantModuleEnabled(organization, "COURSES", effectiveAccess);
  const guardiansEnabled = tenantModuleEnabled(
    organization,
    "GUARDIANS",
    effectiveAccess,
  );
  const tuitionEnabled = tenantModuleEnabled(
    organization,
    "TUITION",
    effectiveAccess,
  );
  const canOpenCourses = !isSuperAdmin && coursesEnabled;
  const firstName = isSuperAdmin
    ? "Quản trị viên"
    : user?.fullName?.trim().split(/\s+/).slice(-1)[0] || "bạn";
  const dashboardDescription = isSuperAdmin
    ? "Xem nhanh số tổ chức, khóa học và người dùng đang hoạt động."
    : isLearner
      ? `Nắm nhanh tiến độ học tập tại ${organization?.name ?? "tổ chức của bạn"}.`
      : isGuardian
        ? `Theo dõi học viên và học phí tại ${organization?.name ?? "trung tâm"}.`
        : `Theo dõi hoạt động đào tạo và những việc cần ưu tiên tại ${organization?.name ?? "tổ chức của bạn"}.`;
  const needsBillingAction =
    isGlobalTenantAdmin && (!effectiveAccess || readOnly);
  const primaryActionLabel = isSuperAdmin
    ? "Quản lý tổ chức"
    : needsBillingAction
      ? "Quản lý thuê bao"
      : isGuardian
        ? "Xem học phí"
        : "Quản lý khóa học";
  const primaryActionPath = isSuperAdmin
    ? "/admin/tenants"
    : needsBillingAction
      ? "/billing"
      : isGuardian
        ? "/tuition"
        : "/courses";
  const showPrimaryAction = isGuardian
    ? tuitionEnabled
    : !isLearner &&
      (isSuperAdmin || needsBillingAction || (coursesEnabled && !readOnly));
  const accessPresentation = effectiveAccess
    ? getSubscriptionAccessPresentation(effectiveAccess.state)
    : null;
  const emptyTitle = isSuperAdmin
    ? "Chưa có dữ liệu khóa học gần đây"
    : !coursesEnabled
      ? "Tính năng khóa học đang tạm tắt"
      : isLearner
        ? "Bạn chưa có khóa học nào"
        : "Chưa có khóa học để bắt đầu";
  const emptyDescription = isSuperAdmin
    ? "Dữ liệu sẽ xuất hiện khi các tổ chức bắt đầu vận hành khóa học."
    : !coursesEnabled
      ? "Quyền module được xác định bởi gói thuê bao và cấu hình của quản trị nền tảng."
      : isLearner
        ? "Các khóa học được ghi danh sẽ xuất hiện tại đây để bạn tiếp tục học nhanh hơn."
        : "Tạo khóa học đầu tiên để xây dựng nội dung và ghi danh học viên.";
  const emptyActionLabel = isSuperAdmin
    ? "Đến trang tổ chức"
    : isLearner
      ? "Xem khóa học của tôi"
      : "Đi tới quản lý khóa học";

  return (
    <main className="dashboard-page page-shell">
      <header className="dashboard-header page-heading">
        <div className="dashboard-header__copy">
          <span className="dashboard-header__eyebrow">Tổng quan hôm nay</span>
          <h1 className="dashboard-header__title">Xin chào, {firstName}</h1>
          <p className="dashboard-header__description">
            {dashboardDescription}
          </p>
        </div>

        <div className="dashboard-header__actions">
          {user?.role && (
            <Tag className="dashboard-header__role">
              {isTenantAdmin && !isGlobalTenantAdmin
                ? "Quản lý đơn vị"
                : roleLabel[user.role]}
            </Tag>
          )}
          {accessPresentation && (
            <Tag color={accessPresentation.color}>
              {accessPresentation.label}
            </Tag>
          )}
          {showPrimaryAction && (
            <Button
              className="dashboard-header__primary-action"
              icon={
                isSuperAdmin ? (
                  <RiseOutlined />
                ) : needsBillingAction ? (
                  <DollarOutlined />
                ) : isGuardian ? (
                  <WalletOutlined />
                ) : (
                  <BookOutlined />
                )
              }
              onClick={() => router.push(primaryActionPath)}
              type="primary"
            >
              {primaryActionLabel}
            </Button>
          )}
        </div>
      </header>

      {error && (
        <Alert
          className="dashboard-alert"
          showIcon
          title={error}
          type="error"
        />
      )}
      {!isSuperAdmin && !effectiveAccess && (
        <Alert
          action={
            isGlobalTenantAdmin ? (
              <Button onClick={() => router.push("/billing")}>Chọn gói</Button>
            ) : undefined
          }
          className="dashboard-alert"
          description={
            isGlobalTenantAdmin
              ? "Chọn một gói để cấp module và hạn mức cho workspace."
              : "Liên hệ quản trị tổ chức để kích hoạt gói dịch vụ."
          }
          showIcon
          title="Workspace chưa có thuê bao"
          type="warning"
        />
      )}

      {!data && !error ? (
        <div
          className="dashboard-loading"
          aria-label="Đang tải tổng quan"
          aria-live="polite"
          role="status"
        >
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      ) : (
        data && (
          <div className="dashboard-content">
            <section className="dashboard-stats" aria-label="Chỉ số tổng quan">
              <Row gutter={[18, 18]}>
                {data.stats.map((stat, index) => (
                  <Col
                    className="dashboard-stat-column"
                    key={stat.key}
                    lg={6}
                    md={12}
                    sm={12}
                    xs={24}
                  >
                    <Card className="dashboard-stat-tile surface-card stat-card">
                      <div
                        className="dashboard-stat-tile__top"
                        aria-hidden="true"
                      >
                        <span className="dashboard-stat-tile__index">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="dashboard-stat-tile__icon">
                          <RiseOutlined />
                        </span>
                      </div>
                      <Statistic
                        suffix={stat.suffix}
                        title={
                          <span className="dashboard-stat-tile__label">
                            {stat.label}
                          </span>
                        }
                        value={stat.value}
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            </section>

            {isGuardian ? (
              <section
                className="dashboard-courses-section"
                aria-labelledby="dashboard-guardian-shortcuts"
              >
                <Card
                  className="dashboard-courses surface-card"
                  title={
                    <span id="dashboard-guardian-shortcuts">
                      Khu vực phụ huynh
                    </span>
                  }
                >
                  <Row gutter={[12, 12]}>
                    <Col md={12} xs={24}>
                      <Button
                        block
                        disabled={!guardiansEnabled}
                        icon={<TeamOutlined />}
                        onClick={() => router.push("/guardians")}
                        size="large"
                      >
                        Xem học viên được liên kết
                      </Button>
                    </Col>
                    <Col md={12} xs={24}>
                      <Button
                        block
                        disabled={!tuitionEnabled}
                        icon={<WalletOutlined />}
                        onClick={() => router.push("/tuition")}
                        size="large"
                      >
                        Theo dõi học phí
                      </Button>
                    </Col>
                  </Row>
                </Card>
              </section>
            ) : (
              <section
                className="dashboard-courses-section"
                aria-labelledby="dashboard-recent-courses"
              >
                <Card
                  className="dashboard-courses surface-card"
                  extra={
                    canOpenCourses && (
                      <Button
                        className="dashboard-courses__action"
                        onClick={() => router.push("/courses")}
                        type="link"
                      >
                        Xem tất cả <ArrowRightOutlined />
                      </Button>
                    )
                  }
                  title={
                    <div className="dashboard-courses__title">
                      <span
                        className="dashboard-courses__title-icon"
                        aria-hidden="true"
                      >
                        <BookOutlined />
                      </span>
                      <span>
                        <span className="dashboard-courses__eyebrow">
                          Tiếp tục công việc
                        </span>
                        <span
                          className="dashboard-courses__heading"
                          id="dashboard-recent-courses"
                        >
                          Khóa học gần đây
                        </span>
                      </span>
                    </div>
                  }
                >
                  {data.recentCourses.length ? (
                    <ul className="dashboard-course-list">
                      {data.recentCourses.map((course, index) => {
                        const content = (
                          <>
                            <span
                              className="dashboard-course-item__avatar"
                              aria-hidden="true"
                            >
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="dashboard-course-item__body">
                              <span className="dashboard-course-item__title">
                                <span>{course.title}</span>
                                {canOpenCourses && (
                                  <ArrowRightOutlined
                                    className="dashboard-course-item__arrow"
                                    aria-hidden="true"
                                  />
                                )}
                              </span>
                              <span className="dashboard-course-item__description">
                                <span>
                                  {course.description ||
                                    "Khóa học chưa có mô tả."}
                                </span>
                              </span>
                            </span>
                            <Tag
                              className={`dashboard-course-item__status dashboard-course-item__status--${course.status.toLowerCase()}`}
                              color={
                                course.status === "PUBLISHED"
                                  ? "green"
                                  : course.status === "DRAFT"
                                    ? "gold"
                                    : "default"
                              }
                            >
                              {statusLabel[course.status]}
                            </Tag>
                          </>
                        );

                        return (
                          <li
                            className="dashboard-course-list__row"
                            key={course._id}
                          >
                            {canOpenCourses ? (
                              <Link
                                aria-label={`Mở khóa học ${course.title}`}
                                className="dashboard-course-item dashboard-course-item--clickable"
                                href={`/courses/${course._id}`}
                              >
                                {content}
                              </Link>
                            ) : (
                              <div className="dashboard-course-item">
                                {content}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <Empty
                      className="dashboard-empty empty-block"
                      description={
                        <span className="dashboard-empty__copy">
                          <strong className="dashboard-empty__title">
                            {emptyTitle}
                          </strong>
                          <span className="dashboard-empty__description">
                            {emptyDescription}
                          </span>
                        </span>
                      }
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    >
                      {(isSuperAdmin || canOpenCourses) && (
                        <Button
                          className="dashboard-empty__action"
                          onClick={() => router.push(primaryActionPath)}
                          type="primary"
                        >
                          {emptyActionLabel} <ArrowRightOutlined />
                        </Button>
                      )}
                    </Empty>
                  )}
                </Card>
              </section>
            )}
          </div>
        )
      )}
    </main>
  );
}
