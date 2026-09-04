"use client";

import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import {
  communicationsApi,
  communicationsQueryKeys,
  type Announcement,
  type AnnouncementAudience,
  type AnnouncementListQuery,
  type AnnouncementRecipientRole,
  type AnnouncementStatus,
  type CreateAnnouncementInput,
  type UpdateAnnouncementInput,
} from "@/lib/communications-api";
import { cohortApi, cohortQueryKeys } from "@/lib/cohort-api";
import {
  orgUnitQueryKeys,
  orgUnitsApi,
  type OrgUnitTreeNode,
} from "@/lib/org-units-api";
import { getViewerScope, type ViewerScope } from "@/lib/query-keys";

const AUDIENCE_PRESENTATION: Record<
  AnnouncementAudience,
  { color: string; label: string }
> = {
  COHORT: { color: "purple", label: "Lớp học" },
  ORG_UNIT: { color: "blue", label: "Đơn vị" },
  TENANT: { color: "gold", label: "Toàn trung tâm" },
};
const STATUS_PRESENTATION: Record<
  AnnouncementStatus,
  { color: string; label: string }
> = {
  ARCHIVED: { color: "default", label: "Đã lưu trữ" },
  DRAFT: { color: "orange", label: "Bản nháp" },
  PUBLISHED: { color: "green", label: "Đã phát hành" },
};
const RECIPIENT_LABELS: Record<AnnouncementRecipientRole, string> = {
  GUARDIAN: "Phụ huynh",
  INSTRUCTOR: "Giảng viên",
  LEARNER: "Học viên",
  TENANT_ADMIN: "Quản trị viên",
};
const ADMIN_RECIPIENTS = Object.keys(
  RECIPIENT_LABELS,
) as AnnouncementRecipientRole[];
const INSTRUCTOR_RECIPIENTS: AnnouncementRecipientRole[] = [
  "LEARNER",
  "GUARDIAN",
];
const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

interface AnnouncementDraft {
  audience: AnnouncementAudience;
  body: string;
  cohortId: string;
  orgUnitId: string;
  recipientRoles: AnnouncementRecipientRole[];
  title: string;
}

interface CommunicationsViewProps {
  readOnly: boolean;
  role: AnnouncementRecipientRole;
  scope: ViewerScope;
  token: string;
}

type SaveRequest =
  | { input: CreateAnnouncementInput; kind: "create" }
  | {
      announcementId: string;
      input: UpdateAnnouncementInput;
      kind: "update";
    };

function CommunicationsView({
  readOnly,
  role,
  scope,
  token,
}: CommunicationsViewProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isTenantAdmin = role === "TENANT_ADMIN";
  const isInstructor = role === "INSTRUCTOR";
  const isManager = isTenantAdmin || isInstructor;
  const canManage = isManager && !readOnly;
  const [status, setStatus] = useState<AnnouncementStatus>();
  const [audience, setAudience] = useState<AnnouncementAudience>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [draft, setDraft] = useState<AnnouncementDraft>(() =>
    emptyDraft(isInstructor),
  );

  const filters = useMemo<AnnouncementListQuery>(
    () => ({ ...(audience ? { audience } : {}), ...(status ? { status } : {}) }),
    [audience, status],
  );
  const announcementsQuery = useQuery({
    queryFn: ({ signal }) =>
      communicationsApi.list({ token }, filters, { signal }),
    queryKey: communicationsQueryKeys.list(scope, filters),
  });
  const cohortsQuery = useQuery({
    enabled: isManager,
    queryFn: ({ signal }) => cohortApi.listCohorts({ token }, {}, { signal }),
    queryKey: cohortQueryKeys.list(scope),
  });
  const orgUnitsQuery = useQuery({
    enabled: isTenantAdmin,
    queryFn: ({ signal }) => orgUnitsApi.tree({ token }, false, { signal }),
    queryKey: orgUnitQueryKeys.tree(scope, false),
  });

  const cohorts = useMemo(
    () => (cohortsQuery.data ?? []).filter((item) => item.status !== "ARCHIVED"),
    [cohortsQuery.data],
  );
  const orgUnits = useMemo(
    () => flattenOrgUnits(orgUnitsQuery.data?.items ?? []),
    [orgUnitsQuery.data?.items],
  );
  const cohortNames = useMemo(
    () => new Map(cohorts.map((item) => [item._id, item.name])),
    [cohorts],
  );
  const orgUnitNames = useMemo(
    () => new Map(orgUnits.map((item) => [item._id, item.name])),
    [orgUnits],
  );

  const invalidateAnnouncements = () =>
    queryClient.invalidateQueries({
      queryKey: communicationsQueryKeys.root(scope),
    });
  const saveMutation = useMutation({
    mutationFn: (request: SaveRequest) => {
      if (!canManage) {
        throw new Error("Workspace hiện không cho phép thay đổi thông báo");
      }
      return request.kind === "create"
        ? communicationsApi.create({ token }, request.input)
        : communicationsApi.update(
            { token },
            request.announcementId,
            request.input,
          );
    },
    onError: (error) =>
      message.error(errorMessage(error, "Không thể lưu thông báo")),
    onSuccess: async (_, request) => {
      setModalOpen(false);
      setEditing(null);
      message.success(
        request.kind === "create"
          ? "Đã tạo bản nháp thông báo"
          : "Đã cập nhật thông báo",
      );
      await invalidateAnnouncements();
    },
  });
  const publishMutation = useMutation({
    mutationFn: (announcement: Announcement) => {
      if (!canManage) throw new Error("Workspace đang ở chế độ chỉ đọc");
      return communicationsApi.publish({ token }, announcement._id);
    },
    onError: (error) =>
      message.error(errorMessage(error, "Không thể phát hành thông báo")),
    onSuccess: async () => {
      message.success("Đã phát hành thông báo");
      await invalidateAnnouncements();
    },
  });
  const archiveMutation = useMutation({
    mutationFn: (announcement: Announcement) => {
      if (!canManage) throw new Error("Workspace đang ở chế độ chỉ đọc");
      return communicationsApi.archive({ token }, announcement._id);
    },
    onError: (error) =>
      message.error(errorMessage(error, "Không thể lưu trữ thông báo")),
    onSuccess: async () => {
      message.success("Đã lưu trữ thông báo");
      await invalidateAnnouncements();
    },
  });

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft(isInstructor));
    setModalOpen(true);
  };
  const openEdit = (announcement: Announcement) => {
    const allowedRoles = isInstructor ? INSTRUCTOR_RECIPIENTS : ADMIN_RECIPIENTS;
    setEditing(announcement);
    setDraft({
      audience: isInstructor ? "COHORT" : announcement.audience,
      body: announcement.body,
      cohortId: announcement.cohortId ?? "",
      orgUnitId: announcement.orgUnitId ?? "",
      recipientRoles: announcement.recipientRoles.filter((item) =>
        allowedRoles.includes(item),
      ),
      title: announcement.title,
    });
    setModalOpen(true);
  };
  const saveAnnouncement = () => {
    if (!canManage) return;
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title || !body) {
      message.error("Vui lòng nhập tiêu đề và nội dung thông báo");
      return;
    }
    if (draft.recipientRoles.length === 0) {
      message.error("Vui lòng chọn ít nhất một nhóm người nhận");
      return;
    }
    if (draft.audience === "COHORT" && !draft.cohortId) {
      message.error("Vui lòng chọn lớp nhận thông báo");
      return;
    }
    if (draft.audience === "ORG_UNIT" && !draft.orgUnitId) {
      message.error("Vui lòng chọn đơn vị nhận thông báo");
      return;
    }
    if (
      isInstructor &&
      (draft.audience !== "COHORT" ||
        draft.recipientRoles.some(
          (item) => !INSTRUCTOR_RECIPIENTS.includes(item),
        ))
    ) {
      message.error("Giảng viên chỉ được gửi cho học viên hoặc phụ huynh của lớp");
      return;
    }

    const common = {
      audience: draft.audience,
      body,
      recipientRoles: [...draft.recipientRoles],
      title,
    };
    if (editing) {
      saveMutation.mutate({
        announcementId: editing._id,
        input: {
          ...common,
          cohortId: draft.audience === "COHORT" ? draft.cohortId : null,
          orgUnitId: draft.audience === "ORG_UNIT" ? draft.orgUnitId : null,
        },
        kind: "update",
      });
      return;
    }
    saveMutation.mutate({
      input: {
        ...common,
        ...(draft.audience === "COHORT" ? { cohortId: draft.cohortId } : {}),
        ...(draft.audience === "ORG_UNIT"
          ? { orgUnitId: draft.orgUnitId }
          : {}),
      },
      kind: "create",
    });
  };

  const columns: ColumnsType<Announcement> = (() => {
    const result: ColumnsType<Announcement> = [
      {
        key: "content",
        render: (_, item) => (
          <div>
            <strong>{item.title}</strong>
            <Typography.Paragraph
              ellipsis={{ rows: 2 }}
              style={{ marginBottom: 0, maxWidth: 480, whiteSpace: "pre-wrap" }}
            >
              {item.body}
            </Typography.Paragraph>
          </div>
        ),
        title: "Thông báo",
      },
      {
        key: "audience",
        render: (_, item) => (
          <div>
            <Tag color={AUDIENCE_PRESENTATION[item.audience].color}>
              {AUDIENCE_PRESENTATION[item.audience].label}
            </Tag>
            <div className="table-muted">
              {targetLabel(item, cohortNames, orgUnitNames)}
            </div>
          </div>
        ),
        title: "Phạm vi",
      },
      {
        key: "recipients",
        render: (_, item) => (
          <Space size={[4, 4]} wrap>
            {item.recipientRoles.map((recipientRole) => (
              <Tag key={recipientRole}>{RECIPIENT_LABELS[recipientRole]}</Tag>
            ))}
          </Space>
        ),
        title: "Người nhận",
      },
      {
        key: "status",
        render: (_, item) => (
          <div>
            <Tag color={STATUS_PRESENTATION[item.status].color}>
              {STATUS_PRESENTATION[item.status].label}
            </Tag>
            <div className="table-muted">
              {item.status === "PUBLISHED"
                ? formatDateTime(item.publishedAt)
                : formatDateTime(item.updatedAt ?? item.createdAt)}
            </div>
          </div>
        ),
        title: "Trạng thái",
      },
    ];

    if (canManage) {
      result.push({
        key: "actions",
        render: (_, item) => (
          <Space>
            {item.status === "DRAFT" && (
              <>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => openEdit(item)}
                  size="small"
                >
                  Chỉnh sửa
                </Button>
                <Popconfirm
                  okText="Xác nhận phát hành"
                  onConfirm={() => publishMutation.mutateAsync(item)}
                  title="Phát hành thông báo này?"
                >
                  <Button
                    icon={<SendOutlined />}
                    loading={
                      publishMutation.isPending &&
                      publishMutation.variables?._id === item._id
                    }
                    size="small"
                    type="primary"
                  >
                    Phát hành
                  </Button>
                </Popconfirm>
              </>
            )}
            {item.status !== "ARCHIVED" && (
              <Popconfirm
                okText="Xác nhận lưu trữ"
                onConfirm={() => archiveMutation.mutateAsync(item)}
                title="Lưu trữ thông báo này?"
              >
                <Button
                  loading={
                    archiveMutation.isPending &&
                    archiveMutation.variables?._id === item._id
                  }
                  size="small"
                >
                  Lưu trữ
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
        title: "Thao tác",
      });
    }
    return result;
  })();

  const directoryError = cohortsQuery.error ?? orgUnitsQuery.error;
  const announcements = announcementsQuery.data ?? [];
  const recipientOptions = (isInstructor
    ? INSTRUCTOR_RECIPIENTS
    : ADMIN_RECIPIENTS
  ).map((value) => ({ label: RECIPIENT_LABELS[value], value }));

  return (
    <main aria-labelledby="communications-title" className="page-shell">
      <header className="page-heading">
        <div className="page-heading-copy">
          <h1 id="communications-title">Thông báo trung tâm</h1>
          <p>
            Gửi và theo dõi thông báo theo toàn trung tâm, đơn vị hoặc từng lớp
            học.
          </p>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            loading={announcementsQuery.isFetching}
            onClick={() => void announcementsQuery.refetch()}
          >
            Làm mới
          </Button>
          {isManager && (
            <Button
              disabled={!canManage}
              icon={<PlusOutlined />}
              onClick={openCreate}
              title={readOnly ? "Workspace đang ở chế độ chỉ đọc" : undefined}
              type="primary"
            >
              Tạo thông báo
            </Button>
          )}
        </Space>
      </header>

      {readOnly && isManager && (
        <Alert
          description="Bạn vẫn xem được thông báo, nhưng không thể tạo, sửa, phát hành hoặc lưu trữ."
          showIcon
          title="Workspace chỉ đọc"
          type="info"
        />
      )}
      {!isManager && (
        <Alert
          description="Thông báo đã phát hành cho vai trò và lớp học của bạn được hiển thị tại đây."
          showIcon
          title="Nội dung chỉ đọc"
          type="info"
        />
      )}

      <Card className="surface-card" title="Bộ lọc">
        <Space wrap>
          <Select
            allowClear
            aria-label="Lọc trạng thái thông báo"
            onChange={setStatus}
            options={(Object.keys(STATUS_PRESENTATION) as AnnouncementStatus[]).map(
              (value) => ({ label: STATUS_PRESENTATION[value].label, value }),
            )}
            placeholder="Mọi trạng thái"
            style={{ minWidth: 190 }}
            value={status}
          />
          <Select
            allowClear
            aria-label="Lọc phạm vi thông báo"
            onChange={setAudience}
            options={(Object.keys(AUDIENCE_PRESENTATION) as AnnouncementAudience[]).map(
              (value) => ({ label: AUDIENCE_PRESENTATION[value].label, value }),
            )}
            placeholder="Mọi phạm vi"
            style={{ minWidth: 190 }}
            value={audience}
          />
        </Space>
      </Card>

      {directoryError && isManager && (
        <Alert
          action={
            <Button
              onClick={() => {
                void cohortsQuery.refetch();
                if (isTenantAdmin) void orgUnitsQuery.refetch();
              }}
            >
              Tải lại danh mục
            </Button>
          }
          description="Danh sách thông báo vẫn dùng được, nhưng tên lớp hoặc đơn vị có thể tạm hiển thị bằng mã."
          showIcon
          title="Không tải đủ danh mục người nhận"
          type="warning"
        />
      )}
      {announcementsQuery.error && (
        <Alert
          action={
            <Button onClick={() => void announcementsQuery.refetch()}>
              Thử lại
            </Button>
          }
          description={errorMessage(
            announcementsQuery.error,
            "Không thể tải danh sách thông báo",
          )}
          showIcon
          title="Không tải được thông báo"
          type="error"
        />
      )}

      <Card className="surface-card table-surface">
        {!announcementsQuery.isLoading &&
        !announcementsQuery.error &&
        announcements.length === 0 ? (
          <Empty description="Chưa có thông báo phù hợp bộ lọc" />
        ) : (
          <Table<Announcement>
            columns={columns}
            dataSource={announcements}
            loading={announcementsQuery.isLoading}
            pagination={false}
            rowKey="_id"
            scroll={{ x: canManage ? 1050 : 800 }}
          />
        )}
      </Card>

      <Modal
        cancelText="Hủy"
        confirmLoading={saveMutation.isPending}
        destroyOnHidden
        okButtonProps={{ disabled: !canManage }}
        okText="Lưu thông báo"
        onCancel={() => setModalOpen(false)}
        onOk={saveAnnouncement}
        open={modalOpen}
        title={editing ? "Sửa thông báo" : "Tạo thông báo"}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <label>
            <Typography.Text strong>Tiêu đề</Typography.Text>
            <Input
              aria-label="Tiêu đề thông báo"
              maxLength={160}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Ví dụ: Điều chỉnh lịch học cuối tuần"
              value={draft.title}
            />
          </label>
          <label>
            <Typography.Text strong>Nội dung</Typography.Text>
            <Input.TextArea
              aria-label="Nội dung thông báo"
              maxLength={5000}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  body: event.target.value,
                }))
              }
              placeholder="Viết nội dung ngắn gọn, có thời gian và hành động cần thiết."
              rows={6}
              showCount
              value={draft.body}
            />
          </label>
          <label>
            <Typography.Text strong>Phạm vi</Typography.Text>
            <Select
              aria-label="Phạm vi nhận thông báo"
              disabled={isInstructor}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  audience: value,
                  cohortId: "",
                  orgUnitId: "",
                }))
              }
              options={(isInstructor
                ? (["COHORT"] as AnnouncementAudience[])
                : (Object.keys(AUDIENCE_PRESENTATION) as AnnouncementAudience[])
              ).map((value) => ({
                label: AUDIENCE_PRESENTATION[value].label,
                value,
              }))}
              style={{ width: "100%" }}
              value={draft.audience}
            />
          </label>
          {draft.audience === "COHORT" && (
            <label>
              <Typography.Text strong>Lớp học</Typography.Text>
              <Select
                aria-label="Lớp nhận thông báo"
                loading={cohortsQuery.isLoading}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, cohortId: value }))
                }
                optionFilterProp="label"
                options={cohorts.map((item) => ({
                  label: `${item.name} · ${item.code}`,
                  value: item._id,
                }))}
                placeholder="Chọn lớp"
                showSearch
                style={{ width: "100%" }}
                value={draft.cohortId || undefined}
              />
            </label>
          )}
          {draft.audience === "ORG_UNIT" && (
            <label>
              <Typography.Text strong>Đơn vị</Typography.Text>
              <Select
                aria-label="Đơn vị nhận thông báo"
                loading={orgUnitsQuery.isLoading}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, orgUnitId: value }))
                }
                optionFilterProp="label"
                options={orgUnits.map((item) => ({
                  label: item.path.join(" / ") + " · " + item.name,
                  value: item._id,
                }))}
                placeholder="Chọn đơn vị"
                showSearch
                style={{ width: "100%" }}
                value={draft.orgUnitId || undefined}
              />
            </label>
          )}
          <label>
            <Typography.Text strong>Nhóm người nhận</Typography.Text>
            <Select<AnnouncementRecipientRole[]>
              aria-label="Nhóm người nhận"
              mode="multiple"
              onChange={(values) =>
                setDraft((current) => ({
                  ...current,
                  recipientRoles: values,
                }))
              }
              options={recipientOptions}
              placeholder="Chọn ít nhất một nhóm"
              style={{ width: "100%" }}
              value={draft.recipientRoles}
            />
          </label>
          {isInstructor && (
            <Alert
              description="Giảng viên chỉ có thể gửi thông báo đến học viên hoặc phụ huynh của lớp mình phụ trách."
              showIcon
              type="info"
            />
          )}
        </Space>
      </Modal>
    </main>
  );
}

export default function CommunicationsPage() {
  const { effectiveAccess, organization, token, user } = useAuth();
  const scope = getViewerScope(user, organization);
  const role = user?.role;

  if (!isCommunicationRole(role)) {
    return (
      <Alert
        showIcon
        title="Thông báo trung tâm chỉ dành cho thành viên của tổ chức."
        type="error"
      />
    );
  }
  if (!token || !scope) {
    return (
      <Alert
        showIcon
        title="Phiên thành viên không hợp lệ. Vui lòng đăng nhập lại."
        type="error"
      />
    );
  }

  const readOnly = effectiveAccess?.readOnly ?? false;
  const authorityKey = `${scope.tenantId}:${scope.membershipId}:${scope.viewerId}:${scope.role}:${readOnly ? "READ_ONLY" : "WRITABLE"}`;
  return (
    <CommunicationsView
      key={authorityKey}
      readOnly={readOnly}
      role={role}
      scope={scope}
      token={token}
    />
  );
}

function emptyDraft(isInstructor: boolean): AnnouncementDraft {
  return {
    audience: isInstructor ? "COHORT" : "TENANT",
    body: "",
    cohortId: "",
    orgUnitId: "",
    recipientRoles: [...INSTRUCTOR_RECIPIENTS],
    title: "",
  };
}

function isCommunicationRole(
  role: string | undefined,
): role is AnnouncementRecipientRole {
  return (
    role === "TENANT_ADMIN" ||
    role === "INSTRUCTOR" ||
    role === "LEARNER" ||
    role === "GUARDIAN"
  );
}

function flattenOrgUnits(roots: OrgUnitTreeNode[]): OrgUnitTreeNode[] {
  return roots.flatMap((unit) => [unit, ...flattenOrgUnits(unit.children)]);
}

function targetLabel(
  item: Announcement,
  cohortNames: Map<string, string>,
  orgUnitNames: Map<string, string>,
): string {
  if (item.audience === "TENANT") return "Mọi thành viên phù hợp vai trò";
  if (item.audience === "COHORT") {
    return item.cohortId
      ? cohortNames.get(item.cohortId) ?? item.cohortId
      : `${item.resolvedCohortIds.length} lớp đã xác định`;
  }
  return item.orgUnitId
    ? orgUnitNames.get(item.orgUnitId) ?? item.orgUnitId
    : `${item.resolvedCohortIds.length} lớp đã xác định`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : dateTime.format(parsed);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
