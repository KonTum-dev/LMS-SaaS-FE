"use client";

import { useFeedback } from "@/components/feedback/feedback-provider";
import { useI18n } from "@/components/i18n/i18n-provider";
import { formatDate as formatUiDate } from "@/lib/i18n/translate";
import { learningPolishMessages as learningMessages } from "@/lib/i18n/learning-polish-messages";

import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Input, Pagination, Select, Tag } from "antd";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";

import { useEffect, useMemo, useState } from "react";
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
import { listPageCount } from "@/lib/list-controls";
import { getViewerScope, lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";
import type { Course } from "@/lib/types";

interface ReportViewProps {
  readOnly: boolean;
  scope: ViewerScope;
  token: string;
}

function AssessmentReports({ readOnly, scope, token }: ReportViewProps) {
  const { t, locale } = useI18n(learningMessages);
  const { formatError } = useFeedback();
  const router = useRouter();
  const [assessmentId, setAssessmentId] = useState<string | undefined>();
  const [assessmentPage, setAssessmentPage] = useState(1);
  const [selectedAssessment, setSelectedAssessment] = useState<{ label: string; value: string } | null>(null);
  const [courseId, setCourseId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [status, setStatus] = useState<AssessmentAttemptStatus | undefined>();
  const filters = useMemo<AssessmentReportQuery>(() => ({
    assessmentId,
    courseId,
    limit: pageSize,
    page,
    search: search || undefined,
    status,
  }), [assessmentId, courseId, page, pageSize, search, status]);
  const listQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => assessmentApi.listManagerAttempts({ token }, filters),
    queryKey: lmsQueryKeys.assessmentReport(scope, { ...filters }),
  });
  const coursesQuery = useQuery({
    queryFn: () => apiFetch<Course[]>("/courses", { token }),
    queryKey: lmsQueryKeys.courses(scope),
  });
  const assessmentsFilter = useMemo(() => ({ courseId, limit: 20, page: assessmentPage }), [assessmentPage, courseId]);
  const assessmentsQuery = useQuery({
    queryFn: () => assessmentApi.listForManager({ token }, assessmentsFilter),
    queryKey: lmsQueryKeys.assessmentList(scope, assessmentsFilter),
  });
  const assessmentTotal = assessmentsQuery.data?.total;
  useEffect(() => {
    if (assessmentsQuery.isFetching || assessmentsQuery.isError || assessmentTotal === undefined) return;
    const lastPage = listPageCount(assessmentTotal, 20);
    // Synchronize a completed server result after the directory shrinks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (assessmentPage > lastPage) setAssessmentPage(lastPage);
  }, [assessmentPage, assessmentTotal, assessmentsQuery.isError, assessmentsQuery.isFetching]);
  const courseTitles = useMemo(
    () => new Map((coursesQuery.data ?? []).map((course) => [course._id, course.title])),
    [coursesQuery.data],
  );
  const assessmentTitles = useMemo(
    () => new Map([
      ...(assessmentsQuery.data?.items ?? []).map((assessment) => [assessment._id, assessment.title] as const),
      ...(selectedAssessment ? [[selectedAssessment.value, selectedAssessment.label] as const] : []),
    ]),
    [assessmentsQuery.data?.items, selectedAssessment],
  );
  const assessmentOptions = (assessmentsQuery.data?.items ?? []).map((assessment) => ({ label: assessment.title, value: assessment._id }));
  if (selectedAssessment && !assessmentOptions.some((option) => option.value === selectedAssessment.value)) assessmentOptions.unshift(selectedAssessment);
  const directoryError = coursesQuery.error ?? assessmentsQuery.error;
  const updateCourse = (value: string | undefined) => {
    setCourseId(value);
    setAssessmentId(undefined);
    setSelectedAssessment(null);
    setAssessmentPage(1);
    setPage(1);
  };

  const columns: ColumnDef<StockFeatures, AssessmentManagerAttemptRow>[] = [
    {
      id: "learner",
      header: t("Học viên"),
      cell: ({ row }) => <div className="table-primary-cell"><strong>{row.original.learner.fullName}</strong><div className="table-muted">{row.original.learner.email}</div></div>,
    },
    {
      id: "assessment",
      header: t("Bài kiểm tra"),
      cell: ({ row }) => <div><strong>{row.original.assessmentTitle ?? assessmentTitles.get(row.original.assessmentId) ?? row.original.assessmentId}</strong><div className="table-muted">{courseTitles.get(row.original.courseId) ?? row.original.courseId} {t("· Lượt")} {row.original.attemptNumber}</div></div>,
    },
    {
      accessorKey: "status",
      header: t("Trạng thái"),
      cell: ({ getValue }) => <AttemptStatusTag status={getValue<AssessmentAttemptStatus>()} />,
      meta: { width: 130 },
    },
    {
      id: "score",
      header: t("Kết quả"),
      cell: ({ row }) => row.original.score === null || row.original.percentage === null
        ? <span className="table-muted">{t("Chưa có")}</span>
        : <div><strong>{row.original.score}/{row.original.maxScore}</strong><div className="table-muted">{row.original.percentage.toLocaleString(locale === "en" ? "en-US" : "vi-VN")}%</div></div>,
      meta: { responsive: ["sm"], width: 110 },
    },
    {
      id: "passed",
      header: t("Mức đạt"),
      cell: ({ row }) => row.original.passed === null ? "—" : <Tag color={row.original.passed ? "green" : "red"}>{row.original.passed ? t("Đạt") : t("Chưa đạt")}</Tag>,
      meta: { responsive: ["md"], width: 110 },
    },
    {
      accessorKey: "startedAt",
      header: t("Bắt đầu"),
      cell: ({ getValue }) => formatUiDate(getValue<string>(), locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      meta: { responsive: ["lg"], width: 165 },
    },
  ];

  return (
    <main aria-labelledby="reports-title" className="page-shell">
      <header className={`${styles.pageHeader} page-heading`}>
        <div className="page-heading-copy">
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/assessments")} type="link">{t("Bài kiểm tra")}</Button>
          <h1 id="reports-title">{t("Báo cáo lượt làm")}</h1>
          <p>{t("Theo dõi kết quả làm bài theo khóa học.")}</p>
        </div>
        <Button icon={<ReloadOutlined />} loading={listQuery.isFetching} onClick={() => void listQuery.refetch()}>{t("Làm mới")}</Button>
      </header>
      {readOnly && <Alert description={t("Báo cáo vẫn khả dụng đầy đủ vì đây là dữ liệu chỉ đọc.")} showIcon title={t("Workspace chỉ đọc")} type="info" />}
      <Card className="surface-card">
        <section aria-label={t("Bộ lọc báo cáo")} className={styles.reportFilters}>
          <Select
            allowClear
            aria-label={t("Lọc theo khóa học")}
            loading={coursesQuery.isLoading}
            onChange={updateCourse}
            optionFilterProp="label"
            options={(coursesQuery.data ?? []).map((course) => ({ label: course.title, value: course._id }))}
            placeholder={t("Tất cả khóa học")}
            showSearch
            value={courseId}
          />
          <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
          <Select
            allowClear
            aria-label={t("Lọc theo bài kiểm tra")}
            loading={assessmentsQuery.isFetching}
            onChange={(value) => {
              setAssessmentId(value);
              setSelectedAssessment(assessmentOptions.find((option) => option.value === value) ?? null);
              setPage(1);
            }}
            options={assessmentsQuery.isError ? (selectedAssessment ? [selectedAssessment] : []) : assessmentOptions}
            placeholder={t("Tất cả bài kiểm tra")}
            showSearch={false}
            value={assessmentId}
          />
          {!assessmentsQuery.isError && (assessmentsQuery.data?.total ?? 0) > 20 ? <Pagination
            aria-label={t("Phân trang bài kiểm tra")}
            current={assessmentPage}
            disabled={assessmentsQuery.isFetching}
            onChange={(nextPage) => setAssessmentPage(nextPage)}
            pageSize={20}
            showSizeChanger={false}
            simple
            size="small"
            total={assessmentsQuery.data?.total ?? 0}
          /> : null}
          </div>
          <Select
            allowClear
            aria-label={t("Lọc theo trạng thái lượt làm")}
            onChange={(value) => { setStatus(value); setPage(1); }}
            options={(Object.entries(assessmentAttemptStatusLabels) as Array<[AssessmentAttemptStatus, string]>).map(([value, label]) => ({ label: t(label), value }))}
            placeholder={t("Tất cả trạng thái")}
            value={status}
          />
          <Input.Search
            allowClear
            aria-label={t("Tìm học viên theo tên hoặc email")}
            className={styles.reportSearch}
            enterButton={t("Tìm")}
            maxLength={100}
            onChange={(event) => {
              const value = event.target.value;
              setSearchDraft(value);
              if (!value.trim()) { setSearch(""); setPage(1); }
            }}
            onSearch={() => { setSearch(searchDraft.trim()); setPage(1); }}
            placeholder={t("Tên hoặc email học viên")}
            value={searchDraft}
          />
          {(assessmentId || courseId || status || searchDraft || search) ? <Button onClick={() => {
            setAssessmentId(undefined);
            setSelectedAssessment(null);
            setAssessmentPage(1);
            setCourseId(undefined);
            setStatus(undefined);
            setSearchDraft("");
            setSearch("");
            setPage(1);
          }}>{t("Xóa bộ lọc")}</Button> : null}
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
            >{t("Tải lại tên hiển thị")}</Button>
          )}
          description={formatError(directoryError, "Báo cáo vẫn dùng được, nhưng một số khóa học hoặc bài kiểm tra có thể tạm hiển thị bằng mã.")}
          showIcon
          title={t("Không tải đủ tên cho báo cáo")}
          type="warning"
        />
      )}
      {listQuery.error && (
        <Alert
          action={<Button icon={<ReloadOutlined />} onClick={() => void listQuery.refetch()}>{t("Thử lại")}</Button>}
          description={formatError(listQuery.error, "Không thể tải báo cáo.")}
          showIcon
          title={t("Không tải được lượt làm")}
          type="error"
        />
      )}
      <Card className="surface-card table-surface">
        {!listQuery.isError && (
        <DataTable
          ariaLabel={t("Danh sách lượt làm bài kiểm tra")}
          columns={columns}
          data={listQuery.data?.items ?? []}
          emptyText={t("Chưa có lượt làm phù hợp bộ lọc")}
          loading={listQuery.isFetching}
          onPageChange={(nextPage, nextSize) => { setPage(nextSize === pageSize ? nextPage : 1); setPageSize(nextSize); }}
          page={page}
          pageSize={pageSize}
          rowKey="_id"
          scrollX={860}
          total={listQuery.data?.total ?? 0}
        />
        )}
      </Card>
    </main>
  );
}

export default function AssessmentReportsPage() {
  const { t } = useI18n(learningMessages);
  const { effectiveAccess, organization, token, user } = useAuth();
  const scope = getViewerScope(user, organization);
  const manager = user?.role === "TENANT_ADMIN" || user?.role === "INSTRUCTOR";
  if (!effectiveModuleEnabled(effectiveAccess, "ASSESSMENTS")) {
    return <Alert showIcon title={t("Module Bài kiểm tra không khả dụng trong workspace này.")} type="warning" />;
  }
  if (!manager) return <Alert showIcon title={t("Báo cáo lượt làm chỉ dành cho quản trị tổ chức và giảng viên.")} type="error" />;
  if (!token || !scope) return <Alert showIcon title={t("Phiên thành viên không hợp lệ. Vui lòng đăng nhập lại.")} type="error" />;
  const readOnly = effectiveAccess?.readOnly ?? false;
  const authorityKey = `${scope.tenantId}:${scope.membershipId}:${scope.viewerId}:${scope.role}:${readOnly ? "READ_ONLY" : "WRITABLE"}`;
  return <AssessmentReports key={authorityKey} readOnly={readOnly} scope={scope} token={token} />;
}
