"use client";

import { useFeedback } from "@/components/feedback/feedback-provider";
import { useI18n } from "@/components/i18n/i18n-provider";
import { learningMessages } from "@/lib/i18n/learning-messages";
import { workspacePolishMessages } from "@/lib/i18n/workspace-polish-messages";

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
const dashboardMessages = { ...learningMessages, ...workspacePolishMessages };
export default function DashboardPage() {
  const { t, locale } = useI18n(dashboardMessages);
  const { formatError } = useFeedback();
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
  const error = dashboard.isError ? formatError(dashboard.error, "") : "";
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
    ? t("Quản trị viên")
    : user?.fullName?.trim().split(/\s+/).slice(-1)[0] || t("bạn");
  const dashboardDescription = isSuperAdmin
    ? t("Theo dõi tổ chức, người dùng và khóa học.")
    : isLearner
      ? t("Tiếp tục học và theo dõi tiến độ của bạn.")
      : isGuardian
        ? t("Xem tình hình học tập và học phí.")
        : t("Theo dõi khóa học và hoạt động đào tạo.");
  const needsBillingAction =
    isGlobalTenantAdmin && (!effectiveAccess || readOnly);
  const primaryActionLabel = isSuperAdmin
    ? t("Quản lý tổ chức")
    : needsBillingAction
      ? t("Quản lý thuê bao")
      : isGuardian
        ? t("Xem học phí")
        : t("Quản lý khóa học");
  const primaryActionPath = isSuperAdmin
    ? "/admin/tenants"
    : needsBillingAction
      ? "/billing"
      : isGuardian
        ? "/tuition"
        : "/courses";
  const showPrimaryAction = isGuardian
    ? false
    : !isLearner &&
    (isSuperAdmin || needsBillingAction || (coursesEnabled && !readOnly));
  const accessPresentation = effectiveAccess
    ? getSubscriptionAccessPresentation(effectiveAccess.state)
    : null;
  const emptyTitle = isSuperAdmin
    ? t("Chưa có khóa học gần đây")
    : !coursesEnabled
      ? t("Tính năng khóa học đang tạm tắt")
      : isLearner
        ? t("Bạn chưa có khóa học nào")
        : t("Chưa có khóa học");
  const emptyDescription = isSuperAdmin
    ? t("Khóa học sẽ xuất hiện khi tổ chức bắt đầu sử dụng.")
    : !coursesEnabled
      ? t("Liên hệ quản trị viên để bật tính năng khóa học.")
      : isLearner
        ? t("Khóa học sẽ xuất hiện khi bạn được ghi danh.")
        : t("Tạo khóa học để bắt đầu.");
  const emptyActionLabel = isSuperAdmin
    ? t("Đến trang tổ chức")
    : isLearner
      ? t("Xem khóa học của tôi")
      : t("Đi tới quản lý khóa học");

  return (
    <main className="dashboard-page page-shell">
      <header className="dashboard-header page-heading">
        <div className="dashboard-header__copy">
          <h1 className="dashboard-header__title">{t("Xin chào,")} {firstName}</h1>
          <p className="dashboard-header__description">
            {dashboardDescription}
          </p>
        </div>

        <div className="dashboard-header__actions">
          {accessPresentation && (
            <Tag color={accessPresentation.color}>
              {t(accessPresentation.label)}
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
          action={<Button loading={dashboard.isFetching} onClick={() => void dashboard.refetch({ cancelRefetch: false })}>{t("Thử lại")}</Button>}
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
              <Button onClick={() => router.push("/billing")}>{t("Chọn gói")}</Button>
            ) : undefined
          }
          className="dashboard-alert"
          description={
            isGlobalTenantAdmin
              ? t("Chọn một gói để cấp module và hạn mức cho workspace.")
              : t("Liên hệ quản trị tổ chức để kích hoạt gói dịch vụ.")
          }
          showIcon
          title={t("Workspace chưa có thuê bao")}
          type="warning"
        />
      )}

      {!data && !error ? (
        <div
          className="dashboard-loading"
          aria-label={t("Đang tải tổng quan")}
          aria-live="polite"
          role="status"
        >
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      ) : (
        data && (
          <div className="dashboard-content">
            <section className="dashboard-stats" aria-label={t("Chỉ số tổng quan")}>
              <Row gutter={[24, 24]}>
                {data.stats.map((stat) => (
                  <Col
                    className="dashboard-stat-column"
                    key={stat.key}
                    xl={6}
                    md={12}
                    sm={12}
                    xs={stat.suffix === "đ" || stat.suffix === "VND" ? 24 : 12}
                  >
                    <Card className="dashboard-stat-tile surface-card stat-card">
                      <Statistic
                        decimalSeparator={locale === "vi" ? "," : "."}
                        groupSeparator={locale === "vi" ? "." : ","}
                        suffix={stat.suffix === "đ" && locale === "en" ? "VND" : stat.suffix}
                        title={
                          <span className="dashboard-stat-tile__label">
                            {t(stat.label)}
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
                    <span id="dashboard-guardian-shortcuts">{t("Khu vực phụ huynh")}</span>
                  }
                >
                  <Row gutter={[12, 12]}>
                    <Col md={12} xs={24}>
                      <Button
                        block
                        disabled={!guardiansEnabled}
                        icon={<TeamOutlined />}
                        onClick={() => router.push("/family")}
                        size="large"
                      >{t("Xem học viên được liên kết")}</Button>
                    </Col>
                    <Col md={12} xs={24}>
                      <Button
                        block
                        disabled={!tuitionEnabled}
                        icon={<WalletOutlined />}
                        onClick={() => router.push("/tuition")}
                        size="large"
                      >{t("Theo dõi học phí")}</Button>
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
                      >{t("Xem tất cả")} <ArrowRightOutlined />
                      </Button>
                    )
                  }
                  title={
                    <span
                      className="dashboard-courses__heading"
                      id="dashboard-recent-courses"
                    >{t("Khóa học gần đây")}</span>
                  }
                >
                  {data.recentCourses.length ? (
                    <ul className="dashboard-course-list">
                      {data.recentCourses.map((course) => {
                        const content = (
                          <>
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
                              {course.description && <span className="dashboard-course-item__description"><span>{course.description}</span></span>}
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
                              {t(statusLabel[course.status])}
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
                                aria-label={t("Mở khóa học {p0}", { p0: course.title })}
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
                      {!showPrimaryAction && (isSuperAdmin || canOpenCourses) && (
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
