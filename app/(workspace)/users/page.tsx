"use client";
import { describeOperationsError } from "@/lib/i18n/operations-errors";
import { useI18n } from "@/components/i18n/i18n-provider";
import { operationsMessages } from "@/lib/i18n/operations-messages";
import { userCreationMessages } from "@/components/users/user-creation-messages";
import { useMemo as useI18nMemo } from "react";

import { useFeedback } from "@/components/feedback/feedback-provider";

import {
  CopyOutlined,
  MailOutlined,
  PlusOutlined,
  RedoOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Input, Modal, Popconfirm, Select, Space, Tabs, Tag } from "antd";
import { Form } from "@/components/form/localized-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import { useMemo, useRef, useState } from "react";
import { isFormValidationError } from "@/components/form/validation-error";
import { useAuth } from "@/components/providers/app-providers";
import { DataTable } from "@/components/table/data-table";
import { apiFetch } from "@/lib/api";
import { orgUnitQueryKeys, orgUnitsApi } from "@/lib/org-units-api";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import { normalizeListSearch } from "@/lib/list-controls";
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
  newUserPasswordValidationError,
  userRoleLabels,
  userRoleOptions,
  type InvitationFormValues,
  type UserFormValues,
} from "@/lib/user-management";

export default function UsersPage() {
  const {
    t,
    invitationStatus,
    dateTime,
    invitationLink,
    userRoleLabels,
    userRoleOptions,
    buildUserOrgUnitOptions,
    locale,
  } = useOperationsCopy();
  const { message, reportError } = useFeedback();
  const { effectiveAccess, organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [memberForm] = Form.useForm<UserFormValues>();
  const [inviteForm] = Form.useForm<InvitationFormValues>();
  const memberRole = Form.useWatch("role", memberForm);
  const [activeTab, setActiveTab] = useState("members");
  const [memberFilters, setMemberFilters] = useState({ search: "", role: "", status: "" });
  const [inviteFilters, setInviteFilters] = useState({ search: "", role: "", status: "" });
  const [editing, setEditing] = useState<TenantMember | null>(null);
  const [memberOpen, setMemberOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [issuedLink, setIssuedLink] = useState("");
  const scope = getViewerScope(user, organization);
  const actionRequests = useRef(new Map<string, Promise<void>>());
  const [pendingActions, setPendingActions] = useState<ReadonlyMap<string, string>>(new Map());
  const actionKey = (target: string, id = "") => JSON.stringify([scope, target, id]);
  const runAction = (key: string, name: string, action: () => Promise<void>) => {
    const existing = actionRequests.current.get(key);
    if (existing) return existing;
    const request = Promise.resolve().then(action).finally(() => {
      actionRequests.current.delete(key);
      setPendingActions(current => { const next = new Map(current); next.delete(key); return next; });
    });
    actionRequests.current.set(key, request);
    setPendingActions(current => new Map(current).set(key, name));
    return request;
  };
  const usersKey = scope
    ? lmsQueryKeys.users(scope)
    : (["lms", "signed-out", "users"] as const);
  const invitationsKey = scope
    ? lmsQueryKeys.invitations(scope)
    : (["lms", "signed-out", "users", "invitations"] as const);
  const canLoad = Boolean(token && scope && user?.role === "TENANT_ADMIN");
  const canLinkGuardians = Boolean(effectiveAccess?.modules.includes("GUARDIANS"));
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
  const normalizedMemberSearch = normalizeListSearch(memberFilters.search);
  const normalizedInviteSearch = normalizeListSearch(inviteFilters.search);
  const filteredMembers = useMemo(() => (usersQuery.data ?? []).filter((member) =>
    (!normalizedMemberSearch || normalizeListSearch(`${member.fullName} ${member.email}`).includes(normalizedMemberSearch)) &&
    (!memberFilters.role || member.role === memberFilters.role) &&
    (!memberFilters.status || member.status === memberFilters.status),
  ), [usersQuery.data, normalizedMemberSearch, memberFilters.role, memberFilters.status]);
  const filteredInvitations = useMemo(() => (invitationsQuery.data ?? []).filter((invitation) =>
    (!normalizedInviteSearch || normalizeListSearch(`${invitation.displayName ?? ""} ${invitation.email}`).includes(normalizedInviteSearch)) &&
    (!inviteFilters.role || invitation.role === inviteFilters.role) &&
    (!inviteFilters.status || invitation.status === inviteFilters.status),
  ), [invitationsQuery.data, normalizedInviteSearch, inviteFilters.role, inviteFilters.status]);
  const listFilters = activeTab === "members" ? memberFilters : inviteFilters;
  const setListFilters = activeTab === "members" ? setMemberFilters : setInviteFilters;
  const memberFiltersActive = Boolean(normalizedMemberSearch || memberFilters.role || memberFilters.status);
  const inviteFiltersActive = Boolean(normalizedInviteSearch || inviteFilters.role || inviteFilters.status);
  const orgUnitsQuery = useQuery({
    enabled: canLoad,
    queryFn: ({ signal }) =>
      orgUnitsApi.tree({ token: token ?? "" }, false, { signal }),
    queryKey: orgUnitsKey,
  });
  const orgUnitOptions = useMemo(
    () => buildUserOrgUnitOptions(orgUnitsQuery.data?.items ?? []),
    [buildUserOrgUnitOptions, orgUnitsQuery.data?.items],
  );
  const orgUnitNames = useMemo(
    () => new Map(orgUnitOptions.map((option) => [option.value, option.label])),
    [orgUnitOptions],
  );
  const scopedRoleOptions = scopedAdmin
    ? userRoleOptions.filter(
        ({ value }) => value === "LEARNER" || value === "GUARDIAN",
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
  const memberSaving = pendingActions.has(actionKey("save")) || saveMemberMutation.isPending;
  const invitationSaving = pendingActions.has(actionKey("invite")) || createInvitationMutation.isPending;
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
  const saveMember = () => runAction(actionKey("save"), "save", async () => {
    if (!canLoad || readOnly) return;
    try {
      await saveMemberMutation.mutateAsync(await memberForm.validateFields());
    } catch (caught) {
      if (!isFormValidationError(caught)) {
        reportError(caught, "Không thể lưu thành viên");
      }
    }
  });
  const createInvitation = () => runAction(actionKey("invite"), "invite", async () => {
    if (!canLoad || readOnly) return;
    try {
      await createInvitationMutation.mutateAsync(
        await inviteForm.validateFields(),
      );
      createInvitationMutation.reset();
    } catch (caught) {
      if (!isFormValidationError(caught)) {
        reportError(caught, "Không thể tạo lời mời");
      }
    }
  });
  const resend = (id: string) => runAction(actionKey("invitation", id), "resend", async () => {
    if (!canLoad || readOnly) return;
    try {
      setIssuedLink("");
      createInvitationMutation.reset();
      resendMutation.reset();
      await resendMutation.mutateAsync(id);
      resendMutation.reset();
    } catch (caught) {
      reportError(caught, "Không thể gửi lại lời mời");
    }
  });
  const revoke = (id: string) => runAction(actionKey("invitation", id), "revoke", async () => {
    if (!canLoad || readOnly) return;
    try {
      await revokeMutation.mutateAsync(id);
    } catch (caught) {
      reportError(caught, "Không thể thu hồi lời mời");
    }
  });
  const promoteGlobalAdmin = (member: TenantMember) => runAction(actionKey("promote", member.membershipId), "promote", async () => {
    if (!canLoad || readOnly || scopedAdmin || member.role !== "TENANT_ADMIN" || member.status !== "ACTIVE" || member.orgUnitScopeMode !== "SCOPED") return;
    try {
      await promoteGlobalAdminMutation.mutateAsync(member);
    } catch (caught) {
      reportError(caught, "Không thể trao quyền quản trị toàn tổ chức");
    }
  });
  const copyLink = () => runAction(actionKey("copy-link"), "copy", async () => {
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
  });
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
      header: t("Thành viên"),
    },
    {
      accessorKey: "role",
      cell: ({ getValue }) => userRoleLabels[getValue<TenantMember["role"]>()],
      header: t("Vai trò"),
      meta: { responsive: ["sm"] },
    },
    ...(hasOrgUnitPlacement
      ? [
          {
            accessorKey: "orgUnitId",
            cell: ({ getValue }) => {
              const orgUnitId = getValue<string | undefined>();
              return orgUnitId
                ? (orgUnitNames.get(orgUnitId) ??
                    t("Cơ sở không còn hoạt động"))
                : t("Chưa gắn cơ sở");
            },
            header: t("Cơ sở chính"),
            meta: { responsive: ["md"] },
          } satisfies ColumnDef<StockFeatures, TenantMember>,
        ]
      : []),
    {
      accessorKey: "status",
      cell: ({ row }) => (
        <Space size={4} wrap>
          <Tag color={row.original.status === "ACTIVE" ? "green" : "default"}>
            {row.original.status === "ACTIVE" ? t("Hoạt động") : t("Tạm ngưng")}
          </Tag>
          {row.original.accountStatus === "INACTIVE" && (
            <Tag color="red">{t("Tài khoản đã khóa")}</Tag>
          )}
        </Space>
      ),
      header: t("Trạng thái"),
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
                  readOnly ? t("Workspace đang ở chế độ chỉ đọc") : undefined
                }
                type="link"
              >
                {t("Sửa")}{" "}
              </Button>
            ) : (
              <span className="table-muted">{t("Chỉ xem")}</span>
            )}
            {canPromote && (
              <Popconfirm
                cancelText={t("Hủy")}
                description={t(
                  "Người này sẽ quản lý mọi chi nhánh, thanh toán và cấu hình tổ chức. Màn hình hiện tại không có thao tác thu hồi quyền này.",
                )}
                disabled={readOnly}
                okText={t("Trao quyền")}
                onConfirm={() => promoteGlobalAdmin(member)}
                okButtonProps={{ loading: pendingActions.has(actionKey("promote", member.membershipId)) }}
                title={t("Trao quyền quản trị toàn tổ chức?")}
              >
                <Button
                  disabled={readOnly}
                  loading={pendingActions.has(actionKey("promote", member.membershipId))}
                  type="link"
                >
                  {t("Trao quyền toàn tổ chức")}{" "}
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
      header: t("Người được mời"),
    },
    {
      accessorKey: "role",
      cell: ({ getValue }) =>
        userRoleLabels[getValue<TenantInvitation["role"]>()],
      header: t("Vai trò"),
      meta: { responsive: ["sm"] },
    },
    ...(showInvitationOrgUnitColumn
      ? [
          {
            accessorKey: "orgUnitId",
            cell: ({ getValue }) => {
              const orgUnitId = getValue<string | undefined>();
              return orgUnitId
                ? (orgUnitNames.get(orgUnitId) ??
                    t("Cơ sở không còn hoạt động"))
                : t("Chưa gắn cơ sở");
            },
            header: t("Cơ sở chính"),
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
      header: t("Trạng thái"),
      meta: { width: 150 },
    },
    {
      accessorKey: "expiresAt",
      cell: ({ getValue }) => dateTime.format(new Date(getValue<string>())),
      header: t("Hết hạn"),
      meta: { responsive: ["md"], width: 180 },
    },
    {
      cell: ({ row }) =>
        canManageInvitation(row.original.status) ? (
          <Space className="table-row-actions" size={0}>
            <Button
              disabled={readOnly || pendingActions.get(actionKey("invitation", row.original._id)) === "revoke"}
              loading={pendingActions.get(actionKey("invitation", row.original._id)) === "resend"}
              icon={<RedoOutlined />}
              onClick={() => void resend(row.original._id)}
              title={
                readOnly
                  ? t("Workspace đang ở chế độ chỉ đọc")
                  : t("Tạo liên kết mới và vô hiệu hóa liên kết cũ")
              }
              type="link"
            >
              {t("Gửi lại")}{" "}
            </Button>
            {row.original.status === "PENDING" && (
              <Popconfirm
                cancelText={t("Hủy")}
                disabled={readOnly || pendingActions.get(actionKey("invitation", row.original._id)) === "resend"}
                okText={t("Thu hồi")}
                onConfirm={() => revoke(row.original._id)}
                okButtonProps={{ loading: pendingActions.get(actionKey("invitation", row.original._id)) === "revoke" }}
                title={t("Thu hồi lời mời này?")}
              >
                <Button
                  danger
                  disabled={readOnly || pendingActions.get(actionKey("invitation", row.original._id)) === "resend"}
                  loading={pendingActions.get(actionKey("invitation", row.original._id)) === "revoke"}
                  icon={<StopOutlined />}
                  type="link"
                >
                  {t("Thu hồi")}{" "}
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
        title={t("Chỉ quản trị tổ chức được quản lý người dùng.")}
        type="warning"
      />
    );
  }

  return (
    <div className="page-shell">
      <div className="page-heading page-toolbar">
        <div className="page-heading-copy">
          <h1>{t("Người dùng")}</h1>
          <p>
            {t(
              "Quản lý thành viên hiện tại và mời người dùng tham gia workspace.",
            )}{" "}
          </p>
        </div>
        <Space className="page-toolbar-actions" wrap>
          {canLinkGuardians && <Button href="/guardians">{t("Liên kết phụ huynh – học viên")}</Button>}
          <Button disabled={readOnly} href="/users/import">
            {t("Nhập CSV")}{" "}
          </Button>
          <Button
            disabled={readOnly}
            icon={<PlusOutlined />}
            onClick={showCreateMember}
            title={
              readOnly ? t("Gia hạn thuê bao để tạo tài khoản") : undefined
            }
          >
            {t("Tạo tài khoản")}{" "}
          </Button>
          <Button
            disabled={readOnly}
            icon={<MailOutlined />}
            onClick={showInvitation}
            title={readOnly ? t("Gia hạn thuê bao để gửi lời mời") : undefined}
            type="primary"
          >
            {t("Gửi lời mời")}{" "}
          </Button>
        </Space>
      </div>
      {readOnly && (
        <Alert
          showIcon
          style={{ marginBottom: 18 }}
          title={t(
            "Workspace đang ở chế độ chỉ đọc; bạn vẫn có thể xem thành viên và lời mời.",
          )}
          type="warning"
        />
      )}
      {orgUnitsQuery.error && (
        <Alert
          showIcon
          style={{ marginBottom: 18 }}
          title={t(
            "Không tải được danh sách cơ sở; các thay đổi phân bổ cơ sở tạm thời chưa khả dụng.",
          )}
          type="warning"
        />
      )}
      <div className="list-filter-bar" role="search" aria-label={activeTab === "members" ? t("Bộ lọc thành viên") : t("Bộ lọc lời mời")}>
        <Input
          allowClear
          aria-label={activeTab === "members" ? t("Tìm thành viên") : t("Tìm lời mời")}
          onChange={(event) => setListFilters(current => ({ ...current, search: event.target.value }))}
          placeholder={t("Tìm theo tên hoặc email")}
          style={{ width: 280 }}
          type="search"
          value={listFilters.search}
        />
        <Select
          aria-label={t("Lọc vai trò")}
          onChange={(value: string) => setListFilters(current => ({ ...current, role: value }))}
          options={[{ label: t("Tất cả vai trò"), value: "" }, ...userRoleOptions]}
          style={{ width: 190 }}
          value={listFilters.role}
        />
        <Select
          aria-label={activeTab === "members" ? t("Lọc trạng thái thành viên") : t("Lọc trạng thái lời mời")}
          onChange={(value: string) => setListFilters(current => ({ ...current, status: value }))}
          options={[
            { label: t("Tất cả trạng thái"), value: "" },
            ...(activeTab === "members"
              ? [{ label: t("Hoạt động"), value: "ACTIVE" }, { label: t("Tạm ngưng"), value: "INACTIVE" }]
              : Object.entries(invitationStatus).map(([value, presentation]) => ({ value, label: presentation.label }))),
          ]}
          style={{ width: 190 }}
          value={listFilters.status}
        />
        <Button disabled={!listFilters.search && !listFilters.role && !listFilters.status} onClick={() => setListFilters({ search: "", role: "", status: "" })}>
          {t("Xóa bộ lọc")}
        </Button>
      </div>
      <Tabs
        activeKey={activeTab}
        items={[
          {
            children: usersQuery.error || pendingActions.has(actionKey("retry-users")) ? (
              <Alert
                action={<Button loading={usersQuery.isFetching || pendingActions.has(actionKey("retry-users"))} onClick={() => void runAction(actionKey("retry-users"), "retry", async () => { await usersQuery.refetch({ cancelRefetch: false }); })}>{t("Thử lại")}</Button>}
                showIcon
                title={
                  usersQuery.error instanceof Error
                    ? describeOperationsError(
                        usersQuery.error,
                        locale,
                        t("Không tải được thành viên"),
                      )
                    : t("Không tải được thành viên")
                }
                type="error"
              />
            ) : (
              <Card className="surface-card table-surface">
                <DataTable
                  ariaLabel={t("Danh sách thành viên")}
                  columns={memberColumns}
                  data={filteredMembers}
                  emptyText={memberFiltersActive ? t("Không có thành viên phù hợp") : t("Chưa có thành viên")}
                  loading={usersQuery.isFetching}
                  rowKey="membershipId"
                  paginationResetKey={JSON.stringify([normalizedMemberSearch, memberFilters.role, memberFilters.status])}
                  scrollX={900}
                />
              </Card>
            ),
            key: "members",
            label: t("Thành viên"),
          },
          {
            children: invitationsQuery.error || pendingActions.has(actionKey("retry-invitations")) ? (
              <Alert
                action={<Button loading={invitationsQuery.isFetching || pendingActions.has(actionKey("retry-invitations"))} onClick={() => void runAction(actionKey("retry-invitations"), "retry", async () => { await invitationsQuery.refetch({ cancelRefetch: false }); })}>{t("Thử lại")}</Button>}
                showIcon
                title={
                  invitationsQuery.error instanceof Error
                    ? describeOperationsError(
                        invitationsQuery.error,
                        locale,
                        t("Không tải được lời mời"),
                      )
                    : t("Không tải được lời mời")
                }
                type="error"
              />
            ) : (
              <Card className="surface-card table-surface">
                <DataTable
                  ariaLabel={t("Danh sách lời mời")}
                  columns={invitationColumns}
                  data={filteredInvitations}
                  emptyText={inviteFiltersActive ? t("Không có lời mời phù hợp") : t("Chưa có lời mời")}
                  loading={invitationsQuery.isFetching}
                  rowKey="_id"
                  paginationResetKey={JSON.stringify([normalizedInviteSearch, inviteFilters.role, inviteFilters.status])}
                  scrollX={980}
                />
              </Card>
            ),
            key: "invitations",
            label: t("Lời mời"),
          },
        ]}
        onChange={setActiveTab}
      />

      <Modal
        cancelText={t("Hủy")}
        cancelButtonProps={{ disabled: memberSaving }}
        closable={!memberSaving}
        confirmLoading={memberSaving}
        keyboard={!memberSaving}
        mask={{ closable: !memberSaving }}
        okText={editing ? t("Lưu thay đổi") : t("Tạo tài khoản")}
        onCancel={() => { if (!memberSaving) setMemberOpen(false); }}
        onOk={() => void saveMember()}
        open={memberOpen}
        title={editing ? t("Cập nhật thành viên") : t("Tạo tài khoản mới")}
      >
        {!editing && <Alert type="info" showIcon title={t("Tạo tài khoản mới cho tổ chức này. Nếu email đã có tài khoản DX LMS, hãy dùng Gửi lời mời.")} />}
        <Form
          disabled={memberSaving}
          form={memberForm}
          layout="vertical"
          requiredMark={false}
          style={{ marginTop: 22 }}
        >
          <Form.Item
            label={editing ? t("Tên hiển thị trong workspace") : t("Họ và tên")}
            name="fullName"
            rules={[{ required: true, min: 2, message: t("Nhập họ tên") }]}
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
                message: t("Email chưa hợp lệ"),
              },
            ]}
          >
            <Input disabled={Boolean(editing) || memberSaving} autoComplete="off" />
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
            <Select options={scopedRoleOptions} />
          </Form.Item>
          {memberRole === "GUARDIAN" && <p className="table-muted">{t("Với phụ huynh, chọn vai trò Phụ huynh rồi liên kết với học viên để cấp quyền xem thông tin.")}</p>}
          {hasOrgUnitPlacement && (
            <Form.Item
              getValueFromEvent={(value) => value ?? null}
              label={t("Cơ sở chính")}
              name="orgUnitId"
              rules={
                scopedAdmin
                  ? [
                      {
                        message: t("Chọn cơ sở quản lý thành viên"),
                        required: true,
                      },
                    ]
                  : undefined
              }
            >
              <Select
                allowClear={!scopedAdmin}
                loading={orgUnitsQuery.isLoading}
                options={orgUnitOptions}
                placeholder={
                  scopedAdmin
                    ? t("Chọn cơ sở trong phạm vi quản lý")
                    : t("Không gắn cơ sở (phù hợp mô hình solo)")
                }
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          )}
          {editing && (
            <Form.Item label={t("Trạng thái thành viên")} name="status">
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

      <Modal
        cancelText={t("Hủy")}
        cancelButtonProps={{ disabled: invitationSaving }}
        closable={!invitationSaving}
        confirmLoading={invitationSaving}
        keyboard={!invitationSaving}
        mask={{ closable: !invitationSaving }}
        okText={t("Tạo lời mời")}
        onCancel={() => { if (!invitationSaving) setInviteOpen(false); }}
        onOk={() => void createInvitation()}
        open={inviteOpen}
        title={t("Mời vào workspace")}
      >
        <Form
          disabled={invitationSaving}
          form={inviteForm}
          layout="vertical"
          requiredMark={false}
          style={{ marginTop: 22 }}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[
              {
                required: true,
                type: "email",
                message: t("Email chưa hợp lệ"),
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label={t("Tên hiển thị (không bắt buộc)")}
            name="displayName"
            rules={[{ min: 2, message: t("Tên cần ít nhất 2 ký tự") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label={t("Vai trò")}
            name="role"
            rules={[{ required: true }]}
          >
            <Select options={scopedRoleOptions} />
          </Form.Item>
          {(orgUnitOptions.length > 0 || scopedAdmin) && (
            <Form.Item
              label={t("Cơ sở chính")}
              name="orgUnitId"
              rules={
                scopedAdmin
                  ? [{ message: t("Chọn cơ sở cho lời mời"), required: true }]
                  : undefined
              }
            >
              <Select
                allowClear={!scopedAdmin}
                loading={orgUnitsQuery.isLoading}
                options={orgUnitOptions}
                placeholder={
                  scopedAdmin
                    ? t("Chọn cơ sở trong phạm vi quản lý")
                    : t("Không gắn cơ sở (không bắt buộc)")
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
        okText={t("Đóng")}
        onCancel={closeIssuedLink}
        onOk={closeIssuedLink}
        open={Boolean(issuedLink)}
        title={t("Liên kết lời mời một lần")}
      >
        <Alert
          description={t(
            "Chỉ liên kết mới nhất còn hiệu lực. Hãy gửi liên kết này qua kênh riêng cho người được mời.",
          )}
          showIcon
          style={{ marginBottom: 16 }}
          type="warning"
        />
        <Space.Compact block>
          <Input
            aria-label={t("Liên kết lời mời")}
            readOnly
            value={issuedLink}
          />
          <Button
            aria-label={t("Sao chép liên kết lời mời")}
            icon={<CopyOutlined />}
            onClick={() => void copyLink()}
            loading={pendingActions.has(actionKey("copy-link"))}
          >
            {t("Sao chép")}{" "}
          </Button>
        </Space.Compact>
      </Modal>
    </div>
  );
}

const usersMessages = { ...operationsMessages, ...userCreationMessages };

function useOperationsCopy() {
  const i18n = useI18n(usersMessages);
  return useI18nMemo(() => {
    const { t, locale } = i18n;
    const invitationStatus: Record<
      InvitationStatus,
      { color: string; label: string }
    > = {
      ACCEPTED: { color: "green", label: t("Đã chấp nhận") },
      CLAIMED: { color: "processing", label: t("Đang xác nhận") },
      EXPIRED: { color: "default", label: t("Đã hết hạn") },
      PENDING: { color: "gold", label: t("Đang chờ") },
      REVOKED: { color: "red", label: t("Đã thu hồi") },
    };

    const dateTime = new Intl.DateTimeFormat(
      locale === "en" ? "en-US" : "vi-VN",
      {
        dateStyle: "medium",
        timeStyle: "short",
      },
    );

    function invitationLink(response: InvitationIssueResponse): string {
      if (typeof window === "undefined") return response.acceptPath;
      return buildInvitationAcceptUrl(response, window.location.origin);
    }
    const translatedUserRoleLabels = Object.fromEntries(
      Object.entries(userRoleLabels).map(([key, label]) => [key, t(label)]),
    ) as typeof userRoleLabels;
    const translatedUserRoleOptions = userRoleOptions.map((option) => ({
      ...option,
      label: t(option.label),
    }));
    const translatedBuildUserOrgUnitOptions = (
      roots: Parameters<typeof buildUserOrgUnitOptions>[0],
    ) =>
      buildUserOrgUnitOptions(roots).map((option) => ({
        ...option,
        label: option.label.replace(
          / · (Chi nhánh|Phòng ban|Trung tâm)$/,
          (_match, label: string) => " · " + t(label),
        ),
      }));
    return {
      ...i18n,
      userRoleLabels: translatedUserRoleLabels,
      userRoleOptions: translatedUserRoleOptions,
      buildUserOrgUnitOptions: translatedBuildUserOrgUnitOptions,
      invitationStatus,
      dateTime,
      invitationLink,
    };
  }, [i18n]);
}
