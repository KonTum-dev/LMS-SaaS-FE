"use client";

import { ArrowLeftOutlined, CalendarOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Empty, List, Skeleton, Space, Tag, Typography } from "antd";
import dayjs from "dayjs";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import { apiFetch } from "@/lib/api";
import type { Assignment, Course } from "@/lib/types";

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !id) return;
    Promise.all([
      apiFetch<Course>(`/courses/${id}`, { token }),
      apiFetch<Assignment[]>(`/assignments?courseId=${id}`, { token }),
    ])
      .then(([courseData, assignmentData]) => {
        setCourse(courseData);
        setAssignments(assignmentData);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Không mở được khóa học"));
  }, [id, token]);

  return <div className="page-shell">
    <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/courses")} style={{ marginBottom: 18 }} type="text">Quay lại khóa học</Button>
    {error ? <Alert message={error} showIcon type="error" /> : !course ? <Skeleton active paragraph={{ rows: 8 }} /> : <>
      <div className="page-heading"><div><Space style={{ marginBottom: 10 }}><Tag color={course.status === "PUBLISHED" ? "green" : "gold"}>{course.status === "PUBLISHED" ? "Đang mở" : course.status === "DRAFT" ? "Bản nháp" : "Đã lưu trữ"}</Tag><Typography.Text type="secondary">/{course.slug}</Typography.Text></Space><h1>{course.title}</h1><p>{course.description || "Khóa học chưa có mô tả."}</p></div></div>
      {typeof course.instructorId === "object" && <Card className="surface-card" style={{ marginBottom: 20 }}><Space><UserOutlined /><span>Giảng viên phụ trách: <strong>{course.instructorId.fullName}</strong></span></Space></Card>}
      <Card className="surface-card" title={`Bài tập (${assignments.length})`}>
        {assignments.length ? <List dataSource={assignments} renderItem={(item) => <List.Item extra={<Tag color={item.published ? "green" : "gold"}>{item.published ? "Đã giao" : "Bản nháp"}</Tag>}><List.Item.Meta description={<><span>{item.description || "Không có mô tả"}</span>{item.dueAt && <div style={{ marginTop: 7 }}><CalendarOutlined /> Hạn nộp: {dayjs(item.dueAt).format("DD/MM/YYYY HH:mm")}</div>}</>} title={item.title} /></List.Item>} /> : <Empty description="Chưa có bài tập" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
      </Card>
    </>}
  </div>;
}
