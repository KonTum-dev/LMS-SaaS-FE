"use client";

import {
  ArrowLeftOutlined,
  CalendarOutlined,
  ReadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Empty,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/app-providers";
import { apiFetch } from "@/lib/api";
import { effectiveModuleEnabled } from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import { submissionApi } from "@/lib/submission-api";
import type { Assignment, Course } from "@/lib/types";

function percent(value: number | null) {
  return value === null ? "Chưa có dữ liệu" : `${value}%`;
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { effectiveAccess, organization, token, user } = useAuth();
  const scope = getViewerScope(user, organization);
  const coursesEnabled = effectiveModuleEnabled(effectiveAccess, "COURSES");
  const assignmentsEnabled = effectiveModuleEnabled(
    effectiveAccess,
    "ASSIGNMENTS",
  );
  const managerRole =
    user?.role === "TENANT_ADMIN" || user?.role === "INSTRUCTOR";
  const curriculumEntryAllowed = Boolean(
    coursesEnabled &&
    organization &&
    scope &&
    user?.tenantId &&
    user.role !== "SUPER_ADMIN",
  );
  const courseQuery = useQuery({
    enabled: Boolean(token && scope && id),
    queryKey: scope
      ? lmsQueryKeys.course(scope, id)
      : ["lms", "signed-out", "courses", id],
    queryFn: () => apiFetch<Course>(`/courses/${id}`, { token }),
  });
  const assignmentsQuery = useQuery({
    enabled: Boolean(token && scope && id && assignmentsEnabled),
    queryKey: scope
      ? lmsQueryKeys.assignments(scope, id)
      : ["lms", "signed-out", "assignments", id],
    queryFn: () =>
      apiFetch<Assignment[]>(`/assignments?courseId=${id}`, { token }),
  });
  const course = courseQuery.data;
  const reportQuery = useQuery({
    enabled: Boolean(
      token &&
      scope &&
      id &&
      assignmentsEnabled &&
      managerRole &&
      course?.status === "PUBLISHED",
    ),
    queryFn: ({ signal }) =>
      submissionApi.getCourseReport({ token }, id, signal),
    queryKey: scope
      ? lmsQueryKeys.courseReport(scope, id)
      : ["lms", "signed-out", "reports", "courses", id],
  });
  const assignments = assignmentsQuery.data ?? [];
  const error =
    courseQuery.error instanceof Error ? courseQuery.error.message : "";
  const loading = courseQuery.isPending;
  const statusLabel =
    course?.status === "PUBLISHED"
      ? "Đang mở"
      : course?.status === "DRAFT"
        ? "Bản nháp"
        : "Đã lưu trữ";
  const statusColor =
    course?.status === "PUBLISHED"
      ? "green"
      : course?.status === "ARCHIVED"
        ? "default"
        : "gold";

  return (
    <main
      aria-label={course ? undefined : "Chi tiết khóa học"}
      aria-labelledby={course ? "course-detail-title" : undefined}
      className="page-shell course-detail-page"
    >
      <nav
        aria-label="Điều hướng khóa học"
        className="course-detail-breadcrumb"
      >
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/courses")}
          type="text"
        >
          Quay lại khóa học
        </Button>
      </nav>
      {error ? (
        <Alert showIcon title={error} type="error" />
      ) : loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : !course ? (
        <Empty description="Không tìm thấy khóa học" />
      ) : (
        <>
          <header className="page-heading course-detail-heading">
            <div className="page-heading-copy course-detail-heading-copy">
              <Space className="course-detail-kicker" size={[8, 8]} wrap>
                <Tag color={statusColor}>{statusLabel}</Tag>
              </Space>
              <h1 id="course-detail-title">{course.title}</h1>
              <p className="course-detail-description">
                {course.description || "Khóa học chưa có mô tả."}
              </p>
              <Space className="course-detail-meta" size={[20, 10]} wrap>
                {typeof course.instructorId === "object" && (
                  <span className="course-detail-meta-item">
                    <UserOutlined aria-hidden="true" />
                    <span>
                      <span className="course-detail-meta-label">
                        Giảng viên
                      </span>{" "}
                      <strong>{course.instructorId.fullName}</strong>
                    </span>
                  </span>
                )}
                {course.createdAt && (
                  <span className="course-detail-meta-item">
                    <CalendarOutlined aria-hidden="true" />
                    <span>
                      <span className="course-detail-meta-label">Khởi tạo</span>{" "}
                      <time dateTime={course.createdAt}>
                        {dayjs(course.createdAt).format("DD/MM/YYYY")}
                      </time>
                    </span>
                  </span>
                )}
              </Space>
            </div>
            {curriculumEntryAllowed && (
              <Button
                icon={<ReadOutlined />}
                onClick={() => router.push(`/courses/${id}/curriculum`)}
                type="primary"
              >
                Mở giáo trình
              </Button>
            )}
          </header>

          {assignmentsEnabled &&
            managerRole &&
            course.status === "PUBLISHED" && (
              <Card
                className="surface-card course-report-card"
                title="Báo cáo tiến độ"
              >
                {reportQuery.error ? (
                  <Alert
                    showIcon
                    title={
                      reportQuery.error instanceof Error
                        ? reportQuery.error.message
                        : "Không tải được báo cáo tiến độ"
                    }
                    type="warning"
                  />
                ) : reportQuery.isPending ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : reportQuery.data ? (
                  <>
                    <dl className="course-report-metrics">
                      <div>
                        <dt>Học viên đang học</dt>
                        <dd>{reportQuery.data.activeLearners}</dd>
                      </div>
                      <div>
                        <dt>Bài tập đã công bố</dt>
                        <dd>{reportQuery.data.publishedAssignments}</dd>
                      </div>
                      <div>
                        <dt>Bài nộp kỳ vọng</dt>
                        <dd>{reportQuery.data.expectedSubmissions}</dd>
                      </div>
                      <div>
                        <dt>Chưa bắt đầu</dt>
                        <dd>{reportQuery.data.counts.notStarted}</dd>
                      </div>
                      <div>
                        <dt>Bản nháp</dt>
                        <dd>{reportQuery.data.counts.draft}</dd>
                      </div>
                      <div>
                        <dt>Đã nộp</dt>
                        <dd>{reportQuery.data.counts.submitted}</dd>
                      </div>
                      <div>
                        <dt>Đã trả lại</dt>
                        <dd>{reportQuery.data.counts.returned}</dd>
                      </div>
                      <div>
                        <dt>Đã chấm</dt>
                        <dd>{reportQuery.data.counts.graded}</dd>
                      </div>
                      <div>
                        <dt>Nộp muộn</dt>
                        <dd>{reportQuery.data.lateSubmissions}</dd>
                      </div>
                      <div>
                        <dt>Hoàn thành</dt>
                        <dd>{percent(reportQuery.data.completionPercent)}</dd>
                      </div>
                      <div>
                        <dt>Điểm trung bình</dt>
                        <dd>
                          {percent(reportQuery.data.gradedAveragePercent)}
                        </dd>
                      </div>
                    </dl>
                    <small>
                      Báo cáo theo danh sách học viên đang hoạt động · cập nhật{" "}
                      {dayjs(reportQuery.data.generatedAt).format(
                        "DD/MM/YYYY HH:mm",
                      )}
                    </small>
                  </>
                ) : null}
              </Card>
            )}

          {assignmentsEnabled && (
            <Card
              className="surface-card course-assignments-card"
              extra={
                <Tag className="course-assignment-count">
                  {assignments.length} bài
                </Tag>
              }
              title={<span className="course-assignments-title">Bài tập</span>}
            >
              {assignmentsQuery.error ? (
                <Alert
                  showIcon
                  title={
                    assignmentsQuery.error instanceof Error
                      ? assignmentsQuery.error.message
                      : "Không tải được bài tập"
                  }
                  type="warning"
                />
              ) : assignmentsQuery.isPending ? (
                <Skeleton active paragraph={{ rows: 3 }} />
              ) : assignments.length ? (
                <ul className="course-assignment-list">
                  {assignments.map((item) => {
                    const assignmentTitleId = `assignment-title-${item._id}`;
                    return (
                      <li className="course-assignment-item" key={item._id}>
                        <article
                          aria-labelledby={assignmentTitleId}
                          className="course-assignment-content"
                        >
                          <Typography.Title
                            className="course-assignment-title"
                            id={assignmentTitleId}
                            level={3}
                          >
                            {item.title}
                          </Typography.Title>
                          <Typography.Paragraph
                            className="course-assignment-description"
                            type="secondary"
                          >
                            {item.description || "Không có mô tả"}
                          </Typography.Paragraph>
                          {item.dueAt && (
                            <span className="course-assignment-due">
                              <CalendarOutlined aria-hidden="true" />
                              <span>
                                Hạn nộp{" "}
                                <time dateTime={item.dueAt}>
                                  {dayjs(item.dueAt).format("DD/MM/YYYY HH:mm")}
                                </time>
                              </span>
                            </span>
                          )}
                        </article>
                        <Tag color={item.published ? "green" : "gold"}>
                          {item.published ? "Đã giao" : "Bản nháp"}
                        </Tag>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <Empty
                  description="Chưa có bài tập"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </Card>
          )}
        </>
      )}
    </main>
  );
}
