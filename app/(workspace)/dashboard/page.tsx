"use client";

import { ArrowRightOutlined, BookOutlined, RiseOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, Empty, List, Row, Skeleton, Statistic, Tag } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import { apiFetch } from "@/lib/api";
import type { DashboardData } from "@/lib/types";

const statusLabel = { DRAFT: "Bản nháp", PUBLISHED: "Đang mở", ARCHIVED: "Đã lưu trữ" } as const;

export default function DashboardPage() {
  const { organization, token, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    apiFetch<DashboardData>("/dashboard", { token }).then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : "Không tải được dashboard"));
  }, [token]);

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div><h1>Xin chào, {user?.fullName?.split(" ").slice(-1)[0]}</h1><p>{user?.role === "SUPER_ADMIN" ? "Theo dõi hoạt động của toàn nền tảng." : `Tổng quan hoạt động tại ${organization?.name ?? "tổ chức của bạn"}.`}</p></div>
        {user?.role !== "LEARNER" && <Button icon={<RiseOutlined />} onClick={() => router.push(user?.role === "SUPER_ADMIN" ? "/admin/tenants" : "/courses")} type="primary">Bắt đầu quản lý</Button>}
      </div>
      {error && <Alert message={error} showIcon style={{ marginBottom: 20 }} type="error" />}
      {!data && !error ? <Skeleton active paragraph={{ rows: 8 }} /> : data && <>
        <Row gutter={[18, 18]}>
          {data.stats.map((stat) => <Col key={stat.key} lg={6} md={12} sm={12} xs={24}><Card className="surface-card stat-card"><Statistic suffix={stat.suffix} title={stat.label} value={stat.value} /></Card></Col>)}
        </Row>
        <Card className="surface-card" extra={user?.role !== "SUPER_ADMIN" && <Button onClick={() => router.push("/courses")} type="link">Xem tất cả <ArrowRightOutlined /></Button>} style={{ marginTop: 20 }} title={<span><BookOutlined /> &nbsp;Khóa học gần đây</span>}>
          {data.recentCourses.length ? <List dataSource={data.recentCourses} renderItem={(course) => <List.Item actions={[<Tag color={course.status === "PUBLISHED" ? "green" : "default"} key="status">{statusLabel[course.status]}</Tag>]}><List.Item.Meta description={course.description || `/${course.slug}`} title={course.title} /></List.Item>} /> : <Empty className="empty-block" description={user?.role === "SUPER_ADMIN" ? "Số liệu khóa học được tổng hợp trên toàn nền tảng" : "Chưa có khóa học nào"} />}
        </Card>
      </>}
    </div>
  );
}
