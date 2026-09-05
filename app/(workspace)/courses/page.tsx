"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { learningPolishMessages as learningMessages } from "@/lib/i18n/learning-polish-messages";
import polish from "@/components/layout/learning-polish.module.css";
import { listPageCount, normalizeListSearch } from "@/lib/list-controls";

import { useFeedback } from "@/components/feedback/feedback-provider";

import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Empty, Input, Modal, Pagination, Popconfirm, Select, Space, Spin, Tag, Typography } from "antd";
import { Form } from "@/components/form/localized-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { isFormValidationError } from "@/components/form/validation-error";
import { useAuth } from "@/components/providers/app-providers";
import { apiFetch } from "@/lib/api";
import { effectiveModuleEnabled } from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import {
  invalidateCourseEnrollmentQueries,
  invalidateCourseRelatedQueries,
} from "@/lib/query-invalidation";
import type {
  Course,
  CourseRosterItem,
  CourseStatus,
  DirectoryPerson,
  Paginated,
} from "@/lib/types";

interface CourseForm {
  title: string;
  slug: string;
  description?: string;
  status: CourseStatus;
  instructorId?: string;
}
interface EnrollmentForm {
  userId: string;
}
const statuses = [
  { label: "Bản nháp", value: "DRAFT" },
  { label: "Đang mở", value: "PUBLISHED" },
  { label: "Đã lưu trữ", value: "ARCHIVED" },
];
const statusLabel = Object.fromEntries(
  statuses.map((item) => [item.value, item.label]),
);
const objectId = (value: { _id: string } | string | undefined) =>
  typeof value === "string" ? value : value?._id;
const DIRECTORY_LIMIT = 20;
const EMPTY_DIRECTORY: DirectoryPerson[] = [];
const EMPTY_ROSTER: CourseRosterItem[] = [];

function directoryPath(path: string, page: number, search: string) {
  const params = new URLSearchParams({
    limit: String(DIRECTORY_LIMIT),
    page: String(page),
  });
  if (search.trim()) params.set("search", search.trim());
  return `${path}?${params.toString()}`;
}

export default function CoursesPage() {
  const { t } = useI18n(learningMessages);
  const { message, reportError, formatError } = useFeedback();
  const { effectiveAccess, organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [courseForm] = Form.useForm<CourseForm>();
  const [enrollmentForm] = Form.useForm<EnrollmentForm>();
  const [editing, setEditing] = useState<Course | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseOpen, setCourseOpen] = useState(false);
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const [instructorPage, setInstructorPage] = useState(1);
  const [instructorSearch, setInstructorSearch] = useState("");
  const [learnerPage, setLearnerPage] = useState(1);
  const [learnerSearch, setLearnerSearch] = useState("");
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterSearch, setRosterSearch] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [listStatus, setListStatus] = useState<CourseStatus | undefined>();
  const [listPage, setListPage] = useState(1);
  const [listSize, setListSize] = useState(12);
  const role = user?.role;
  const readOnly = effectiveAccess?.readOnly ?? false;
  const scopedTenantAdmin =
    role === "TENANT_ADMIN" && user?.orgUnitScopeMode === "SCOPED";
  const canManageRole = role === "TENANT_ADMIN" || role === "INSTRUCTOR";
  const canManageCourseRole =
    role === "INSTRUCTOR" || (role === "TENANT_ADMIN" && !scopedTenantAdmin);
  const canManageCourse = canManageCourseRole && !readOnly;
  const enrollmentEnabled = effectiveModuleEnabled(
    effectiveAccess,
    "ENROLLMENTS",
  );
  const canViewRoster = canManageRole && enrollmentEnabled;
  const canMutateRoster = canViewRoster && !readOnly;
  const scope = getViewerScope(user, organization);
  const actionRequests = useRef(new Map<string, Promise<void>>());
  const [pendingActions, setPendingActions] = useState<ReadonlySet<string>>(new Set());
  const actionKey = (action: string, id = "") => JSON.stringify([scope, action, id]);
  const runAction = (key: string, action: () => Promise<void>) => {
    const existing = actionRequests.current.get(key);
    if (existing) return existing;
    const request = Promise.resolve().then(action).finally(() => {
      actionRequests.current.delete(key);
      setPendingActions(current => { const next = new Set(current); next.delete(key); return next; });
    });
    actionRequests.current.set(key, request);
    setPendingActions(current => new Set(current).add(key));
    return request;
  };
  const coursesKey = scope
    ? lmsQueryKeys.courses(scope)
    : (["lms", "signed-out", "courses"] as const);
  const selectedCourseId = selectedCourse?._id ?? "";
  const instructorDirectory = useMemo(
    () => ({
      limit: DIRECTORY_LIMIT,
      page: instructorPage,
      ...(instructorSearch.trim() ? { search: instructorSearch.trim() } : {}),
    }),
    [instructorPage, instructorSearch],
  );
  const learnerDirectory = useMemo(
    () => ({
      limit: DIRECTORY_LIMIT,
      page: learnerPage,
      ...(learnerSearch.trim() ? { search: learnerSearch.trim() } : {}),
    }),
    [learnerPage, learnerSearch],
  );
  const rosterDirectory = useMemo(
    () => ({
      limit: DIRECTORY_LIMIT,
      page: rosterPage,
      ...(rosterSearch.trim() ? { search: rosterSearch.trim() } : {}),
    }),
    [rosterPage, rosterSearch],
  );
  const coursesQuery = useQuery({
    enabled: Boolean(token && scope && role !== "SUPER_ADMIN"),
    queryKey: coursesKey,
    queryFn: () => apiFetch<Course[]>("/courses", { token }),
  });
  const instructorsQuery = useQuery({
    enabled: Boolean(
      token &&
      scope &&
      courseOpen &&
      role === "TENANT_ADMIN" &&
      !scopedTenantAdmin,
    ),
    placeholderData: (previous) => previous,
    queryKey: scope
      ? lmsQueryKeys.eligibleInstructors(scope, instructorDirectory)
      : [
        "lms",
        "signed-out",
        "courses",
        "eligible-instructors",
        instructorDirectory,
      ],
    queryFn: () =>
      apiFetch<Paginated<DirectoryPerson>>(
        directoryPath(
          "/courses/eligible-instructors",
          instructorPage,
          instructorSearch,
        ),
        { token },
      ),
  });
  const learnersQuery = useQuery({
    enabled: Boolean(
      token && scope && enrollmentOpen && selectedCourseId && canMutateRoster,
    ),
    placeholderData: (previous) => previous,
    queryKey: scope
      ? lmsQueryKeys.eligibleLearners(scope, selectedCourseId, learnerDirectory)
      : [
        "lms",
        "signed-out",
        "enrollments",
        selectedCourseId,
        "eligible-learners",
        learnerDirectory,
      ],
    queryFn: () =>
      apiFetch<Paginated<DirectoryPerson>>(
        directoryPath(
          `/enrollments/courses/${selectedCourseId}/eligible-learners`,
          learnerPage,
          learnerSearch,
        ),
        { token },
      ),
  });
  const rosterQuery = useQuery({
    enabled: Boolean(
      token && scope && enrollmentOpen && selectedCourseId && canViewRoster,
    ),
    placeholderData: (previous) => previous,
    queryKey: scope
      ? lmsQueryKeys.courseRoster(scope, selectedCourseId, rosterDirectory)
      : [
        "lms",
        "signed-out",
        "enrollments",
        selectedCourseId,
        "roster",
        rosterDirectory,
      ],
    queryFn: () =>
      apiFetch<Paginated<CourseRosterItem>>(
        directoryPath(
          `/enrollments/courses/${selectedCourseId}/roster`,
          rosterPage,
          rosterSearch,
        ),
        { token },
      ),
  });
  const courses = coursesQuery.data ?? [];
  const normalizedSearch = normalizeListSearch(listSearch);
  const filteredCourses = courses.filter((course) => {
    const instructor = typeof course.instructorId === "object" ? course.instructorId : null;
    return (!listStatus || course.status === listStatus)
      && (!normalizedSearch || normalizeListSearch([
        course.title, course.slug, course.description, instructor?.fullName, instructor?.email,
      ].filter(Boolean).join(" ")).includes(normalizedSearch));
  });
  const currentListPage = Math.min(listPage, listPageCount(filteredCourses.length, listSize));
  if (!coursesQuery.isFetching && !coursesQuery.isPending && listPage > currentListPage) setListPage(currentListPage);
  const visibleCourses = filteredCourses.slice((currentListPage - 1) * listSize, currentListPage * listSize);
  const hasListFilters = Boolean(listSearch || listStatus);
  const clearListFilters = () => {
    setListSearch("");
    setListStatus(undefined);
    setListPage(1);
  };
  const instructors = useMemo(() => {
    const directory = instructorsQuery.data?.items ?? EMPTY_DIRECTORY;
    const current =
      editing && typeof editing.instructorId === "object"
        ? {
          email: editing.instructorId.email,
          fullName: editing.instructorId.fullName,
          userId: editing.instructorId._id,
        }
        : null;
    return current && !directory.some((item) => item.userId === current.userId)
      ? [current, ...directory]
      : directory;
  }, [editing, instructorsQuery.data?.items]);
  const learners = learnersQuery.data?.items ?? EMPTY_DIRECTORY;
  const selectedEnrollments = rosterQuery.data?.items ?? EMPTY_ROSTER;
  const enrollmentLoading =
    enrollmentOpen &&
    (rosterQuery.isPending || (canMutateRoster && learnersQuery.isPending));
  const enrollmentError = rosterQuery.error ?? learnersQuery.error;

  const resetInstructorDirectory = () => {
    setInstructorPage(1);
    setInstructorSearch("");
  };
  const showCreate = () => {
    setEditing(null);
    resetInstructorDirectory();
    courseForm.resetFields();
    courseForm.setFieldsValue({ status: "DRAFT" });
    setCourseOpen(true);
  };
  const showEdit = (course: Course) => {
    setEditing(course);
    resetInstructorDirectory();
    courseForm.setFieldsValue({
      title: course.title,
      slug: course.slug,
      description: course.description,
      status: course.status,
      instructorId: objectId(course.instructorId),
    });
    setCourseOpen(true);
  };
  const saveCourseMutation = useMutation({
    mutationFn: (values: CourseForm) =>
      apiFetch(editing ? `/courses/${editing._id}` : "/courses", {
        token,
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          ...values,
          instructorId:
            user?.role === "TENANT_ADMIN"
              ? (values.instructorId ?? null)
              : undefined,
        }),
      }),
    onSuccess: async () => {
      message.success(editing ? "Đã cập nhật khóa học" : "Đã tạo khóa học");
      setCourseOpen(false);
      if (scope) await invalidateCourseRelatedQueries(queryClient, scope);
    },
  });
  const archiveMutation = useMutation({
    mutationFn: (course: Course) =>
      apiFetch(`/courses/${course._id}`, { token, method: "DELETE" }),
    onSuccess: async () => {
      message.success("Đã lưu trữ khóa học");
      if (scope) await invalidateCourseRelatedQueries(queryClient, scope);
    },
  });
  const enrollMutation = useMutation({
    mutationFn: ({ courseId, userId }: EnrollmentForm & { courseId: string }) =>
      apiFetch("/enrollments", {
        token,
        method: "POST",
        body: JSON.stringify({ courseId, userId }),
      }),
    onSuccess: async (_response, variables) => {
      message.success("Đã ghi danh học viên");
      enrollmentForm.resetFields();
      if (scope)
        await invalidateCourseEnrollmentQueries(
          queryClient,
          scope,
          variables.courseId,
        );
    },
  });
  const removeEnrollmentMutation = useMutation({
    mutationFn: ({ id }: { courseId: string; id: string }) =>
      apiFetch<{ withdrawn: true }>(`/enrollments/${id}`, {
        token,
        method: "DELETE",
      }),
    onSuccess: async (_response, variables) => {
      message.success("Đã rút học viên khỏi khóa học");
      if (scope)
        await invalidateCourseEnrollmentQueries(
          queryClient,
          scope,
          variables.courseId,
        );
    },
  });
  const tanstackCourseForm = useAntdTanStackForm<CourseForm>(
    { description: "", status: "DRAFT", slug: "", title: "" },
    (values) => saveCourseMutation.mutateAsync(values).then(() => undefined),
  );
  const tanstackEnrollmentForm = useAntdTanStackForm<EnrollmentForm>(
    { userId: "" },
    (values) =>
      selectedCourse
        ? enrollMutation
          .mutateAsync({ ...values, courseId: selectedCourse._id })
          .then(() => undefined)
        : Promise.resolve(),
  );
  const saveCourse = () => runAction(actionKey("save"), async () => {
    if (!canManageCourse || !scope) return;
    try {
      await tanstackCourseForm.submit(await courseForm.validateFields());
    } catch (caught) {
      if (!isFormValidationError(caught))
        reportError(caught, "Không thể lưu khóa học");
    }
  });
  const archive = (course: Course) => runAction(actionKey("archive", course._id), async () => {
    if (!canManageCourse || !scope) return;
    try {
      await archiveMutation.mutateAsync(course);
    } catch (caught) {
      reportError(caught, "Không thể lưu trữ khóa học");
    }
  });
  const showEnrollment = (course: Course) => {
    setSelectedCourse(course);
    setLearnerPage(1);
    setLearnerSearch("");
    setRosterPage(1);
    setRosterSearch("");
    enrollmentForm.resetFields();
    setEnrollmentOpen(true);
  };
  const enroll = () => runAction(actionKey("enroll", selectedCourseId), async () => {
    if (!selectedCourse || !canMutateRoster || !scope) return;
    try {
      await tanstackEnrollmentForm.submit(
        await enrollmentForm.validateFields(),
      );
    } catch (caught) {
      if (!isFormValidationError(caught))
        reportError(caught, "Không thể ghi danh");
    }
  });
  const removeEnrollment = (id: string) => runAction(actionKey("remove", id), async () => {
    if (!selectedCourse || !canMutateRoster || !scope) return;
    try {
      await removeEnrollmentMutation.mutateAsync({
        courseId: selectedCourse._id,
        id,
      });
    } catch (caught) {
      reportError(caught, "Không thể hủy ghi danh");
    }
  });

  if (user?.role === "SUPER_ADMIN")
    return (
      <Alert
        showIcon
        title={t("Quản trị nền tảng xem số liệu tổng hợp; khóa học được vận hành trong từng tổ chức.")}
        type="info"
      />
    );
  return (
    <main
      aria-labelledby="courses-page-title"
      className="page-shell courses-page"
    >
      <header className="page-heading courses-page-heading">
        <div className="page-heading-copy">
          <h1 id="courses-page-title">
            {user?.role === "LEARNER" ? t("Khóa học của tôi") : t("Khóa học")}
          </h1>
          <p>
            {user?.role === "LEARNER"
              ? t("Tiếp tục các khóa học bạn đã tham gia.")
              : scopedTenantAdmin
                ? t("Ghi danh học viên trong đơn vị vào danh mục chung.")
                : t("Quản lý nội dung, giảng viên và học viên.")}
          </p>
        </div>
        {canManageCourseRole && (
          <Button
            className="page-primary-action"
            disabled={readOnly}
            icon={<PlusOutlined />}
            onClick={showCreate}
            title={readOnly ? t("Gia hạn thuê bao để tạo khóa học") : undefined}
            type="primary"
          >{t("Tạo khóa học")}</Button>
        )}
      </header>
      {scopedTenantAdmin && (
        <Alert
          description={t("Bạn quản lý ghi danh trong đơn vị. Nội dung do quản trị viên toàn tổ chức hoặc giảng viên phụ trách quản lý.")}
          showIcon
          title={t("Danh mục học thuật dùng chung")}
          type="info"
        />
      )}
      <div aria-label={t("Bộ lọc khóa học")} className="list-filter-bar" role="search">
        <Input.Search
          allowClear
          aria-label={t("Tìm khóa học")}
          maxLength={100}
          onChange={(event) => { setListSearch(event.target.value); setListPage(1); }}
          placeholder={t("Tìm theo tên hoặc mô tả")}
          value={listSearch}
        />
        {role !== "LEARNER" && (
          <Select<CourseStatus>
            allowClear
            aria-label={t("Lọc trạng thái khóa học")}
            onChange={(value) => { setListStatus(value); setListPage(1); }}
            options={statuses.map((option) => ({ ...option, label: t(option.label) }))}
            placeholder={t("Tất cả trạng thái")}
            value={listStatus}
          />
        )}
        {hasListFilters && <Button onClick={clearListFilters}>{t("Xóa bộ lọc")}</Button>}
      </div>
      {coursesQuery.error || pendingActions.has(actionKey("retry-courses")) ? (
        <Alert
          action={<Button loading={coursesQuery.isFetching || pendingActions.has(actionKey("retry-courses"))} onClick={() => void runAction(actionKey("retry-courses"), async () => { await coursesQuery.refetch({ cancelRefetch: false }); })}>{t("Thử lại")}</Button>}
          showIcon
          title={
            formatError(coursesQuery.error, "Không tải được khóa học")
          }
          type="error"
        />
      ) : coursesQuery.isPending ? (
        <div
          aria-label={t("Đang tải khóa học")}
          className="page-loading"
          role="status"
        >
          <Spin size="large" />
        </div>
      ) : visibleCourses.length ? (
        <>
        <section aria-label={t("Danh sách khóa học")} className="course-grid">
          {visibleCourses.map((course) => {
            const courseTitleId = `course-title-${course._id}`;
            return (
              <Card className={`surface-card course-card ${polish.courseCard}`} key={course._id}>
                <article
                  aria-labelledby={courseTitleId}
                  className="course-card-content"
                >
                  <header className="course-card-header">
                    <Space className="course-card-kicker" size={[8, 8]} wrap>
                      <Tag
                        color={
                          course.status === "PUBLISHED"
                            ? "green"
                            : course.status === "ARCHIVED"
                              ? "default"
                              : "gold"
                        }
                      >
                        {t(statusLabel[course.status])}
                      </Tag>
                    </Space>
                    <Typography.Title
                      className="course-card-title"
                      ellipsis={{ rows: 2 }}
                      id={courseTitleId}
                      level={2}
                    >
                      {course.title}
                    </Typography.Title>
                  </header>

                  {course.description && <Typography.Paragraph
                    className="course-card-description"
                    ellipsis={{ rows: 3 }}
                  >
                    {course.description}
                  </Typography.Paragraph>}

                  {typeof course.instructorId === "object" && (
                    <dl className="course-card-meta">
                      <div>
                        <dt>{t("Giảng viên")}</dt>
                        <dd>{course.instructorId.fullName}</dd>
                      </div>
                    </dl>
                  )}

                  <Space className="course-card-actions" size={[8, 8]} wrap>
                    {!scopedTenantAdmin && (
                      <Button
                        className="course-card-primary-action"
                        onClick={() => router.push(`/courses/${course._id}`)}
                        type="primary"
                      >{t("Mở khóa học")}</Button>
                    )}
                    {canViewRoster && course.status !== "ARCHIVED" && (
                      <Button
                        icon={<TeamOutlined />}
                        onClick={() => showEnrollment(course)}
                      >{t("Học viên")}</Button>
                    )}
                    {canManageCourse && (
                      <details className={polish.courseMenu} onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
                      <summary aria-label={t("Tùy chọn khóa học {name}", { name: course.title })}>⋯</summary>
                      <div className={polish.courseMenuPanel}>
                      <Button
                        icon={<EditOutlined />}
                        onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); showEdit(course); }}
                        type="text"
                      >{t("Chỉnh sửa")}</Button>
                      <Popconfirm
                        cancelText={t("Hủy")}
                        okText={t("Lưu trữ")}
                        onConfirm={() => archive(course)}
                        okButtonProps={{ loading: pendingActions.has(actionKey("archive", course._id)) }}
                        title={t("Lưu trữ khóa học này?")}
                      >
                        <Button
                          aria-label={t("Lưu trữ khóa học {p0}", { p0: course.title })}
                          danger
                          loading={pendingActions.has(actionKey("archive", course._id))}
                          icon={<DeleteOutlined />}
                          title={t("Lưu trữ khóa học")}
                          type="text"
                        >{t("Lưu trữ")}</Button>
                      </Popconfirm>
                      </div>
                      </details>
                    )}
                  </Space>
                </article>
              </Card>
            );
          })}
        </section>
        <div className="list-pagination">
          <Pagination
            current={currentListPage}
            hideOnSinglePage={false}
            onChange={(page, size) => { setListPage(size === listSize ? page : 1); setListSize(size); }}
            pageSize={listSize}
            pageSizeOptions={[12, 24, 48, 96]}
            responsive
            showLessItems
            showSizeChanger={{ "aria-label": t("Số dòng mỗi trang"), showSearch: false }}
            showTotal={(total, range) => t("{p0}–{p1} trên {p2} mục", { p0: range[0], p1: range[1], p2: total })}
            total={filteredCourses.length}
          />
        </div>
        </>
      ) : (
        <Card className="surface-card courses-empty-card">
          <Empty
            className="empty-block"
            description={
              hasListFilters
                ? t("Không có khóa học phù hợp")
                : user?.role === "LEARNER"
                ? t("Bạn chưa được ghi danh vào khóa học nào")
                : t("Chưa có khóa học")
            }
          >
            {hasListFilters ? <Typography.Text type="secondary">{t("Thử thay đổi từ khóa hoặc xóa bộ lọc.")}</Typography.Text> : canManageCourseRole && (
              <Button disabled={readOnly} onClick={showCreate} type="primary">{t("Tạo khóa học đầu tiên")}</Button>
            )}
          </Empty>
        </Card>
      )}

      <Modal
        cancelText={t("Hủy")}
        confirmLoading={pendingActions.has(actionKey("save")) || saveCourseMutation.isPending}
        okText={editing ? t("Lưu thay đổi") : t("Tạo khóa học")}
        onCancel={() => setCourseOpen(false)}
        onOk={() => void saveCourse()}
        open={courseOpen}
        title={editing ? t("Chỉnh sửa khóa học") : t("Tạo khóa học")}
      >
        <Form
          form={courseForm}
          layout="vertical"
          requiredMark={false}
          style={{ marginTop: 22 }}
        >
          <Form.Item
            label={t("Tên khóa học")}
            name="title"
            rules={[{ required: true, min: 2, message: t("Nhập tên khóa học") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            extra={t("Dùng chữ thường, số và dấu gạch ngang.")}
            label={t("Đường dẫn khóa học")}
            name="slug"
            rules={[
              {
                required: true,
                pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                message: t("Dùng chữ thường, số và dấu gạch ngang"),
              },
            ]}
          >
            <Input addonBefore="/courses/" placeholder="tieng-anh-giao-tiep" />
          </Form.Item>
          <Form.Item label={t("Mô tả")} name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label={t("Trạng thái")} name="status">
            <Select options={statuses.map(option => ({ ...option, label: t(option.label) }))} />
          </Form.Item>
          {user?.role === "TENANT_ADMIN" && (
            <>
              {instructorsQuery.error && (
                <Alert
                  showIcon
                  title={
                    formatError(instructorsQuery.error, "Không tải được danh sách giảng viên")
                  }
                  type="warning"
                />
              )}
              <Form.Item label={t("Giảng viên phụ trách")} name="instructorId">
                <Select
                  allowClear
                  filterOption={false}
                  loading={instructorsQuery.isFetching}
                  onSearch={(value) => {
                    setInstructorSearch(value);
                    setInstructorPage(1);
                  }}
                  options={instructors.map((item) => ({
                    label: `${item.fullName} · ${item.email}`,
                    value: item.userId,
                  }))}
                  placeholder={t("Tìm giảng viên")}
                  showSearch
                />
              </Form.Item>
              {(instructorsQuery.data?.total ?? 0) > DIRECTORY_LIMIT && (
                <Pagination
                  current={instructorPage}
                  onChange={setInstructorPage}
                  pageSize={DIRECTORY_LIMIT}
                  showSizeChanger={false}
                  size="small"
                  total={instructorsQuery.data?.total ?? 0}
                />
              )}
            </>
          )}
        </Form>
      </Modal>

      <Modal
        cancelButtonProps={{ style: { display: "none" } }}
        footer={null}
        onCancel={() => setEnrollmentOpen(false)}
        open={enrollmentOpen}
        title={`Ghi danh · ${selectedCourse?.title ?? ""}`}
      >
        {enrollmentError || pendingActions.has(actionKey("retry-enrollment", selectedCourseId)) ? (
          <Alert
            action={
              <Button
                loading={pendingActions.has(actionKey("retry-enrollment", selectedCourseId)) || rosterQuery.isFetching || (canMutateRoster && learnersQuery.isFetching)}
                onClick={() =>
                  void runAction(actionKey("retry-enrollment", selectedCourseId), async () => { await Promise.all([
                    rosterQuery.refetch({ cancelRefetch: false }),
                    ...(canMutateRoster ? [learnersQuery.refetch({ cancelRefetch: false })] : []),
                  ]); })
                }
                size="small"
              >{t("Thử lại")}</Button>
            }
            showIcon
            style={{ marginTop: 22 }}
            title={
              formatError(enrollmentError, "Không tải được dữ liệu ghi danh")
            }
            type="error"
          />
        ) : enrollmentLoading ? (
          <div
            style={{ display: "grid", minHeight: 180, placeItems: "center" }}
          >
            <Spin />
          </div>
        ) : (
          <>
            {readOnly && (
              <Alert
                description={t("Bạn vẫn có thể xem danh sách; thao tác ghi danh và rút học viên đang tạm khóa.")}
                showIcon
                style={{ marginTop: 22 }}
                title={t("Workspace chỉ đọc")}
                type="info"
              />
            )}
            {canMutateRoster && (
              <Form
                form={enrollmentForm}
                layout="vertical"
                onFinish={() => void enroll()}
                requiredMark={false}
                style={{ marginTop: 22 }}
              >
                <Space.Compact block>
                  <Form.Item
                    name="userId"
                    noStyle
                    rules={[{ required: true, message: t("Chọn học viên") }]}
                  >
                    <Select
                      disabled={enrollMutation.isPending}
                      filterOption={false}
                      loading={learnersQuery.isFetching}
                      onSearch={(value) => {
                        setLearnerSearch(value);
                        setLearnerPage(1);
                      }}
                      options={learners.map((item) => ({
                        label: `${item.fullName} · ${item.email}`,
                        value: item.userId,
                      }))}
                      placeholder={t("Tìm học viên đủ điều kiện")}
                      showSearch
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                  <Button
                    disabled={!learners.length}
                    htmlType="submit"
                    loading={pendingActions.has(actionKey("enroll", selectedCourseId)) || enrollMutation.isPending}
                    type="primary"
                  >{t("Ghi danh")}</Button>
                </Space.Compact>
                {(learnersQuery.data?.total ?? 0) > DIRECTORY_LIMIT && (
                  <Pagination
                    current={learnerPage}
                    onChange={setLearnerPage}
                    pageSize={DIRECTORY_LIMIT}
                    showSizeChanger={false}
                    simple
                    size="small"
                    total={learnersQuery.data?.total ?? 0}
                  />
                )}
              </Form>
            )}
            <div style={{ marginTop: 24 }}>
              <Input.Search
                allowClear
                aria-label={t("Tìm trong danh sách đã ghi danh")}
                onSearch={(value) => {
                  setRosterSearch(value);
                  setRosterPage(1);
                }}
                placeholder={t("Tìm học viên đã ghi danh")}
              />
              <strong style={{ display: "block", marginTop: 16 }}>{t("Đã ghi danh (")}{rosterQuery.data?.total ?? 0})
              </strong>
              {selectedEnrollments.length ? (
                selectedEnrollments.map((item) => {
                  const learner = item.userId;
                  return (
                    <div
                      key={item._id}
                      style={{
                        alignItems: "center",
                        borderBottom: "1px solid #eee",
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "12px 0",
                      }}
                    >
                      <span>
                        {learner.fullName}
                        <small
                          className="table-muted"
                          style={{ display: "block" }}
                        >
                          {learner.email}
                        </small>
                      </span>
                      {canMutateRoster ? (
                        <Popconfirm
                          cancelText={t("Hủy")}
                          okText={t("Rút")}
                          onConfirm={() => removeEnrollment(item._id)}
                          okButtonProps={{ loading: pendingActions.has(actionKey("remove", item._id)) }}
                          title={t("Rút học viên khỏi khóa học?")}
                        >
                          <Button danger loading={pendingActions.has(actionKey("remove", item._id))} size="small" type="text">{t("Rút")}</Button>
                        </Popconfirm>
                      ) : (
                        <Tag color="green">{t("Đang học")}</Tag>
                      )}
                    </div>
                  );
                })
              ) : (
                <Empty
                  description={t("Chưa có học viên")}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
              {(rosterQuery.data?.total ?? 0) > DIRECTORY_LIMIT && (
                <Pagination
                  current={rosterPage}
                  onChange={setRosterPage}
                  pageSize={DIRECTORY_LIMIT}
                  showSizeChanger={false}
                  size="small"
                  total={rosterQuery.data?.total ?? 0}
                />
              )}
            </div>
          </>
        )}
      </Modal>
    </main>
  );
}
