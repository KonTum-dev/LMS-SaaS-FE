"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Checkbox, ColorPicker, Form, Input, Modal, Select, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import { apiFetch } from "@/lib/api";
import type { LmsModule, Organization, OrganizationStatus } from "@/lib/types";

interface TenantForm {
  name: string;
  slug: string;
  status?: OrganizationStatus;
  primaryColor: string | { toHexString: () => string };
  logoUrl?: string;
  enabledModules: LmsModule[];
  adminEmail?: string;
  adminFullName?: string;
  adminPassword?: string;
}

const modules: Array<{ label: string; value: LmsModule }> = [
  { label: "Người dùng", value: "USERS" }, { label: "Khóa học", value: "COURSES" },
  { label: "Ghi danh", value: "ENROLLMENTS" }, { label: "Bài tập", value: "ASSIGNMENTS" },
];

export default function TenantsPage() {
  const { message } = App.useApp();
  const { token, user } = useAuth();
  const [form] = Form.useForm<TenantForm>();
  const [items, setItems] = useState<Organization[]>([]);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token || user?.role !== "SUPER_ADMIN") return;
    try { setItems(await apiFetch<Organization[]>("/organizations", { token })); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Không tải được tổ chức"); }
    finally { setLoading(false); }
  }, [token, user?.role]);
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const showCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ primaryColor: "#5B5BD6", enabledModules: modules.map((item) => item.value) });
    setOpen(true);
  };
  const showEdit = (tenant: Organization) => {
    setEditing(tenant);
    form.setFieldsValue({ name: tenant.name, slug: tenant.slug, status: tenant.status, primaryColor: tenant.primaryColor, logoUrl: tenant.logoUrl ?? undefined, enabledModules: tenant.enabledModules });
    setOpen(true);
  };
  const save = async () => {
    const values = await form.validateFields();
    const color = typeof values.primaryColor === "string" ? values.primaryColor : values.primaryColor.toHexString();
    setSaving(true);
    try {
      await apiFetch<Organization>(editing ? `/organizations/${editing._id}` : "/organizations", { token, method: editing ? "PATCH" : "POST", body: JSON.stringify({ ...values, primaryColor: color, logoUrl: values.logoUrl?.trim() || (editing ? null : undefined) }) });
      message.success(editing ? "Đã cập nhật tổ chức" : "Đã tạo tổ chức");
      setOpen(false);
      await load();
    } catch (caught) { message.error(caught instanceof Error ? caught.message : "Không thể lưu tổ chức"); }
    finally { setSaving(false); }
  };

  const columns: ColumnsType<Organization> = [
    { title: "Tổ chức", dataIndex: "name", render: (value, record) => <div><strong>{value}</strong><div className="table-muted">{record.slug}</div></div> },
    { title: "Màu thương hiệu", dataIndex: "primaryColor", width: 170, render: (value) => <Space><span style={{ background: value, borderRadius: 6, height: 22, width: 22 }} />{value}</Space> },
    { title: "Module", dataIndex: "enabledModules", responsive: ["md"], render: (value: LmsModule[]) => `${value.length}/${modules.length} đang bật` },
    { title: "Trạng thái", dataIndex: "status", width: 140, render: (value) => <Tag color={value === "ACTIVE" ? "green" : "red"}>{value === "ACTIVE" ? "Hoạt động" : "Đã khóa"}</Tag> },
    { title: "", key: "action", width: 90, render: (_, record) => <Button onClick={() => showEdit(record)} type="link">Sửa</Button> },
  ];

  if (user?.role !== "SUPER_ADMIN") return <Alert message="Bạn không có quyền truy cập khu vực quản trị nền tảng." showIcon type="warning" />;
  return <div className="page-shell">
    <div className="page-heading"><div><h1>Quản lý tổ chức</h1><p>Tạo workspace, kiểm soát trạng thái và cấu hình dịch vụ cho từng đơn vị.</p></div><Button icon={<PlusOutlined />} onClick={showCreate} type="primary">Thêm tổ chức</Button></div>
    {error && <Alert message={error} showIcon style={{ marginBottom: 18 }} type="error" />}
    <Card className="surface-card"><Table columns={columns} dataSource={items} loading={loading} locale={{ emptyText: "Chưa có tổ chức" }} pagination={{ pageSize: 8 }} rowKey="_id" scroll={{ x: 760 }} /></Card>
    <Modal cancelText="Hủy" confirmLoading={saving} okText={editing ? "Lưu thay đổi" : "Tạo tổ chức"} onCancel={() => setOpen(false)} onOk={() => void save()} open={open} title={editing ? "Cập nhật tổ chức" : "Tạo tổ chức mới"}>
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 22 }}>
        <Form.Item label="Tên tổ chức" name="name" rules={[{ required: true, min: 2, message: "Tên cần ít nhất 2 ký tự" }]}><Input placeholder="Bright Academy" /></Form.Item>
        <Form.Item label="Slug" name="slug" rules={[{ required: true, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: "Dùng chữ thường, số và dấu gạch ngang" }]}><Input placeholder="bright-academy" /></Form.Item>
        {editing && <Form.Item label="Trạng thái" name="status"><Select options={[{ label: "Hoạt động", value: "ACTIVE" }, { label: "Khóa truy cập", value: "SUSPENDED" }]} /></Form.Item>}
        <Form.Item label="Màu thương hiệu" name="primaryColor" rules={[{ required: true }]}><ColorPicker showText /></Form.Item>
        <Form.Item label="Logo URL" name="logoUrl" rules={[{ type: "url", message: "Nhập URL đầy đủ gồm http/https" }]}><Input placeholder="https://..." /></Form.Item>
        <Form.Item label="Module được sử dụng" name="enabledModules" rules={[{ required: true, message: "Chọn ít nhất một module" }]}><Checkbox.Group options={modules} /></Form.Item>
        {!editing && <>
          <Form.Item label="Tên quản trị viên đầu tiên" name="adminFullName" rules={[{ required: true, min: 2, message: "Nhập họ tên quản trị viên" }]}><Input /></Form.Item>
          <Form.Item label="Email quản trị viên" name="adminEmail" rules={[{ required: true, type: "email", message: "Email chưa hợp lệ" }]}><Input /></Form.Item>
          <Form.Item label="Mật khẩu ban đầu" name="adminPassword" rules={[{ required: true, min: 8, message: "Mật khẩu cần ít nhất 8 ký tự" }]}><Input.Password /></Form.Item>
        </>}
      </Form>
    </Modal>
  </div>;
}
