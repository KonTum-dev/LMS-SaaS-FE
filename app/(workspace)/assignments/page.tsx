"use client";

import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, DatePicker, Empty, Form, Input, Modal, Popconfirm, Select, Switch, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import { apiFetch } from "@/lib/api";
import type { Assignment, Course } from "@/lib/types";

interface AssignmentForm { courseId: string; title: string; description?: string; dueAt?: Dayjs; published: boolean }
const objectId = (value: { _id: string } | string) => typeof value === "string" ? value : value._id;

export default function AssignmentsPage() {
  const { message } = App.useApp();
  const { token, user } = useAuth();
  const [form] = Form.useForm<AssignmentForm>();
  const [items, setItems] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canManage = user?.role === "TENANT_ADMIN" || user?.role === "INSTRUCTOR";

  const load = useCallback(async () => {
    if (!token || user?.role === "SUPER_ADMIN") return;
    try {
      const [assignmentData, courseData] = await Promise.all([apiFetch<Assignment[]>("/assignments", { token }), apiFetch<Course[]>("/courses", { token })]);
      setItems(assignmentData); setCourses(courseData); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không tải được bài tập"); }
    finally { setLoading(false); }
  }, [token, user?.role]);
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const create = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ published: false }); setOpen(true); };
  const edit = (item: Assignment) => {
    setEditing(item);
    form.setFieldsValue({ courseId: objectId(item.courseId), title: item.title, description: item.description, dueAt: item.dueAt ? dayjs(item.dueAt) : undefined, published: item.published });
    setOpen(true);
  };
  const save = async () => {
    const values = await form.validateFields(); setSaving(true);
    try {
      await apiFetch(editing ? `/assignments/${editing._id}` : "/assignments", { token, method: editing ? "PATCH" : "POST", body: JSON.stringify({ ...values, dueAt: values.dueAt?.toISOString() ?? (editing ? null : undefined) }) });
      message.success(editing ? "Đã cập nhật bài tập" : "Đã tạo bài tập"); setOpen(false); await load();
    } catch (caught) { message.error(caught instanceof Error ? caught.message : "Không thể lưu bài tập"); }
    finally { setSaving(false); }
  };
  const remove = async (item: Assignment) => {
    try { await apiFetch(`/assignments/${item._id}`, { token, method: "DELETE" }); message.success("Đã xóa bài tập"); await load(); }
    catch (caught) { message.error(caught instanceof Error ? caught.message : "Không thể xóa bài tập"); }
  };

  const columns: ColumnsType<Assignment> = [
    { title: "Bài tập", dataIndex: "title", render: (value, record) => <div><strong>{value}</strong><div className="table-muted">{typeof record.courseId === "object" ? record.courseId.title : "Khóa học"}</div></div> },
    { title: "Hạn nộp", dataIndex: "dueAt", responsive: ["sm"], render: (value) => value ? dayjs(value).format("DD/MM/YYYY HH:mm") : <span className="table-muted">Không giới hạn</span> },
    { title: "Trạng thái", dataIndex: "published", width: 130, render: (value) => <Tag color={value ? "green" : "gold"}>{value ? "Đã giao" : "Bản nháp"}</Tag> },
    ...(canManage ? [{ title: "", key: "actions", width: 105, render: (_: unknown, record: Assignment) => <><Button icon={<EditOutlined />} onClick={() => edit(record)} size="small" type="text" /><Popconfirm cancelText="Hủy" okText="Xóa" onConfirm={() => void remove(record)} title="Xóa bài tập này?"><Button danger icon={<DeleteOutlined />} size="small" type="text" /></Popconfirm></> }] : []),
  ];

  if (user?.role === "SUPER_ADMIN") return <Alert message="Bài tập được quản lý trong từng tổ chức." showIcon type="info" />;
  return <div className="page-shell">
    <div className="page-heading"><div><h1>Bài tập</h1><p>{canManage ? "Tạo đầu việc học tập, đặt hạn nộp và kiểm soát thời điểm công bố." : "Theo dõi các bài tập đã được giao trong khóa học của bạn."}</p></div>{canManage && <Button disabled={!courses.length} icon={<PlusOutlined />} onClick={create} type="primary">Tạo bài tập</Button>}</div>
    {error && <Alert message={error} showIcon style={{ marginBottom: 18 }} type="error" />}
    <Card className="surface-card"><Table columns={columns} dataSource={items} loading={loading} locale={{ emptyText: <Empty description={canManage ? "Chưa có bài tập" : "Chưa có bài tập được giao"} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} pagination={{ pageSize: 10 }} rowKey="_id" scroll={{ x: 680 }} /></Card>
    <Modal cancelText="Hủy" confirmLoading={saving} okText={editing ? "Lưu thay đổi" : "Tạo bài tập"} onCancel={() => setOpen(false)} onOk={() => void save()} open={open} title={editing ? "Chỉnh sửa bài tập" : "Tạo bài tập"}>
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 22 }}>
        <Form.Item label="Khóa học" name="courseId" rules={[{ required: true, message: "Chọn khóa học" }]}><Select optionFilterProp="label" options={courses.filter((course) => course.status !== "ARCHIVED").map((course) => ({ label: course.title, value: course._id }))} showSearch /></Form.Item>
        <Form.Item label="Tên bài tập" name="title" rules={[{ required: true, min: 2, message: "Nhập tên bài tập" }]}><Input /></Form.Item>
        <Form.Item label="Mô tả" name="description"><Input.TextArea rows={3} /></Form.Item>
        <Form.Item label="Hạn nộp" name="dueAt"><DatePicker showTime style={{ width: "100%" }} /></Form.Item>
        <Form.Item label="Công bố cho học viên" name="published" valuePropName="checked"><Switch checkedChildren="Đã giao" unCheckedChildren="Bản nháp" /></Form.Item>
      </Form>
    </Modal>
  </div>;
}
