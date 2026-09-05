"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { formatDate as formatUiDate } from "@/lib/i18n/translate";
import { learningPolishMessages as learningMessages } from "@/lib/i18n/learning-polish-messages";

import { useFeedback } from "@/components/feedback/feedback-provider";

import { ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Input,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";

import { useMemo, useState } from "react";
import { SecureAttachmentList } from "@/components/media/secure-attachment-list";
import { useAuth } from "@/components/providers/app-providers";
import { DataTable } from "@/components/table/data-table";
import { apiFetch } from "@/lib/api";
import { effectiveModuleEnabled } from "@/lib/entitlements";
import { invalidateGradingSubmissionQueries } from "@/lib/query-invalidation";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import { submissionApi, type GradingListQuery } from "@/lib/submission-api";
import type {
  Assignment,
  Course,
  GradingSubmissionDetail,
  GradingSubmissionRow,
  GradingSubmissionStatus,
} from "@/lib/types";

const statusLabels: Record<GradingSubmissionStatus, string> = {
  GRADED: "Đã chấm",
  RETURNED: "Đã trả lại",
  SUBMITTED: "Chờ chấm",
};

interface QueueFilters {
  assignmentId: string;
  courseId: string;
  page: number;
  pageSize: number;
  search: string;
  sort: "NEWEST" | "OLDEST";
  status: GradingSubmissionStatus;
}

interface GradeDraft {
  feedback: string;
  score: string;
  submissionId: string;
}

interface ReturnDraft {
  feedback: string;
  submissionId: string;
}

const defaultQueueFilters = (): QueueFilters => ({
  assignmentId: "",
  courseId: "",
  page: 1,
  pageSize: 20,
  search: "",
  sort: "OLDEST",
  status: "SUBMITTED",
});

function isRevisionConflict(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "SUBMISSION_REVISION_MISMATCH",
  );
}

function selectedString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "target" in value) {
    const target = (value as { target?: { value?: unknown } }).target;
    return typeof target?.value === "string" ? target.value : "";
  }
  return "";
}

function courseIdOf(assignment: Assignment) {
  return typeof assignment.courseId === "string"
    ? assignment.courseId
    : assignment.courseId._id;
}

export default function GradingPage() {

  const { organization, user } = useAuth();
  const scope = getViewerScope(user, organization);
  const scopeKey = scope
    ? `${scope.tenantId}:${scope.membershipId}:${scope.viewerId}:${scope.role}`
    : "signed-out";
  return <ScopedGradingPage key={scopeKey} />;
}

function ScopedGradingPage() {
  const { t, locale } = useI18n(learningMessages);
  const { message, formatError } = useFeedback();
  const { effectiveAccess, organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const scope = getViewerScope(user, organization);
  const assignmentsEnabled = effectiveModuleEnabled(
    effectiveAccess,
    "ASSIGNMENTS",
  );
  const mediaEnabled = effectiveModuleEnabled(effectiveAccess, "MEDIA");
  const managerRole =
    user?.role === "TENANT_ADMIN" || user?.role === "INSTRUCTOR";
  const canRequest = Boolean(
    token && scope && assignmentsEnabled && managerRole,
  );
  const readOnly = effectiveAccess?.readOnly ?? false;
  const [filters, setFilters] = useState<QueueFilters>(defaultQueueFilters);
  const [searchDraft, setSearchDraft] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [returnDraft, setReturnDraft] = useState<ReturnDraft | null>(null);
  const [gradeDraft, setGradeDraft] = useState<GradeDraft | null>(null);

  const requestQuery = useMemo<GradingListQuery>(
    () => ({
      ...(filters.assignmentId ? { assignmentId: filters.assignmentId } : {}),
      ...(filters.courseId ? { courseId: filters.courseId } : {}),
      limit: filters.pageSize,
      page: filters.page,
      ...(filters.search ? { search: filters.search } : {}),
      sort: filters.sort,
      status: filters.status,
    }),
    [filters],
  );
  const listKey = scope
    ? lmsQueryKeys.gradingList(scope, { ...requestQuery })
    : (["lms", "signed-out", "submissions", "grading", "list"] as const);
  const listQuery = useQuery({
    enabled: canRequest,
    queryFn: ({ signal }) =>
      submissionApi.listGradingSubmissions({ token }, requestQuery, signal),
    queryKey: listKey,
    refetchInterval: canRequest ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
  const coursesQuery = useQuery({
    enabled: canRequest,
    queryFn: ({ signal }) => apiFetch<Course[]>("/courses", { signal, token }),
    queryKey: scope
      ? lmsQueryKeys.courses(scope)
      : ["lms", "signed-out", "courses"],
  });
  const assignmentsQuery = useQuery({
    enabled: canRequest,
    queryFn: ({ signal }) =>
      apiFetch<Assignment[]>("/assignments", { signal, token }),
    queryKey: scope
      ? lmsQueryKeys.assignments(scope)
      : ["lms", "signed-out", "assignments"],
  });
  const detailKey =
    scope && selectedId
      ? lmsQueryKeys.gradingDetail(scope, selectedId)
      : ([
        "lms",
        "signed-out",
        "submissions",
        "grading",
        "detail",
        selectedId ?? "none",
      ] as const);
  const detailQuery = useQuery({
    enabled: canRequest && Boolean(selectedId),
    queryFn: ({ signal }) =>
      submissionApi.getGradingSubmission({ token }, selectedId!, signal),
    queryKey: detailKey,
  });

  const detail = detailQuery.data;
  const activeReturnDraft =
    returnDraft?.submissionId === selectedId ? returnDraft : null;
  const returnFeedback = activeReturnDraft?.feedback ?? "";
  const activeGradeDraft =
    gradeDraft?.submissionId === selectedId ? gradeDraft : null;
  const gradeFeedback =
    activeGradeDraft?.feedback ?? detail?.gradingFeedback ?? "";
  const gradeScore =
    activeGradeDraft?.score ??
    (detail?.score === null || detail?.score === undefined
      ? ""
      : String(detail.score));
  const numericScore =
    gradeScore.trim() === "" ? Number.NaN : Number(gradeScore);
  const scoreValid = Boolean(
    detail &&
    Number.isFinite(numericScore) &&
    numericScore >= 0 &&
    numericScore <= detail.maxPoints,
  );
  const canReturn = detail?.status === "SUBMITTED";
  const filesReturnLocked = Boolean(
    canReturn && detail?.submissionMode === "FILES" && !mediaEnabled,
  );
  const canGrade =
    detail?.status === "SUBMITTED" ||
    detail?.status === "RETURNED" ||
    detail?.status === "GRADED";

  const onActionSuccess = async (
    updated: GradingSubmissionDetail,
    successMessage: string,
  ) => {
    const updatedDetailKey = scope
      ? lmsQueryKeys.gradingDetail(scope, updated._id)
      : detailKey;
    queryClient.setQueryData(updatedDetailKey, updated);
    setReturnDraft(null);
    setGradeDraft(null);
    message.success(successMessage);
    if (scope)
      await invalidateGradingSubmissionQueries(
        queryClient,
        scope,
        updated.course._id,
      );
  };
  const returnMutation = useMutation({
    mutationFn: () => {
      if (!selectedId || !detail || !canReturn || readOnly) {
        throw new Error(t("Workspace hiện không cho phép trả lại bài nộp."));
      }
      if (filesReturnLocked) {
        throw new Error(
          t("Bật module Tài liệu riêng tư trước khi trả lại bài nhận tệp."),
        );
      }
      return submissionApi.returnGradingSubmission({ token }, selectedId, {
        expectedRevision: detail!.revision,
        feedback: returnFeedback.trim(),
      });
    },
    onSuccess: (updated) => onActionSuccess(updated, t("Đã trả bài cho học viên")),
  });
  const gradeMutation = useMutation({
    mutationFn: () => {
      if (
        !selectedId ||
        !detail ||
        !canGrade ||
        readOnly ||
        !scoreValid ||
        !gradeFeedback.trim()
      ) {
        throw new Error(t("Workspace hiện không cho phép lưu kết quả chấm bài."));
      }
      return submissionApi.gradeSubmission({ token }, selectedId, {
        expectedRevision: detail!.revision,
        feedback: gradeFeedback.trim(),
        score: numericScore,
      });
    },
    onSuccess: (updated) => onActionSuccess(updated, t("Đã lưu kết quả chấm bài")),
  });
  const actionError = returnMutation.error ?? gradeMutation.error;
  const conflict = isRevisionConflict(actionError);
  const actionBusy = returnMutation.isPending || gradeMutation.isPending;

  const openDetail = (row: GradingSubmissionRow) => {
    if (actionBusy) return;
    setSelectedId(row._id);
    setReturnDraft(null);
    setGradeDraft(null);
    returnMutation.reset();
    gradeMutation.reset();
  };
  const closeDetail = () => {
    if (actionBusy) return;
    setSelectedId(null);
    setReturnDraft(null);
    setGradeDraft(null);
    returnMutation.reset();
    gradeMutation.reset();
  };
  const reloadDetail = async () => {
    await detailQuery.refetch();
    returnMutation.reset();
    gradeMutation.reset();
  };
  const startGrade = () => {
    setGradeDraft({
      feedback: gradeFeedback,
      score: gradeScore,
      submissionId: selectedId!,
    });
    gradeMutation.mutate();
  };
  const updateFilter = (values: Partial<QueueFilters>) =>
    setFilters((current) => ({ ...current, ...values, page: 1 }));
  const applySearch = () => updateFilter({ search: searchDraft.trim() });
  const rows = listQuery.data?.items ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const assignmentOptions = assignments
    .filter(
      (assignment) =>
        !filters.courseId || courseIdOf(assignment) === filters.courseId,
    )
    .map((assignment) => ({ label: assignment.title, value: assignment._id }));

  const columns: ColumnDef<StockFeatures, GradingSubmissionRow>[] = [
    {
      id: "learner",
      header: t("Học viên"),
      cell: ({ row }) => (
        <div className="table-primary-cell">
          <strong>{row.original.learner.fullName}</strong>
          <div className="table-muted">{row.original.learner.email}</div>
        </div>
      ),
    },
    {
      id: "assignment",
      header: t("Bài tập"),
      cell: ({ row }) => (
        <div>
          <strong>{row.original.assignment.title}</strong>
          <div className="table-muted">{row.original.course.title}</div>
          {row.original.submissionMode === "FILES" && (
            <div className="table-muted">
              {row.original.submittedAttachmentIds.length} {t("tệp trong snapshot")}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: t("Trạng thái"),
      cell: ({ getValue }) => (
        <Tag>{t(statusLabels[getValue<GradingSubmissionStatus>()])}</Tag>
      ),
      meta: { width: 120 },
    },
    {
      accessorKey: "submittedAt",
      header: t("Thời điểm nộp"),
      cell: ({ getValue, row }) => (
        <span>
          {formatUiDate(getValue<string>(), locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          {row.original.wasLate ? t("· Muộn") : ""}
        </span>
      ),
      meta: { responsive: ["md"] },
    },
    {
      id: "score",
      header: t("Điểm"),
      cell: ({ row }) =>
        row.original.score === null
          ? "—"
          : `${row.original.score}/${row.original.maxPoints}`,
      meta: { responsive: ["sm"], width: 100 },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          aria-label={t("Mở bài nộp của {p0}", { p0: row.original.learner.fullName })}
          disabled={actionBusy}
          onClick={() => openDetail(row.original)}
          size="small"
        >{t("Mở")}</Button>
      ),
      meta: { width: 80 },
    },
  ];

  if (!assignmentsEnabled) {
    return (
      <main className="page-shell">
        <Alert
          showIcon
          title={t("Module Bài tập không khả dụng trong workspace này.")}
          type="warning"
        />
      </main>
    );
  }
  if (!managerRole) {
    return (
      <main className="page-shell">
        <Alert
          showIcon
          title={t("Khu vực chấm bài chỉ dành cho quản trị tổ chức và giảng viên.")}
          type="info"
        />
      </main>
    );
  }

  return (
    <main className="page-shell grading-page">
      <header className="page-heading page-toolbar">
        <div className="page-heading-copy">
          <h1>{t("Chấm bài")}</h1>
          <p>{t("Theo dõi bài đã nộp, phản hồi để học viên chỉnh sửa và ghi nhận kết quả.")}</p>
        </div>
        <Button
          icon={<ReloadOutlined />}
          loading={listQuery.isFetching}
          onClick={() => void listQuery.refetch()}
        >{t("Làm mới")}</Button>
      </header>
      {readOnly && (
        <Alert
          description={t("Danh sách và nội dung bài nộp vẫn được hiển thị; thao tác trả bài và chấm điểm đang tạm khóa.")}
          showIcon
          title={t("Workspace chỉ đọc")}
          type="info"
        />
      )}

      <section aria-label={t("Bộ lọc")}>
        <div className="list-filter-bar">
          <Select
            aria-label={t("Lọc trạng thái")}
            onChange={(value) =>
              updateFilter({
                status: selectedString(value) as GradingSubmissionStatus,
              })
            }
            options={Object.entries(statusLabels).map(([value, label]) => ({
              label: t(label),
              value,
            }))}
            value={filters.status}
          />
          <Select
            aria-label={t("Sắp xếp bài nộp")}
            onChange={(value) =>
              updateFilter({
                sort: selectedString(value) as QueueFilters["sort"],
              })
            }
            options={[
              { label: t("Cũ nhất trước"), value: "OLDEST" },
              { label: t("Mới nhất trước"), value: "NEWEST" },
            ]}
            value={filters.sort}
          />
          <Select
            allowClear
            aria-label={t("Lọc khóa học")}
            showSearch
            optionFilterProp="label"
            loading={coursesQuery.isPending}
            onChange={(value) =>
              updateFilter({
                assignmentId: "",
                courseId: selectedString(value),
              })
            }
            options={(coursesQuery.data ?? []).map((course) => ({
              label: course.title,
              value: course._id,
            }))}
            placeholder={t("Mọi khóa học")}
            value={filters.courseId || undefined}
          />
          <Select
            allowClear
            aria-label={t("Lọc bài tập")}
            showSearch
            optionFilterProp="label"
            loading={assignmentsQuery.isPending}
            onChange={(value) =>
              updateFilter({ assignmentId: selectedString(value) })
            }
            options={assignmentOptions}
            placeholder={t("Mọi bài tập")}
            value={filters.assignmentId || undefined}
          />
          <Input
            allowClear
            aria-label={t("Tìm học viên")}
            maxLength={100}
            onChange={(event) => {
              const value = event.target.value;
              setSearchDraft(value);
              if (!value.trim()) updateFilter({ search: "" });
            }}
            onPressEnter={applySearch}
            placeholder={t("Tên hoặc email học viên")}
            value={searchDraft}
          />
          <Button onClick={applySearch}>{t("Tìm kiếm")}</Button>
          {(searchDraft || filters.search || filters.courseId || filters.assignmentId || filters.status !== "SUBMITTED" || filters.sort !== "OLDEST") ? (
            <Button onClick={() => {
              setSearchDraft("");
              setFilters((current) => ({ ...defaultQueueFilters(), pageSize: current.pageSize }));
            }}>{t("Xóa bộ lọc")}</Button>
          ) : null}
        </div>
      </section>

      <Card className="surface-card table-surface" title={t("Hàng đợi chấm bài")}>
        {listQuery.error ? (
          <Alert
            showIcon
            title={formatError(
              listQuery.error,
              t("Không tải được hàng đợi chấm bài"),
            )}
            type="error"
          />
        ) : (
          <DataTable
            ariaLabel={t("Danh sách bài nộp cần chấm")}
            columns={columns}
            data={rows}
            emptyText={t("Không có bài nộp phù hợp")}
            loading={listQuery.isPending || listQuery.isFetching}
            onPageChange={(page, pageSize) =>
              setFilters((current) => ({ ...current, pageSize, page: current.pageSize === pageSize ? page : 1 }))
            }
            page={filters.page}
            pageSize={filters.pageSize}
            rowKey="_id"
            scrollX={880}
            total={listQuery.data?.total ?? 0}
          />
        )}
      </Card>

      {selectedId && (
        <Card
          className="surface-card grading-detail-card"
          extra={
            <Button disabled={actionBusy} onClick={closeDetail} size="small">{t("Đóng")}</Button>
          }
          title={t("Chi tiết bài nộp")}
        >
          {detailQuery.error ? (
            <Alert
              showIcon
              title={formatError(
                detailQuery.error,
                t("Không tải được chi tiết bài nộp"),
              )}
              type="error"
            />
          ) : detailQuery.isPending ? (
            <Skeleton active paragraph={{ rows: 7 }} />
          ) : detail ? (
            <>
              <Space size={[8, 8]} wrap>
                <Tag>{t(statusLabels[detail.status])}</Tag>
                <Tag>{detail.attemptCount} {t("lần nộp")}</Tag>
                {detail.wasLate && <Tag color="gold">{t("Nộp muộn")}</Tag>}
              </Space>
              <Typography.Title level={3}>
                {detail.assignment.title}
              </Typography.Title>
              <p>
                <strong>{detail.learner.fullName}</strong> ·{" "}
                {detail.learner.email}
              </p>
              <section aria-labelledby="submitted-snapshot-title">
                <Typography.Title id="submitted-snapshot-title" level={4}>{t("Nội dung đã nộp")}</Typography.Title>
                {detail.submissionMode === "FILES" ? (
                  <>
                    <SecureAttachmentList
                      assetIds={detail.submittedAttachmentIds}
                      mediaEnabled={mediaEnabled}
                      scope={scope!}
                      target={{ kind: "GRADING", submissionId: detail._id }}
                      token={token}
                    />
                    {detail.submittedAttachmentIds.length === 0 && (
                      <Alert
                        showIcon
                        title={t("Snapshot tệp không hợp lệ; không có attachment ID để chấm.")}
                        type="error"
                      />
                    )}
                  </>
                ) : detail.submittedContent ? (
                  <pre className="assignment-submitted-content">
                    {detail.submittedContent}
                  </pre>
                ) : (
                  <Alert
                    showIcon
                    title={t("Snapshot nội dung không hợp lệ hoặc bị thiếu.")}
                    type="error"
                  />
                )}
              </section>
              {detail.returnFeedback && (
                <Alert
                  description={detail.returnFeedback}
                  showIcon
                  title={t("Phản hồi trả bài hiện tại")}
                  type="warning"
                />
              )}
              {detail.score !== null && (
                <section aria-label={t("Kết quả chấm hiện tại")}>
                  <p>
                    <strong>{t("Kết quả hiện tại:")} {detail.score}/{detail.maxPoints} {t("điểm")}</strong>
                    {detail.gradedAt
                      ? ` · ${formatUiDate(detail.gradedAt, locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
                      : ""}
                  </p>
                  <p>{detail.gradingFeedback || t("Chưa có nhận xét.")}</p>
                </section>
              )}

              {filesReturnLocked && (
                <Alert
                  description={t("Bạn vẫn có thể xem snapshot và chấm điểm. Việc trả lại sẽ chỉ mở lại khi module hoạt động để học viên có thể sửa và nộp tệp mới.")}
                  showIcon
                  title={t("Không thể trả lại bài nhận tệp khi Tài liệu riêng tư đang tắt")}
                  type="warning"
                />
              )}

              {actionError &&
                (conflict ? (
                  <Alert
                    action={
                      <Button onClick={() => void reloadDetail()} size="small">{t("Tải lại revision mới nhất")}</Button>
                    }
                    description={t("Điểm và phản hồi bạn đang nhập vẫn được giữ nguyên. Tải lại chi tiết trước khi thử lại.")}
                    showIcon
                    title={t("Bài nộp đã thay đổi ở một phiên khác")}
                    type="warning"
                  />
                ) : (
                  <Alert
                    showIcon
                    title={formatError(
                      actionError,
                      t("Không thể cập nhật bài nộp"),
                    )}
                    type="error"
                  />
                ))}

              {canReturn || canGrade ? (
                <div className="grading-actions">
                  {canReturn && (
                    <Card size="small" title={t("Trả lại để chỉnh sửa")}>
                      <Input.TextArea
                        aria-label={t("Phản hồi trả bài")}
                        disabled={readOnly || actionBusy || filesReturnLocked}
                        maxLength={4000}
                        onChange={(event) =>
                          setReturnDraft({
                            feedback: event.target.value,
                            submissionId: selectedId,
                          })
                        }
                        placeholder={t("Nêu rõ nội dung học viên cần chỉnh sửa")}
                        rows={3}
                        value={returnFeedback}
                      />
                      <Button
                        disabled={
                          readOnly ||
                          actionBusy ||
                          filesReturnLocked ||
                          !returnFeedback.trim()
                        }
                        loading={returnMutation.isPending}
                        onClick={() => returnMutation.mutate()}
                        type="default"
                      >{t("Trả lại cho học viên")}</Button>
                    </Card>
                  )}
                  {canGrade && (
                    <Card
                      size="small"
                      title={
                        detail.status === "GRADED"
                          ? t("Chấm lại")
                          : t("Ghi nhận điểm")
                      }
                    >
                      <Input
                        aria-label={t("Điểm trên {p0}", { p0: detail.maxPoints })}
                        disabled={readOnly || actionBusy}
                        max={detail.maxPoints}
                        min={0}
                        onChange={(event) =>
                          setGradeDraft({
                            feedback: gradeFeedback,
                            score: event.target.value,
                            submissionId: selectedId,
                          })
                        }
                        placeholder={`0–${detail.maxPoints}`}
                        type="number"
                        value={gradeScore}
                      />
                      {!scoreValid && gradeScore.trim() && (
                        <Alert
                          showIcon
                          title={t("Điểm phải từ 0 đến {p0}.", { p0: detail.maxPoints })}
                          type="warning"
                        />
                      )}
                      <Input.TextArea
                        aria-label={t("Phản hồi chấm điểm")}
                        disabled={readOnly || actionBusy}
                        maxLength={4000}
                        onChange={(event) =>
                          setGradeDraft({
                            feedback: event.target.value,
                            score: gradeScore,
                            submissionId: selectedId,
                          })
                        }
                        placeholder={t("Nhận xét cho học viên")}
                        rows={3}
                        value={gradeFeedback}
                      />
                      <Button
                        disabled={
                          readOnly ||
                          actionBusy ||
                          !scoreValid ||
                          !gradeFeedback.trim()
                        }
                        loading={gradeMutation.isPending}
                        onClick={startGrade}
                        type="primary"
                      >
                        {detail.status === "GRADED"
                          ? t("Lưu điểm chấm lại")
                          : t("Chấm điểm")}
                      </Button>
                    </Card>
                  )}
                </div>
              ) : (
                <Alert
                  showIcon
                  title={t("Bài nộp ở trạng thái này không còn thao tác chấm đang chờ.")}
                  type="info"
                />
              )}
            </>
          ) : null}
        </Card>
      )}
    </main>
  );
}
