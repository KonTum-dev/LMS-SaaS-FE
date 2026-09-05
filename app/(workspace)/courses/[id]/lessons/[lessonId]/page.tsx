"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { learningMessages } from "@/lib/i18n/learning-messages";

import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  SendOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useAuth } from "@/components/providers/app-providers";
import styles from "@/components/curriculum/curriculum.module.css";
import { SecureAttachmentList } from "@/components/media/secure-attachment-list";
import { SecureMediaUploader } from "@/components/media/secure-media-uploader";
import { YouTubePublishAction } from "@/components/media/youtube-publish-action";
import { curriculumApi } from "@/lib/curriculum-api";
import { effectiveModuleEnabled } from "@/lib/entitlements";
import {
  DEFAULT_LESSON_MEDIA_MAX_BYTES,
  LESSON_MEDIA_CONTENT_TYPES,
  MAX_LESSON_ATTACHMENTS,
  type MediaAsset,
} from "@/lib/media-api";
import {
  invalidateCurriculumQueries,
  invalidateLessonProgressQueries,
} from "@/lib/query-invalidation";
import {
  getViewerScope,
  lmsQueryKeys,
  type ViewerScope,
} from "@/lib/query-keys";
import type { LessonDetail, LessonType, UserRole } from "@/lib/types";
import { canPublishYouTube } from "@/lib/workspace-access";

interface LessonViewerProps {
  courseId: string;
  canPublishYouTube: boolean;
  lessonId: string;
  mediaEnabled: boolean;
  readOnly: boolean;
  role: Exclude<UserRole, "SUPER_ADMIN">;
  scope: ViewerScope;
  token: string;
}

interface LessonEditDraft {
  content: string;
  estimatedMinutes: string;
  expectedRevision: number;
  original: string;
  required: boolean;
  summary: string;
  title: string;
  type: LessonType;
}

const MAX_LESSON_TEXT_BYTES = 100 * 1024;
const MAX_HTTPS_LENGTH = 2048;

function safeHttpsUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname &&
      !url.username &&
      !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function draftFingerprint(
  draft: Omit<LessonEditDraft, "expectedRevision" | "original">,
) {
  return JSON.stringify({
    content: draft.type === "TEXT" ? draft.content : draft.content.trim(),
    estimatedMinutes: draft.estimatedMinutes.trim(),
    required: draft.required,
    summary: draft.summary.trim(),
    title: draft.title.trim(),
    type: draft.type,
  });
}

function draftFromLesson(lesson: LessonDetail): LessonEditDraft {
  const values = {
    content:
      lesson.type === "TEXT"
        ? (lesson.textContent ?? "")
        : (lesson.sourceUrl ?? ""),
    estimatedMinutes:
      lesson.estimatedMinutes == null ? "" : String(lesson.estimatedMinutes),
    required: lesson.required,
    summary: lesson.summary,
    title: lesson.title,
    type: lesson.type,
  };
  return {
    ...values,
    expectedRevision: lesson.revision,
    original: draftFingerprint(values),
  };
}

export default function LessonPage() {
  const { t } = useI18n(learningMessages);
  const { id, lessonId } = useParams<{ id: string; lessonId: string }>();
  const { effectiveAccess, organization, token, user } = useAuth();
  const coursesEnabled = effectiveModuleEnabled(effectiveAccess, "COURSES");
  const mediaEnabled = effectiveModuleEnabled(effectiveAccess, "MEDIA");
  const scope = getViewerScope(user, organization);

  if (!coursesEnabled) {
    return (
      <main className="page-shell">
        <Alert
          showIcon
          title={t("Module Khóa học không khả dụng trong workspace này.")}
          type="warning"
        />
      </main>
    );
  }
  if (
    !user ||
    !organization ||
    !scope ||
    user.role === "SUPER_ADMIN" ||
    !user.tenantId
  ) {
    return (
      <main className="page-shell">
        <Alert
          showIcon
          title={t("Bài học chỉ khả dụng trong workspace của tổ chức.")}
          type="info"
        />
      </main>
    );
  }

  const readOnly = effectiveAccess?.readOnly ?? false;
  const authorityKey = `${scope.tenantId}:${scope.membershipId}:${scope.viewerId}:${scope.role}:${id}:${lessonId}:${mediaEnabled ? "MEDIA" : "NO_MEDIA"}:${readOnly ? "READ_ONLY" : "WRITABLE"}`;
  return (
    <LessonViewer
      courseId={id}
      canPublishYouTube={canPublishYouTube(user)}
      key={authorityKey}
      lessonId={lessonId}
      mediaEnabled={mediaEnabled}
      readOnly={readOnly}
      role={user.role}
      scope={scope}
      token={token}
    />
  );
}

function LessonViewer({
  canPublishYouTube,
  courseId,
  lessonId,
  mediaEnabled,
  readOnly,
  role,
  scope,
  token,
}: LessonViewerProps) {
  const { t } = useI18n(learningMessages);
  function lessonDraftError(draft: LessonEditDraft | null) {
    if (!draft || draft.title.trim().length < 2)
      return t("Tên bài học cần ít nhất 2 ký tự.");
    if (draft.estimatedMinutes.trim()) {
      const minutes = Number(draft.estimatedMinutes);
      if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 1440) {
        return t("Thời lượng phải là số phút nguyên từ 1 đến 1440.");
      }
    }
    if (!draft.content.trim()) {
      return draft.type === "TEXT"
        ? t("Nhập nội dung bài học.")
        : t("Nhập liên kết HTTPS.");
    }
    if (draft.type === "TEXT") {
      return new TextEncoder().encode(draft.content).byteLength <=
        MAX_LESSON_TEXT_BYTES
        ? null
        : t("Nội dung bài học không được vượt quá 100 KiB UTF-8.");
    }
    return safeHttpsUrl(draft.content)?.length &&
      safeHttpsUrl(draft.content)!.length <= MAX_HTTPS_LENGTH
      ? null
      : t("Liên kết phải dùng HTTPS, có tên miền và không chứa thông tin đăng nhập.");
  }

  const { message, reportError, formatError } = useFeedback();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editDraft, setEditDraft] = useState<LessonEditDraft | null>(null);
  const lessonKey = lmsQueryKeys.lesson(scope, courseId, lessonId);
  const lessonQuery = useQuery({
    queryFn: () => curriculumApi.getLesson({ token }, courseId, lessonId),
    queryKey: lessonKey,
  });
  const lesson = lessonQuery.data;
  const learner = role === "LEARNER";
  const manager = role === "TENANT_ADMIN" || role === "INSTRUCTOR";
  const sourceUrl = safeHttpsUrl(lesson?.sourceUrl ?? null);
  const refresh = () =>
    invalidateCurriculumQueries(queryClient, scope, courseId);
  const updateLesson = useMutation({
    mutationFn: (draft: LessonEditDraft) => {
      if (
        readOnly ||
        lesson?.course.status === "ARCHIVED" ||
        lesson?.section.archivedAt
      ) {
        throw new Error(
          t("Workspace, khóa học hoặc chương hiện không cho phép chỉnh sửa."),
        );
      }
      const estimatedMinutes = draft.estimatedMinutes.trim()
        ? Number(draft.estimatedMinutes)
        : null;
      return curriculumApi.updateLesson({ token }, courseId, lessonId, {
        estimatedMinutes,
        expectedRevision: draft.expectedRevision,
        required: draft.required,
        summary: draft.summary.trim(),
        ...(draft.type === "TEXT"
          ? { textContent: draft.content }
          : { sourceUrl: draft.content.trim() }),
        title: draft.title.trim(),
        type: draft.type,
      });
    },
    onSuccess: async () => {
      setEditDraft(null);
      message.success("Đã cập nhật bài học");
      await refresh();
    },
    onError: (error) => reportError(error, "Không thể cập nhật bài học"),
  });
  const publishLesson = useMutation({
    mutationFn: (current: LessonDetail) => {
      if (
        readOnly ||
        current.archivedAt ||
        current.section.archivedAt ||
        !current.section.published ||
        current.course.status !== "PUBLISHED"
      ) {
        throw new Error(
          t("Bài học chỉ có thể được công bố trong chương và khóa học đang công bố."),
        );
      }
      return curriculumApi.publishLesson({ token }, courseId, lessonId, {
        expectedRevision: current.revision,
      });
    },
    onSuccess: async () => {
      message.success("Đã công bố bài học");
      await refresh();
    },
    onError: (error) => reportError(error, "Không thể công bố bài học"),
  });
  const archiveLesson = useMutation({
    mutationFn: (current: LessonDetail) => {
      if (readOnly || current.archivedAt) {
        throw new Error(t("Workspace hoặc bài học hiện không cho phép lưu trữ."));
      }
      return curriculumApi.archiveLesson({ token }, courseId, lessonId, {
        expectedRevision: current.revision,
      });
    },
    onSuccess: async () => {
      message.success("Đã lưu trữ bài học");
      await refresh();
    },
    onError: (error) => reportError(error, "Không thể lưu trữ bài học"),
  });
  const replaceAttachments = useMutation({
    mutationFn: (attachmentIds: string[]) => {
      const current =
        queryClient.getQueryData<LessonDetail>(lessonKey) ?? lesson;
      if (
        !current ||
        !mediaEnabled ||
        readOnly ||
        current.archivedAt ||
        current.section.archivedAt ||
        current.course.status === "ARCHIVED"
      ) {
        throw new Error(
          t("Workspace, khóa học hoặc bài học hiện không cho phép cập nhật tệp."),
        );
      }
      return curriculumApi.replaceLessonAttachments(
        { token },
        courseId,
        lessonId,
        {
          attachmentIds,
          expectedRevision: current.revision,
        },
      );
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(lessonKey, updated);
      message.success("Đã cập nhật tệp đính kèm của bài học");
      await refresh();
    },
    onError: (error) =>
      reportError(error, "Không thể cập nhật tệp đính kèm của bài học"),
  });
  const setLessonProgress = useMutation({
    mutationFn: (current: LessonDetail) => {
      if (role !== "LEARNER" || readOnly) {
        throw new Error(
          t("Workspace hiện không cho phép cập nhật tiến độ học tập."),
        );
      }
      return curriculumApi.setLessonProgress({ token }, courseId, lessonId, {
        completed: !current.progress?.completed,
        expectedRevision: current.progress?.revision ?? 0,
      });
    },
    onSuccess: async (progress) => {
      message.success(
        progress.completed
          ? "Đã đánh dấu bài học hoàn thành"
          : "Đã bỏ đánh dấu hoàn thành bài học",
      );
      await invalidateLessonProgressQueries(
        queryClient,
        scope,
        courseId,
        lessonId,
      );
    },
    onError: (error) =>
      reportError(error, "Không thể cập nhật tiến độ bài học"),
  });
  const mutationError =
    updateLesson.error ||
    publishLesson.error ||
    archiveLesson.error ||
    replaceAttachments.error ||
    setLessonProgress.error;
  const busy =
    updateLesson.isPending ||
    publishLesson.isPending ||
    archiveLesson.isPending ||
    replaceAttachments.isPending ||
    setLessonProgress.isPending;
  const editError = lessonDraftError(editDraft);
  const editChanged = Boolean(
    editDraft && draftFingerprint(editDraft) !== editDraft.original,
  );
  const reloadAfterMutationError = async () => {
    const result = await lessonQuery.refetch();
    if (result.error || !result.data) return;
    if (updateLesson.error) {
      const canonical = draftFromLesson(result.data);
      setEditDraft((current) => {
        if (!current) return null;
        return draftFingerprint(current) === canonical.original
          ? null
          : {
            ...current,
            expectedRevision: result.data.revision,
            original: canonical.original,
          };
      });
    }
    updateLesson.reset();
    publishLesson.reset();
    archiveLesson.reset();
    replaceAttachments.reset();
    setLessonProgress.reset();
  };
  const attachAvailableAsset = async (asset: MediaAsset) => {
    const current = queryClient.getQueryData<LessonDetail>(lessonKey) ?? lesson;
    if (!current) throw new Error(t("Không tìm thấy bài học hiện tại."));
    const attachmentIds = current.attachmentIds ?? [];
    if (attachmentIds.includes(asset._id)) return;
    if (attachmentIds.length >= MAX_LESSON_ATTACHMENTS) {
      throw new Error(
        t("Bài học chỉ được đính kèm tối đa {p0} tệp.", { p0: MAX_LESSON_ATTACHMENTS }),
      );
    }
    await replaceAttachments.mutateAsync([...attachmentIds, asset._id]);
  };

  return (
    <main
      aria-labelledby={lesson ? "lesson-page-title" : undefined}
      className="page-shell"
    >
      <nav aria-label={t("Điều hướng bài học")}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push(`/courses/${courseId}/curriculum`)}
          type="text"
        >{t("Quay lại giáo trình")}</Button>
      </nav>
      {readOnly && manager && (
        <Alert
          showIcon
          title={t("Workspace chỉ đọc; các thao tác chỉnh sửa bài học đang tạm khóa.")}
          type="info"
        />
      )}
      {readOnly && learner && (
        <Alert
          showIcon
          title={t("Workspace chỉ đọc; thao tác cập nhật tiến độ đang tạm khóa.")}
          type="info"
        />
      )}
      {mutationError && (
        <Alert
          action={
            <Button
              onClick={() => void reloadAfterMutationError()}
              size="small"
            >{t("Tải lại bài học")}</Button>
          }
          showIcon
          title={formatError(mutationError, t("Không thể cập nhật bài học"))}
          type="error"
        />
      )}
      {lessonQuery.error ? (
        <Alert
          action={<Button disabled={lessonQuery.isFetching} loading={lessonQuery.isFetching} onClick={() => { if (!lessonQuery.isFetching) void lessonQuery.refetch(); }} size="small">{t("Thử lại")}</Button>}
          showIcon
          title={formatError(lessonQuery.error, t("Không tải được bài học"))}
          type="error"
        />
      ) : lessonQuery.isPending ? (
        <div
          aria-label={t("Đang tải bài học")}
          className="page-loading"
          role="status"
        >
          <Spin size="large" />
        </div>
      ) : !lesson ? (
        <Alert showIcon title={t("Không tìm thấy bài học")} type="warning" />
      ) : (
        <>
          <header className="page-heading">
            <div className="page-heading-copy">
              <Space size={[8, 8]} wrap>
                <Tag>{lesson.section.title}</Tag>
                <Tag>
                  {lesson.type === "TEXT" ? t("Văn bản") : t("Liên kết HTTPS")}
                </Tag>
                <Tag>{lesson.required ? t("Bắt buộc") : t("Tự chọn")}</Tag>
                {lesson.estimatedMinutes && (
                  <Tag>{lesson.estimatedMinutes} {t("phút")}</Tag>
                )}
              </Space>
              <h1 id="lesson-page-title">{lesson.title}</h1>
              {lesson.summary && <p>{lesson.summary}</p>}
            </div>
            {manager && (
              <div className={styles.resourceActions}>
                <Button
                  disabled={
                    readOnly ||
                    busy ||
                    Boolean(lesson.archivedAt) ||
                    Boolean(lesson.section.archivedAt) ||
                    lesson.course.status === "ARCHIVED"
                  }
                  icon={<EditOutlined />}
                  onClick={() => {
                    updateLesson.reset();
                    setEditDraft(draftFromLesson(lesson));
                  }}
                >{t("Sửa bài học")}</Button>
                {!lesson.published && !lesson.archivedAt && (
                  <Button
                    disabled={
                      readOnly ||
                      busy ||
                      lesson.course.status !== "PUBLISHED" ||
                      !lesson.section.published ||
                      Boolean(lesson.section.archivedAt)
                    }
                    icon={<SendOutlined />}
                    onClick={() => publishLesson.mutate(lesson)}
                    type="primary"
                  >{t("Công bố bài học")}</Button>
                )}
                {!lesson.archivedAt && (
                  <Popconfirm
                    okText={t("Lưu trữ bài học")}
                    onConfirm={() => archiveLesson.mutateAsync(lesson)}
                    title={t("Lưu trữ bài học {p0}?", { p0: lesson.title })}
                  >
                    <Button
                      danger
                      disabled={readOnly || busy}
                      icon={<DeleteOutlined />}
                    >{t("Lưu trữ")}</Button>
                  </Popconfirm>
                )}
              </div>
            )}
          </header>

          {lesson.progress?.contentChangedSinceCompletion && (
            <Alert
              description={t("Trạng thái hoàn thành được giữ nguyên; bạn nên xem lại nội dung mới.")}
              showIcon
              title={t("Bài học đã được cập nhật sau lần hoàn thành của bạn")}
              type="warning"
            />
          )}

          {lesson.type === "TEXT" ? (
            <Card className="surface-card" title={t("Nội dung bài học")}>
              <Typography.Paragraph className={styles.lessonContent}>
                {lesson.textContent || t("Bài học chưa có nội dung.")}
              </Typography.Paragraph>
            </Card>
          ) : (
            <Card className="surface-card" title={t("Tài liệu bên ngoài")}>
              {sourceUrl ? (
                <div className={styles.externalCard}>
                  <p>{t("Tài liệu được mở ở tab mới. Hãy kiểm tra tên miền trước khi tiếp tục.")}</p>
                  <a
                    className={styles.externalLink}
                    href={sourceUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <LinkOutlined />{t("Mở tài liệu HTTPS")}</a>
                </div>
              ) : (
                <Alert
                  showIcon
                  title={t("Liên kết bài học không hợp lệ")}
                  type="error"
                />
              )}
            </Card>
          )}

          <Card className="surface-card" title={t("Tệp đính kèm riêng tư")}>
            <Space orientation="vertical" size={14} style={{ width: "100%" }}>
              <SecureAttachmentList
                assetIds={lesson.attachmentIds ?? []}
                canMutate={
                  manager &&
                  mediaEnabled &&
                  !readOnly &&
                  !busy &&
                  !lesson.archivedAt &&
                  !lesson.section.archivedAt &&
                  lesson.course.status !== "ARCHIVED"
                }
                mediaEnabled={mediaEnabled}
                onReplace={async (attachmentIds) => {
                  await replaceAttachments.mutateAsync(attachmentIds);
                }}
                replacing={replaceAttachments.isPending}
                renderAssetAction={
                  canPublishYouTube && mediaEnabled
                    ? (asset) => (
                      <YouTubePublishAction
                        asset={asset}
                        courseId={courseId}
                        description={lesson.summary}
                        disabled={
                          readOnly ||
                          busy ||
                          Boolean(lesson.archivedAt) ||
                          Boolean(lesson.section.archivedAt) ||
                          lesson.course.status === "ARCHIVED"
                        }
                        lessonId={lessonId}
                        mediaEnabled={mediaEnabled}
                        scope={scope}
                        title={lesson.title}
                        token={token}
                      />
                    )
                    : undefined
                }
                scope={scope}
                target={{ courseId, kind: "LESSON", lessonId }}
                token={token}
              />
              {manager && mediaEnabled && (
                <SecureMediaUploader
                  allowedContentTypes={LESSON_MEDIA_CONTENT_TYPES}
                  currentAssetIds={lesson.attachmentIds ?? []}
                  disabled={
                    readOnly ||
                    busy ||
                    Boolean(lesson.archivedAt) ||
                    Boolean(lesson.section.archivedAt) ||
                    lesson.course.status === "ARCHIVED"
                  }
                  label={t("Thêm tệp cho bài học")}
                  maxBytes={DEFAULT_LESSON_MEDIA_MAX_BYTES}
                  maxCount={MAX_LESSON_ATTACHMENTS}
                  onAvailable={attachAvailableAsset}
                  target={{ courseId, kind: "LESSON", lessonId }}
                  token={token}
                />
              )}
              {manager && !mediaEnabled && (
                <Alert
                  description={t("Bạn vẫn có thể sửa nội dung văn bản hoặc liên kết của bài học. Bật module Tài liệu riêng tư để thêm, sắp xếp hoặc tải tệp.")}
                  showIcon
                  title={t("Module Tài liệu riêng tư chưa khả dụng")}
                  type="info"
                />
              )}
            </Space>
          </Card>

          {learner && (
            <Card className="surface-card" title={t("Trạng thái học tập")}>
              <Space size={[8, 8]} wrap>
                <Tag color={lesson.progress?.completed ? "green" : "default"}>
                  {lesson.progress?.completed
                    ? t("Đã hoàn thành")
                    : t("Chưa hoàn thành")}
                </Tag>
                <Button
                  aria-label={
                    lesson.progress?.completed
                      ? t("Đánh dấu chưa hoàn thành")
                      : t("Đánh dấu hoàn thành")
                  }
                  disabled={readOnly || busy}
                  loading={setLessonProgress.isPending}
                  onClick={() => setLessonProgress.mutate(lesson)}
                  type={lesson.progress?.completed ? "default" : "primary"}
                >
                  {lesson.progress?.completed
                    ? t("Đánh dấu chưa hoàn thành")
                    : t("Đánh dấu hoàn thành")}
                </Button>
              </Space>
            </Card>
          )}

          <Modal
            cancelText={t("Hủy")}
            okButtonProps={{
              disabled: readOnly || busy || Boolean(editError) || !editChanged,
            }}
            okText={t("Lưu thay đổi")}
            onCancel={() => {
              updateLesson.reset();
              setEditDraft(null);
            }}
            onOk={() =>
              editDraft &&
              !readOnly &&
              !editError &&
              editChanged &&
              updateLesson.mutate(editDraft)
            }
            open={Boolean(editDraft)}
            title={t("Sửa bài học")}
          >
            {editDraft && (
              <div className={styles.modalFields}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t("Tên bài học")}</span>
                  <Input
                    aria-label={t("Tên bài học cần sửa")}
                    disabled={readOnly}
                    maxLength={200}
                    onChange={(event) =>
                      setEditDraft({ ...editDraft, title: event.target.value })
                    }
                    value={editDraft.title}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t("Mô tả ngắn")}</span>
                  <Input.TextArea
                    aria-label={t("Mô tả bài học cần sửa")}
                    disabled={readOnly}
                    maxLength={2000}
                    onChange={(event) =>
                      setEditDraft({
                        ...editDraft,
                        summary: event.target.value,
                      })
                    }
                    rows={2}
                    value={editDraft.summary}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t("Loại bài học")}</span>
                  <Select<LessonType>
                    aria-label={t("Loại bài học cần sửa")}
                    disabled={readOnly}
                    onChange={(type) =>
                      setEditDraft({ ...editDraft, content: "", type })
                    }
                    options={[
                      { label: t("Văn bản"), value: "TEXT" },
                      { label: t("Liên kết HTTPS"), value: "HTTPS_LINK" },
                    ]}
                    value={editDraft.type}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>
                    {editDraft.type === "TEXT" ? t("Nội dung") : t("Liên kết HTTPS")}
                  </span>
                  {editDraft.type === "TEXT" ? (
                    <Input.TextArea
                      aria-label={t("Nội dung bài học cần sửa")}
                      disabled={readOnly}
                      onChange={(event) =>
                        setEditDraft({
                          ...editDraft,
                          content: event.target.value,
                        })
                      }
                      rows={8}
                      value={editDraft.content}
                    />
                  ) : (
                    <Input
                      aria-label={t("Liên kết bài học HTTPS cần sửa")}
                      disabled={readOnly}
                      maxLength={MAX_HTTPS_LENGTH}
                      onChange={(event) =>
                        setEditDraft({
                          ...editDraft,
                          content: event.target.value,
                        })
                      }
                      type="url"
                      value={editDraft.content}
                    />
                  )}
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t("Thời lượng (phút, để trống nếu không có)")}</span>
                  <Input
                    aria-label={t("Thời lượng bài học cần sửa")}
                    disabled={readOnly}
                    max={1440}
                    min={1}
                    onChange={(event) =>
                      setEditDraft({
                        ...editDraft,
                        estimatedMinutes: event.target.value,
                      })
                    }
                    type="number"
                    value={editDraft.estimatedMinutes}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t("Yêu cầu hoàn thành")}</span>
                  <Select
                    aria-label={t("Yêu cầu hoàn thành bài học")}
                    disabled={readOnly}
                    onChange={(value) =>
                      setEditDraft({
                        ...editDraft,
                        required: value === "required",
                      })
                    }
                    options={[
                      { label: t("Bắt buộc"), value: "required" },
                      { label: t("Tự chọn"), value: "optional" },
                    ]}
                    value={editDraft.required ? "required" : "optional"}
                  />
                </label>
                {editError && (
                  <Alert showIcon title={editError} type="warning" />
                )}
              </div>
            )}
          </Modal>
        </>
      )}
    </main>
  );
}
