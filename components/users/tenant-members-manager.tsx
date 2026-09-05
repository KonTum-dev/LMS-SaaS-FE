"use client";
import { describeOperationsError } from "@/lib/i18n/operations-errors";
import { useI18n } from "@/components/i18n/i18n-provider";
import { operationsMessages } from "@/lib/i18n/operations-messages";
import { workspacePolishMessages } from "@/lib/i18n/workspace-polish-messages";
import { userCreationMessages } from "./user-creation-messages";
import { useMemo as useI18nMemo } from "react";

import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import { Alert, Button, Descriptions, Input, Modal, Select, Space, Tag } from "antd";
import { Form } from "@/components/form/localized-form";
import { useRef, useState } from "react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useAuth } from "@/components/providers/app-providers";
import { DataTable } from "@/components/table/data-table";
import { apiFetch } from "@/lib/api";
import { normalizeListSearch } from "@/lib/list-controls";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import type { Organization, TenantMember } from "@/lib/types";
import {
  adminTenantMemberEndpoint,
  buildCreateUserPayload,
  buildUpdateUserPayload,
  newUserPasswordValidationError,
  userRoleLabels,
  userRoleOptions,
  type UserFormValues,
} from "@/lib/user-management";

interface TenantMembersManagerProps {
  onClose: () => void;
  tenant: Organization | null;
}
const memberMessages = { ...operationsMessages, ...workspacePolishMessages, ...userCreationMessages };

export function TenantMembersManager({
  onClose,
  tenant,
}: TenantMembersManagerProps) {
  const { t, locale, userRoleLabels, userRoleOptions } = useOperationsCopy();
  const { message, modal, reportError } = useFeedback();
  const { organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<UserFormValues>();
  const [editing, setEditing] = useState<TenantMember | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const saveInFlight = useRef(false);
  const [validatingSave, setValidatingSave] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TenantMember["status"]>();
  const normalizedSearch = normalizeListSearch(search);
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
  const memberDetail = useQuery({
    enabled: Boolean(
      tenant &&
      token &&
      scope &&
      user?.role === "SUPER_ADMIN" &&
      selectedMemberId,
    ),
    queryFn: () =>
      apiFetch<TenantMember>(
        adminTenantMemberEndpoint(tenantId, selectedMemberId!),
        { token },
      ),
    queryKey: [...membersKey, "detail", selectedMemberId],
  });
  const visibleMembers = (membersQuery.data ?? []).filter(
    (member) =>
      (!statusFilter || member.status === statusFilter) &&
      normalizeListSearch(`${member.fullName} ${member.email}`).includes(normalizedSearch),
  );
  const memberLifecycle = useMutation({
    mutationFn: (member: TenantMember) =>
      apiFetch<TenantMember>(
        `${adminTenantMemberEndpoint(tenantId, member.membershipId)}${member.status === "ACTIVE" ? "" : "/restore"}`,
        { method: member.status === "ACTIVE" ? "DELETE" : "POST", token },
      ),
    onError: (error) =>
      reportError(error, "Không thể cập nhật trạng thái thành viên"),
    onSuccess: async (member) => {
      message.success(
        member.status === "ACTIVE"
          ? "Đã khôi phục thành viên"
          : "Đã vô hiệu hóa thành viên trong tổ chức",
      );
      await queryClient.invalidateQueries({ queryKey: membersKey });
    },
  });
  const requestMemberLifecycle = (member: TenantMember) => {
    const disabling = member.status === "ACTIVE";
    modal.confirm({
      cancelText: t("Hủy"),
      content: disabling
        ? t(
            "Chỉ ngừng quyền truy cập tổ chức này. Tài khoản toàn cục, thành viên ở tổ chức khác và lịch sử học tập được giữ nguyên.",
          )
        : t(
            "Khôi phục quyền thành viên trong tổ chức này. Thao tác không mở khóa tài khoản toàn cục đang bị vô hiệu hóa; hạn mức và quyền truy cập tổ chức vẫn được kiểm tra.",
          ),
      okButtonProps: { danger: disabling },
      okText: disabling ? t("Vô hiệu hóa thành viên") : t("Khôi phục"),
      onOk: () => memberLifecycle.mutateAsync(member),
      title: t("{value0} thành viên {value1}?", {
        value0: disabling ? t("Vô hiệu hóa") : t("Khôi phục"),
        value1: member.fullName,
      }),
    });
  };

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
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setValidatingSave(true);
    try {
      await saveMutation.mutateAsync(await form.validateFields());
    } catch (caught) {
      if (
        typeof caught === "object" &&
        caught !== null &&
        "errorFields" in caught &&
        Array.isArray(caught.errorFields)
      ) {
        message.error(
          "Vui lòng kiểm tra các trường được đánh dấu trước khi lưu thành viên",
        );
        return;
      }
      reportError(caught, "Không thể lưu thành viên");
    } finally {
      saveInFlight.current = false;
      setValidatingSave(false);
    }
  };
  const saving = validatingSave || saveMutation.isPending;

  const columns: ColumnDef<StockFeatures, TenantMember>[] = [
    {
      accessorKey: "fullName",
      cell: ({ row }) => (
        <div className="table-primary-cell">
          <strong>{row.original.fullName}</strong>
          <div className="table-muted">{row.original.email}</div>
          {row.original.accountStatus !== "ACTIVE" && <Tag color="red">{t("Tài khoản bị vô hiệu hóa")}</Tag>}
        </div>
      ),
      header: t("Thành viên"),
    },
    {
      accessorKey: "role",
      cell: ({ getValue }) => userRoleLabels[getValue<TenantMember["role"]>()],
      header: t("Vai trò"),
      meta: { responsive: ["sm"] },
    },
    {
      accessorKey: "status",
      cell: ({ getValue }) => {
        const status = getValue<TenantMember["status"]>();
        return (
          <Tag color={status === "ACTIVE" ? "green" : "default"}>
            {status === "ACTIVE" ? t("Hoạt động") : t("Tạm ngưng")}
          </Tag>
        );
      },
      header: t("Trong tổ chức"),
      meta: { width: 130 },
    },
    {
      cell: ({ row }) => (
        <Space size={0} wrap>
          <Button
            aria-label={t("Xem chi tiết thành viên {value0}", {
              value0: row.original.fullName,
            })}
            onClick={() => setSelectedMemberId(row.original.membershipId)}
            type="link"
          >
            {t("Chi tiết")}{" "}
          </Button>
          <Button
            aria-label={t("Chỉnh sửa thành viên {value0}", {
              value0: row.original.fullName,
            })}
            disabled={memberLifecycle.isPending}
            onClick={() => showEdit(row.original)}
            type="link"
          >
            {t("Sửa")}{" "}
          </Button>
          <Button
            aria-label={t("{value0} thành viên {value1}", {
              value0:
                row.original.status === "ACTIVE"
                  ? t("Vô hiệu hóa")
                  : t("Khôi phục"),
              value1: row.original.fullName,
            })}
            danger={row.original.status === "ACTIVE"}
            disabled={memberLifecycle.isPending || saveMutation.isPending}
            loading={
              memberLifecycle.isPending &&
              memberLifecycle.variables?.membershipId ===
                row.original.membershipId
            }
            onClick={() => requestMemberLifecycle(row.original)}
            type="link"
          >
            {row.original.status === "ACTIVE"
              ? t("Vô hiệu hóa")
              : t("Khôi phục")}
          </Button>
        </Space>
      ),
      header: "",
      id: "actions",
      meta: { width: 270 },
    },
  ];

  return (
    <>
      <Modal
        className="admin-form-modal"
        cancelButtonProps={{ style: { display: "none" } }}
        okText={t("Đóng")}
        onCancel={onClose}
        onOk={onClose}
        open={Boolean(tenant)}
        title={t("Thành viên · {value0}", {
          value0: tenant?.name ?? t("Tổ chức"),
        })}
        width={1100}
      >
        <div className="tenant-members-toolbar">
          <p>
            {t(
              "Tạo hoặc khôi phục quản trị viên, giảng viên, học viên và phụ huynh cho tổ chức này.",
            )}{" "}
          </p>
          <Button icon={<PlusOutlined />} onClick={showCreate} type="primary">
            {t("Thêm thành viên")}{" "}
          </Button>
        </div>
        <div className="list-filter-bar" role="search" aria-label={t("Bộ lọc thành viên")}>
          <Input
            allowClear
            aria-label={t("Tìm thành viên")}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("Tên hoặc email thành viên")}
            value={search}
            style={{ width: 260 }}
          />
          <Select
            allowClear
            aria-label={t("Lọc trạng thái thành viên")}
            onChange={setStatusFilter}
            options={[
              { label: t("Hoạt động"), value: "ACTIVE" },
              { label: t("Tạm ngưng"), value: "INACTIVE" },
            ]}
            placeholder={t("Trạng thái trong tổ chức")}
            value={statusFilter}
            style={{ width: 230 }}
          />
          {(search || statusFilter) && <Button onClick={() => { setSearch(""); setStatusFilter(undefined); }}>{t("Xóa bộ lọc")}</Button>}
        </div>
        {membersQuery.error ? (
          <Alert
            action={<Button loading={membersQuery.isFetching} onClick={() => void membersQuery.refetch({ cancelRefetch: false })}>{t("Thử lại")}</Button>}
            showIcon
            title={
              membersQuery.error instanceof Error
                ? describeOperationsError(
                    membersQuery.error,
                    locale,
                    t("Không tải được thành viên"),
                  )
                : t("Không tải được thành viên")
            }
            type="error"
          />
        ) : (
          <DataTable
            ariaLabel={t("Danh sách thành viên {value0}", {
              value0: tenant?.name ?? t("tổ chức"),
            })}
            columns={columns}
            data={visibleMembers}
            emptyText={t(normalizedSearch || statusFilter ? "Không tìm thấy thành viên phù hợp" : "Tổ chức chưa có thành viên")}
            loading={membersQuery.isFetching}
            paginationResetKey={JSON.stringify([normalizedSearch, statusFilter ?? ""])}
            pageSize={8}
            rowKey="membershipId"
            scrollX={780}
          />
        )}
      </Modal>

      <Modal
        className="admin-form-modal"
        footer={null}
        onCancel={() => setSelectedMemberId(null)}
        open={Boolean(tenant && selectedMemberId)}
        title={t("Chi tiết thành viên")}
        width={680}
      >
        {memberDetail.isPending ? (
          <p role="status">{t("Đang tải chi tiết thành viên…")}</p>
        ) : memberDetail.error ? (
          <Alert
            action={<Button loading={memberDetail.isFetching} onClick={() => void memberDetail.refetch({ cancelRefetch: false })}>{t("Thử lại")}</Button>}
            showIcon
            title={
              memberDetail.error instanceof Error
                ? describeOperationsError(
                    memberDetail.error,
                    locale,
                    t("Không tải được chi tiết thành viên"),
                  )
                : t("Không tải được chi tiết thành viên")
            }
            type="error"
          />
        ) : memberDetail.data ? (
          <>
          <Descriptions bordered column={1}>
            <Descriptions.Item label={t("Họ tên")}>
              {memberDetail.data.fullName}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {memberDetail.data.email}
            </Descriptions.Item>
            <Descriptions.Item label={t("Vai trò")}>
              {userRoleLabels[memberDetail.data.role]}
            </Descriptions.Item>
            <Descriptions.Item label={t("Trong tổ chức")}>
              {memberDetail.data.status === "ACTIVE"
                ? t("Hoạt động")
                : t("Tạm ngưng")}
            </Descriptions.Item>
            <Descriptions.Item label={t("Tài khoản toàn cục")}>
              {memberDetail.data.accountStatus === "ACTIVE"
                ? t("Hoạt động")
                : t("Bị vô hiệu hóa")}
            </Descriptions.Item>
            <Descriptions.Item label={t("Ngày tham gia")}>
              {new Date(memberDetail.data.joinedAt).toLocaleString(
                locale === "en" ? "en-US" : "vi-VN",
              )}
            </Descriptions.Item>
          </Descriptions>
          <details className="admin-detail-disclosure">
            <summary>{t("Mã định danh")}</summary>
            <Descriptions bordered column={1}>
              <Descriptions.Item label={t("ID thành viên")}>{memberDetail.data.membershipId}</Descriptions.Item>
              <Descriptions.Item label={t("ID tài khoản")}>{memberDetail.data.userId}</Descriptions.Item>
              <Descriptions.Item label={t("ID tổ chức")}>{memberDetail.data.tenantId}</Descriptions.Item>
            </Descriptions>
          </details>
          </>
        ) : null}
      </Modal>

      <Modal
        className="admin-form-modal"
        cancelText={t("Hủy")}
        cancelButtonProps={{ disabled: saving }}
        closable={!saving}
        confirmLoading={saving}
        keyboard={!saving}
        mask={{ closable: !saving }}
        okText={editing ? t("Lưu thay đổi") : t("Thêm thành viên")}
        onCancel={() => { if (!saving) setEditorOpen(false); }}
        onOk={() => void save()}
        open={editorOpen}
        title={
          editing ? t("Cập nhật thành viên") : t("Thêm thành viên vào tenant")
        }
      >
        <Form
          className="admin-entity-form"
          disabled={saving}
          form={form}
          layout="vertical"
          requiredMark={false}
          style={{ marginTop: 20 }}
        >
          <Form.Item
            label={editing ? t("Tên hiển thị trong tenant") : t("Họ và tên")}
            name="fullName"
            rules={[{ message: t("Nhập họ tên"), min: 2, required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              {
                message: t("Email chưa hợp lệ"),
                required: !editing,
                type: "email",
              },
            ]}
          >
            <Input disabled={Boolean(editing) || saving} autoComplete="off" />
          </Form.Item>
          {!editing && (
            <Form.Item
              label={t("Mật khẩu ban đầu")}
              name="password"
              rules={[
                {
                  validator: (_, value: string | undefined) => {
                    const error = newUserPasswordValidationError(value ?? "");
                    return error ? Promise.reject(new Error(t(error))) : Promise.resolve();
                  },
                },
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          )}
          <Form.Item
            label={t("Vai trò")}
            name="role"
            rules={[{ required: true }]}
          >
            <Select options={userRoleOptions} />
          </Form.Item>
          {editing && (
            <Form.Item label={t("Trạng thái")} name="status">
              <Select
                options={[
                  { label: t("Hoạt động"), value: "ACTIVE" },
                  { label: t("Tạm ngưng"), value: "INACTIVE" },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}

function useOperationsCopy() {
  const i18n = useI18n(memberMessages);
  return useI18nMemo(() => {
    const { t } = i18n;

    const translatedUserRoleLabels = Object.fromEntries(
      Object.entries(userRoleLabels).map(([key, label]) => [key, t(label)]),
    ) as typeof userRoleLabels;
    const translatedUserRoleOptions = userRoleOptions.map((option) => ({
      ...option,
      label: t(option.label),
    }));
    return {
      ...i18n,
      userRoleLabels: translatedUserRoleLabels,
      userRoleOptions: translatedUserRoleOptions,
    };
  }, [i18n]);
}
