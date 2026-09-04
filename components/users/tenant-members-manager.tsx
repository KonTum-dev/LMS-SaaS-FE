"use client";

import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import { Alert, App, Button, Form, Input, Modal, Select, Tag } from "antd";
import { useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import { DataTable } from "@/components/table/data-table";
import { apiFetch } from "@/lib/api";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import type { Organization, TenantMember } from "@/lib/types";
import {
  adminTenantMemberEndpoint,
  buildCreateUserPayload,
  buildUpdateUserPayload,
  userRoleLabels,
  userRoleOptions,
  type UserFormValues,
} from "@/lib/user-management";

interface TenantMembersManagerProps {
  onClose: () => void;
  tenant: Organization | null;
}

export function TenantMembersManager({
  onClose,
  tenant,
}: TenantMembersManagerProps) {
  const { message } = App.useApp();
  const { organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<UserFormValues>();
  const [editing, setEditing] = useState<TenantMember | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const scope = getViewerScope(user, organization);
  const tenantId = tenant?._id ?? "closed";
  const membersKey = scope
    ? lmsQueryKeys.tenantUsers(scope, tenantId)
    : (["lms", "signed-out", "organizations", tenantId, "users"] as const);

  const membersQuery = useQuery({
    enabled: Boolean(tenant && token && scope && user?.role === "SUPER_ADMIN"),
    queryFn: () =>
      apiFetch<TenantMember[]>(`/users/tenants/${tenantId}`, { token }),
    queryKey: membersKey,
  });

  const saveMutation = useMutation({
    mutationFn: (values: UserFormValues) =>
      apiFetch<TenantMember>(
        adminTenantMemberEndpoint(tenantId, editing?.membershipId),
        {
          body: JSON.stringify(
            editing
              ? buildUpdateUserPayload(values)
              : buildCreateUserPayload(values),
          ),
          method: editing ? "PATCH" : "POST",
          token,
        },
      ),
    onSuccess: async () => {
      message.success(
        editing ? "Đã cập nhật thành viên" : "Đã thêm thành viên",
      );
      setEditorOpen(false);
      await queryClient.invalidateQueries({ queryKey: membersKey });
    },
  });

  const showCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ role: "LEARNER" });
    setEditorOpen(true);
  };
  const showEdit = (member: TenantMember) => {
    setEditing(member);
    form.resetFields();
    form.setFieldsValue({
      email: member.email,
      fullName: member.fullName,
      role: member.role,
      status: member.status,
    });
    setEditorOpen(true);
  };
  const save = async () => {
    try {
      await saveMutation.mutateAsync(await form.validateFields());
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : "Không thể lưu thành viên",
      );
    }
  };

  const columns: ColumnDef<StockFeatures, TenantMember>[] = [
    {
      accessorKey: "fullName",
      cell: ({ row }) => (
        <div className="table-primary-cell">
          <strong>{row.original.fullName}</strong>
          <div className="table-muted">{row.original.email}</div>
        </div>
      ),
      header: "Thành viên",
    },
    {
      accessorKey: "role",
      cell: ({ getValue }) => userRoleLabels[getValue<TenantMember["role"]>()],
      header: "Vai trò",
      meta: { responsive: ["sm"] },
    },
    {
      accessorKey: "status",
      cell: ({ getValue }) => {
        const status = getValue<TenantMember["status"]>();
        return (
          <Tag color={status === "ACTIVE" ? "green" : "default"}>
            {status === "ACTIVE" ? "Hoạt động" : "Tạm ngưng"}
          </Tag>
        );
      },
      header: "Trạng thái",
      meta: { width: 130 },
    },
    {
      cell: ({ row }) => (
        <Button
          aria-label={`Chỉnh sửa thành viên ${row.original.fullName}`}
          onClick={() => showEdit(row.original)}
          type="link"
        >
          Sửa
        </Button>
      ),
      header: "",
      id: "actions",
      meta: { width: 76 },
    },
  ];

  return (
    <>
      <Modal
        cancelButtonProps={{ style: { display: "none" } }}
        okText="Đóng"
        onCancel={onClose}
        onOk={onClose}
        open={Boolean(tenant)}
        title={`Thành viên · ${tenant?.name ?? "Tổ chức"}`}
        width={860}
      >
        <div className="tenant-members-toolbar">
          <p>
            Tạo hoặc khôi phục quản trị viên, giảng viên và học viên cho tổ chức
            này.
          </p>
          <Button icon={<PlusOutlined />} onClick={showCreate} type="primary">
            Thêm thành viên
          </Button>
        </div>
        {membersQuery.error ? (
          <Alert
            showIcon
            title={
              membersQuery.error instanceof Error
                ? membersQuery.error.message
                : "Không tải được thành viên"
            }
            type="error"
          />
        ) : (
          <DataTable
            ariaLabel={`Danh sách thành viên ${tenant?.name ?? "tổ chức"}`}
            columns={columns}
            data={membersQuery.data ?? []}
            emptyText="Tổ chức chưa có thành viên"
            loading={membersQuery.isLoading}
            pageSize={8}
            rowKey="membershipId"
            scrollX={650}
          />
        )}
      </Modal>

      <Modal
        cancelText="Hủy"
        confirmLoading={saveMutation.isPending}
        okText={editing ? "Lưu thay đổi" : "Thêm thành viên"}
        onCancel={() => setEditorOpen(false)}
        onOk={() => void save()}
        open={editorOpen}
        title={editing ? "Cập nhật thành viên" : "Thêm thành viên vào tenant"}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          style={{ marginTop: 20 }}
        >
          <Form.Item
            label={editing ? "Tên hiển thị trong tenant" : "Họ và tên"}
            name="fullName"
            rules={[{ message: "Nhập họ tên", min: 2, required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              {
                message: "Email chưa hợp lệ",
                required: !editing,
                type: "email",
              },
            ]}
          >
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          {!editing && (
            <Form.Item
              label="Mật khẩu ban đầu"
              name="password"
              rules={[
                {
                  message: "Mật khẩu cần ít nhất 8 ký tự",
                  min: 8,
                  required: true,
                },
              ]}
            >
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item label="Vai trò" name="role" rules={[{ required: true }]}>
            <Select options={userRoleOptions} />
          </Form.Item>
          {editing && (
            <Form.Item label="Trạng thái" name="status">
              <Select
                options={[
                  { label: "Hoạt động", value: "ACTIVE" },
                  { label: "Tạm ngưng", value: "INACTIVE" },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
