"use client";

import {
  CopyOutlined,
  MailOutlined,
  PlusOutlined,
  RedoOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tabs,
  Tag,
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { isFormValidationError } from "@/components/form/validation-error";
import { useAuth } from "@/components/providers/app-providers";
import { DataTable } from "@/components/table/data-table";
import { apiFetch } from "@/lib/api";
import { orgUnitQueryKeys, orgUnitsApi } from "@/lib/org-units-api";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import type {
  InvitationIssueResponse,
  InvitationStatus,
  TenantInvitation,
  TenantMember,
} from "@/lib/types";
import {
  buildInvitationAcceptUrl,
  buildInvitationPayload,
  buildCreateUserPayload,
  buildUpdateUserPayload,
  buildUserOrgUnitOptions,
  canManageInvitation,
  sanitizeInvitationList,
  userRoleLabels,
  userRoleOptions,
  type InvitationFormValues,
  type UserFormValues,
} from "@/lib/user-management";

const invitationStatus: Record<
  InvitationStatus,
  { color: string; label: string }
> = {
  ACCEPTED: { color: "green", label: "Đã chấp nhận" },
  CLAIMED: { color: "processing", label: "Đang xác nhận" },
  EXPIRED: { color: "default", label: "Đã hết hạn" },
  PENDING: { color: "gold", label: "Đang chờ" },
  REVOKED: { color: "red", label: "Đã thu hồi" },
};
const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function invitationLink(response: InvitationIssueResponse): string {
  if (typeof window === "undefined") return response.acceptPath;
  return buildInvitationAcceptUrl(response, window.location.origin);
}

export default function UsersPage() {
  const { message } = App.useApp();
  const { effectiveAccess, organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [memberForm] = Form.useForm<UserFormValues>();
  const [inviteForm] = Form.useForm<InvitationFormValues>();
  const [activeTab, setActiveTab] = useState("members");
  const [editing, setEditing] = useState<TenantMember | null>(null);
  const [memberOpen, setMemberOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [issuedLink, setIssuedLink] = useState("");
  const scope = getViewerScope(user, organization);
  const usersKey = scope
    ? lmsQueryKeys.users(scope)
    : (["lms", "signed-out", "users"] as const);
  const invitationsKey = scope
    ? lmsQueryKeys.invitations(scope)
    : (["lms", "signed-out", "users", "invitations"] as const);
  const canLoad = Boolean(token && scope && user?.role === "TENANT_ADMIN");
  const readOnly = effectiveAccess?.readOnly ?? false;
  const scopedAdmin =
    user?.role === "TENANT_ADMIN" && user.orgUnitScopeMode === "SCOPED";
  const orgUnitsKey = scope
    ? orgUnitQueryKeys.tree(scope, false)
    : (["lms", "signed-out", "org-units", "tree"] as const);

  const usersQuery = useQuery({
    enabled: canLoad,
    queryFn: () => apiFetch<TenantMember[]>("/users", { token }),
    queryKey: usersKey,
  });
  const invitationsQuery = useQuery({
    enabled: canLoad && activeTab === "invitations",
    queryFn: () =>
      apiFetch<TenantInvitation[]>("/users/invitations", { token }).then(
        sanitizeInvitationList,
      ),
    queryKey: invitationsKey,
  });
  const orgUnitsQuery = useQuery({
    enabled: canLoad,
    queryFn: ({ signal }) =>
      orgUnitsApi.tree({ token: token ?? "" }, false, { signal }),
    queryKey: orgUnitsKey,
  });
  const orgUnitOptions = useMemo(
    () => buildUserOrgUnitOptions(orgUnitsQuery.data?.items ?? []),
    [orgUnitsQuery.data?.items],
  );
  const orgUnitNames = useMemo(
    () => new Map(orgUnitOptions.map((option) => [option.value, option.label])),
    [orgUnitOptions],
  );
  const scopedRoleOptions = scopedAdmin
    ? userRoleOptions.filter(({ value }) =>
        value === "LEARNER" || value === "GUARDIAN",
      )
    : userRoleOptions;
  const hasOrgUnitPlacement =
    scopedAdmin ||
    orgUnitOptions.length > 0 ||
    Boolean(editing?.orgUnitId) ||
    Boolean((usersQuery.data ?? []).some((member) => member.orgUnitId));
  const showInvitationOrgUnitColumn =
    scopedAdmin ||
    orgUnitOptions.length > 0 ||
    Boolean(
      (invitationsQuery.data ?? []).some((invitation) => invitation.orgUnitId),
    );

  const saveMemberMutation = useMutation({
    mutationFn: (values: UserFormValues) =>
      apiFetch<TenantMember>(
        editing ? `/users/${editing.membershipId}` : "/users",
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
        editing ? "Đã cập nhật thành viên" : "Đã tạo tài khoản mới",
      );
      setMemberOpen(false);
      await queryClient.invalidateQueries({ queryKey: usersKey });
    },
  });
  const createInvitationMutation = useMutation({
    mutationFn: (values: InvitationFormValues) =>
      apiFetch<InvitationIssueResponse>("/users/invitations", {
        body: JSON.stringify(buildInvitationPayload(values)),
        method: "POST",
        token,
      }),
    onSuccess: async (response) => {
      setIssuedLink(invitationLink(response));
      setInviteOpen(false);
      message.success("Đã tạo lời mời");
      await queryClient.invalidateQueries({ queryKey: invitationsKey });
    },
  });
  const resendMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<InvitationIssueResponse>(`/users/invitations/${id}/resend`, {
        method: "POST",
        token,
      }),
    onSuccess: async (response) => {
      setIssuedLink(invitationLink(response));
      message.success(
        "Đã tạo liên kết mời mới; liên kết cũ không còn hiệu lực",
      );
      await queryClient.invalidateQueries({ queryKey: invitationsKey });
    },
  });
  const revokeMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<TenantInvitation>(`/users/invitations/${id}/revoke`, {
        method: "POST",
        token,
      }),
    onSuccess: async () => {
      message.success("Đã thu hồi lời mời");
      await queryClient.invalidateQueries({ queryKey: invitationsKey });
    },
  });
  const promoteGlobalAdminMutation = useMutation({
    mutationFn: (member: TenantMember) =>
      apiFetch<TenantMember>(
        `/users/${member.membershipId}/promote-global-admin`,
        {
          body: JSON.stringify({
            expectedRevision: member.governanceRevision ?? 0,
          }),
          method: "POST",
          token,
        },
      ),
    onSuccess: async () => {
      message.success("Đã trao quyền quản trị toàn tổ chức");
      await queryClient.invalidateQueries({ queryKey: usersKey });
    },
  });

  const showCreateMember = () => {
    setEditing(null);
    memberForm.resetFields();
    memberForm.setFieldsValue({
      orgUnitId:
        scopedAdmin && orgUnitOptions.length === 1
          ? orgUnitOptions[0].value
          : undefined,
      role: "LEARNER",
    });
    setMemberOpen(true);
  };
  const showEditMember = (member: TenantMember) => {
    setEditing(member);
    memberForm.resetFields();
    memberForm.setFieldsValue({
      email: member.email,
      fullName: member.fullName,
      ...(hasOrgUnitPlacement ? { orgUnitId: member.orgUnitId ?? null } : {}),
      role: member.role,
      status: member.status,
    });
    setMemberOpen(true);
  };
  const canEditMember = (member: TenantMember) =>
    !scopedAdmin || member.role === "LEARNER" || member.role === "GUARDIAN";
  const showInvitation = () => {
    setIssuedLink("");
    createInvitationMutation.reset();
    resendMutation.reset();
    inviteForm.resetFields();
    inviteForm.setFieldsValue({
      orgUnitId:
        scopedAdmin && orgUnitOptions.length === 1
          ? orgUnitOptions[0].value
          : undefined,
      role: "LEARNER",
    });
    setInviteOpen(true);
  };
  const saveMember = async () => {
    try {
      await saveMemberMutation.mutateAsync(await memberForm.validateFields());
    } catch (caught) {
      if (!isFormValidationError(caught)) {
        message.error(
          caught instanceof Error ? caught.message : "Không thể lưu thành viên",
        );
      }
    }
  };
  const createInvitation = async () => {
    try {
      await createInvitationMutation.mutateAsync(
        await inviteForm.validateFields(),
      );
      createInvitationMutation.reset();
    } catch (caught) {
      if (!isFormValidationError(caught)) {
        message.error(
          caught instanceof Error ? caught.message : "Không thể tạo lời mời",
        );
      }
    }
  };
  const resend = async (id: string) => {
    try {
      setIssuedLink("");
      createInvitationMutation.reset();
      resendMutation.reset();
      await resendMutation.mutateAsync(id);
      resendMutation.reset();
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : "Không thể gửi lại lời mời",
      );
    }
  };
  const revoke = async (id: string) => {
    try {
      await revokeMutation.mutateAsync(id);
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : "Không thể thu hồi lời mời",
      );
    }
  };
  const promoteGlobalAdmin = async (member: TenantMember) => {
    try {
      await promoteGlobalAdminMutation.mutateAsync(member);
    } catch (caught) {
      message.error(
        caught instanceof Error
          ? caught.message
          : "Không thể trao quyền quản trị toàn tổ chức",
      );
    }
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(issuedLink);
      message.success("Đã sao chép liên kết mời");
      setIssuedLink("");
      createInvitationMutation.reset();
      resendMutation.reset();
    } catch {
      message.error(
        "Không thể sao chép tự động; hãy sao chép liên kết trong ô bên dưới",
      );
    }
  };
  const closeIssuedLink = () => {
    setIssuedLink("");
    createInvitationMutation.reset();
    resendMutation.reset();
  };

  const memberColumns: ColumnDef<StockFeatures, TenantMember>[] = [
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
    ...(hasOrgUnitPlacement
      ? [
          {
            accessorKey: "orgUnitId",
            cell: ({ getValue }) => {
              const orgUnitId = getValue<string | undefined>();
              return orgUnitId
                ? (orgUnitNames.get(orgUnitId) ?? "Cơ sở không còn hoạt động")
                : "Chưa gắn cơ sở";
            },
            header: "Cơ sở chính",
            meta: { responsive: ["md"] },
          } satisfies ColumnDef<StockFeatures, TenantMember>,
        ]
      : []),
    {
      accessorKey: "status",
      cell: ({ row }) => (
        <Space size={4} wrap>
          <Tag color={row.original.status === "ACTIVE" ? "green" : "default"}>
            {row.original.status === "ACTIVE" ? "Hoạt động" : "Tạm ngưng"}
          </Tag>
          {row.original.accountStatus === "INACTIVE" && (
            <Tag color="red">Tài khoản đã khóa</Tag>
          )}
        </Space>
      ),
      header: "Trạng thái",
      meta: { width: 190 },
    },
    {
      cell: ({ row }) => {
        const member = row.original;
        const canPromote =
          !scopedAdmin &&
          user?.orgUnitScopeMode !== "SCOPED" &&
          member.role === "TENANT_ADMIN" &&
          member.status === "ACTIVE" &&
          member.orgUnitScopeMode === "SCOPED";
        return (
          <Space className="table-row-actions" size={0}>
            {canEditMember(member) ? (
              <Button
                disabled={readOnly}
                onClick={() => showEditMember(member)}
                title={
                  readOnly ? "Workspace đang ở chế độ chỉ đọc" : undefined
                }
                type="link"
              >
                Sửa
              </Button>
            ) : (
              <span className="table-muted">Chỉ xem</span>
            )}
            {canPromote && (
              <Popconfirm
                cancelText="Hủy"
                description="Người này sẽ quản lý mọi chi nhánh, thanh toán và cấu hình tổ chức. Màn hình hiện tại không có thao tác thu hồi quyền này."
                disabled={readOnly}
                okText="Trao quyền"
                onConfirm={() => void promoteGlobalAdmin(member)}
                title="Trao quyền quản trị toàn tổ chức?"
              >
                <Button
                  disabled={readOnly || promoteGlobalAdminMutation.isPending}
                  type="link"
                >
                  Trao quyền toàn tổ chức
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
      header: "",
      id: "actions",
      meta: { width: 76 },
    },
  ];
  const invitationColumns: ColumnDef<StockFeatures, TenantInvitation>[] = [
    {
      accessorKey: "email",
      cell: ({ row }) => (
        <div className="table-primary-cell">
          <strong>{row.original.displayName || row.original.email}</strong>
          {row.original.displayName && (
            <div className="table-muted">{row.original.email}</div>
          )}
        </div>
      ),
      header: "Người được mời",
    },
    {
      accessorKey: "role",
      cell: ({ getValue }) =>
        userRoleLabels[getValue<TenantInvitation["role"]>()],
      header: "Vai trò",
      meta: { responsive: ["sm"] },
    },
    ...(showInvitationOrgUnitColumn
      ? [
          {
            accessorKey: "orgUnitId",
            cell: ({ getValue }) => {
              const orgUnitId = getValue<string | undefined>();
              return orgUnitId
                ? (orgUnitNames.get(orgUnitId) ?? "Cơ sở không còn hoạt động")
                : "Chưa gắn cơ sở";
            },
            header: "Cơ sở chính",
            meta: { responsive: ["md"] },
          } satisfies ColumnDef<StockFeatures, TenantInvitation>,
        ]
      : []),
    {
      accessorKey: "status",
      cell: ({ getValue }) => {
        const presentation = invitationStatus[getValue<InvitationStatus>()];
        return <Tag color={presentation.color}>{presentation.label}</Tag>;
      },
      header: "Trạng thái",
      meta: { width: 150 },
    },
    {
      accessorKey: "expiresAt",
      cell: ({ getValue }) => dateTime.format(new Date(getValue<string>())),
      header: "Hết hạn",
      meta: { responsive: ["md"], width: 180 },
    },
    {
      cell: ({ row }) =>
        canManageInvitation(row.original.status) ? (
          <Space className="table-row-actions" size={0}>
            <Button
              disabled={readOnly || resendMutation.isPending}
              icon={<RedoOutlined />}
              onClick={() => void resend(row.original._id)}
              title={
                readOnly
                  ? "Workspace đang ở chế độ chỉ đọc"
                  : "Tạo liên kết mới và vô hiệu hóa liên kết cũ"
              }
              type="link"
            >
              Gửi lại
            </Button>
            {row.original.status === "PENDING" && (
              <Popconfirm
                cancelText="Hủy"
                disabled={readOnly}
                okText="Thu hồi"
                onConfirm={() => void revoke(row.original._id)}
                title="Thu hồi lời mời này?"
              >
                <Button
                  danger
                  disabled={readOnly || revokeMutation.isPending}
                  icon={<StopOutlined />}
                  type="link"
                >
                  Thu hồi
                </Button>
              </Popconfirm>
            )}
          </Space>
        ) : null,
      header: "",
      id: "actions",
      meta: { width: 190 },
    },
  ];

  if (user?.role !== "TENANT_ADMIN") {
    return (
      <Alert
        showIcon
        title="Chỉ quản trị tổ chức được quản lý người dùng."
        type="warning"
      />
    );
  }

  return (
    <div className="page-shell">
      <div className="page-heading page-toolbar">
        <div className="page-heading-copy">
          <h1>Người dùng</h1>
          <p>
            Quản lý thành viên hiện tại và mời người dùng tham gia workspace.
          </p>
        </div>
        <Space className="page-toolbar-actions" wrap>
          <Button disabled={readOnly} href="/users/import">
            Nhập CSV
          </Button>
          <Button
            disabled={readOnly}
            icon={<PlusOutlined />}
            onClick={showCreateMember}
            title={readOnly ? "Gia hạn thuê bao để tạo tài khoản" : undefined}
          >
            Tạo tài khoản
          </Button>
          <Button
            disabled={readOnly}
            icon={<MailOutlined />}
            onClick={showInvitation}
            title={readOnly ? "Gia hạn thuê bao để gửi lời mời" : undefined}
            type="primary"
          >
            Gửi lời mời
          </Button>
        </Space>
      </div>
      {readOnly && (
        <Alert
          showIcon
          style={{ marginBottom: 18 }}
          title="Workspace đang ở chế độ chỉ đọc; bạn vẫn có thể xem thành viên và lời mời."
          type="warning"
        />
      )}
      {orgUnitsQuery.error && (
        <Alert
          showIcon
          style={{ marginBottom: 18 }}
          title="Không tải được danh sách cơ sở; các thay đổi phân bổ cơ sở tạm thời chưa khả dụng."
          type="warning"
        />
      )}
      <Tabs
        activeKey={activeTab}
        items={[
          {
            children: usersQuery.error ? (
              <Alert
                showIcon
                title={
                  usersQuery.error instanceof Error
                    ? usersQuery.error.message
                    : "Không tải được thành viên"
                }
                type="error"
              />
            ) : (
              <Card className="surface-card table-surface">
                <DataTable
                  ariaLabel="Danh sách thành viên"
                  columns={memberColumns}
                  data={usersQuery.data ?? []}
                  emptyText="Chưa có thành viên"
                  loading={usersQuery.isLoading}
                  rowKey="membershipId"
                  scrollX={900}
                />
              </Card>
            ),
            key: "members",
            label: "Thành viên",
          },
          {
            children: invitationsQuery.error ? (
              <Alert
                showIcon
                title={
                  invitationsQuery.error instanceof Error
                    ? invitationsQuery.error.message
                    : "Không tải được lời mời"
                }
                type="error"
              />
            ) : (
              <Card className="surface-card table-surface">
                <DataTable
                  ariaLabel="Danh sách lời mời"
                  columns={invitationColumns}
                  data={invitationsQuery.data ?? []}
                  emptyText="Chưa có lời mời"
                  loading={invitationsQuery.isLoading}
                  rowKey="_id"
                  scrollX={980}
                />
              </Card>
            ),
            key: "invitations",
            label: "Lời mời",
          },
        ]}
        onChange={setActiveTab}
      />

      <Modal
        cancelText="Hủy"
        confirmLoading={saveMemberMutation.isPending}
        okText={editing ? "Lưu thay đổi" : "Tạo tài khoản"}
        onCancel={() => setMemberOpen(false)}
        onOk={() => void saveMember()}
        open={memberOpen}
        title={editing ? "Cập nhật thành viên" : "Tạo tài khoản mới"}
      >
        <Form
          form={memberForm}
          layout="vertical"
          requiredMark={false}
          style={{ marginTop: 22 }}
        >
          <Form.Item
            label={editing ? "Tên hiển thị trong workspace" : "Họ và tên"}
            name="fullName"
            rules={[{ required: true, min: 2, message: "Nhập họ tên" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              {
                required: !editing,
                type: "email",
                message: "Email chưa hợp lệ",
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
                  required: true,
                  min: 8,
                  message: "Mật khẩu cần ít nhất 8 ký tự",
                },
              ]}
            >
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item label="Vai trò" name="role" rules={[{ required: true }]}>
            <Select options={scopedRoleOptions} />
          </Form.Item>
          {hasOrgUnitPlacement && (
            <Form.Item
              getValueFromEvent={(value) => value ?? null}
              label="Cơ sở chính"
              name="orgUnitId"
              rules={
                scopedAdmin
                  ? [{ message: "Chọn cơ sở quản lý thành viên", required: true }]
                  : undefined
              }
            >
              <Select
                allowClear={!scopedAdmin}
                loading={orgUnitsQuery.isLoading}
                options={orgUnitOptions}
                placeholder={
                  scopedAdmin
                    ? "Chọn cơ sở trong phạm vi quản lý"
                    : "Không gắn cơ sở (phù hợp mô hình solo)"
                }
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          )}
          {editing && (
            <Form.Item label="Trạng thái thành viên" name="status">
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

      <Modal
        cancelText="Hủy"
        confirmLoading={createInvitationMutation.isPending}
        okText="Tạo lời mời"
        onCancel={() => setInviteOpen(false)}
        onOk={() => void createInvitation()}
        open={inviteOpen}
        title="Mời vào workspace"
      >
        <Form
          form={inviteForm}
          layout="vertical"
          requiredMark={false}
          style={{ marginTop: 22 }}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, type: "email", message: "Email chưa hợp lệ" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Tên hiển thị (không bắt buộc)"
            name="displayName"
            rules={[{ min: 2, message: "Tên cần ít nhất 2 ký tự" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Vai trò" name="role" rules={[{ required: true }]}>
            <Select options={scopedRoleOptions} />
          </Form.Item>
          {(orgUnitOptions.length > 0 || scopedAdmin) && (
            <Form.Item
              label="Cơ sở chính"
              name="orgUnitId"
              rules={
                scopedAdmin
                  ? [{ message: "Chọn cơ sở cho lời mời", required: true }]
                  : undefined
              }
            >
              <Select
                allowClear={!scopedAdmin}
                loading={orgUnitsQuery.isLoading}
                options={orgUnitOptions}
                placeholder={
                  scopedAdmin
                    ? "Chọn cơ sở trong phạm vi quản lý"
                    : "Không gắn cơ sở (không bắt buộc)"
                }
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        cancelButtonProps={{ style: { display: "none" } }}
        okText="Đóng"
        onCancel={closeIssuedLink}
        onOk={closeIssuedLink}
        open={Boolean(issuedLink)}
        title="Liên kết lời mời một lần"
      >
        <Alert
          description="Chỉ liên kết mới nhất còn hiệu lực. Hãy gửi liên kết này qua kênh riêng cho người được mời."
          showIcon
          style={{ marginBottom: 16 }}
          type="warning"
        />
        <Space.Compact block>
          <Input aria-label="Liên kết lời mời" readOnly value={issuedLink} />
          <Button
            aria-label="Sao chép liên kết lời mời"
            icon={<CopyOutlined />}
            onClick={() => void copyLink()}
          >
            Sao chép
          </Button>
        </Space.Compact>
      </Modal>
    </div>
  );
}
