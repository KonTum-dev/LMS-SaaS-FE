"use client";

import { useFeedback } from "@/components/feedback/feedback-provider";
import { useI18n } from "@/components/i18n/i18n-provider";
import { learningMessages } from "@/lib/i18n/learning-messages";

import { ArrowLeftOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Input, Tag } from "antd";
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

interface LearnerProgressReportProps {
  courseId: string;
  readOnly: boolean;
  role: Extract<UserRole, "INSTRUCTOR" | "TENANT_ADMIN">;
  scope: ViewerScope;
  token: string;
}

export default function CourseLearnerProgressPage() {
  const { t } = useI18n(learningMessages);
  const { id } = useParams<{ id: string }>();
  const { effectiveAccess, organization, token, user } = useAuth();
  const scope = getViewerScope(user, organization);
  const coursesEnabled = effectiveModuleEnabled(effectiveAccess, "COURSES");
  const enrollmentsEnabled = effectiveModuleEnabled(effectiveAccess, "ENROLLMENTS");

  if (!coursesEnabled) {
    return <main className="page-shell"><Alert showIcon title={t("Module Khóa học không khả dụng trong workspace này.")} type="warning" /></main>;
  }
  if (!enrollmentsEnabled) {
    return <main className="page-shell"><Alert showIcon title={t("Module Ghi danh không khả dụng trong workspace này.")} type="warning" /></main>;
  }
  if (!user || !organization || !scope || user.role === "SUPER_ADMIN" || !user.tenantId) {
    return <main className="page-shell"><Alert showIcon title={t("Báo cáo tiến độ chỉ khả dụng trong workspace của tổ chức.")} type="info" /></main>;
  }
  if (user.role !== "TENANT_ADMIN" && user.role !== "INSTRUCTOR") {
    return <main className="page-shell"><Alert showIcon title={t("Báo cáo tiến độ chỉ dành cho quản trị tổ chức và giảng viên.")} type="info" /></main>;
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
  const { t } = useI18n(learningMessages);
  const { formatError } = useFeedback();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const filters = useMemo(() => ({
    limit: pageSize,
    page,
    ...(search ? { search } : {}),
  }), [page, pageSize, search]);
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
      header: t("Học viên"),
      id: "learner",
    },
    {
      cell: ({ row }) => `${row.original.completedRequiredLessons}/${row.original.requiredLessons}`,
      header: t("Bài bắt buộc"),
      id: "requiredLessons",
    },
    {
      accessorKey: "percent",
      cell: ({ getValue }) => <strong>{getValue<number>()}%</strong>,
      header: t("Tiến độ"),
      meta: { width: 110 },
    },
    {
      accessorKey: "completed",
      cell: ({ getValue }) => getValue<boolean>()
        ? <Tag color="green">{t("Hoàn thành khóa học")}</Tag>
        : <Tag>{t("Đang học")}</Tag>,
      header: t("Trạng thái"),
      meta: { width: 170 },
    },
  ];

  return <main aria-labelledby="learner-progress-title" className="page-shell">
    <nav aria-label={t("Điều hướng báo cáo tiến độ")}>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push(`/courses/${courseId}/curriculum`)}
        type="text"
      >{t("Quay lại giáo trình")}</Button>
    </nav>
    <header className="page-heading">
      <div className="page-heading-copy">
        <h1 id="learner-progress-title">{t("Tiến độ học viên")}</h1>
        <p>{t("Theo dõi mức hoàn thành các bài học bắt buộc trong khóa học.")}</p>
      </div>
    </header>
    {readOnly && <Alert
      description={t("Báo cáo vẫn được cập nhật để bạn theo dõi; workspace hiện không cho phép thao tác ghi.")}
      showIcon
      title={t("Workspace chỉ đọc")}
      type="info"
    />}
    <section aria-label={t("Tìm học viên")}>
      <div className="list-filter-bar">
        <Input
          allowClear
          aria-label={t("Tìm học viên theo tên hoặc email")}
          maxLength={100}
          onChange={(event) => {
            const value = event.target.value;
            setSearchDraft(value);
            if (!value.trim()) { setSearch(""); setPage(1); }
          }}
          onPressEnter={applySearch}
          placeholder={t("Tên hoặc email học viên")}
          value={searchDraft}
        />
        <Button loading={progressQuery.isFetching} onClick={applySearch} type="primary">{t("Tìm kiếm")}</Button>
        {(searchDraft || search) ? <Button onClick={() => { setSearchDraft(""); setSearch(""); setPage(1); }}>{t("Xóa bộ lọc")}</Button> : null}
      </div>
    </section>
    <Card
      className={`surface-card table-surface ${styles.progressReport}`}
      extra={<Tag>{progressQuery.data?.total ?? 0} {t("học viên")}</Tag>}
      title={t("Danh sách tiến độ · {p0}", { p0: role === "INSTRUCTOR" ? t("Giảng viên phụ trách") : t("Quản trị tổ chức") })}
    >
      {progressQuery.error
        ? <Alert
          action={<Button loading={progressQuery.isFetching} onClick={() => void progressQuery.refetch()} size="small">{t("Thử lại")}</Button>}
          showIcon
          title={formatError(progressQuery.error)}
          type="error"
        />
        : <DataTable
          ariaLabel={t("Báo cáo tiến độ học viên")}
          columns={columns}
          data={progressQuery.data?.items ?? []}
          emptyText={search ? t("Không tìm thấy học viên phù hợp") : t("Khóa học chưa có học viên đang hoạt động")}
          loading={progressQuery.isPending || progressQuery.isFetching}
          onPageChange={(nextPage, nextSize) => { setPage(nextSize === pageSize ? nextPage : 1); setPageSize(nextSize); }}
          page={page}
          pageSize={pageSize}
          rowKey={(row) => row.learner._id}
          scrollX={680}
          total={progressQuery.data?.total ?? 0}
        />}
    </Card>
  </main>;
}
