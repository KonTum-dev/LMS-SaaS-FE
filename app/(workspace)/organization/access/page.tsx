"use client";
import { describeOperationsError } from "@/lib/i18n/operations-errors";
import { useI18n } from "@/components/i18n/i18n-provider";
import { operationsMessages } from "@/lib/i18n/operations-messages";
import { useMemo as useI18nMemo } from "react";

import { useFeedback } from "@/components/feedback/feedback-provider";

import { EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Empty,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import { ApiError, apiFetch } from "@/lib/api";
import {
  orgUnitAccessApi,
  orgUnitAccessQueryKeys,
  type CreateOrgUnitAssignmentInput,
  type OrgUnitAccessLevel,
  type OrgUnitAssignment,
  type OrgUnitAssignmentMembership,
  type OrgUnitAssignmentOrgUnit,
  type OrgUnitAssignmentQuery,
  type OrgUnitAssignmentStatus,
  type UpdateOrgUnitAssignmentInput,
} from "@/lib/org-unit-access-api";
import {
  orgUnitQueryKeys,
  orgUnitsApi,
  type OrgUnitTreeNode,
} from "@/lib/org-units-api";
import {
  getViewerScope,
  lmsQueryKeys,
  type ViewerScope,
} from "@/lib/query-keys";
import type { TenantMember } from "@/lib/types";

interface AssignmentFormState {
  accessLevel: OrgUnitAccessLevel;
  includeDescendants: boolean;
  membershipId: string;
  orgUnitId: string;
}

interface AccessViewProps {
  isTenantAdmin: boolean;
  readOnly: boolean;
  scope: ViewerScope;
  token: string;
}

type SaveRequest =
  | { input: CreateOrgUnitAssignmentInput; kind: "create" }
  | {
      assignmentId: string;
      input: UpdateOrgUnitAssignmentInput;
      kind: "update";
    };

const EMPTY_FORM: AssignmentFormState = {
  accessLevel: "VIEWER",
  includeDescendants: false,
  membershipId: "",
  orgUnitId: "",
};

function OrgUnitAccessView({
  isTenantAdmin,
  readOnly,
  scope,
  token,
}: AccessViewProps) {
  const {
    t,
    ACCESS_PRESENTATION,
    STATUS_PRESENTATION,
    ROLE_LABELS,
    flattenOrgUnits,
    orgUnitReferenceId,
    membershipReferenceId,
    orgUnitPresentation,
    memberPresentation,
    scopeUnitNames,
    errorMessage,
  } = useOperationsCopy();
  const { message, reportError } = useFeedback();
  const queryClient = useQueryClient();
  const [orgUnitId, setOrgUnitId] = useState<string>();
  const [membershipId, setMembershipId] = useState<string>();
  const [accessLevel, setAccessLevel] = useState<OrgUnitAccessLevel>();
  const [status, setStatus] = useState<OrgUnitAssignmentStatus>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrgUnitAssignment | null>(null);
  const [form, setForm] = useState<AssignmentFormState>(EMPTY_FORM);

  const filters = useMemo<OrgUnitAssignmentQuery>(
    () => ({
      ...(accessLevel ? { accessLevel } : {}),
      ...(membershipId ? { membershipId } : {}),
      ...(orgUnitId ? { orgUnitId } : {}),
      ...(status ? { status } : {}),
    }),
    [accessLevel, membershipId, orgUnitId, status],
  );
  const meQuery = useQuery({
    queryFn: ({ signal }) => orgUnitAccessApi.me({ token }, { signal }),
    queryKey: orgUnitAccessQueryKeys.me(scope),
  });
  const assignmentsQuery = useQuery({
    enabled: isTenantAdmin,
    queryFn: ({ signal }) =>
      orgUnitAccessApi.list({ token }, filters, { signal }),
    queryKey: orgUnitAccessQueryKeys.list(scope, filters),
  });
  const listForbidden =
    assignmentsQuery.error instanceof ApiError &&
    assignmentsQuery.error.status === 403;
  const managementBlocked = meQuery.data?.scoped === true || listForbidden;
  const canManage = Boolean(
    isTenantAdmin &&
    !readOnly &&
    meQuery.data?.scoped === false &&
    !assignmentsQuery.error,
  );

  const orgUnitsQuery = useQuery({
    queryFn: ({ signal }) => orgUnitsApi.tree({ token }, false, { signal }),
    queryKey: orgUnitQueryKeys.tree(scope, false),
  });
  const membersQuery = useQuery({
    enabled: isTenantAdmin && meQuery.data?.scoped === false && !listForbidden,
    queryFn: ({ signal }) =>
      apiFetch<TenantMember[]>("/users", {
        cache: "no-store",
        signal,
        token,
      }),
    queryKey: lmsQueryKeys.users(scope),
  });
  const orgUnits = useMemo(
    () =>
      flattenOrgUnits(orgUnitsQuery.data?.items ?? []).filter(
        (unit) => unit.status === "ACTIVE",
      ),
    [flattenOrgUnits, orgUnitsQuery.data?.items],
  );
  const members = useMemo(
    () =>
      (membersQuery.data ?? []).filter((member) => member.status === "ACTIVE"),
    [membersQuery.data],
  );
  const orgUnitNames = useMemo(
    () => new Map(orgUnits.map((unit) => [unit._id, unit.name])),
    [orgUnits],
  );
  const memberDirectory = useMemo(
    () => new Map(members.map((member) => [member.membershipId, member])),
    [members],
  );

  const invalidateAssignments = () =>
    queryClient.invalidateQueries({
      queryKey: orgUnitAccessQueryKeys.root(scope),
    });
  const saveMutation = useMutation({
    mutationFn: (request: SaveRequest) => {
      if (!canManage) {
        throw new Error(
          t("Tài khoản này không thể thay đổi phân quyền chi nhánh"),
        );
      }
      return request.kind === "create"
        ? orgUnitAccessApi.create({ token }, request.input)
        : orgUnitAccessApi.update(
            { token },
            request.assignmentId,
            request.input,
          );
    },
    onError: (error) => reportError(error, "Không thể lưu phân quyền"),
    onSuccess: async (_, request) => {
      setModalOpen(false);
      setEditing(null);
      message.success(
        request.kind === "create"
          ? "Đã cấp quyền chi nhánh"
          : "Đã cập nhật quyền chi nhánh",
      );
      await invalidateAssignments();
    },
  });
  const archiveMutation = useMutation({
    mutationFn: (assignment: OrgUnitAssignment) => {
      if (!canManage) {
        throw new Error(
          t("Tài khoản này không thể thu hồi phân quyền chi nhánh"),
        );
      }
      return orgUnitAccessApi.archive(
        { token },
        assignment._id,
        assignment.revision,
      );
    },
    onError: (error) => reportError(error, "Không thể thu hồi phân quyền"),
    onSuccess: async () => {
      message.success("Đã thu hồi quyền chi nhánh");
      await invalidateAssignments();
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };
  const openEdit = (assignment: OrgUnitAssignment) => {
    setEditing(assignment);
    setForm({
      accessLevel: assignment.accessLevel,
      includeDescendants: assignment.includeDescendants,
      membershipId: membershipReferenceId(assignment.membershipId),
      orgUnitId: orgUnitReferenceId(assignment.orgUnitId),
    });
    setModalOpen(true);
  };
  const saveAssignment = () => {
    if (!canManage) return;
    if (editing) {
      saveMutation.mutate({
        assignmentId: editing._id,
        input: {
          accessLevel: form.accessLevel,
          expectedRevision: editing.revision,
          includeDescendants: form.includeDescendants,
        },
        kind: "update",
      });
      return;
    }
    if (!form.orgUnitId || !form.membershipId) {
      message.error("Vui lòng chọn đơn vị và thành viên cần cấp quyền");
      return;
    }
    saveMutation.mutate({
      input: {
        accessLevel: form.accessLevel,
        includeDescendants: form.includeDescendants,
        membershipId: form.membershipId,
        orgUnitId: form.orgUnitId,
      },
      kind: "create",
    });
  };
  const clearFilters = () => {
    setAccessLevel(undefined);
    setMembershipId(undefined);
    setOrgUnitId(undefined);
    setStatus(undefined);
  };

  const columns: ColumnsType<OrgUnitAssignment> = [
    {
      key: "member",
      render: (_, assignment) => {
        const member = memberPresentation(
          assignment.membershipId,
          memberDirectory,
        );
        return (
          <div>
            <strong>{member.name}</strong>
            <div className="table-muted">
              {member.email || member.role || t("Thành viên tổ chức")}
            </div>
          </div>
        );
      },
      title: t("Thành viên"),
    },
    {
      key: "orgUnit",
      render: (_, assignment) => {
        const unit = orgUnitPresentation(assignment.orgUnitId, orgUnitNames);
        return (
          <div>
            <strong>{unit.name}</strong>
            <div className="table-muted">{unit.code}</div>
          </div>
        );
      },
      title: t("Đơn vị"),
    },
    {
      key: "access",
      render: (_, assignment) => (
        <Space size={4} wrap>
          <Tag color={ACCESS_PRESENTATION[assignment.accessLevel].color}>
            {ACCESS_PRESENTATION[assignment.accessLevel].label}
          </Tag>
          {assignment.includeDescendants && <Tag>{t("Bao gồm cấp dưới")}</Tag>}
        </Space>
      ),
      title: t("Mức quyền"),
    },
    {
      key: "status",
      render: (_, assignment) => (
        <div>
          <Tag color={STATUS_PRESENTATION[assignment.status].color}>
            {STATUS_PRESENTATION[assignment.status].label}
          </Tag>
          <div className="table-muted">
            {t("Phiên bản")} {assignment.revision}
          </div>
        </div>
      ),
      title: t("Trạng thái"),
    },
    ...(canManage
      ? ([
          {
            key: "actions",
            render: (_: unknown, assignment: OrgUnitAssignment) =>
              assignment.status === "ACTIVE" ? (
                <Space>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => openEdit(assignment)}
                    size="small"
                  >
                    {t("Chỉnh sửa")}{" "}
                  </Button>
                  <Popconfirm
                    okText={t("Xác nhận thu hồi")}
                    onConfirm={() => archiveMutation.mutateAsync(assignment)}
                    title={t("Thu hồi quyền tại đơn vị này?")}
                  >
                    <Button
                      danger
                      loading={
                        archiveMutation.isPending &&
                        archiveMutation.variables?._id === assignment._id
                      }
                      size="small"
                    >
                      {t("Thu hồi")}{" "}
                    </Button>
                  </Popconfirm>
                </Space>
              ) : null,
            title: t("Thao tác"),
          },
        ] satisfies ColumnsType<OrgUnitAssignment>)
      : []),
  ];

  const directoryError = orgUnitsQuery.error ?? membersQuery.error;
  const assignments = assignmentsQuery.data ?? [];
  const me = meQuery.data;

  return (
    <main aria-labelledby="org-unit-access-title" className="page-shell">
      <header className="page-heading">
        <div className="page-heading-copy">
          <h1 id="org-unit-access-title">{t("Phân quyền chi nhánh")}</h1>
          <p>
            {t(
              "Giới hạn phạm vi vận hành của thành viên theo đơn vị và các cấp trực thuộc.",
            )}{" "}
          </p>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            loading={meQuery.isFetching || assignmentsQuery.isFetching}
            onClick={() => {
              void meQuery.refetch();
              if (isTenantAdmin) void assignmentsQuery.refetch();
            }}
          >
            {t("Làm mới")}{" "}
          </Button>
          {isTenantAdmin && (
            <Button
              disabled={!canManage}
              icon={<PlusOutlined />}
              onClick={openCreate}
              title={
                managementBlocked ? t("Không thể tự mở rộng quyền") : undefined
              }
              type="primary"
            >
              {t("Cấp quyền")}{" "}
            </Button>
          )}
        </Space>
      </header>

      {readOnly && isTenantAdmin && (
        <Alert
          description={t(
            "Bạn vẫn xem được phân quyền hiện tại, nhưng không thể cấp, sửa hoặc thu hồi quyền.",
          )}
          showIcon
          title={t("Workspace chỉ đọc")}
          type="info"
        />
      )}
      {managementBlocked && isTenantAdmin && (
        <Alert
          description={t(
            "Tài khoản quản trị này đang bị giới hạn theo chi nhánh. Để tránh tự nâng quyền, bạn không thể xem danh sách toàn cục, cấp thêm hoặc mở rộng phạm vi; hãy liên hệ một quản trị viên toàn cục.",
          )}
          showIcon
          title={t("Không thể tự mở rộng quyền chi nhánh")}
          type="error"
        />
      )}
      {!isTenantAdmin && (
        <Alert
          description={t(
            "Giảng viên có thể xem phạm vi được cấp cho chính mình; chỉ quản trị viên toàn cục mới được thay đổi phân quyền.",
          )}
          showIcon
          title={t("Phạm vi chỉ đọc")}
          type="info"
        />
      )}

      <Card
        className="surface-card"
        title={t("Phạm vi của tài khoản hiện tại")}
      >
        {meQuery.isLoading ? (
          <Skeleton active />
        ) : meQuery.error ? (
          <Alert
            action={
              <Button onClick={() => void meQuery.refetch()}>
                {t("Thử lại")}
              </Button>
            }
            description={errorMessage(
              meQuery.error,
              t("Không thể tải phạm vi hiện tại"),
            )}
            showIcon
            title={t("Không xác định được phạm vi truy cập")}
            type="error"
          />
        ) : me ? (
          <Space size="large" wrap>
            <div>
              <Typography.Text type="secondary">
                {t("Trạng thái")}
              </Typography.Text>
              <div>
                <Tag color={me.scoped ? "blue" : "green"}>
                  {me.scoped ? t("Giới hạn theo đơn vị") : t("Toàn tổ chức")}
                </Tag>
              </div>
            </div>
            <div>
              <Typography.Text type="secondary">
                {t("Mức quyền cao nhất")}
              </Typography.Text>
              <div>
                {me.highestAccessLevel
                  ? ACCESS_PRESENTATION[me.highestAccessLevel].label
                  : t("Quyền toàn cục")}
              </div>
            </div>
            <div>
              <Typography.Text type="secondary">
                {t("Đơn vị hiệu lực")}
              </Typography.Text>
              <div>{scopeUnitNames(me.orgUnitIds, orgUnitNames)}</div>
            </div>
          </Space>
        ) : null}
      </Card>

      {isTenantAdmin && !managementBlocked && (
        <>
          <Card className="surface-card" title={t("Bộ lọc phân quyền")}>
            <Space wrap>
              <Select
                allowClear
                aria-label={t("Lọc theo đơn vị")}
                loading={orgUnitsQuery.isLoading}
                onChange={setOrgUnitId}
                optionFilterProp="label"
                options={orgUnits.map((unit) => ({
                  label: unit.path.join(" / ") + " · " + unit.name,
                  value: unit._id,
                }))}
                placeholder={t("Mọi đơn vị")}
                showSearch
                style={{ minWidth: 220 }}
                value={orgUnitId}
              />
              <Select
                allowClear
                aria-label={t("Lọc theo thành viên")}
                loading={membersQuery.isLoading}
                onChange={setMembershipId}
                optionFilterProp="label"
                options={members.map((member) => ({
                  label: `${member.fullName} · ${member.email}`,
                  value: member.membershipId,
                }))}
                placeholder={t("Mọi thành viên")}
                showSearch
                style={{ minWidth: 240 }}
                value={membershipId}
              />
              <Select
                allowClear
                aria-label={t("Lọc theo mức quyền")}
                onChange={setAccessLevel}
                options={(
                  Object.keys(ACCESS_PRESENTATION) as OrgUnitAccessLevel[]
                ).map((value) => ({
                  label: ACCESS_PRESENTATION[value].label,
                  value,
                }))}
                placeholder={t("Mọi mức quyền")}
                style={{ minWidth: 170 }}
                value={accessLevel}
              />
              <Select
                allowClear
                aria-label={t("Lọc theo trạng thái")}
                onChange={setStatus}
                options={(
                  Object.keys(STATUS_PRESENTATION) as OrgUnitAssignmentStatus[]
                ).map((value) => ({
                  label: STATUS_PRESENTATION[value].label,
                  value,
                }))}
                placeholder={t("Mọi trạng thái")}
                style={{ minWidth: 170 }}
                value={status}
              />
              <Button onClick={clearFilters}>{t("Xóa lọc")}</Button>
            </Space>
          </Card>

          {directoryError && (
            <Alert
              action={
                <Button
                  onClick={() => {
                    void orgUnitsQuery.refetch();
                    void membersQuery.refetch();
                  }}
                >
                  {t("Tải lại danh mục")}{" "}
                </Button>
              }
              description={t(
                "Chưa thể tải đủ đơn vị hoặc thành viên để cấp quyền mới. Danh sách hiện tại vẫn có thể xem bằng dữ liệu trả về từ máy chủ.",
              )}
              showIcon
              title={t("Không tải đủ danh mục phân quyền")}
              type="warning"
            />
          )}
          {assignmentsQuery.error && !listForbidden && (
            <Alert
              action={
                <Button onClick={() => void assignmentsQuery.refetch()}>
                  {t("Thử lại")}{" "}
                </Button>
              }
              description={errorMessage(
                assignmentsQuery.error,
                t("Không thể tải danh sách phân quyền"),
              )}
              showIcon
              title={t("Không tải được phân quyền chi nhánh")}
              type="error"
            />
          )}

          <Card className="surface-card table-surface">
            {!assignmentsQuery.isLoading &&
            !assignmentsQuery.error &&
            assignments.length === 0 ? (
              <Empty description={t("Chưa có phân quyền phù hợp bộ lọc")} />
            ) : (
              <Table<OrgUnitAssignment>
                columns={columns}
                dataSource={assignments}
                loading={assignmentsQuery.isLoading}
                pagination={false}
                rowKey="_id"
                scroll={{ x: canManage ? 920 : 720 }}
              />
            )}
          </Card>
        </>
      )}

      <Modal
        cancelText={t("Hủy")}
        confirmLoading={saveMutation.isPending}
        destroyOnHidden
        okButtonProps={{ disabled: !canManage }}
        okText={t("Lưu phân quyền")}
        onCancel={() => setModalOpen(false)}
        onOk={saveAssignment}
        open={modalOpen}
        title={editing ? t("Sửa phân quyền") : t("Cấp quyền chi nhánh")}
      >
        <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
          {!editing && (
            <>
              <label>
                <Typography.Text strong>{t("Đơn vị")}</Typography.Text>
                <Select
                  aria-label={t("Đơn vị cần cấp quyền")}
                  loading={orgUnitsQuery.isLoading}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, orgUnitId: value }))
                  }
                  optionFilterProp="label"
                  options={orgUnits.map((unit) => ({
                    label: unit.path.join(" / ") + " · " + unit.name,
                    value: unit._id,
                  }))}
                  placeholder={t("Chọn đơn vị")}
                  showSearch
                  style={{ width: "100%" }}
                  value={form.orgUnitId || undefined}
                />
              </label>
              <label>
                <Typography.Text strong>{t("Thành viên")}</Typography.Text>
                <Select
                  aria-label={t("Thành viên cần cấp quyền")}
                  loading={membersQuery.isLoading}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, membershipId: value }))
                  }
                  optionFilterProp="label"
                  options={members.map((member) => ({
                    label: `${member.fullName} · ${ROLE_LABELS[member.role]} · ${member.email}`,
                    value: member.membershipId,
                  }))}
                  placeholder={t("Chọn thành viên")}
                  showSearch
                  style={{ width: "100%" }}
                  value={form.membershipId || undefined}
                />
              </label>
            </>
          )}
          {editing && (
            <Alert
              description={t("{value0} · {value1} · phiên bản {value2}", {
                value0: memberPresentation(
                  editing.membershipId,
                  memberDirectory,
                ).name,
                value1: orgUnitPresentation(editing.orgUnitId, orgUnitNames)
                  .name,
                value2: editing.revision,
              })}
              showIcon
              title={t("Đang cập nhật phân quyền hiện có")}
              type="info"
            />
          )}
          <label>
            <Typography.Text strong>{t("Mức quyền")}</Typography.Text>
            <Select
              aria-label={t("Mức quyền chi nhánh")}
              onChange={(value) =>
                setForm((current) => ({ ...current, accessLevel: value }))
              }
              options={(
                Object.keys(ACCESS_PRESENTATION) as OrgUnitAccessLevel[]
              ).map((value) => ({
                label: ACCESS_PRESENTATION[value].label,
                value,
              }))}
              style={{ width: "100%" }}
              value={form.accessLevel}
            />
          </label>
          <Space>
            <Switch
              aria-label={t("Áp dụng cho đơn vị cấp dưới")}
              checked={form.includeDescendants}
              onChange={(checked) =>
                setForm((current) => ({
                  ...current,
                  includeDescendants: checked,
                }))
              }
            />
            <div>
              <strong>{t("Bao gồm đơn vị cấp dưới")}</strong>
              <div className="table-muted">
                {t(
                  "Quyền này cũng có hiệu lực với các phòng ban hoặc chi nhánh con.",
                )}{" "}
              </div>
            </div>
          </Space>
        </Space>
      </Modal>
    </main>
  );
}

export default function OrgUnitAccessPage() {
  const { t } = useOperationsCopy();
  const { effectiveAccess, organization, token, user } = useAuth();
  const scope = getViewerScope(user, organization);
  const supportedRole =
    user?.role === "TENANT_ADMIN" || user?.role === "INSTRUCTOR";

  if (!supportedRole) {
    return (
      <Alert
        showIcon
        title={t(
          "Phân quyền chi nhánh chỉ dành cho quản trị viên và giảng viên.",
        )}
        type="error"
      />
    );
  }
  if (!token || !scope) {
    return (
      <Alert
        showIcon
        title={t("Phiên thành viên không hợp lệ. Vui lòng đăng nhập lại.")}
        type="error"
      />
    );
  }

  const readOnly = effectiveAccess?.readOnly ?? false;
  const authorityKey = `${scope.tenantId}:${scope.membershipId}:${scope.viewerId}:${scope.role}:${readOnly ? "READ_ONLY" : "WRITABLE"}`;
  return (
    <OrgUnitAccessView
      isTenantAdmin={user?.role === "TENANT_ADMIN"}
      key={authorityKey}
      readOnly={readOnly}
      scope={scope}
      token={token}
    />
  );
}

function useOperationsCopy() {
  const i18n = useI18n(operationsMessages);
  return useI18nMemo(() => {
    const { t, locale } = i18n;
    const ACCESS_PRESENTATION: Record<
      OrgUnitAccessLevel,
      { color: string; label: string }
    > = {
      MANAGER: { color: "purple", label: t("Quản lý") },
      STAFF: { color: "blue", label: t("Nhân sự") },
      VIEWER: { color: "default", label: t("Chỉ xem") },
    };

    const STATUS_PRESENTATION: Record<
      OrgUnitAssignmentStatus,
      { color: string; label: string }
    > = {
      ACTIVE: { color: "green", label: t("Hoạt động") },
      ARCHIVED: { color: "default", label: t("Đã lưu trữ") },
    };

    const ROLE_LABELS: Record<TenantMember["role"], string> = {
      GUARDIAN: t("Phụ huynh"),
      INSTRUCTOR: t("Giảng viên"),
      LEARNER: t("Học viên"),
      TENANT_ADMIN: t("Quản trị viên"),
    };

    function flattenOrgUnits(roots: OrgUnitTreeNode[]): OrgUnitTreeNode[] {
      return roots.flatMap((unit) => [unit, ...flattenOrgUnits(unit.children)]);
    }

    function orgUnitReferenceId(
      reference: string | OrgUnitAssignmentOrgUnit,
    ): string {
      return typeof reference === "string" ? reference : reference._id;
    }

    function membershipReferenceId(
      reference: string | OrgUnitAssignmentMembership,
    ): string {
      return typeof reference === "string" ? reference : reference._id;
    }

    function orgUnitPresentation(
      reference: string | OrgUnitAssignmentOrgUnit,
      directory: Map<string, string>,
    ): { code: string; name: string } {
      if (typeof reference !== "string") {
        return { code: reference.code, name: reference.name };
      }
      return {
        code: reference,
        name: directory.get(reference) ?? t("Đơn vị được cấp quyền"),
      };
    }

    function memberPresentation(
      reference: string | OrgUnitAssignmentMembership,
      directory: Map<string, TenantMember>,
    ): { email: string; name: string; role: string } {
      if (typeof reference !== "string") {
        const user =
          typeof reference.userId === "string" ? null : reference.userId;
        return {
          email: user?.email ?? "",
          name:
            reference.displayName || user?.fullName || t("Thành viên tổ chức"),
          role: ROLE_LABELS[reference.role],
        };
      }
      const member = directory.get(reference);
      return {
        email: member?.email ?? "",
        name: member?.fullName ?? t("Thành viên tổ chức"),
        role: member ? ROLE_LABELS[member.role] : reference,
      };
    }

    function scopeUnitNames(
      orgUnitIds: string[] | null,
      directory: Map<string, string>,
    ): string {
      if (orgUnitIds === null) return t("Tất cả đơn vị");
      if (orgUnitIds.length === 0) return t("Chưa có đơn vị");
      return orgUnitIds
        .map((orgUnitId) => directory.get(orgUnitId) ?? orgUnitId)
        .join(", ");
    }

    function errorMessage(error: unknown, fallback: string): string {
      return error instanceof Error && error.message
        ? describeOperationsError(error, locale, fallback)
        : fallback;
    }
    return {
      ...i18n,
      ACCESS_PRESENTATION,
      STATUS_PRESENTATION,
      ROLE_LABELS,
      flattenOrgUnits,
      orgUnitReferenceId,
      membershipReferenceId,
      orgUnitPresentation,
      memberPresentation,
      scopeUnitNames,
      errorMessage,
    };
  }, [i18n]);
}
