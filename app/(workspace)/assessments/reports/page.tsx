"use client";

import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Input, Select, Tag } from "antd";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/assessments/assessments.module.css";
import { assessmentAttemptStatusLabels, AttemptStatusTag } from "@/components/assessments/assessment-presenters";
import { useAuth } from "@/components/providers/app-providers";
import { DataTable } from "@/components/table/data-table";
import {
  assessmentApi,
  type AssessmentAttemptStatus,
  type AssessmentManagerAttemptRow,
  type AssessmentReportQuery,
} from "@/lib/assessment-api";
import { apiFetch } from "@/lib/api";
import { effectiveModuleEnabled } from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";
import type { Course } from "@/lib/types";

const PAGE_SIZE = 20;

interface ReportViewProps {
  readOnly: boolean;
  scope: ViewerScope;
  token: string;
}

function AssessmentReports({ readOnly, scope, token }: ReportViewProps) {
  const router = useRouter();
  const [assessmentId, setAssessmentId] = useState<string | undefined>();
  const [courseId, setCourseId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [status, setStatus] = useState<AssessmentAttemptStatus | undefined>();
  const filters = useMemo<AssessmentReportQuery>(() => ({
    assessmentId,
    courseId,
    limit: PAGE_SIZE,
    page,
    search: search || undefined,
    status,
  }), [assessmentId, courseId, page, search, status]);
  const listQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => assessmentApi.listManagerAttempts({ token }, filters),
    queryKey: lmsQueryKeys.assessmentReport(scope, { ...filters }),
  });
  const coursesQuery = useQuery({
    queryFn: () => apiFetch<Course[]>("/courses", { token }),
    queryKey: lmsQueryKeys.courses(scope),
  });
  const assessmentsFilter = useMemo(() => ({ courseId, limit: 100, page: 1 }), [courseId]);
  const assessmentsQuery = useQuery({
    queryFn: () => assessmentApi.listForManager({ token }, assessmentsFilter),
    queryKey: lmsQueryKeys.assessmentList(scope, assessmentsFilter),
  });
  const courseTitles = useMemo(
    () => new Map((coursesQuery.data ?? []).map((course) => [course._id, course.title])),
    [coursesQuery.data],
  );
  const assessmentTitles = useMemo(
    () => new Map((assessmentsQuery.data?.items ?? []).map((assessment) => [assessment._id, assessment.title])),
    [assessmentsQuery.data?.items],
  );
  const directoryError = coursesQuery.error ?? assessmentsQuery.error;
  const updateCourse = (value: string | undefined) => {
    setCourseId(value);
    setAssessmentId(undefined);
    setPage(1);
  };

  const columns: ColumnDef<StockFeatures, AssessmentManagerAttemptRow>[] = [
    {
      id: "learner",
      header: "Học viên",
      cell: ({ row }) => <div className="table-primary-cell"><strong>{row.original.learner.fullName}</strong><div className="table-muted">{row.original.learner.email}</div></div>,
    },
    {
      id: "assessment",
      header: "Bài kiểm tra",
      cell: ({ row }) => <div><strong>{assessmentTitles.get(row.original.assessmentId) ?? row.original.assessmentId}</strong><div className="table-muted">{courseTitles.get(row.original.courseId) ?? row.original.courseId} · Lượt {row.original.attemptNumber}</div></div>,
    },
    {
      accessorKey: "status",
      header: "Trạng thái",
      cell: ({ getValue }) => <AttemptStatusTag status={getValue<AssessmentAttemptStatus>()} />,
      meta: { width: 130 },
    },
    {
      id: "score",
      header: "Kết quả",
      cell: ({ row }) => row.original.score === null || row.original.percentage === null
        ? <span className="table-muted">Chưa có</span>
        : <div><strong>{row.original.score}/{row.original.maxScore}</strong><div className="table-muted">{row.original.percentage.toLocaleString("vi-VN")}%</div></div>,
      meta: { responsive: ["sm"], width: 110 },
    },
    {
      id: "passed",
      header: "Mức đạt",
      cell: ({ row }) => row.original.passed === null ? "—" : <Tag color={row.original.passed ? "green" : "red"}>{row.original.passed ? "Đạt" : "Chưa đạt"}</Tag>,
      meta: { responsive: ["md"], width: 110 },
    },
    {
      accessorKey: "startedAt",
      header: "Bắt đầu",
      cell: ({ getValue }) => dayjs(getValue<string>()).format("DD/MM/YYYY HH:mm"),
      meta: { responsive: ["lg"], width: 165 },
    },
  ];

  return (
    <main aria-labelledby="reports-title" className="page-shell">
      <header className={`${styles.pageHeader} page-heading`}>
        <div className="page-heading-copy">
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/assessments")} type="link">Bài kiểm tra</Button>
          <h1 id="reports-title">Báo cáo lượt làm</h1>
          <p>Kết quả tổng hợp theo phạm vi khóa học được phép quản lý; không hiển thị đáp án hoặc đúng/sai từng câu.</p>
        </div>
        <Button icon={<ReloadOutlined />} loading={listQuery.isFetching} onClick={() => void listQuery.refetch()}>Làm mới</Button>
      </header>
      {readOnly && <Alert description="Báo cáo vẫn khả dụng đầy đủ vì đây là dữ liệu chỉ đọc." showIcon title="Workspace chỉ đọc" type="info" />}
      <Card className="surface-card">
        <section aria-label="Bộ lọc báo cáo" className={styles.reportFilters}>
          <Select
            allowClear
            aria-label="Lọc theo khóa học"
            loading={coursesQuery.isLoading}
            onChange={updateCourse}
            optionFilterProp="label"
            options={(coursesQuery.data ?? []).map((course) => ({ label: course.title, value: course._id }))}
            placeholder="Tất cả khóa học"
            showSearch
            value={courseId}
          />
          <Select
            allowClear
            aria-label="Lọc theo bài kiểm tra"
            loading={assessmentsQuery.isLoading}
            onChange={(value) => { setAssessmentId(value); setPage(1); }}
            optionFilterProp="label"
            options={(assessmentsQuery.data?.items ?? []).map((assessment) => ({ label: assessment.title, value: assessment._id }))}
            placeholder="Tất cả bài kiểm tra"
            showSearch
            value={assessmentId}
          />
          <Select
            allowClear
            aria-label="Lọc theo trạng thái lượt làm"
            onChange={(value) => { setStatus(value); setPage(1); }}
            options={(Object.entries(assessmentAttemptStatusLabels) as Array<[AssessmentAttemptStatus, string]>).map(([value, label]) => ({ label, value }))}
            placeholder="Tất cả trạng thái"
            value={status}
          />
          <Input.Search
            allowClear
            aria-label="Tìm học viên theo tên hoặc email"
            className={styles.reportSearch}
            enterButton="Tìm"
            maxLength={100}
            onChange={(event) => setSearchDraft(event.target.value)}
            onSearch={() => { setSearch(searchDraft.trim()); setPage(1); }}
            placeholder="Tên hoặc email học viên"
            value={searchDraft}
          />
        </section>
      </Card>
      {directoryError && (
        <Alert
          action={(
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                void coursesQuery.refetch();
                void assessmentsQuery.refetch();
              }}
            >
              Tải lại tên hiển thị
            </Button>
          )}
          description={directoryError instanceof Error
            ? directoryError.message
            : "Báo cáo vẫn dùng được, nhưng một số khóa học hoặc bài kiểm tra có thể tạm hiển thị bằng mã."}
          showIcon
          title="Không tải đủ tên cho báo cáo"
          type="warning"
        />
      )}
      {listQuery.error && (
        <Alert
          action={<Button icon={<ReloadOutlined />} onClick={() => void listQuery.refetch()}>Thử lại</Button>}
          description={listQuery.error instanceof Error ? listQuery.error.message : "Không thể tải báo cáo."}
          showIcon
          title="Không tải được lượt làm"
          type="error"
        />
      )}
      <Card className="surface-card table-surface">
        <DataTable
          ariaLabel="Danh sách lượt làm bài kiểm tra"
          columns={columns}
          data={listQuery.data?.items ?? []}
          emptyText="Chưa có lượt làm phù hợp bộ lọc"
          loading={listQuery.isLoading}
          onPageChange={(nextPage) => setPage(nextPage)}
          page={listQuery.data?.page ?? page}
          pageSize={listQuery.data?.limit ?? PAGE_SIZE}
          rowKey="_id"
          scrollX={860}
          total={listQuery.data?.total ?? 0}
        />
      </Card>
    </main>
  );
}

export default function AssessmentReportsPage() {
  const { effectiveAccess, organization, token, user } = useAuth();
  const scope = getViewerScope(user, organization);
  const manager = user?.role === "TENANT_ADMIN" || user?.role === "INSTRUCTOR";
  if (!effectiveModuleEnabled(effectiveAccess, "ASSESSMENTS")) {
    return <Alert showIcon title="Module Bài kiểm tra không khả dụng trong workspace này." type="warning" />;
  }
  if (!manager) return <Alert showIcon title="Báo cáo lượt làm chỉ dành cho quản trị tổ chức và giảng viên." type="error" />;
  if (!token || !scope) return <Alert showIcon title="Phiên thành viên không hợp lệ. Vui lòng đăng nhập lại." type="error" />;
  const readOnly = effectiveAccess?.readOnly ?? false;
  const authorityKey = `${scope.tenantId}:${scope.membershipId}:${scope.viewerId}:${scope.role}:${readOnly ? "READ_ONLY" : "WRITABLE"}`;
  return <AssessmentReports key={authorityKey} readOnly={readOnly} scope={scope} token={token} />;
}
