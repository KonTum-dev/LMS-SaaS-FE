"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Checkbox, ColorPicker, Form, Input, Modal, Select, Space, Tag } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import { useState } from "react";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { isFormValidationError } from "@/components/form/validation-error";
import { useAuth } from "@/components/providers/app-providers";
import { DataTable } from "@/components/table/data-table";
import { apiFetch } from "@/lib/api";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
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
  const { organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<TenantForm>();
  const [editing, setEditing] = useState<Organization | null>(null);
  const [open, setOpen] = useState(false);
  const scope = getViewerScope(user, organization);
  const tenantsKey = scope ? lmsQueryKeys.tenants(scope) : ["lms", "signed-out", "organizations"] as const;
  const tenantsQuery = useQuery({
    enabled: Boolean(token && scope && user?.role === "SUPER_ADMIN"),
    queryKey: tenantsKey,
    queryFn: () => apiFetch<Organization[]>("/organizations", { token }),
  });
  const items = tenantsQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: async (values: TenantForm) => {
      const primaryColor = typeof values.primaryColor === "string" ? values.primaryColor : values.primaryColor.toHexString();
      return apiFetch<Organization>(editing ? `/organizations/${editing._id}` : "/organizations", {
        token,
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({ ...values, primaryColor, logoUrl: values.logoUrl?.trim() || (editing ? null : undefined) }),
      });
    },
    onSuccess: async () => {
      message.success(editing ? "Đã cập nhật tổ chức" : "Đã tạo tổ chức");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: tenantsKey });
    },
  });
  const tanstackForm = useAntdTanStackForm<TenantForm>(
    { enabledModules: modules.map((item) => item.value), name: "", primaryColor: "#5B5BD6", slug: "" },
    (values) => saveMutation.mutateAsync(values).then(() => undefined),
  );

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
    try { await tanstackForm.submit(await form.validateFields()); }
    catch (caught) {
      if (!isFormValidationError(caught)) message.error(caught instanceof Error ? caught.message : "Không thể lưu tổ chức");
    }
  };

  const columns: ColumnDef<StockFeatures, Organization>[] = [
    { header: "Tổ chức", accessorKey: "name", cell: ({ row }) => <div><strong>{row.original.name}</strong><div className="table-muted">{row.original.slug}</div></div> },
    { header: "Màu thương hiệu", accessorKey: "primaryColor", cell: ({ getValue }) => { const value = getValue<string>(); return <Space><span style={{ background: value, borderRadius: 6, height: 22, width: 22 }} />{value}</Space>; }, meta: { width: 170 } },
    { header: "Module", accessorKey: "enabledModules", cell: ({ getValue }) => `${getValue<LmsModule[]>().length}/${modules.length} đang bật`, meta: { responsive: ["md"] } },
    { header: "Trạng thái", accessorKey: "status", cell: ({ getValue }) => { const value = getValue<OrganizationStatus>(); return <Tag color={value === "ACTIVE" ? "green" : "red"}>{value === "ACTIVE" ? "Hoạt động" : "Đã khóa"}</Tag>; }, meta: { width: 140 } },
    { id: "action", header: "", cell: ({ row }) => <Button onClick={() => showEdit(row.original)} type="link">Sửa</Button>, meta: { width: 90 } },
  ];

  if (user?.role !== "SUPER_ADMIN") return <Alert message="Bạn không có quyền truy cập khu vực quản trị nền tảng." showIcon type="warning" />;
  return <div className="page-shell">
    <div className="page-heading"><div><h1>Quản lý tổ chức</h1><p>Tạo workspace, kiểm soát trạng thái và cấu hình dịch vụ cho từng đơn vị.</p></div><Button icon={<PlusOutlined />} onClick={showCreate} type="primary">Thêm tổ chức</Button></div>
    {tenantsQuery.error
      ? <Alert message={tenantsQuery.error instanceof Error ? tenantsQuery.error.message : "Không tải được tổ chức"} showIcon type="error" />
      : <Card className="surface-card"><DataTable columns={columns} data={items} emptyText="Chưa có tổ chức" loading={tenantsQuery.isLoading} pageSize={8} rowKey="_id" scrollX={760} /></Card>}
    <Modal cancelText="Hủy" confirmLoading={saveMutation.isPending} okText={editing ? "Lưu thay đổi" : "Tạo tổ chức"} onCancel={() => setOpen(false)} onOk={() => void save()} open={open} title={editing ? "Cập nhật tổ chức" : "Tạo tổ chức mới"}>
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
