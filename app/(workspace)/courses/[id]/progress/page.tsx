"use client";

import { ArrowLeftOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Input, Space, Tag } from "antd";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import { DataTable } from "@/components/table/data-table";
import styles from "@/components/curriculum/curriculum.module.css";
import { curriculumApi } from "@/lib/curriculum-api";
import { effectiveModuleEnabled } from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";
import type { LearnerProgressRow, UserRole } from "@/lib/types";

const PAGE_SIZE = 20;

interface LearnerProgressReportProps {
  courseId: string;
  readOnly: boolean;
  role: Extract<UserRole, "INSTRUCTOR" | "TENANT_ADMIN">;
  scope: ViewerScope;
  token: string;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Không tải được tiến độ học viên";
}

export default function CourseLearnerProgressPage() {
  const { id } = useParams<{ id: string }>();
  const { effectiveAccess, organization, token, user } = useAuth();
  const scope = getViewerScope(user, organization);
  const coursesEnabled = effectiveModuleEnabled(effectiveAccess, "COURSES");
  const enrollmentsEnabled = effectiveModuleEnabled(effectiveAccess, "ENROLLMENTS");

  if (!coursesEnabled) {
    return <main className="page-shell"><Alert showIcon title="Module Khóa học không khả dụng trong workspace này." type="warning" /></main>;
  }
  if (!enrollmentsEnabled) {
    return <main className="page-shell"><Alert showIcon title="Module Ghi danh không khả dụng trong workspace này." type="warning" /></main>;
  }
  if (!user || !organization || !scope || user.role === "SUPER_ADMIN" || !user.tenantId) {
    return <main className="page-shell"><Alert showIcon title="Báo cáo tiến độ chỉ khả dụng trong workspace của tổ chức." type="info" /></main>;
  }
  if (user.role !== "TENANT_ADMIN" && user.role !== "INSTRUCTOR") {
    return <main className="page-shell"><Alert showIcon title="Báo cáo tiến độ chỉ dành cho quản trị tổ chức và giảng viên." type="info" /></main>;
  }

  const readOnly = effectiveAccess?.readOnly ?? false;
  const authorityKey = `${scope.tenantId}:${scope.membershipId}:${scope.viewerId}:${scope.role}:${id}:${readOnly ? "READ_ONLY" : "WRITABLE"}`;
  return <LearnerProgressReport
    courseId={id}
    key={authorityKey}
    readOnly={readOnly}
    role={user.role}
    scope={scope}
    token={token}
  />;
}

function LearnerProgressReport({
  courseId,
  readOnly,
  role,
  scope,
  token,
}: LearnerProgressReportProps) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const filters = useMemo(() => ({
    limit: PAGE_SIZE,
    page,
    ...(search ? { search } : {}),
  }), [page, search]);
  const progressQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => curriculumApi.getLearnerProgress({ token }, courseId, filters),
    queryKey: lmsQueryKeys.courseLearnerProgress(scope, courseId, filters),
  });
  const applySearch = () => {
    setPage(1);
    setSearch(searchDraft.trim());
  };
  const columns: ColumnDef<StockFeatures, LearnerProgressRow>[] = [
    {
      cell: ({ row }) => <div className="table-primary-cell">
        <strong>{row.original.learner.fullName}</strong>
        <div className="table-muted">{row.original.learner.email}</div>
      </div>,
      header: "Học viên",
      id: "learner",
    },
    {
      cell: ({ row }) => `${row.original.completedRequiredLessons}/${row.original.requiredLessons}`,
      header: "Bài bắt buộc",
      id: "requiredLessons",
    },
    {
      accessorKey: "percent",
      cell: ({ getValue }) => <strong>{getValue<number>()}%</strong>,
      header: "Tiến độ",
      meta: { width: 110 },
    },
    {
      accessorKey: "completed",
      cell: ({ getValue }) => getValue<boolean>()
        ? <Tag color="green">Hoàn thành khóa học</Tag>
        : <Tag>Đang học</Tag>,
      header: "Trạng thái",
      meta: { width: 170 },
    },
  ];

  return <main aria-labelledby="learner-progress-title" className="page-shell">
    <nav aria-label="Điều hướng báo cáo tiến độ">
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push(`/courses/${courseId}/curriculum`)}
        type="text"
      >Quay lại giáo trình</Button>
    </nav>
    <header className="page-heading">
      <div className="page-heading-copy">
        <h1 id="learner-progress-title">Tiến độ học viên</h1>
        <p>Theo dõi mức hoàn thành các bài học bắt buộc trong khóa học.</p>
      </div>
    </header>
    {readOnly && <Alert
      description="Báo cáo vẫn được cập nhật để bạn theo dõi; workspace hiện không cho phép thao tác ghi."
      showIcon
      title="Workspace chỉ đọc"
      type="info"
    />}
    <Card className="surface-card" title="Tìm học viên">
      <Space size={[8, 8]} wrap>
        <Input
          allowClear
          aria-label="Tìm học viên theo tên hoặc email"
          maxLength={100}
          onChange={(event) => setSearchDraft(event.target.value)}
          onPressEnter={applySearch}
          placeholder="Tên hoặc email học viên"
          value={searchDraft}
        />
        <Button onClick={applySearch} type="primary">Tìm kiếm</Button>
      </Space>
    </Card>
    <Card
      className={`surface-card table-surface ${styles.progressReport}`}
      extra={<Tag>{progressQuery.data?.total ?? 0} học viên</Tag>}
      title={`Danh sách tiến độ · ${role === "INSTRUCTOR" ? "Giảng viên phụ trách" : "Quản trị tổ chức"}`}
    >
      {progressQuery.error
        ? <Alert
          action={<Button onClick={() => void progressQuery.refetch()} size="small">Thử lại</Button>}
          showIcon
          title={errorMessage(progressQuery.error)}
          type="error"
        />
        : <DataTable
          ariaLabel="Báo cáo tiến độ học viên"
          columns={columns}
          data={progressQuery.data?.items ?? []}
          emptyText={search ? "Không tìm thấy học viên phù hợp" : "Khóa học chưa có học viên đang hoạt động"}
          loading={progressQuery.isPending || progressQuery.isFetching}
          onPageChange={(nextPage) => setPage(nextPage)}
          page={progressQuery.data?.page ?? page}
          pageSize={progressQuery.data?.limit ?? PAGE_SIZE}
          rowKey={(row) => row.learner._id}
          scrollX={680}
          total={progressQuery.data?.total ?? 0}
        />}
    </Card>
  </main>;
}
