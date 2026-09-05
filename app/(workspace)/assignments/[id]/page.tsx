"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { formatDate as formatUiDate } from "@/lib/i18n/translate";
import { learningPolishMessages as learningMessages } from "@/lib/i18n/learning-polish-messages";

import { useFeedback } from "@/components/feedback/feedback-provider";

import {
  ArrowLeftOutlined,
  LinkOutlined,
  SaveOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Input, Space, Spin, Tag } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { SecureAttachmentList } from "@/components/media/secure-attachment-list";
import { SecureMediaUploader } from "@/components/media/secure-media-uploader";
import { useAuth } from "@/components/providers/app-providers";
import { apiFetch } from "@/lib/api";
import { effectiveModuleEnabled } from "@/lib/entitlements";
import { invalidateLearnerSubmissionQueries } from "@/lib/query-invalidation";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import {
  DEFAULT_SUBMISSION_MEDIA_MAX_BYTES,
  MAX_SUBMISSION_ATTACHMENTS,
  SUBMISSION_MEDIA_CONTENT_TYPES,
  type MediaAsset,
} from "@/lib/media-api";
import { submissionApi, type SaveSubmissionInput } from "@/lib/submission-api";
import type {
  Assignment,
  LearnerSubmission,
  SubmissionStatus,
} from "@/lib/types";

type LearnerAssignmentState = "NOT_STARTED" | SubmissionStatus;

const statePresentation: Record<
  LearnerAssignmentState,
  { color: string; label: string }
> = {
  DRAFT: { color: "blue", label: "Bản nháp" },
  GRADED: { color: "green", label: "Đã chấm điểm" },
  NOT_STARTED: { color: "default", label: "Chưa bắt đầu" },
  RETURNED: { color: "gold", label: "Cần chỉnh sửa" },
  SUBMITTED: { color: "cyan", label: "Đã nộp" },
};

function isRevisionConflict(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "SUBMISSION_REVISION_MISMATCH",
  );
}

const MAX_TEXT_BYTES = 50 * 1024;
const MAX_HTTPS_LENGTH = 2048;

export default function LearnerAssignmentPage() {
  const { t, locale } = useI18n(learningMessages);
  function submissionValidationMessage(
    mode: Assignment["submissionMode"],
    content: string,
    attachmentIds: readonly string[],
    mediaEnabled: boolean,
  ) {
    if (mode === "FILES") {
      if (!mediaEnabled)
        return t("Module Tài liệu riêng tư đang tắt; không thể lưu hoặc nộp bài nhận tệp.");
      if (attachmentIds.length < 1)
        return t("Đính kèm ít nhất một tệp đã kiểm tra an toàn.");
      if (attachmentIds.length > MAX_SUBMISSION_ATTACHMENTS) {
        return t("Chỉ được đính kèm tối đa {p0} tệp.", { p0: MAX_SUBMISSION_ATTACHMENTS });
      }
      return new Set(attachmentIds).size === attachmentIds.length
        ? null
        : t("Danh sách tệp không được trùng lặp.");
    }
    const trimmed = content.trim();
    if (!trimmed) return t("Nhập nội dung bài làm trước khi lưu hoặc nộp.");
    if (mode === "TEXT") {
      return new TextEncoder().encode(trimmed).byteLength <= MAX_TEXT_BYTES
        ? null
        : t("Nội dung văn bản không được vượt quá 50 KiB UTF-8.");
    }
    if (trimmed.length > MAX_HTTPS_LENGTH) {
      return t("Liên kết HTTPS không được vượt quá 2.048 ký tự.");
    }
    try {
      const url = new URL(trimmed);
      return url.protocol === "https:" &&
        Boolean(url.hostname) &&
        !url.username &&
        !url.password &&
        url.toString().length <= MAX_HTTPS_LENGTH
        ? null
        : t("Nhập liên kết HTTPS có tên miền và không chứa tên đăng nhập hoặc mật khẩu.");
    } catch {
      return t("Nhập liên kết HTTPS có tên miền và không chứa tên đăng nhập hoặc mật khẩu.");
    }
  }

  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message, formatError } = useFeedback();
  const { effectiveAccess, organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<{
    attachmentIds: string[];
    assignmentId: string;
    baseRevision: number;
    content: string;
  } | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const draftRef = useRef({
    attachmentIds: [] as string[],
    content: "",
    revision: 0,
  });
  const scope = getViewerScope(user, organization);
  const assignmentsEnabled = effectiveModuleEnabled(
    effectiveAccess,
    "ASSIGNMENTS",
  );
  const mediaEnabled = effectiveModuleEnabled(effectiveAccess, "MEDIA");
  const isLearner = user?.role === "LEARNER";
  const canFetchAssignment = Boolean(
    token && scope && id && assignmentsEnabled && user?.role !== "SUPER_ADMIN",
  );
  const canFetchLearnerData = canFetchAssignment && isLearner;
  const readOnly = effectiveAccess?.readOnly ?? false;
  const assignmentKey = scope
    ? lmsQueryKeys.assignmentDetail(scope, id)
    : (["lms", "signed-out", "assignments", "detail", id] as const);
  const submissionKey = scope
    ? lmsQueryKeys.mySubmission(scope, id)
    : (["lms", "signed-out", "submissions", "mine", id] as const);
  const assignmentQuery = useQuery({
    enabled: canFetchAssignment,
    queryFn: ({ signal }) =>
      apiFetch<Assignment>(`/assignments/${id}`, {
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal,
        token,
      }),
    queryKey: assignmentKey,
  });
  const submissionQuery = useQuery({
    enabled: canFetchLearnerData,
    queryFn: ({ signal }) =>
      submissionApi.getMySubmission({ token }, id, signal),
    queryKey: submissionKey,
  });
  const assignment = assignmentQuery.data;
  const submission = submissionQuery.data;
  const state: LearnerAssignmentState = submission?.status ?? "NOT_STARTED";
  const editable =
    state === "NOT_STARTED" || state === "DRAFT" || state === "RETURNED";
  const activeDraft = draft?.assignmentId === id ? draft : null;
  const content = activeDraft?.content ?? submission?.draftContent ?? "";
  const attachmentIds = useMemo(
    () => activeDraft?.attachmentIds ?? submission?.draftAttachmentIds ?? [],
    [activeDraft?.attachmentIds, submission?.draftAttachmentIds],
  );
  const expectedRevision =
    activeDraft?.baseRevision ?? submission?.revision ?? 0;
  useEffect(() => {
    draftRef.current = { attachmentIds, content, revision: expectedRevision };
  }, [attachmentIds, content, expectedRevision]);
  const updateContent = (value: string) => {
    draftRef.current = {
      attachmentIds,
      content: value,
      revision: expectedRevision,
    };
    setDraft({
      attachmentIds,
      assignmentId: id,
      baseRevision: expectedRevision,
      content: value,
    });
  };

  const commitSavedDraft = (saved: LearnerSubmission) => {
    const next = {
      attachmentIds: saved.draftAttachmentIds,
      assignmentId: id,
      baseRevision: saved.revision,
      content: saved.draftContent ?? "",
    };
    draftRef.current = {
      attachmentIds: next.attachmentIds,
      content: next.content,
      revision: next.baseRevision,
    };
    queryClient.setQueryData(submissionKey, saved);
    setDraft(next);
  };
  const saveInput = (): SaveSubmissionInput =>
    assignment?.submissionMode === "FILES"
      ? {
        attachmentIds: [...draftRef.current.attachmentIds],
        expectedRevision: draftRef.current.revision,
      }
      : {
        content: draftRef.current.content,
        expectedRevision: draftRef.current.revision,
      };
  const saveDraft = useMutation({
    mutationFn: (input: SaveSubmissionInput) =>
      submissionApi.saveMySubmission({ token }, id, input),
    onSuccess: async (saved) => {
      commitSavedDraft(saved);
      message.success("Đã lưu bản nháp");
      if (scope) {
        void invalidateLearnerSubmissionQueries(queryClient, scope, id);
      }
    },
  });
  const submit = useMutation({
    mutationFn: async () => {
      const saved = await submissionApi.saveMySubmission(
        { token },
        id,
        saveInput(),
      );
      commitSavedDraft(saved);
      return submissionApi.submitMySubmission({ token }, id, {
        expectedRevision: saved.revision,
      });
    },
    onSuccess: async (submitted) => {
      queryClient.setQueryData(submissionKey, submitted);
      setDraft(null);
      message.success("Đã nộp bài");
      if (scope)
        await invalidateLearnerSubmissionQueries(queryClient, scope, id);
    },
  });
  const busy = saveDraft.isPending || submit.isPending || uploadBusy;
  const mutationError = saveDraft.error ?? submit.error;
  const conflict = isRevisionConflict(mutationError);
  const validationMessage = assignment
    ? submissionValidationMessage(
      assignment.submissionMode,
      content,
      attachmentIds,
      mediaEnabled,
    )
    : t("Không tải được cấu hình bài tập.");
  const contentValid = validationMessage === null;
  const visibleValidationMessage =
    assignment?.submissionMode === "FILES"
      ? validationMessage
      : content.trim()
        ? validationMessage
        : null;
  const reloadLearnerData = async () => {
    const localContent = content;
    const latestSubmission = await submissionQuery.refetch();
    setDraft({
      attachmentIds: [...attachmentIds],
      assignmentId: id,
      baseRevision: latestSubmission.data?.revision ?? 0,
      content: localContent,
    });
    draftRef.current = {
      attachmentIds: [...attachmentIds],
      content: localContent,
      revision: latestSubmission.data?.revision ?? 0,
    };
    saveDraft.reset();
    submit.reset();
  };
  const status = statePresentation[state];
  const metadata = useMemo(() => {
    if (!assignment) return [];
    return [
      t("{p0} điểm", { p0: assignment.maxPoints }),
      assignment.submissionMode === "TEXT"
        ? t("Nộp văn bản")
        : assignment.submissionMode === "HTTPS_LINK"
          ? t("Nộp liên kết HTTPS")
          : t("Nộp tệp riêng tư"),
      assignment.dueAt
        ? t("Hạn {p0}", { p0: formatUiDate(assignment.dueAt, locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) })
        : t("Không giới hạn thời gian"),
    ];
  }, [assignment, locale, t]);
  const replaceDraftAttachments = async (nextAttachmentIds: string[]) => {
    if (!mediaEnabled || readOnly || assignment?.submissionMode !== "FILES") {
      throw new Error(t("Workspace hiện không cho phép cập nhật tệp bản nháp."));
    }
    if (
      nextAttachmentIds.length < 1 ||
      nextAttachmentIds.length > MAX_SUBMISSION_ATTACHMENTS ||
      new Set(nextAttachmentIds).size !== nextAttachmentIds.length
    ) {
      throw new Error(
        t("Bản nháp nhận tệp phải có từ 1 đến {p0} tệp không trùng lặp.", { p0: MAX_SUBMISSION_ATTACHMENTS }),
      );
    }
    const snapshot = draftRef.current;
    await saveDraft.mutateAsync({
      attachmentIds: nextAttachmentIds,
      expectedRevision: snapshot.revision,
    });
  };
  const attachAvailableAsset = async (asset: MediaAsset) => {
    const current = draftRef.current.attachmentIds;
    if (current.includes(asset._id)) return;
    if (current.length >= MAX_SUBMISSION_ATTACHMENTS) {
      throw new Error(
        t("Bài làm chỉ được đính kèm tối đa {p0} tệp.", { p0: MAX_SUBMISSION_ATTACHMENTS }),
      );
    }
    await replaceDraftAttachments([...current, asset._id]);
  };

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
  if (!user || user.role === "SUPER_ADMIN") {
    return (
      <main className="page-shell">
        <Alert
          showIcon
          title={t("Trang bài làm chỉ khả dụng trong workspace của tổ chức.")}
          type="info"
        />
      </main>
    );
  }
  if (assignmentQuery.error) {
    return (
      <main className="page-shell">
        <Alert
          action={<Button disabled={assignmentQuery.isFetching} loading={assignmentQuery.isFetching} onClick={() => { if (!assignmentQuery.isFetching) void assignmentQuery.refetch(); }} size="small">{t("Thử lại")}</Button>}
          showIcon
          title={formatError(assignmentQuery.error, t("Không tải được bài tập"))}
          type="error"
        />
      </main>
    );
  }
  if (assignmentQuery.isPending) {
    return (
      <main
        aria-label={t("Đang tải bài tập")}
        className="page-shell page-loading"
        role="status"
      >
        <Spin size="large" />
      </main>
    );
  }
  if (!assignment) {
    return (
      <main className="page-shell">
        <Alert showIcon title={t("Không tìm thấy bài tập")} type="warning" />
      </main>
    );
  }

  return (
    <main
      aria-labelledby="learner-assignment-title"
      className="page-shell assignment-detail-page"
    >
      <nav aria-label={t("Điều hướng bài tập")}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/assignments")}
          type="text"
        >{t("Quay lại bài tập")}</Button>
      </nav>
      <header className="page-heading">
        <div className="page-heading-copy">
          <Space size={[8, 8]} wrap>
            <Tag color={status.color}>{t(status.label)}</Tag>
            {metadata.map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
          </Space>
          <h1 id="learner-assignment-title">{assignment.title}</h1>
          {assignment.description && <p>{assignment.description}</p>}
        </div>
      </header>

      {!isLearner ? (
        <Alert showIcon title={t("Khu vực nộp bài dành cho học viên")} type="info" />
      ) : submissionQuery.error ? (
        <Alert
          action={<Button disabled={submissionQuery.isFetching} loading={submissionQuery.isFetching} onClick={() => { if (!submissionQuery.isFetching) void submissionQuery.refetch(); }} size="small">{t("Thử lại")}</Button>}
          showIcon
          title={formatError(submissionQuery.error, t("Không tải được bài làm"))}
          type="error"
        />
      ) : submissionQuery.isPending ? (
        <div
          aria-label={t("Đang tải bài làm")}
          className="page-loading"
          role="status"
        >
          <Spin />
        </div>
      ) : (
        <>
          {readOnly && (
            <Alert
              description={t("Bạn vẫn xem được bài làm và kết quả; lưu nháp và nộp bài đang tạm khóa.")}
              showIcon
              title={t("Workspace chỉ đọc")}
              type="info"
            />
          )}
          {state === "RETURNED" && (
            <Alert
              description={
                submission?.returnFeedback ||
                t("Giảng viên yêu cầu bạn cập nhật bài làm.")
              }
              showIcon
              title={t("Phản hồi yêu cầu chỉnh sửa")}
              type="warning"
            />
          )}
          {conflict ? (
            <Alert
              action={
                <Button onClick={() => void reloadLearnerData()} size="small">{t("Đồng bộ revision mới nhất")}</Button>
              }
              description={t("Nội dung đang nhập được giữ nguyên khi tải bản mới nhất.")}
              showIcon
              title={t("Bản nháp đã thay đổi ở một phiên khác")}
              type="warning"
            />
          ) : mutationError ? (
            <Alert
              showIcon
              title={formatError(mutationError, t("Không thể lưu bài làm"))}
              type="error"
            />
          ) : null}

          {editable ? (
            <Card
              className="surface-card"
              title={
                state === "RETURNED"
                  ? t("Chỉnh sửa và nộp lại")
                  : t("Bài làm của bạn")
              }
            >
              {assignment.submissionMode === "TEXT" ? (
                <Input.TextArea
                  aria-describedby={
                    visibleValidationMessage
                      ? "submission-content-validation"
                      : undefined
                  }
                  aria-invalid={Boolean(visibleValidationMessage)}
                  aria-label={t("Nội dung bài làm")}
                  disabled={readOnly || busy}
                  onChange={(event) => updateContent(event.target.value)}
                  placeholder={t("Nhập nội dung bài làm")}
                  rows={10}
                  value={content}
                />
              ) : assignment.submissionMode === "HTTPS_LINK" ? (
                <Input
                  aria-describedby={
                    visibleValidationMessage
                      ? "submission-content-validation"
                      : undefined
                  }
                  aria-invalid={Boolean(visibleValidationMessage)}
                  aria-label={t("Liên kết bài làm HTTPS")}
                  disabled={readOnly || busy}
                  onChange={(event) => updateContent(event.target.value)}
                  placeholder="https://example.com/bai-lam"
                  prefix={<LinkOutlined />}
                  type="url"
                  value={content}
                />
              ) : (
                <Space orientation="vertical" size={14} style={{ width: "100%" }}>
                  <SecureAttachmentList
                    assetIds={attachmentIds}
                    canMutate={mediaEnabled && !readOnly && !busy}
                    mediaEnabled={mediaEnabled}
                    minCount={1}
                    onReplace={replaceDraftAttachments}
                    replacing={saveDraft.isPending}
                    scope={scope!}
                    target={{ assignmentId: id, kind: "LEARNER_SUBMISSION" }}
                    token={token}
                  />
                  {mediaEnabled && (
                    <SecureMediaUploader
                      allowedContentTypes={SUBMISSION_MEDIA_CONTENT_TYPES}
                      currentAssetIds={attachmentIds}
                      disabled={
                        readOnly || submit.isPending
                      }
                      label={t("Thêm tệp bài làm")}
                      maxBytes={DEFAULT_SUBMISSION_MEDIA_MAX_BYTES}
                      maxCount={MAX_SUBMISSION_ATTACHMENTS}
                      onAvailable={attachAvailableAsset}
                      onBusyChange={setUploadBusy}
                      target={{ assignmentId: id, kind: "LEARNER_SUBMISSION" }}
                      token={token}
                    />
                  )}
                  {!mediaEnabled && (
                    <Alert
                      description={t("Tệp đã nộp vẫn hiển thị. Các thao tác với tệp đang tạm khóa.")}
                      showIcon
                      title={t("Tệp riêng tư hiện không khả dụng")}
                      type="warning"
                    />
                  )}
                </Space>
              )}
              {visibleValidationMessage && (
                <div id="submission-content-validation">
                  <Alert
                    showIcon
                    title={visibleValidationMessage}
                    type="warning"
                  />
                </div>
              )}
              <Space style={{ marginTop: 18 }} wrap>
                <Button
                  disabled={readOnly || busy || !contentValid}
                  icon={<SaveOutlined />}
                  loading={saveDraft.isPending}
                  onClick={() => saveDraft.mutate(saveInput())}
                >{t("Lưu bản nháp")}</Button>
                <Button
                  disabled={readOnly || busy || !contentValid}
                  icon={<SendOutlined />}
                  loading={submit.isPending}
                  onClick={() => submit.mutate()}
                  type="primary"
                >
                  {state === "RETURNED" ? t("Nộp lại") : t("Nộp bài")}
                </Button>
              </Space>
            </Card>
          ) : (
            <Card className="surface-card" title={t("Bài làm đã gửi")}>
              <p>
                {state === "SUBMITTED"
                  ? t("Bài làm đang chờ giảng viên chấm điểm.")
                  : t("Bài làm đã được chấm điểm.")}
              </p>
              {submission?.submittedContent && (
                <pre className="assignment-submitted-content">
                  {submission.submittedContent}
                </pre>
              )}
              {submission?.submissionMode === "FILES" && (
                <SecureAttachmentList
                  assetIds={submission.submittedAttachmentIds}
                  mediaEnabled={mediaEnabled}
                  scope={scope!}
                  target={{ assignmentId: id, kind: "LEARNER_SUBMISSION" }}
                  token={token}
                />
              )}
              {submission?.submittedAt && (
                <p>{t("Đã nộp lúc")}{" "}
                  {formatUiDate(submission.submittedAt, locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} {t("· Lần")} {submission.attemptCount}
                </p>
              )}
            </Card>
          )}

          {editable &&
            submission?.submissionMode === "FILES" &&
            submission.submittedAttachmentIds.length > 0 && (
              <Card className="surface-card" title={t("Bài nộp trước")}>
                <SecureAttachmentList
                  assetIds={submission.submittedAttachmentIds}
                  mediaEnabled={mediaEnabled}
                  scope={scope!}
                  target={{ assignmentId: id, kind: "LEARNER_SUBMISSION" }}
                  token={token}
                />
              </Card>
            )}

          {state === "GRADED" &&
            submission?.score !== null &&
            submission?.gradedAt && (
              <Card className="surface-card" title={t("Kết quả")}>
                <p>
                  <strong>
                    {submission.score}/{submission.maxPoints} {t("điểm ·")}{" "}
                    {Math.round(
                      (submission.score / submission.maxPoints) * 10_000,
                    ) / 100}
                    %
                  </strong>
                </p>
                <p>
                  {submission.gradingFeedback ||
                    t("Chưa có nhận xét từ giảng viên.")}
                </p>
                <small>{t("Chấm lúc")}{" "}
                  {formatUiDate(submission.gradedAt, locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </small>
              </Card>
            )}
        </>
      )}
    </main>
  );
}
