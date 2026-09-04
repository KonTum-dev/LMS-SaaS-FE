"use client";

import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
  const { message } = App.useApp();
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
  const saveCourse = async () => {
    try {
      await tanstackCourseForm.submit(await courseForm.validateFields());
    } catch (caught) {
      if (!isFormValidationError(caught))
        message.error(
          caught instanceof Error ? caught.message : "Không thể lưu khóa học",
        );
    }
  };
  const archive = async (course: Course) => {
    try {
      await archiveMutation.mutateAsync(course);
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : "Không thể lưu trữ khóa học",
      );
    }
  };
  const showEnrollment = (course: Course) => {
    setSelectedCourse(course);
    setLearnerPage(1);
    setLearnerSearch("");
    setRosterPage(1);
    setRosterSearch("");
    enrollmentForm.resetFields();
    setEnrollmentOpen(true);
  };
  const enroll = async () => {
    if (!selectedCourse) return;
    try {
      await tanstackEnrollmentForm.submit(
        await enrollmentForm.validateFields(),
      );
    } catch (caught) {
      if (!isFormValidationError(caught))
        message.error(
          caught instanceof Error ? caught.message : "Không thể ghi danh",
        );
    }
  };
  const removeEnrollment = async (id: string) => {
    if (!selectedCourse) return;
    try {
      await removeEnrollmentMutation.mutateAsync({
        courseId: selectedCourse._id,
        id,
      });
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : "Không thể hủy ghi danh",
      );
    }
  };

  if (user?.role === "SUPER_ADMIN")
    return (
      <Alert
        showIcon
        title="Quản trị nền tảng xem số liệu tổng hợp; khóa học được vận hành trong từng tổ chức."
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
            {user?.role === "LEARNER" ? "Khóa học của tôi" : "Khóa học"}
          </h1>
          <p>
            {user?.role === "LEARNER"
              ? "Các khóa học đã ghi danh và đang được mở."
              : scopedTenantAdmin
                ? "Dùng danh mục khóa học chung để quản lý ghi danh trong đơn vị của bạn."
                : "Tổ chức nội dung đào tạo, phân công giảng viên và ghi danh học viên."}
          </p>
        </div>
        {canManageCourseRole && (
          <Button
            className="page-primary-action"
            disabled={readOnly}
            icon={<PlusOutlined />}
            onClick={showCreate}
            title={readOnly ? "Gia hạn thuê bao để tạo khóa học" : undefined}
            type="primary"
          >
            Tạo khóa học
          </Button>
        )}
      </header>
      {scopedTenantAdmin && (
        <Alert
          description="Nội dung khóa học được quản trị viên toàn tổ chức hoặc giảng viên phụ trách quản lý. Bạn vẫn có thể ghi danh học viên thuộc phạm vi đơn vị."
          showIcon
          title="Danh mục học thuật dùng chung"
          type="info"
        />
      )}
      {coursesQuery.error ? (
        <Alert
          showIcon
          title={
            coursesQuery.error instanceof Error
              ? coursesQuery.error.message
              : "Không tải được khóa học"
          }
          type="error"
        />
      ) : coursesQuery.isPending ? (
        <div
          aria-label="Đang tải khóa học"
          className="page-loading"
          role="status"
        >
          <Spin size="large" />
        </div>
      ) : courses.length ? (
        <section aria-label="Danh sách khóa học" className="course-grid">
          {courses.map((course) => {
            const courseTitleId = `course-title-${course._id}`;
            return (
              <Card className="surface-card course-card" key={course._id}>
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
                        {statusLabel[course.status]}
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

                  <Typography.Paragraph
                    className="course-card-description"
                    ellipsis={{ rows: 3 }}
                  >
                    {course.description || "Chưa có mô tả cho khóa học này."}
                  </Typography.Paragraph>

                  {typeof course.instructorId === "object" && (
                    <dl className="course-card-meta">
                      <div>
                        <dt>Giảng viên</dt>
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
                      >
                        Mở khóa học
                      </Button>
                    )}
                    {canManageCourse && (
                      <Button
                        icon={<EditOutlined />}
                        onClick={() => showEdit(course)}
                      >
                        Chỉnh sửa
                      </Button>
                    )}
                    {canViewRoster && course.status !== "ARCHIVED" && (
                      <Button
                        icon={<TeamOutlined />}
                        onClick={() => showEnrollment(course)}
                      >
                        Học viên
                      </Button>
                    )}
                    {canManageCourse && (
                      <Popconfirm
                        cancelText="Hủy"
                        okText="Lưu trữ"
                        onConfirm={() => void archive(course)}
                        title="Lưu trữ khóa học này?"
                      >
                        <Button
                          aria-label={`Lưu trữ khóa học ${course.title}`}
                          danger
                          icon={<DeleteOutlined />}
                          title="Lưu trữ khóa học"
                        />
                      </Popconfirm>
                    )}
                  </Space>
                </article>
              </Card>
            );
          })}
        </section>
      ) : (
        <Card className="surface-card courses-empty-card">
          <Empty
            className="empty-block"
            description={
              user?.role === "LEARNER"
                ? "Bạn chưa được ghi danh vào khóa học nào"
                : "Chưa có khóa học"
            }
          >
            {canManageCourseRole && (
              <Button disabled={readOnly} onClick={showCreate} type="primary">
                Tạo khóa học đầu tiên
              </Button>
            )}
          </Empty>
        </Card>
      )}

      <Modal
        cancelText="Hủy"
        confirmLoading={saveCourseMutation.isPending}
        okText={editing ? "Lưu thay đổi" : "Tạo khóa học"}
        onCancel={() => setCourseOpen(false)}
        onOk={() => void saveCourse()}
        open={courseOpen}
        title={editing ? "Chỉnh sửa khóa học" : "Tạo khóa học"}
      >
        <Form
          form={courseForm}
          layout="vertical"
          requiredMark={false}
          style={{ marginTop: 22 }}
        >
          <Form.Item
            label="Tên khóa học"
            name="title"
            rules={[{ required: true, min: 2, message: "Nhập tên khóa học" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            extra="Dùng chữ thường, số và dấu gạch ngang."
            label="Đường dẫn khóa học"
            name="slug"
            rules={[
              {
                required: true,
                pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                message: "Dùng chữ thường, số và dấu gạch ngang",
              },
            ]}
          >
            <Input addonBefore="/courses/" placeholder="tieng-anh-giao-tiep" />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Trạng thái" name="status">
            <Select options={statuses} />
          </Form.Item>
          {user?.role === "TENANT_ADMIN" && (
            <>
              {instructorsQuery.error && (
                <Alert
                  showIcon
                  title={
                    instructorsQuery.error instanceof Error
                      ? instructorsQuery.error.message
                      : "Không tải được danh sách giảng viên"
                  }
                  type="warning"
                />
              )}
              <Form.Item label="Giảng viên phụ trách" name="instructorId">
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
                  placeholder="Tìm giảng viên"
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
        {enrollmentError ? (
          <Alert
            action={
              <Button
                onClick={() =>
                  void Promise.all([
                    rosterQuery.refetch(),
                    ...(canMutateRoster ? [learnersQuery.refetch()] : []),
                  ])
                }
                size="small"
              >
                Thử lại
              </Button>
            }
            showIcon
            style={{ marginTop: 22 }}
            title={
              enrollmentError instanceof Error
                ? enrollmentError.message
                : "Không tải được dữ liệu ghi danh"
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
                description="Bạn vẫn có thể xem danh sách; thao tác ghi danh và rút học viên đang tạm khóa."
                showIcon
                style={{ marginTop: 22 }}
                title="Workspace chỉ đọc"
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
                    rules={[{ required: true, message: "Chọn học viên" }]}
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
                      placeholder="Tìm học viên đủ điều kiện"
                      showSearch
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                  <Button
                    disabled={!learners.length}
                    htmlType="submit"
                    loading={enrollMutation.isPending}
                    type="primary"
                  >
                    Ghi danh
                  </Button>
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
                aria-label="Tìm trong danh sách đã ghi danh"
                onSearch={(value) => {
                  setRosterSearch(value);
                  setRosterPage(1);
                }}
                placeholder="Tìm học viên đã ghi danh"
              />
              <strong style={{ display: "block", marginTop: 16 }}>
                Đã ghi danh ({rosterQuery.data?.total ?? 0})
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
                          cancelText="Hủy"
                          okText="Rút"
                          onConfirm={() => void removeEnrollment(item._id)}
                          title="Rút học viên khỏi khóa học?"
                        >
                          <Button danger size="small" type="text">
                            Rút
                          </Button>
                        </Popconfirm>
                      ) : (
                        <Tag color="green">Đang học</Tag>
                      )}
                    </div>
                  );
                })
              ) : (
                <Empty
                  description="Chưa có học viên"
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
