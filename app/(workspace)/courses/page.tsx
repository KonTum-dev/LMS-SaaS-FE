"use client";

import { DeleteOutlined, EditOutlined, PlusOutlined, TeamOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Empty, Form, Input, Modal, Popconfirm, Select, Space, Spin, Tag, Typography } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { isFormValidationError } from "@/components/form/validation-error";
import { useAuth } from "@/components/providers/app-providers";
import { apiFetch } from "@/lib/api";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import { invalidateCourseRelatedQueries } from "@/lib/query-invalidation";
import type { AppUser, Course, CourseStatus, Enrollment } from "@/lib/types";

interface CourseForm { title: string; slug: string; description?: string; status: CourseStatus; instructorId?: string }
interface EnrollmentForm { userId: string }
const statuses = [
  { label: "Bản nháp", value: "DRAFT" }, { label: "Đang mở", value: "PUBLISHED" }, { label: "Đã lưu trữ", value: "ARCHIVED" },
];
const statusLabel = Object.fromEntries(statuses.map((item) => [item.value, item.label]));
const objectId = (value: { _id: string } | string | undefined) => typeof value === "string" ? value : value?._id;
const EMPTY_USERS: AppUser[] = [];
const EMPTY_ENROLLMENTS: Enrollment[] = [];

export default function CoursesPage() {
  const { message } = App.useApp();
  const { organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [courseForm] = Form.useForm<CourseForm>();
  const [enrollmentForm] = Form.useForm<EnrollmentForm>();
  const [editing, setEditing] = useState<Course | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseOpen, setCourseOpen] = useState(false);
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const role = user?.role;
  const canManage = role === "TENANT_ADMIN" || role === "INSTRUCTOR";
  const enrollmentEnabled = organization?.enabledModules?.includes("ENROLLMENTS") ?? true;
  const scope = getViewerScope(user, organization);
  const coursesKey = scope ? lmsQueryKeys.courses(scope) : ["lms", "signed-out", "courses"] as const;
  const peopleKey = scope ? lmsQueryKeys.users(scope) : ["lms", "signed-out", "users"] as const;
  const enrollmentsKey = scope ? lmsQueryKeys.enrollments(scope) : ["lms", "signed-out", "enrollments"] as const;
  const coursesQuery = useQuery({
    enabled: Boolean(token && scope && role !== "SUPER_ADMIN"),
    queryKey: coursesKey,
    queryFn: () => apiFetch<Course[]>("/courses", { token }),
  });
  const peopleQuery = useQuery({
    enabled: Boolean(token && scope && canManage),
    queryKey: peopleKey,
    queryFn: () => apiFetch<AppUser[]>(role === "TENANT_ADMIN" ? "/users" : "/users/learners", { token }),
  });
  const enrollmentsQuery = useQuery({
    enabled: Boolean(token && scope && canManage && enrollmentEnabled),
    queryKey: enrollmentsKey,
    queryFn: () => apiFetch<Enrollment[]>("/enrollments", { token }),
  });
  const courses = coursesQuery.data ?? [];
  const people = peopleQuery.data ?? EMPTY_USERS;
  const enrollments = enrollmentsQuery.data ?? EMPTY_ENROLLMENTS;

  const instructors = useMemo(() => people.filter((person) => person.role === "INSTRUCTOR" || person.role === "TENANT_ADMIN"), [people]);
  const learners = useMemo(() => people.filter((person) => person.role === "LEARNER" && person.status === "ACTIVE"), [people]);
  const selectedEnrollments = useMemo(() => enrollments.filter((item) => objectId(item.courseId) === selectedCourse?._id), [enrollments, selectedCourse]);
  const enrollmentLoading = enrollmentOpen && (peopleQuery.isPending || enrollmentsQuery.isPending);
  const enrollmentError = peopleQuery.error ?? enrollmentsQuery.error;

  const showCreate = () => { setEditing(null); courseForm.resetFields(); courseForm.setFieldsValue({ status: "DRAFT" }); setCourseOpen(true); };
  const showEdit = (course: Course) => { setEditing(course); courseForm.setFieldsValue({ title: course.title, slug: course.slug, description: course.description, status: course.status, instructorId: objectId(course.instructorId) }); setCourseOpen(true); };
  const saveCourseMutation = useMutation({
    mutationFn: (values: CourseForm) => apiFetch(editing ? `/courses/${editing._id}` : "/courses", {
      token,
      method: editing ? "PATCH" : "POST",
      body: JSON.stringify({ ...values, instructorId: user?.role === "TENANT_ADMIN" ? values.instructorId ?? null : undefined }),
    }),
    onSuccess: async () => {
      message.success(editing ? "Đã cập nhật khóa học" : "Đã tạo khóa học");
      setCourseOpen(false);
      if (scope) await invalidateCourseRelatedQueries(queryClient, scope);
    },
  });
  const archiveMutation = useMutation({
    mutationFn: (course: Course) => apiFetch(`/courses/${course._id}`, { token, method: "DELETE" }),
    onSuccess: async () => {
      message.success("Đã lưu trữ khóa học");
      if (scope) await invalidateCourseRelatedQueries(queryClient, scope);
    },
  });
  const enrollMutation = useMutation({
    mutationFn: (values: EnrollmentForm) => apiFetch("/enrollments", { token, method: "POST", body: JSON.stringify({ courseId: selectedCourse?._id, userId: values.userId }) }),
    onSuccess: async () => {
      message.success("Đã ghi danh học viên");
      enrollmentForm.resetFields();
      if (scope) await invalidateCourseRelatedQueries(queryClient, scope);
    },
  });
  const removeEnrollmentMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/enrollments/${id}`, { token, method: "DELETE" }),
    onSuccess: async () => {
      message.success("Đã hủy ghi danh");
      if (scope) await invalidateCourseRelatedQueries(queryClient, scope);
    },
  });
  const tanstackCourseForm = useAntdTanStackForm<CourseForm>(
    { description: "", status: "DRAFT", slug: "", title: "" },
    (values) => saveCourseMutation.mutateAsync(values).then(() => undefined),
  );
  const tanstackEnrollmentForm = useAntdTanStackForm<EnrollmentForm>(
    { userId: "" },
    (values) => enrollMutation.mutateAsync(values).then(() => undefined),
  );
  const saveCourse = async () => {
    try { await tanstackCourseForm.submit(await courseForm.validateFields()); }
    catch (caught) {
      if (!isFormValidationError(caught)) message.error(caught instanceof Error ? caught.message : "Không thể lưu khóa học");
    }
  };
  const archive = async (course: Course) => {
    try { await archiveMutation.mutateAsync(course); }
    catch (caught) { message.error(caught instanceof Error ? caught.message : "Không thể lưu trữ khóa học"); }
  };
  const showEnrollment = (course: Course) => { setSelectedCourse(course); enrollmentForm.resetFields(); setEnrollmentOpen(true); };
  const enroll = async () => {
    if (!selectedCourse) return;
    try { await tanstackEnrollmentForm.submit(await enrollmentForm.validateFields()); }
    catch (caught) {
      if (!isFormValidationError(caught)) message.error(caught instanceof Error ? caught.message : "Không thể ghi danh");
    }
  };
  const removeEnrollment = async (id: string) => {
    try { await removeEnrollmentMutation.mutateAsync(id); }
    catch (caught) { message.error(caught instanceof Error ? caught.message : "Không thể hủy ghi danh"); }
  };

  if (user?.role === "SUPER_ADMIN") return <Alert message="Quản trị nền tảng xem số liệu tổng hợp; khóa học được vận hành trong từng tổ chức." showIcon type="info" />;
  return <div className="page-shell">
    <div className="page-heading"><div><h1>{user?.role === "LEARNER" ? "Khóa học của tôi" : "Khóa học"}</h1><p>{user?.role === "LEARNER" ? "Các khóa học đã ghi danh và đang được mở." : "Tổ chức nội dung đào tạo, phân công giảng viên và ghi danh học viên."}</p></div>{canManage && <Button icon={<PlusOutlined />} onClick={showCreate} type="primary">Tạo khóa học</Button>}</div>
    {(peopleQuery.error || enrollmentsQuery.error) && !coursesQuery.error && <Alert message={(peopleQuery.error ?? enrollmentsQuery.error) instanceof Error ? (peopleQuery.error ?? enrollmentsQuery.error)?.message : "Không tải được dữ liệu ghi danh"} showIcon style={{ marginBottom: 18 }} type="warning" />}
    {coursesQuery.error ? <Alert message={coursesQuery.error instanceof Error ? coursesQuery.error.message : "Không tải được khóa học"} showIcon type="error" /> : coursesQuery.isPending ? <div style={{ display: "grid", minHeight: 300, placeItems: "center" }}><Spin size="large" /></div> : courses.length ? <div className="course-grid">{courses.map((course) => <Card className="surface-card course-card" key={course._id} title={<Typography.Text ellipsis>{course.title}</Typography.Text>} extra={<Tag color={course.status === "PUBLISHED" ? "green" : course.status === "ARCHIVED" ? "default" : "gold"}>{statusLabel[course.status]}</Tag>}>
      <Typography.Paragraph className="table-muted" ellipsis={{ rows: 3 }}>{course.description || "Chưa có mô tả cho khóa học này."}</Typography.Paragraph>
      {typeof course.instructorId === "object" && <Typography.Text type="secondary">Giảng viên: {course.instructorId.fullName}</Typography.Text>}
      <div className="course-card-actions"><Button onClick={() => router.push(`/courses/${course._id}`)} type={canManage ? "default" : "primary"}>Mở khóa học</Button>{canManage && <><Button icon={<EditOutlined />} onClick={() => showEdit(course)}>Sửa</Button>{enrollmentEnabled && <Button icon={<TeamOutlined />} onClick={() => showEnrollment(course)}>Ghi danh</Button>}<Popconfirm cancelText="Hủy" okText="Lưu trữ" onConfirm={() => void archive(course)} title="Lưu trữ khóa học này?"><Button danger icon={<DeleteOutlined />} /></Popconfirm></>}</div>
    </Card>)}</div> : <Card className="surface-card"><Empty className="empty-block" description={user?.role === "LEARNER" ? "Bạn chưa được ghi danh vào khóa học nào" : "Chưa có khóa học"}>{canManage && <Button onClick={showCreate} type="primary">Tạo khóa học đầu tiên</Button>}</Empty></Card>}

    <Modal cancelText="Hủy" confirmLoading={saveCourseMutation.isPending} okText={editing ? "Lưu thay đổi" : "Tạo khóa học"} onCancel={() => setCourseOpen(false)} onOk={() => void saveCourse()} open={courseOpen} title={editing ? "Chỉnh sửa khóa học" : "Tạo khóa học"}>
      <Form form={courseForm} layout="vertical" requiredMark={false} style={{ marginTop: 22 }}>
        <Form.Item label="Tên khóa học" name="title" rules={[{ required: true, min: 2, message: "Nhập tên khóa học" }]}><Input /></Form.Item>
        <Form.Item label="Slug" name="slug" rules={[{ required: true, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: "Dùng chữ thường, số và dấu gạch ngang" }]}><Input placeholder="tieng-anh-giao-tiep" /></Form.Item>
        <Form.Item label="Mô tả" name="description"><Input.TextArea rows={3} /></Form.Item>
        <Form.Item label="Trạng thái" name="status"><Select options={statuses} /></Form.Item>
        {user?.role === "TENANT_ADMIN" && <Form.Item label="Giảng viên phụ trách" name="instructorId"><Select allowClear optionFilterProp="label" options={instructors.map((item) => ({ label: `${item.fullName} · ${item.email}`, value: item._id }))} placeholder="Chưa phân công" showSearch /></Form.Item>}
      </Form>
    </Modal>

    <Modal cancelButtonProps={{ style: { display: "none" } }} footer={null} onCancel={() => setEnrollmentOpen(false)} open={enrollmentOpen} title={`Ghi danh · ${selectedCourse?.title ?? ""}`}>
      {enrollmentError
        ? <Alert action={<Button onClick={() => void Promise.all([peopleQuery.refetch(), enrollmentsQuery.refetch()])} size="small">Thử lại</Button>} message={enrollmentError instanceof Error ? enrollmentError.message : "Không tải được dữ liệu ghi danh"} showIcon style={{ marginTop: 22 }} type="error" />
        : enrollmentLoading
          ? <div style={{ display: "grid", minHeight: 180, placeItems: "center" }}><Spin /></div>
          : <>
            <Form form={enrollmentForm} layout="vertical" onFinish={() => void enroll()} requiredMark={false} style={{ marginTop: 22 }}>
              <Space.Compact block><Form.Item name="userId" noStyle rules={[{ required: true, message: "Chọn học viên" }]}><Select disabled={enrollMutation.isPending} optionFilterProp="label" options={learners.map((item) => ({ label: `${item.fullName} · ${item.email}`, value: item._id }))} placeholder="Chọn học viên" showSearch style={{ width: "100%" }} /></Form.Item><Button disabled={!learners.length} htmlType="submit" loading={enrollMutation.isPending} type="primary">Ghi danh</Button></Space.Compact>
            </Form>
            <div style={{ marginTop: 24 }}><strong>Đã ghi danh ({selectedEnrollments.length})</strong>{selectedEnrollments.length ? selectedEnrollments.map((item) => { const learner = typeof item.userId === "object" ? item.userId : undefined; return <div key={item._id} style={{ alignItems: "center", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", padding: "12px 0" }}><span>{learner?.fullName ?? "Học viên"}<small className="table-muted" style={{ display: "block" }}>{learner?.email}</small></span><Popconfirm cancelText="Hủy" okText="Xóa" onConfirm={() => void removeEnrollment(item._id)} title="Hủy ghi danh?"><Button danger size="small" type="text">Hủy</Button></Popconfirm></div>; }) : <Empty description="Chưa có học viên" image={Empty.PRESENTED_IMAGE_SIMPLE} />}</div>
          </>}
    </Modal>
  </div>;
}
