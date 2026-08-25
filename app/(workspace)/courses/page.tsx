"use client";

import { DeleteOutlined, EditOutlined, PlusOutlined, TeamOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Empty, Form, Input, Modal, Popconfirm, Select, Space, Spin, Tag, Typography } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/app-providers";
import { apiFetch } from "@/lib/api";
import type { AppUser, Course, CourseStatus, Enrollment } from "@/lib/types";

interface CourseForm { title: string; slug: string; description?: string; status: CourseStatus; instructorId?: string }
interface EnrollmentForm { userId: string }
const statuses = [
  { label: "Bản nháp", value: "DRAFT" }, { label: "Đang mở", value: "PUBLISHED" }, { label: "Đã lưu trữ", value: "ARCHIVED" },
];
const statusLabel = Object.fromEntries(statuses.map((item) => [item.value, item.label]));
const objectId = (value: { _id: string } | string | undefined) => typeof value === "string" ? value : value?._id;

export default function CoursesPage() {
  const { message } = App.useApp();
  const { organization, token, user } = useAuth();
  const router = useRouter();
  const [courseForm] = Form.useForm<CourseForm>();
  const [enrollmentForm] = Form.useForm<EnrollmentForm>();
  const [courses, setCourses] = useState<Course[]>([]);
  const [people, setPeople] = useState<AppUser[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [editing, setEditing] = useState<Course | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseOpen, setCourseOpen] = useState(false);
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const role = user?.role;
  const canManage = role === "TENANT_ADMIN" || role === "INSTRUCTOR";
  const enrollmentEnabled = organization?.enabledModules?.includes("ENROLLMENTS") ?? true;

  const load = useCallback(async () => {
    if (!token || role === "SUPER_ADMIN") return;
    try {
      const courseData = await apiFetch<Course[]>("/courses", { token });
      setCourses(courseData);
      if (canManage) {
        const [learnerData, enrollmentData] = await Promise.all([
          apiFetch<AppUser[]>("/users/learners", { token }),
          enrollmentEnabled ? apiFetch<Enrollment[]>("/enrollments", { token }) : Promise.resolve([]),
        ]);
        let allPeople = learnerData;
        if (role === "TENANT_ADMIN") allPeople = await apiFetch<AppUser[]>("/users", { token });
        setPeople(allPeople);
        setEnrollments(enrollmentData);
      }
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không tải được khóa học"); }
    finally { setLoading(false); }
  }, [canManage, enrollmentEnabled, role, token]);
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const instructors = useMemo(() => people.filter((person) => person.role === "INSTRUCTOR" || person.role === "TENANT_ADMIN"), [people]);
  const learners = useMemo(() => people.filter((person) => person.role === "LEARNER" && person.status === "ACTIVE"), [people]);
  const selectedEnrollments = useMemo(() => enrollments.filter((item) => objectId(item.courseId) === selectedCourse?._id), [enrollments, selectedCourse]);

  const showCreate = () => { setEditing(null); courseForm.resetFields(); courseForm.setFieldsValue({ status: "DRAFT" }); setCourseOpen(true); };
  const showEdit = (course: Course) => { setEditing(course); courseForm.setFieldsValue({ title: course.title, slug: course.slug, description: course.description, status: course.status, instructorId: objectId(course.instructorId) }); setCourseOpen(true); };
  const saveCourse = async () => {
    const values = await courseForm.validateFields(); setSaving(true);
    try {
      await apiFetch(editing ? `/courses/${editing._id}` : "/courses", { token, method: editing ? "PATCH" : "POST", body: JSON.stringify({ ...values, instructorId: user?.role === "TENANT_ADMIN" ? values.instructorId ?? null : undefined }) });
      message.success(editing ? "Đã cập nhật khóa học" : "Đã tạo khóa học"); setCourseOpen(false); await load();
    } catch (caught) { message.error(caught instanceof Error ? caught.message : "Không thể lưu khóa học"); }
    finally { setSaving(false); }
  };
  const archive = async (course: Course) => {
    try { await apiFetch(`/courses/${course._id}`, { token, method: "DELETE" }); message.success("Đã lưu trữ khóa học"); await load(); }
    catch (caught) { message.error(caught instanceof Error ? caught.message : "Không thể lưu trữ khóa học"); }
  };
  const showEnrollment = (course: Course) => { setSelectedCourse(course); enrollmentForm.resetFields(); setEnrollmentOpen(true); };
  const enroll = async () => {
    if (!selectedCourse) return;
    const values = await enrollmentForm.validateFields(); setSaving(true);
    try { await apiFetch("/enrollments", { token, method: "POST", body: JSON.stringify({ courseId: selectedCourse._id, userId: values.userId }) }); message.success("Đã ghi danh học viên"); enrollmentForm.resetFields(); await load(); }
    catch (caught) { message.error(caught instanceof Error ? caught.message : "Không thể ghi danh"); }
    finally { setSaving(false); }
  };
  const removeEnrollment = async (id: string) => {
    try { await apiFetch(`/enrollments/${id}`, { token, method: "DELETE" }); message.success("Đã hủy ghi danh"); await load(); }
    catch (caught) { message.error(caught instanceof Error ? caught.message : "Không thể hủy ghi danh"); }
  };

  if (user?.role === "SUPER_ADMIN") return <Alert message="Quản trị nền tảng xem số liệu tổng hợp; khóa học được vận hành trong từng tổ chức." showIcon type="info" />;
  return <div className="page-shell">
    <div className="page-heading"><div><h1>{user?.role === "LEARNER" ? "Khóa học của tôi" : "Khóa học"}</h1><p>{user?.role === "LEARNER" ? "Các khóa học đã ghi danh và đang được mở." : "Tổ chức nội dung đào tạo, phân công giảng viên và ghi danh học viên."}</p></div>{canManage && <Button icon={<PlusOutlined />} onClick={showCreate} type="primary">Tạo khóa học</Button>}</div>
    {error && <Alert message={error} showIcon style={{ marginBottom: 18 }} type="error" />}
    {loading ? <div style={{ display: "grid", minHeight: 300, placeItems: "center" }}><Spin size="large" /></div> : courses.length ? <div className="course-grid">{courses.map((course) => <Card className="surface-card course-card" key={course._id} title={<Typography.Text ellipsis>{course.title}</Typography.Text>} extra={<Tag color={course.status === "PUBLISHED" ? "green" : course.status === "ARCHIVED" ? "default" : "gold"}>{statusLabel[course.status]}</Tag>}>
      <Typography.Paragraph className="table-muted" ellipsis={{ rows: 3 }}>{course.description || "Chưa có mô tả cho khóa học này."}</Typography.Paragraph>
      {typeof course.instructorId === "object" && <Typography.Text type="secondary">Giảng viên: {course.instructorId.fullName}</Typography.Text>}
      <div className="course-card-actions"><Button onClick={() => router.push(`/courses/${course._id}`)} type={canManage ? "default" : "primary"}>Mở khóa học</Button>{canManage && <><Button icon={<EditOutlined />} onClick={() => showEdit(course)}>Sửa</Button>{enrollmentEnabled && <Button icon={<TeamOutlined />} onClick={() => showEnrollment(course)}>Ghi danh</Button>}<Popconfirm cancelText="Hủy" okText="Lưu trữ" onConfirm={() => void archive(course)} title="Lưu trữ khóa học này?"><Button danger icon={<DeleteOutlined />} /></Popconfirm></>}</div>
    </Card>)}</div> : <Card className="surface-card"><Empty className="empty-block" description={user?.role === "LEARNER" ? "Bạn chưa được ghi danh vào khóa học nào" : "Chưa có khóa học"}>{canManage && <Button onClick={showCreate} type="primary">Tạo khóa học đầu tiên</Button>}</Empty></Card>}

    <Modal cancelText="Hủy" confirmLoading={saving} okText={editing ? "Lưu thay đổi" : "Tạo khóa học"} onCancel={() => setCourseOpen(false)} onOk={() => void saveCourse()} open={courseOpen} title={editing ? "Chỉnh sửa khóa học" : "Tạo khóa học"}>
      <Form form={courseForm} layout="vertical" requiredMark={false} style={{ marginTop: 22 }}>
        <Form.Item label="Tên khóa học" name="title" rules={[{ required: true, min: 2, message: "Nhập tên khóa học" }]}><Input /></Form.Item>
        <Form.Item label="Slug" name="slug" rules={[{ required: true, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: "Dùng chữ thường, số và dấu gạch ngang" }]}><Input placeholder="tieng-anh-giao-tiep" /></Form.Item>
        <Form.Item label="Mô tả" name="description"><Input.TextArea rows={3} /></Form.Item>
        <Form.Item label="Trạng thái" name="status"><Select options={statuses} /></Form.Item>
        {user?.role === "TENANT_ADMIN" && <Form.Item label="Giảng viên phụ trách" name="instructorId"><Select allowClear optionFilterProp="label" options={instructors.map((item) => ({ label: `${item.fullName} · ${item.email}`, value: item._id }))} placeholder="Chưa phân công" showSearch /></Form.Item>}
      </Form>
    </Modal>

    <Modal cancelButtonProps={{ style: { display: "none" } }} footer={null} onCancel={() => setEnrollmentOpen(false)} open={enrollmentOpen} title={`Ghi danh · ${selectedCourse?.title ?? ""}`}>
      <Form form={enrollmentForm} layout="vertical" onFinish={() => void enroll()} requiredMark={false} style={{ marginTop: 22 }}>
        <Space.Compact block><Form.Item name="userId" noStyle rules={[{ required: true, message: "Chọn học viên" }]}><Select optionFilterProp="label" options={learners.map((item) => ({ label: `${item.fullName} · ${item.email}`, value: item._id }))} placeholder="Chọn học viên" showSearch style={{ width: "100%" }} /></Form.Item><Button htmlType="submit" loading={saving} type="primary">Ghi danh</Button></Space.Compact>
      </Form>
      <div style={{ marginTop: 24 }}><strong>Đã ghi danh ({selectedEnrollments.length})</strong>{selectedEnrollments.length ? selectedEnrollments.map((item) => { const learner = typeof item.userId === "object" ? item.userId : undefined; return <div key={item._id} style={{ alignItems: "center", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", padding: "12px 0" }}><span>{learner?.fullName ?? "Học viên"}<small className="table-muted" style={{ display: "block" }}>{learner?.email}</small></span><Popconfirm cancelText="Hủy" okText="Xóa" onConfirm={() => void removeEnrollment(item._id)} title="Hủy ghi danh?"><Button danger size="small" type="text">Hủy</Button></Popconfirm></div>; }) : <Empty description="Chưa có học viên" image={Empty.PRESENTED_IMAGE_SIMPLE} />}</div>
    </Modal>
  </div>;
}
