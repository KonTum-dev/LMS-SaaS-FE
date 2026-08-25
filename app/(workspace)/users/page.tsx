"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Form, Input, Modal, Select, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import { apiFetch } from "@/lib/api";
import type { AppUser } from "@/lib/types";

interface UserForm {
  email: string;
  password?: string;
  fullName: string;
  role: AppUser["role"];
  status?: AppUser["status"];
}

const roleOptions = [
  { label: "Quản trị tổ chức", value: "TENANT_ADMIN" },
  { label: "Giảng viên", value: "INSTRUCTOR" },
  { label: "Học viên", value: "LEARNER" },
];
const roleLabel = Object.fromEntries(roleOptions.map((item) => [item.value, item.label]));

export default function UsersPage() {
  const { message } = App.useApp();
  const { token, user } = useAuth();
  const [form] = Form.useForm<UserForm>();
  const [items, setItems] = useState<AppUser[]>([]);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token || user?.role !== "TENANT_ADMIN") return;
    try { setItems(await apiFetch<AppUser[]>("/users", { token })); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Không tải được người dùng"); }
    finally { setLoading(false); }
  }, [token, user?.role]);
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const create = () => {
    setEditing(null); form.resetFields(); form.setFieldsValue({ role: "LEARNER" }); setOpen(true);
  };
  const edit = (item: AppUser) => {
    setEditing(item); form.resetFields(); form.setFieldsValue({ email: item.email, fullName: item.fullName, role: item.role, status: item.status }); setOpen(true);
  };
  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const body = editing ? { fullName: values.fullName, role: values.role, status: values.status } : values;
      await apiFetch(editing ? `/users/${editing._id}` : "/users", { token, method: editing ? "PATCH" : "POST", body: JSON.stringify(body) });
      message.success(editing ? "Đã cập nhật người dùng" : "Đã thêm người dùng");
      setOpen(false); await load();
    } catch (caught) { message.error(caught instanceof Error ? caught.message : "Không thể lưu người dùng"); }
    finally { setSaving(false); }
  };

  const columns: ColumnsType<AppUser> = [
    { title: "Họ và tên", dataIndex: "fullName", render: (value, record) => <div><strong>{value}</strong><div className="table-muted">{record.email}</div></div> },
    { title: "Vai trò", dataIndex: "role", responsive: ["sm"], render: (value) => roleLabel[value] },
    { title: "Trạng thái", dataIndex: "status", width: 140, render: (value) => <Tag color={value === "ACTIVE" ? "green" : "default"}>{value === "ACTIVE" ? "Hoạt động" : "Tạm ngưng"}</Tag> },
    { title: "", width: 80, render: (_, record) => <Button onClick={() => edit(record)} type="link">Sửa</Button> },
  ];

  if (user?.role !== "TENANT_ADMIN") return <Alert message="Chỉ quản trị tổ chức được quản lý người dùng." showIcon type="warning" />;
  return <div className="page-shell">
    <div className="page-heading"><div><h1>Người dùng</h1><p>Quản lý đội ngũ giảng viên, học viên và quyền truy cập workspace.</p></div><Button icon={<PlusOutlined />} onClick={create} type="primary">Thêm người dùng</Button></div>
    {error && <Alert message={error} showIcon style={{ marginBottom: 18 }} type="error" />}
    <Card className="surface-card"><Table columns={columns} dataSource={items} loading={loading} locale={{ emptyText: "Chưa có người dùng" }} pagination={{ pageSize: 10 }} rowKey="_id" scroll={{ x: 620 }} /></Card>
    <Modal cancelText="Hủy" confirmLoading={saving} okText={editing ? "Lưu thay đổi" : "Thêm người dùng"} onCancel={() => setOpen(false)} onOk={() => void save()} open={open} title={editing ? "Cập nhật người dùng" : "Thêm người dùng"}>
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 22 }}>
        <Form.Item label="Họ và tên" name="fullName" rules={[{ required: true, min: 2, message: "Nhập họ tên" }]}><Input /></Form.Item>
        <Form.Item label="Email" name="email" rules={[{ required: !editing, type: "email", message: "Email chưa hợp lệ" }]}><Input disabled={Boolean(editing)} /></Form.Item>
        {!editing && <Form.Item label="Mật khẩu ban đầu" name="password" rules={[{ required: true, min: 8, message: "Mật khẩu cần ít nhất 8 ký tự" }]}><Input.Password /></Form.Item>}
        <Form.Item label="Vai trò" name="role" rules={[{ required: true }]}><Select options={roleOptions} /></Form.Item>
        {editing && <Form.Item label="Trạng thái" name="status"><Select options={[{ label: "Hoạt động", value: "ACTIVE" }, { label: "Tạm ngưng", value: "INACTIVE" }]} /></Form.Item>}
      </Form>
    </Modal>
  </div>;
}
