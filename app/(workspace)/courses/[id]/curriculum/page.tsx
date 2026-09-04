"use client";

import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SendOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
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
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import styles from "@/components/curriculum/curriculum.module.css";
import { ApiError } from "@/lib/api";
import { createCurriculumMutationId, curriculumApi } from "@/lib/curriculum-api";
import { effectiveModuleEnabled } from "@/lib/entitlements";
import {
  invalidateCurriculumQueries,
  invalidateLessonProgressQueries,
} from "@/lib/query-invalidation";
import { getViewerScope, lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";
import type { CurriculumLesson, CurriculumSection, LessonType, UserRole } from "@/lib/types";

interface SectionDraft {
  clientMutationId: string;
  description: string;
  expectedCurriculumRevision: number;
  title: string;
}

interface LessonDraft {
  clientMutationId: string;
  content: string;
  expectedCurriculumRevision: number;
  sectionId: string;
  summary: string;
  title: string;
  type: LessonType;
}

interface SectionEditDraft {
  description: string;
  expectedRevision: number;
  originalDescription: string;
  originalTitle: string;
  sectionId: string;
  title: string;
}

interface CurriculumWorkspaceProps {
  courseId: string;
  learnerProgressEnabled: boolean;
  readOnly: boolean;
  role: Exclude<UserRole, "SUPER_ADMIN">;
  scope: ViewerScope;
  token: string;
}

const MAX_LESSON_TEXT_BYTES = 100 * 1024;
const MAX_HTTPS_LENGTH = 2048;

function resourceState(resource: { archivedAt: string | null; published: boolean }) {
  if (resource.archivedAt) return { color: "default", label: "Đã lưu trữ" };
  if (resource.published) return { color: "green", label: "Đã công bố" };
  return { color: "gold", label: "Bản nháp" };
}

function sortByPosition<T extends { _id: string; position: number }>(items: readonly T[]) {
  return [...items].sort((left, right) => left.position - right.position || left._id.localeCompare(right._id));
}

function lessonContentError(draft: LessonDraft | null) {
  if (!draft || draft.title.trim().length < 2) return "Tên bài học cần ít nhất 2 ký tự.";
  const content = draft.content.trim();
  if (!content) return draft.type === "TEXT" ? "Nhập nội dung bài học." : "Nhập liên kết HTTPS.";
  if (draft.type === "TEXT") {
    return new TextEncoder().encode(content).byteLength <= MAX_LESSON_TEXT_BYTES
      ? null
      : "Nội dung bài học không được vượt quá 100 KiB UTF-8.";
  }
  try {
    const url = new URL(content);
    return url.protocol === "https:"
      && Boolean(url.hostname)
      && !url.username
      && !url.password
      && url.toString().length <= MAX_HTTPS_LENGTH
      ? null
      : "Liên kết phải dùng HTTPS, có tên miền và không chứa thông tin đăng nhập.";
  } catch {
    return "Liên kết phải dùng HTTPS, có tên miền và không chứa thông tin đăng nhập.";
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isCurriculumRevisionMismatch(error: unknown) {
  return error instanceof ApiError
    && (error.status === 412 || error.code === "CURRICULUM_REVISION_MISMATCH");
}

export default function CourseCurriculumPage() {
  const { id } = useParams<{ id: string }>();
  const { effectiveAccess, organization, token, user } = useAuth();
  const coursesEnabled = effectiveModuleEnabled(effectiveAccess, "COURSES");
  const learnerProgressEnabled = effectiveModuleEnabled(effectiveAccess, "ENROLLMENTS");
  const scope = getViewerScope(user, organization);

  if (!coursesEnabled) {
    return <main className="page-shell"><Alert showIcon title="Module Khóa học không khả dụng trong workspace này." type="warning" /></main>;
  }
  if (!user || !organization || !scope || user.role === "SUPER_ADMIN" || !user.tenantId) {
    return <main className="page-shell"><Alert showIcon title="Giáo trình chỉ khả dụng trong workspace của tổ chức." type="info" /></main>;
  }

  const readOnly = effectiveAccess?.readOnly ?? false;
  const authorityKey = `${scope.tenantId}:${scope.membershipId}:${scope.viewerId}:${scope.role}:${id}:${readOnly ? "READ_ONLY" : "WRITABLE"}`;
  return <CurriculumWorkspace
    courseId={id}
    key={authorityKey}
    learnerProgressEnabled={learnerProgressEnabled}
    readOnly={readOnly}
    role={user.role}
    scope={scope}
    token={token}
  />;
}

function CurriculumWorkspace({
  courseId,
  learnerProgressEnabled,
  readOnly,
  role,
  scope,
  token,
}: CurriculumWorkspaceProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const manager = role === "TENANT_ADMIN" || role === "INSTRUCTOR";
  const [includeArchived, setIncludeArchived] = useState(false);
  const [sectionDraft, setSectionDraft] = useState<SectionDraft | null>(null);
  const [sectionEditDraft, setSectionEditDraft] = useState<SectionEditDraft | null>(null);
  const [lessonDraft, setLessonDraft] = useState<LessonDraft | null>(null);
  const filters = manager && includeArchived ? { includeArchived: true } : {};
  const curriculumQuery = useQuery({
    queryFn: () => curriculumApi.getCurriculum({ token }, courseId, filters),
    queryKey: lmsQueryKeys.curriculumTree(scope, courseId, filters),
  });
  const curriculum = curriculumQuery.data;
  const sections = useMemo(
    () => sortByPosition(curriculum?.sections ?? []),
    [curriculum?.sections],
  );
  const refresh = () => invalidateCurriculumQueries(queryClient, scope, courseId);

  const createSection = useMutation({
    mutationFn: (draft: SectionDraft) => {
      if (readOnly || curriculum?.course.status === "ARCHIVED") {
        throw new Error("Workspace hoặc khóa học hiện không cho phép chỉnh sửa.");
      }
      return curriculumApi.createSection({ token }, courseId, {
        clientMutationId: draft.clientMutationId,
        description: draft.description.trim(),
        expectedCurriculumRevision: draft.expectedCurriculumRevision,
        title: draft.title.trim(),
      });
    },
    onSuccess: async () => {
      setSectionDraft(null);
      message.success("Đã thêm chương");
      await refresh();
    },
  });
  const createLesson = useMutation({
    mutationFn: (draft: LessonDraft) => {
      if (readOnly || curriculum?.course.status === "ARCHIVED") {
        throw new Error("Workspace hoặc khóa học hiện không cho phép chỉnh sửa.");
      }
      return curriculumApi.createLesson({ token }, courseId, draft.sectionId, {
        clientMutationId: draft.clientMutationId,
        expectedCurriculumRevision: draft.expectedCurriculumRevision,
        required: true,
        summary: draft.summary.trim(),
        ...(draft.type === "TEXT"
          ? { textContent: draft.content.trim() }
          : { sourceUrl: draft.content.trim() }),
        title: draft.title.trim(),
        type: draft.type,
      });
    },
    onSuccess: async () => {
      setLessonDraft(null);
      message.success("Đã thêm bài học");
      await refresh();
    },
  });
  const updateSection = useMutation({
    mutationFn: (draft: SectionEditDraft) => {
      if (readOnly || curriculum?.course.status === "ARCHIVED") {
        throw new Error("Workspace hoặc khóa học hiện không cho phép chỉnh sửa.");
      }
      return curriculumApi.updateSection({ token }, courseId, draft.sectionId, {
        description: draft.description.trim(),
        expectedRevision: draft.expectedRevision,
        title: draft.title.trim(),
      });
    },
    onSuccess: async () => {
      setSectionEditDraft(null);
      message.success("Đã cập nhật chương");
      await refresh();
    },
  });
  const publishSection = useMutation({
    mutationFn: (section: CurriculumSection) => {
      if (readOnly || curriculum?.course.status !== "PUBLISHED" || section.archivedAt) {
        throw new Error("Chương chỉ có thể được công bố trong khóa học đang công bố.");
      }
      return curriculumApi.publishSection(
        { token }, courseId, section._id, { expectedRevision: section.revision },
      );
    },
    onSuccess: async () => {
      message.success("Đã công bố chương");
      await refresh();
    },
  });
  const archiveSection = useMutation({
    mutationFn: (section: CurriculumSection) => {
      if (readOnly || section.archivedAt) {
        throw new Error("Workspace hoặc chương hiện không cho phép lưu trữ.");
      }
      return curriculumApi.archiveSection(
        { token }, courseId, section._id, { expectedRevision: section.revision },
      );
    },
    onSuccess: async () => {
      message.success("Đã lưu trữ chương");
      await refresh();
    },
  });
  const publishLesson = useMutation({
    mutationFn: ({ lesson, section }: { lesson: CurriculumLesson; section: CurriculumSection }) => {
      if (
        readOnly
        || curriculum?.course.status !== "PUBLISHED"
        || section.archivedAt
        || !section.published
        || lesson.archivedAt
      ) {
        throw new Error("Bài học chỉ có thể được công bố trong chương và khóa học đang công bố.");
      }
      return curriculumApi.publishLesson(
        { token }, courseId, lesson._id, { expectedRevision: lesson.revision },
      );
    },
    onSuccess: async () => {
      message.success("Đã công bố bài học");
      await refresh();
    },
  });
  const archiveLesson = useMutation({
    mutationFn: (lesson: CurriculumLesson) => {
      if (readOnly || lesson.archivedAt) {
        throw new Error("Workspace hoặc bài học hiện không cho phép lưu trữ.");
      }
      return curriculumApi.archiveLesson(
        { token }, courseId, lesson._id, { expectedRevision: lesson.revision },
      );
    },
    onSuccess: async () => {
      message.success("Đã lưu trữ bài học");
      await refresh();
    },
  });
  const setLessonProgress = useMutation({
    mutationFn: (lesson: CurriculumLesson) => {
      if (role !== "LEARNER" || readOnly) {
        throw new Error("Workspace hiện không cho phép cập nhật tiến độ học tập.");
      }
      return curriculumApi.setLessonProgress({ token }, courseId, lesson._id, {
        completed: !lesson.progress?.completed,
        expectedRevision: lesson.progress?.revision ?? 0,
      });
    },
    onSuccess: async (_progress, lesson) => {
      message.success(lesson.progress?.completed
        ? "Đã đánh dấu bài học là chưa hoàn thành"
        : "Đã hoàn thành bài học");
      await invalidateLessonProgressQueries(queryClient, scope, courseId, lesson._id);
    },
  });
  const mutations = [
    createSection,
    createLesson,
    updateSection,
    publishSection,
    archiveSection,
    publishLesson,
    archiveLesson,
    setLessonProgress,
  ];
  const busy = mutations.some((mutation) => mutation.isPending);
  const mutationError = mutations.map((mutation) => mutation.error).find(Boolean);
  const sectionValid = Boolean(sectionDraft && sectionDraft.title.trim().length >= 2);
  const sectionEditValid = Boolean(
    sectionEditDraft
      && sectionEditDraft.title.trim().length >= 2
      && (
        sectionEditDraft.title.trim() !== sectionEditDraft.originalTitle
        || sectionEditDraft.description.trim() !== sectionEditDraft.originalDescription
      ),
  );
  const lessonError = lessonContentError(lessonDraft);
  const courseArchived = curriculum?.course.status === "ARCHIVED";
  const reloadAfterMutationError = async () => {
    const result = await curriculumQuery.refetch();
    await queryClient.invalidateQueries({ queryKey: lmsQueryKeys.course(scope, courseId) });
    if (result.error || !result.data) return;
    if (isCurriculumRevisionMismatch(createSection.error)) {
      setSectionDraft((current) => current ? {
        ...current,
        clientMutationId: createCurriculumMutationId(),
        expectedCurriculumRevision: result.data.curriculumRevision,
      } : null);
      createSection.reset();
    }
    if (isCurriculumRevisionMismatch(createLesson.error)) {
      setLessonDraft((current) => current ? {
        ...current,
        clientMutationId: createCurriculumMutationId(),
        expectedCurriculumRevision: result.data.curriculumRevision,
      } : null);
      createLesson.reset();
    }
    if (updateSection.error && sectionEditDraft) {
      const freshSection = result.data.sections.find(
        (section) => section._id === sectionEditDraft.sectionId,
      );
      if (freshSection) {
        setSectionEditDraft((current) => {
          if (!current) return null;
          const canonicalMatchesDraft = current.title.trim() === freshSection.title
            && current.description.trim() === freshSection.description;
          return canonicalMatchesDraft ? null : {
            ...current,
            expectedRevision: freshSection.revision,
            originalDescription: freshSection.description,
            originalTitle: freshSection.title,
          };
        });
        updateSection.reset();
      }
    }
    for (const mutation of [publishSection, archiveSection, publishLesson, archiveLesson]) {
      if (mutation.error) mutation.reset();
    }
    setLessonProgress.reset();
  };

  return <main aria-labelledby="curriculum-page-title" className="page-shell">
    <nav aria-label="Điều hướng giáo trình">
      <Button icon={<ArrowLeftOutlined />} onClick={() => router.push(`/courses/${courseId}`)} type="text">Quay lại khóa học</Button>
    </nav>
    <header className={`page-heading ${styles.pageHeader}`}>
      <div className="page-heading-copy">
        <h1 id="curriculum-page-title">{curriculum?.course.title ?? "Giáo trình khóa học"}</h1>
        <p>{manager ? "Xây dựng giáo trình bằng cách thêm chương và bài học." : "Học theo nội dung đã được giảng viên công bố."}</p>
      </div>
      {manager && <div className={styles.toolbar}>
        {learnerProgressEnabled && <Button
          onClick={() => router.push(`/courses/${courseId}/progress`)}
        >Tiến độ học viên</Button>}
        <Button disabled={readOnly || busy || !curriculum || curriculum.course.status === "ARCHIVED"} icon={<PlusOutlined />} onClick={() => {
          if (!curriculum) return;
          createSection.reset();
          setSectionDraft({
            clientMutationId: createCurriculumMutationId(), description: "", expectedCurriculumRevision: curriculum.curriculumRevision, title: "",
          });
        }} type="primary">Thêm chương</Button>
        <Button disabled={busy} onClick={() => setIncludeArchived((current) => !current)}>
          {includeArchived ? "Ẩn nội dung lưu trữ" : "Xem nội dung lưu trữ"}
        </Button>
      </div>}
    </header>

    {readOnly && <Alert
      description={manager
        ? "Bạn vẫn xem được giáo trình; thao tác thêm chương và bài học đang tạm khóa."
        : "Bạn vẫn xem được toàn bộ nội dung đã công bố; thao tác cập nhật tiến độ đang tạm khóa."}
      showIcon
      title="Workspace chỉ đọc"
      type="info"
    />}
    {mutationError && <Alert
      action={<Button onClick={() => void reloadAfterMutationError()} size="small">Tải lại giáo trình</Button>}
      showIcon
      title={errorMessage(mutationError, "Không thể cập nhật giáo trình")}
      type="error"
    />}
    {curriculumQuery.error
      ? <Alert showIcon title={errorMessage(curriculumQuery.error, "Không tải được giáo trình")} type="error" />
      : curriculumQuery.isPending
        ? <div aria-label="Đang tải giáo trình" className="page-loading" role="status"><Spin size="large" /></div>
        : !curriculum
          ? <Empty description="Không tìm thấy giáo trình" />
          : <>
            {!manager && curriculum.myProgress && <Card className="surface-card" title="Tiến độ của bạn">
              <strong>{curriculum.myProgress.completedRequiredLessons}/{curriculum.myProgress.requiredLessons} bài bắt buộc · {curriculum.myProgress.percent}%</strong>
            </Card>}
            {sections.length ? <ol aria-label="Các chương" className={styles.sectionList}>
              {sections.map((section) => {
                const state = resourceState(section);
                const lessons = sortByPosition(section.lessons);
                return <li key={section._id}>
                  <Card
                    className="surface-card"
                    extra={<Space size={[6, 6]} wrap>
                      <Tag color={state.color}>{state.label}</Tag>
                      {manager && <>
                        <Button
                          aria-label={`Sửa chương ${section.title}`}
                          disabled={readOnly || busy || Boolean(section.archivedAt) || curriculum.course.status === "ARCHIVED"}
                          icon={<EditOutlined />}
                          onClick={() => {
                            updateSection.reset();
                            setSectionEditDraft({
                              description: section.description,
                              expectedRevision: section.revision,
                              originalDescription: section.description,
                              originalTitle: section.title,
                              sectionId: section._id,
                              title: section.title,
                            });
                          }}
                          size="small"
                        >Sửa</Button>
                        {!section.published && !section.archivedAt && <Button
                          aria-label={`Công bố chương ${section.title}`}
                          disabled={readOnly || busy || curriculum.course.status !== "PUBLISHED"}
                          icon={<SendOutlined />}
                          onClick={() => publishSection.mutate(section)}
                          size="small"
                        >Công bố</Button>}
                        {!section.archivedAt && <Popconfirm
                          okText="Lưu trữ chương"
                          onConfirm={() => archiveSection.mutateAsync(section)}
                          title={`Lưu trữ chương ${section.title}? Các bài học bên trong sẽ bị ẩn khỏi học viên.`}
                        >
                          <Button
                            aria-label={`Lưu trữ chương ${section.title}`}
                            danger
                            disabled={readOnly || busy}
                            icon={<DeleteOutlined />}
                            size="small"
                          >Lưu trữ</Button>
                        </Popconfirm>}
                      </>}
                    </Space>}
                    title={section.title}
                  >
                    {section.description && <Typography.Paragraph type="secondary">{section.description}</Typography.Paragraph>}
                    {lessons.length ? <ol aria-label={`Bài học trong ${section.title}`} className={styles.lessonList}>
                      {lessons.map((lesson) => {
                        const lessonState = resourceState(lesson);
                        return <li className={styles.lessonItem} key={lesson._id}>
                          <div className={styles.lessonCopy}>
                            <Link className={styles.lessonTitle} href={`/courses/${courseId}/lessons/${lesson._id}`}>{lesson.title}</Link>
                            {lesson.summary && <p className={styles.lessonSummary}>{lesson.summary}</p>}
                            <Space size={[6, 6]} wrap>
                              <Tag>{lesson.type === "TEXT" ? "Văn bản" : "Liên kết HTTPS"}</Tag>
                              <Tag>{lesson.required ? "Bắt buộc" : "Tự chọn"}</Tag>
                              {manager && <Tag color={lessonState.color}>{lessonState.label}</Tag>}
                              {!manager && lesson.progress?.completed && <Tag color="green">Đã hoàn thành</Tag>}
                              {!manager && lesson.progress?.contentChangedSinceCompletion && <Tag color="gold">Nội dung mới sau khi hoàn thành</Tag>}
                            </Space>
                          </div>
                          {manager && <div className={styles.resourceActions}>
                            {!lesson.published && !lesson.archivedAt && <Button
                              aria-label={`Công bố bài học ${lesson.title}`}
                              disabled={
                                readOnly
                                || busy
                                || curriculum.course.status !== "PUBLISHED"
                                || !section.published
                                || Boolean(section.archivedAt)
                              }
                              icon={<SendOutlined />}
                              onClick={() => publishLesson.mutate({ lesson, section })}
                              size="small"
                            >Công bố</Button>}
                            {!lesson.archivedAt && <Popconfirm
                              okText="Lưu trữ bài học"
                              onConfirm={() => archiveLesson.mutateAsync(lesson)}
                              title={`Lưu trữ bài học ${lesson.title}?`}
                            >
                              <Button
                                aria-label={`Lưu trữ bài học ${lesson.title}`}
                                danger
                                disabled={readOnly || busy}
                                icon={<DeleteOutlined />}
                                size="small"
                              >Lưu trữ</Button>
                            </Popconfirm>}
                          </div>}
                          {!manager && <div className={styles.resourceActions}>
                            <Button
                              aria-label={`${lesson.progress?.completed ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"} ${lesson.title}`}
                              disabled={readOnly || busy}
                              loading={setLessonProgress.isPending && setLessonProgress.variables?._id === lesson._id}
                              onClick={() => setLessonProgress.mutate(lesson)}
                              size="small"
                              type={lesson.progress?.completed ? "default" : "primary"}
                            >{lesson.progress?.completed ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"}</Button>
                          </div>}
                        </li>;
                      })}
                    </ol> : <p className={styles.emptyLessons}>Chương này chưa có bài học.</p>}
                    {manager && !section.archivedAt && <Button
                      disabled={readOnly || busy || curriculum.course.status === "ARCHIVED"}
                      icon={<PlusOutlined />}
                      onClick={() => {
                        createLesson.reset();
                        setLessonDraft({
                          clientMutationId: createCurriculumMutationId(), content: "", expectedCurriculumRevision: curriculum.curriculumRevision, sectionId: section._id, summary: "", title: "", type: "TEXT",
                        });
                      }}
                      style={{ marginTop: 16 }}
                    >Thêm bài học</Button>}
                  </Card>
                </li>;
              })}
            </ol> : <Card className="surface-card"><Empty description={manager ? "Chưa có chương nào" : "Giáo trình chưa có bài học được công bố"} /></Card>}
          </>}

    <Modal
      cancelText="Hủy"
      okButtonProps={{ disabled: readOnly || courseArchived || !sectionValid || createSection.isPending }}
      okText="Thêm chương"
      onCancel={() => {
        createSection.reset();
        setSectionDraft(null);
      }}
      onOk={() => sectionDraft && !readOnly && !courseArchived && createSection.mutate(sectionDraft)}
      open={Boolean(sectionDraft)}
      title="Thêm chương"
    >
      {sectionDraft && <div className={styles.modalFields}>
        <label className={styles.field}><span className={styles.fieldLabel}>Tên chương</span><Input aria-label="Tên chương" disabled={readOnly || courseArchived} maxLength={200} onChange={(event) => setSectionDraft({ ...sectionDraft, title: event.target.value })} value={sectionDraft.title} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>Mô tả</span><Input.TextArea aria-label="Mô tả chương" disabled={readOnly || courseArchived} maxLength={2000} onChange={(event) => setSectionDraft({ ...sectionDraft, description: event.target.value })} rows={3} value={sectionDraft.description} /></label>
      </div>}
    </Modal>

    <Modal
      cancelText="Hủy"
      okButtonProps={{
        disabled: readOnly || courseArchived || !sectionEditValid || updateSection.isPending,
      }}
      okText="Lưu thay đổi"
      onCancel={() => {
        updateSection.reset();
        setSectionEditDraft(null);
      }}
      onOk={() => sectionEditDraft
        && !readOnly
        && !courseArchived
        && sectionEditValid
        && updateSection.mutate(sectionEditDraft)}
      open={Boolean(sectionEditDraft)}
      title="Sửa chương"
    >
      {sectionEditDraft && <div className={styles.modalFields}>
        <label className={styles.field}><span className={styles.fieldLabel}>Tên chương</span><Input aria-label="Tên chương cần sửa" disabled={readOnly || courseArchived} maxLength={200} onChange={(event) => setSectionEditDraft({ ...sectionEditDraft, title: event.target.value })} value={sectionEditDraft.title} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>Mô tả</span><Input.TextArea aria-label="Mô tả chương cần sửa" disabled={readOnly || courseArchived} maxLength={2000} onChange={(event) => setSectionEditDraft({ ...sectionEditDraft, description: event.target.value })} rows={3} value={sectionEditDraft.description} /></label>
      </div>}
    </Modal>

    <Modal
      cancelText="Hủy"
      okButtonProps={{ disabled: readOnly || courseArchived || Boolean(lessonError) || createLesson.isPending }}
      okText="Thêm bài học"
      onCancel={() => {
        createLesson.reset();
        setLessonDraft(null);
      }}
      onOk={() => lessonDraft && !readOnly && !courseArchived && !lessonError && createLesson.mutate(lessonDraft)}
      open={Boolean(lessonDraft)}
      title="Thêm bài học"
    >
      {lessonDraft && <div className={styles.modalFields}>
        <label className={styles.field}><span className={styles.fieldLabel}>Tên bài học</span><Input aria-label="Tên bài học" disabled={readOnly || courseArchived} maxLength={200} onChange={(event) => setLessonDraft({ ...lessonDraft, title: event.target.value })} value={lessonDraft.title} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>Mô tả ngắn</span><Input.TextArea aria-label="Mô tả bài học" disabled={readOnly || courseArchived} maxLength={2000} onChange={(event) => setLessonDraft({ ...lessonDraft, summary: event.target.value })} rows={2} value={lessonDraft.summary} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>Loại bài học</span><Select<LessonType> aria-label="Loại bài học" disabled={readOnly || courseArchived} onChange={(type) => setLessonDraft({ ...lessonDraft, content: "", type })} options={[
          { label: "Văn bản", value: "TEXT" }, { label: "Liên kết HTTPS", value: "HTTPS_LINK" },
        ]} value={lessonDraft.type} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>{lessonDraft.type === "TEXT" ? "Nội dung" : "Liên kết HTTPS"}</span>{lessonDraft.type === "TEXT"
          ? <Input.TextArea aria-label="Nội dung bài học" disabled={readOnly || courseArchived} onChange={(event) => setLessonDraft({ ...lessonDraft, content: event.target.value })} rows={8} value={lessonDraft.content} />
          : <Input aria-label="Liên kết bài học HTTPS" disabled={readOnly || courseArchived} maxLength={MAX_HTTPS_LENGTH} onChange={(event) => setLessonDraft({ ...lessonDraft, content: event.target.value })} type="url" value={lessonDraft.content} />}</label>
        {lessonDraft.title.trim() && lessonError && <Alert showIcon title={lessonError} type="warning" />}
      </div>}
    </Modal>
  </main>;
}
