"use client";

import { ArrowLeftOutlined, CalendarOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Empty, List, Skeleton, Space, Tag, Typography } from "antd";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/app-providers";
import { apiFetch } from "@/lib/api";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import type { Assignment, Course } from "@/lib/types";

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { organization, token, user } = useAuth();
  const scope = getViewerScope(user, organization);
  const courseQuery = useQuery({
    enabled: Boolean(token && scope && id),
    queryKey: scope ? lmsQueryKeys.course(scope, id) : ["lms", "signed-out", "courses", id],
    queryFn: () => apiFetch<Course>(`/courses/${id}`, { token }),
  });
  const assignmentsQuery = useQuery({
    enabled: Boolean(token && scope && id),
    queryKey: scope ? lmsQueryKeys.assignments(scope, id) : ["lms", "signed-out", "assignments", id],
    queryFn: () => apiFetch<Assignment[]>(`/assignments?courseId=${id}`, { token }),
  });
  const course = courseQuery.data;
  const assignments = assignmentsQuery.data ?? [];
  const queryError = courseQuery.error ?? assignmentsQuery.error;
  const error = queryError instanceof Error ? queryError.message : "";
  const loading = courseQuery.isPending || assignmentsQuery.isPending;

  return <div className="page-shell">
    <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/courses")} style={{ marginBottom: 18 }} type="text">Quay lại khóa học</Button>
    {error ? <Alert message={error} showIcon type="error" /> : loading ? <Skeleton active paragraph={{ rows: 8 }} /> : !course ? <Empty description="Không tìm thấy khóa học" /> : <>
      <div className="page-heading"><div><Space style={{ marginBottom: 10 }}><Tag color={course.status === "PUBLISHED" ? "green" : "gold"}>{course.status === "PUBLISHED" ? "Đang mở" : course.status === "DRAFT" ? "Bản nháp" : "Đã lưu trữ"}</Tag><Typography.Text type="secondary">/{course.slug}</Typography.Text></Space><h1>{course.title}</h1><p>{course.description || "Khóa học chưa có mô tả."}</p></div></div>
      {typeof course.instructorId === "object" && <Card className="surface-card" style={{ marginBottom: 20 }}><Space><UserOutlined /><span>Giảng viên phụ trách: <strong>{course.instructorId.fullName}</strong></span></Space></Card>}
      <Card className="surface-card" title={`Bài tập (${assignments.length})`}>
        {assignments.length ? <List dataSource={assignments} renderItem={(item) => <List.Item extra={<Tag color={item.published ? "green" : "gold"}>{item.published ? "Đã giao" : "Bản nháp"}</Tag>}><List.Item.Meta description={<><span>{item.description || "Không có mô tả"}</span>{item.dueAt && <div style={{ marginTop: 7 }}><CalendarOutlined /> Hạn nộp: {dayjs(item.dueAt).format("DD/MM/YYYY HH:mm")}</div>}</>} title={item.title} /></List.Item>} /> : <Empty description="Chưa có bài tập" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
      </Card>
    </>}
  </div>;
}
