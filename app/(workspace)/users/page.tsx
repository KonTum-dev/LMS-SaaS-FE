"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Form, Input, Modal, Select, Tag } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import { useState } from "react";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { isFormValidationError } from "@/components/form/validation-error";
import { useAuth } from "@/components/providers/app-providers";
import { DataTable } from "@/components/table/data-table";
import { apiFetch } from "@/lib/api";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
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
  const { organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<UserForm>();
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [open, setOpen] = useState(false);
  const scope = getViewerScope(user, organization);
  const usersKey = scope ? lmsQueryKeys.users(scope) : ["lms", "signed-out", "users"] as const;
  const usersQuery = useQuery({
    enabled: Boolean(token && scope && user?.role === "TENANT_ADMIN"),
    queryKey: usersKey,
    queryFn: () => apiFetch<AppUser[]>("/users", { token }),
  });
  const items = usersQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: async (values: UserForm) => {
      const body = editing ? { fullName: values.fullName, role: values.role, status: values.status } : values;
      await apiFetch(editing ? `/users/${editing._id}` : "/users", {
        token,
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      message.success(editing ? "Đã cập nhật người dùng" : "Đã thêm người dùng");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: usersKey });
    },
  });
  const tanstackForm = useAntdTanStackForm<UserForm>(
    { email: "", fullName: "", role: "LEARNER" },
    (values) => saveMutation.mutateAsync(values),
  );

  const create = () => {
    setEditing(null); form.resetFields(); form.setFieldsValue({ role: "LEARNER" }); setOpen(true);
  };
  const edit = (item: AppUser) => {
    setEditing(item); form.resetFields(); form.setFieldsValue({ email: item.email, fullName: item.fullName, role: item.role, status: item.status }); setOpen(true);
  };
  const save = async () => {
    try { await tanstackForm.submit(await form.validateFields()); }
    catch (caught) {
      if (!isFormValidationError(caught)) message.error(caught instanceof Error ? caught.message : "Không thể lưu người dùng");
    }
  };

  const columns: ColumnDef<StockFeatures, AppUser>[] = [
    { header: "Họ và tên", accessorKey: "fullName", cell: ({ row }) => <div><strong>{row.original.fullName}</strong><div className="table-muted">{row.original.email}</div></div> },
    { header: "Vai trò", accessorKey: "role", cell: ({ getValue }) => roleLabel[getValue<string>()], meta: { responsive: ["sm"] } },
    { header: "Trạng thái", accessorKey: "status", cell: ({ getValue }) => { const value = getValue<AppUser["status"]>(); return <Tag color={value === "ACTIVE" ? "green" : "default"}>{value === "ACTIVE" ? "Hoạt động" : "Tạm ngưng"}</Tag>; }, meta: { width: 140 } },
    { id: "actions", header: "", cell: ({ row }) => <Button onClick={() => edit(row.original)} type="link">Sửa</Button>, meta: { width: 80 } },
  ];

  if (user?.role !== "TENANT_ADMIN") return <Alert message="Chỉ quản trị tổ chức được quản lý người dùng." showIcon type="warning" />;
  return <div className="page-shell">
    <div className="page-heading"><div><h1>Người dùng</h1><p>Quản lý đội ngũ giảng viên, học viên và quyền truy cập workspace.</p></div><Button icon={<PlusOutlined />} onClick={create} type="primary">Thêm người dùng</Button></div>
    {usersQuery.error
      ? <Alert message={usersQuery.error instanceof Error ? usersQuery.error.message : "Không tải được người dùng"} showIcon type="error" />
      : <Card className="surface-card"><DataTable columns={columns} data={items} emptyText="Chưa có người dùng" loading={usersQuery.isLoading} rowKey="_id" scrollX={620} /></Card>}
    <Modal cancelText="Hủy" confirmLoading={saveMutation.isPending} okText={editing ? "Lưu thay đổi" : "Thêm người dùng"} onCancel={() => setOpen(false)} onOk={() => void save()} open={open} title={editing ? "Cập nhật người dùng" : "Thêm người dùng"}>
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
