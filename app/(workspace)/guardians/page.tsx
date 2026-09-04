"use client";

import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import {
  guardianApi,
  guardianDirectoryUserId,
  type CreateGuardianRelationshipInput,
  type GuardianRelationship,
  type GuardianRelationshipStatus,
  type GuardianRelationshipType,
  type UpdateGuardianRelationshipInput,
} from "@/lib/guardian-api";
import {
  getViewerScope,
  lmsQueryKeys,
  normalizeQueryFilters,
  type ViewerScope,
} from "@/lib/query-keys";

const relationshipTypeLabels: Record<GuardianRelationshipType, string> = {
  GUARDIAN: "Người giám hộ",
  OTHER: "Quan hệ khác",
  PARENT: "Cha/mẹ",
};

const relationshipTypeOptions = (
  Object.entries(relationshipTypeLabels) as Array<
    [GuardianRelationshipType, string]
  >
).map(([value, label]) => ({ label, value }));

const statusOptions: Array<{
  label: string;
  value: GuardianRelationshipStatus;
}> = [
  { label: "Đang hoạt động", value: "ACTIVE" },
  { label: "Đã lưu trữ", value: "INACTIVE" },
];

interface GuardianFormValues {
  canReceiveAcademicUpdates?: boolean;
  canReceiveBillingUpdates?: boolean;
  guardianId: string;
  learnerId: string;
  primaryContact?: boolean;
  relationshipType: GuardianRelationshipType;
}

interface EditGuardianFormValues {
  canReceiveAcademicUpdates?: boolean;
  canReceiveBillingUpdates?: boolean;
  primaryContact?: boolean;
  relationshipType: GuardianRelationshipType;
  status: GuardianRelationshipStatus;
}

function guardianRootKey(scope: ViewerScope) {
  return [...lmsQueryKeys.viewer(scope), "guardians"] as const;
}

function guardianRelationshipKey(
  scope: ViewerScope,
  input: {
    learnerId?: string;
    mode: string;
    status: GuardianRelationshipStatus;
  },
) {
  return [
    ...guardianRootKey(scope),
    "relationships",
    normalizeQueryFilters(input),
  ] as const;
}

function selectValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null) return "";
  const event = value as {
    currentTarget?: { value?: unknown };
    target?: { value?: unknown };
  };
  const candidate = event.currentTarget?.value ?? event.target?.value;
  return typeof candidate === "string" ? candidate : "";
}

function roleDescription(role?: string): string {
  if (role === "INSTRUCTOR") {
    return "Tra cứu người liên hệ đã đồng ý nhận cập nhật học tập của học viên.";
  }
  if (role === "LEARNER") {
    return "Xem người giám hộ và phạm vi cập nhật đang được liên kết với bạn.";
  }
  if (role === "GUARDIAN") {
    return "Xem các học viên và phạm vi cập nhật được liên kết với tài khoản của bạn.";
  }
  return "Quản lý mối liên hệ giữa học viên và phụ huynh hoặc người giám hộ.";
}

export default function GuardiansPage() {
  const { message } = App.useApp();
  const { effectiveAccess, organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>();
  const [status, setStatus] =
    useState<GuardianRelationshipStatus>("ACTIVE");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<GuardianRelationship | null>(null);

  const role = user?.role as string | undefined;
  const isTenantAdmin = role === "TENANT_ADMIN";
  const isInstructor = role === "INSTRUCTOR";
  const isLearner = role === "LEARNER";
  const isGuardian = role === "GUARDIAN";
  const supportedRole =
    isTenantAdmin || isInstructor || isLearner || isGuardian;
  const scope = getViewerScope(user, organization);
  const canLoad = Boolean(token && scope && supportedRole);
  const readOnly = effectiveAccess?.readOnly ?? false;
  const canManage = Boolean(isTenantAdmin && !readOnly);
  const effectiveStatus: GuardianRelationshipStatus = isInstructor
    ? "ACTIVE"
    : status;
  const targetLearnerId = isLearner ? user?.sub : selectedLearnerId;
  const relationshipCanLoad = Boolean(
    canLoad && (isGuardian || targetLearnerId),
  );
  const signedOutRoot = ["lms", "signed-out", "guardians"] as const;
  const rootKey = scope ? guardianRootKey(scope) : signedOutRoot;

  const directoryQuery = useQuery({
    enabled: Boolean(token && scope && (isTenantAdmin || isInstructor)),
    queryFn: ({ signal }) =>
      isTenantAdmin
        ? guardianApi.listDirectory({ token }, { signal })
        : guardianApi.listLearners({ token }, { signal }),
    queryKey: scope
      ? [
          ...guardianRootKey(scope),
          "directory",
          isTenantAdmin ? "all" : "learners",
        ]
      : [...signedOutRoot, "directory"],
  });

  const relationshipsQuery = useQuery({
    enabled: relationshipCanLoad,
    queryFn: ({ signal }) => {
      if (isGuardian) {
        return guardianApi.listForCurrentGuardian(
          { token },
          { status: effectiveStatus },
          { signal },
        );
      }
      if (!targetLearnerId) return Promise.resolve([]);
      return guardianApi.listByLearner(
        { token },
        targetLearnerId,
        { status: effectiveStatus },
        { signal },
      );
    },
    queryKey: scope
      ? guardianRelationshipKey(scope, {
          ...(targetLearnerId ? { learnerId: targetLearnerId } : {}),
          mode: isGuardian ? "guardian-me" : role ?? "unknown",
          status: effectiveStatus,
        })
      : [...signedOutRoot, "relationships"],
  });

  const refreshGuardians = () =>
    queryClient.invalidateQueries({ queryKey: rootKey });
  const createMutation = useMutation({
    mutationFn: (input: CreateGuardianRelationshipInput) =>
      guardianApi.create({ token }, input),
    onSuccess: async (relationship) => {
      setCreateOpen(false);
      setSelectedLearnerId(relationship.learnerId._id);
      setStatus("ACTIVE");
      message.success("Đã thêm quan hệ người giám hộ");
      await refreshGuardians();
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({
      input,
      relationshipId,
    }: {
      input: UpdateGuardianRelationshipInput;
      relationshipId: string;
    }) => guardianApi.update({ token }, relationshipId, input),
    onSuccess: async () => {
      setEditing(null);
      message.success("Đã cập nhật quan hệ người giám hộ");
      await refreshGuardians();
    },
  });
  const archiveMutation = useMutation({
    mutationFn: (relationshipId: string) =>
      guardianApi.archive({ token }, relationshipId),
    onSuccess: async () => {
      message.success("Đã lưu trữ quan hệ người giám hộ");
      await refreshGuardians();
    },
  });

  const directory = useMemo(
    () =>
      (directoryQuery.data ?? []).filter(
        (entry) =>
          entry.status === "ACTIVE" && entry.accountStatus === "ACTIVE",
      ),
    [directoryQuery.data],
  );
  const learners = useMemo(
    () => directory.filter((entry) => entry.role === "LEARNER"),
    [directory],
  );
  const guardians = useMemo(
    () => directory.filter((entry) => entry.role === "GUARDIAN"),
    [directory],
  );
  const learnerOptions = useMemo(
    () => [
      { label: "Chọn học viên", value: "" },
      ...learners.map((entry) => ({
        label: `${entry.fullName} · ${entry.email}`,
        value: guardianDirectoryUserId(entry),
      })),
    ],
    [learners],
  );
  const guardianOptions = useMemo(
    () =>
      guardians.map((entry) => ({
        label: `${entry.fullName} · ${entry.email}`,
        value: guardianDirectoryUserId(entry),
      })),
    [guardians],
  );
  const relationships = useMemo(
    () => relationshipsQuery.data ?? [],
    [relationshipsQuery.data],
  );
  const summary = useMemo(
    () => ({
      academic: relationships.filter(
        (relationship) => relationship.canReceiveAcademicUpdates,
      ).length,
      billing: relationships.filter(
        (relationship) => relationship.canReceiveBillingUpdates,
      ).length,
      primary: relationships.filter(
        (relationship) => relationship.primaryContact,
      ).length,
    }),
    [relationships],
  );

  const createRelationship = async (values: GuardianFormValues) => {
    try {
      await createMutation.mutateAsync({
        canReceiveAcademicUpdates: Boolean(values.canReceiveAcademicUpdates),
        canReceiveBillingUpdates: Boolean(values.canReceiveBillingUpdates),
        guardianId: values.guardianId,
        learnerId: values.learnerId,
        primaryContact: Boolean(values.primaryContact),
        relationshipType: values.relationshipType,
      });
    } catch (caught) {
      message.error(
        caught instanceof Error
          ? caught.message
          : "Không thể thêm người giám hộ",
      );
    }
  };

  const updateRelationship = async (values: EditGuardianFormValues) => {
    if (!editing) return;
    try {
      await updateMutation.mutateAsync({
        input: {
          canReceiveAcademicUpdates: Boolean(
            values.canReceiveAcademicUpdates,
          ),
          canReceiveBillingUpdates: Boolean(values.canReceiveBillingUpdates),
          primaryContact: Boolean(values.primaryContact),
          relationshipType: values.relationshipType,
          status: values.status,
        },
        relationshipId: editing._id,
      });
    } catch (caught) {
      message.error(
        caught instanceof Error
          ? caught.message
          : "Không thể cập nhật người giám hộ",
      );
    }
  };

  const archiveRelationship = async (relationshipId: string) => {
    try {
      await archiveMutation.mutateAsync(relationshipId);
    } catch (caught) {
      message.error(
        caught instanceof Error
          ? caught.message
          : "Không thể lưu trữ người giám hộ",
      );
    }
  };

  const canSeeBillingConsent = !isInstructor;
  const columns: ColumnsType<GuardianRelationship> = [
    {
      key: "learner",
      render: (_, relationship) => (
        <div>
          <strong>{relationship.learnerId.fullName}</strong>
          <div className="table-muted">{relationship.learnerId.email}</div>
        </div>
      ),
      responsive: ["md"],
      title: "Học viên",
    },
    {
      key: "guardian",
      render: (_, relationship) => (
        <div>
          <strong>{relationship.guardianId.fullName}</strong>
          <div className="table-muted">{relationship.guardianId.email}</div>
        </div>
      ),
      title: "Phụ huynh / người giám hộ",
    },
    {
      dataIndex: "relationshipType",
      key: "relationshipType",
      render: (value: GuardianRelationshipType) =>
        relationshipTypeLabels[value],
      responsive: ["sm"],
      title: "Quan hệ",
    },
    {
      key: "consents",
      render: (_, relationship) => (
        <Space wrap>
          {relationship.primaryContact && <Tag color="blue">Liên hệ chính</Tag>}
          {relationship.canReceiveAcademicUpdates && (
            <Tag color="green">Cập nhật học tập</Tag>
          )}
          {canSeeBillingConsent && relationship.canReceiveBillingUpdates && (
            <Tag color="gold">Cập nhật học phí</Tag>
          )}
          {!relationship.primaryContact &&
            !relationship.canReceiveAcademicUpdates &&
            (!canSeeBillingConsent ||
              !relationship.canReceiveBillingUpdates) && (
              <Typography.Text type="secondary">
                Chưa bật cập nhật
              </Typography.Text>
            )}
        </Space>
      ),
      title: "Phạm vi liên hệ",
    },
    {
      dataIndex: "status",
      key: "status",
      render: (value: GuardianRelationshipStatus) => (
        <Tag color={value === "ACTIVE" ? "green" : "default"}>
          {value === "ACTIVE" ? "Đang hoạt động" : "Đã lưu trữ"}
        </Tag>
      ),
      responsive: ["lg"],
      title: "Trạng thái",
    },
    ...(isTenantAdmin
      ? [
          {
            key: "actions",
            render: (_: unknown, relationship: GuardianRelationship) => (
              <Space wrap>
                <Button
                  aria-label={`Sửa quan hệ ${relationship.guardianId.fullName}`}
                  disabled={!canManage}
                  icon={<EditOutlined />}
                  onClick={() => setEditing(relationship)}
                  size="small"
                >
                  Sửa
                </Button>
                {relationship.status === "ACTIVE" && (
                  <Popconfirm
                    cancelText="Giữ quan hệ"
                    disabled={!canManage}
                    okText="Xác nhận lưu trữ"
                    onConfirm={() => archiveRelationship(relationship._id)}
                    title="Lưu trữ quan hệ người giám hộ này?"
                  >
                    <Button
                      aria-label={`Lưu trữ quan hệ ${relationship.guardianId.fullName}`}
                      danger
                      disabled={!canManage}
                      icon={<DeleteOutlined />}
                      loading={
                        archiveMutation.isPending &&
                        archiveMutation.variables === relationship._id
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
          },
        ]
      : []),
  ];

  if (!supportedRole) {
    return (
      <Alert
        showIcon
        title="Bạn không có quyền truy cập quan hệ người giám hộ."
        type="warning"
      />
    );
  }
  if (!scope) {
    return (
      <Alert
        showIcon
        title="Phiên làm việc thiếu phạm vi thành viên hợp lệ."
        type="error"
      />
    );
  }

  const requiresLearnerSelection = isTenantAdmin || isInstructor;

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <h1>Phụ huynh & người giám hộ</h1>
          <p>{roleDescription(role)}</p>
        </div>
        {isTenantAdmin && (
          <Button
            disabled={!canManage || learners.length === 0 || guardians.length === 0}
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
            title={
              readOnly
                ? "Workspace chỉ đọc"
                : guardians.length === 0
                  ? "Cần ít nhất một tài khoản người giám hộ hoạt động"
                  : undefined
            }
            type="primary"
          >
            Thêm người giám hộ
          </Button>
        )}
      </div>

      {!isTenantAdmin && (
        <Alert
          description={roleDescription(role)}
          showIcon
          title="Chế độ chỉ đọc"
          type="info"
        />
      )}
      {isTenantAdmin && readOnly && (
        <Alert
          description="Bạn vẫn có thể tra cứu dữ liệu; thêm, sửa và lưu trữ quan hệ đang tạm khóa."
          showIcon
          title="Workspace đang ở chế độ chỉ đọc"
          type="warning"
        />
      )}
      {directoryQuery.error && (
        <Alert
          action={
            <Button onClick={() => void directoryQuery.refetch()} size="small">
              Thử lại
            </Button>
          }
          description={
            directoryQuery.error instanceof Error
              ? directoryQuery.error.message
              : "Không thể tải danh sách người dùng"
          }
          showIcon
          title="Không tải được danh sách học viên"
          type="error"
        />
      )}
      {relationshipsQuery.error && (
        <Alert
          action={
            <Button
              onClick={() => void relationshipsQuery.refetch()}
              size="small"
            >
              Thử lại
            </Button>
          }
          description={
            relationshipsQuery.error instanceof Error
              ? relationshipsQuery.error.message
              : "Không thể tải quan hệ người giám hộ"
          }
          showIcon
          title="Không tải được quan hệ người giám hộ"
          type="error"
        />
      )}

      <Row gutter={[16, 16]}>
        <Col lg={canSeeBillingConsent ? 6 : 8} sm={12} xs={24}>
          <Card className="surface-card">
            <Statistic title="Quan hệ đang hiển thị" value={relationships.length} />
          </Card>
        </Col>
        <Col lg={canSeeBillingConsent ? 6 : 8} sm={12} xs={24}>
          <Card className="surface-card">
            <Statistic title="Liên hệ chính" value={summary.primary} />
          </Card>
        </Col>
        <Col lg={canSeeBillingConsent ? 6 : 8} sm={12} xs={24}>
          <Card className="surface-card">
            <Statistic title="Nhận cập nhật học tập" value={summary.academic} />
          </Card>
        </Col>
        {canSeeBillingConsent && (
          <Col lg={6} sm={12} xs={24}>
            <Card className="surface-card">
              <Statistic title="Nhận cập nhật học phí" value={summary.billing} />
            </Card>
          </Col>
        )}
      </Row>

      <Card className="surface-card" title="Danh sách quan hệ">
        <Space wrap>
          {requiresLearnerSelection && (
            <Select<string>
              aria-label="Chọn học viên để tra cứu"
              loading={directoryQuery.isLoading}
              onChange={(nextValue) => {
                setSelectedLearnerId(selectValue(nextValue) || undefined);
              }}
              optionFilterProp="label"
              options={learnerOptions}
              showSearch
              value={selectedLearnerId ?? ""}
            />
          )}
          {!isInstructor && (
            <Select<GuardianRelationshipStatus>
              aria-label="Lọc trạng thái quan hệ"
              onChange={(nextValue) =>
                setStatus(
                  selectValue(nextValue) as GuardianRelationshipStatus,
                )
              }
              options={statusOptions}
              value={status}
            />
          )}
          {isInstructor && (
            <Tag color="blue">Đã đồng ý nhận cập nhật học tập</Tag>
          )}
        </Space>

        {requiresLearnerSelection && !selectedLearnerId ? (
          directoryQuery.isLoading ? (
            <div aria-label="Đang tải danh sách học viên" className="page-loading" role="status">
              <Spin size="large" />
            </div>
          ) : (
            <Empty
              description="Chọn một học viên để xem quan hệ người giám hộ"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )
        ) : (
          <Table<GuardianRelationship>
            columns={columns}
            dataSource={relationships}
            loading={relationshipsQuery.isLoading}
            locale={{
              emptyText: (
                <Empty
                  description="Chưa có quan hệ người giám hộ phù hợp"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
            pagination={false}
            rowKey="_id"
            scroll={{ x: 900 }}
          />
        )}
      </Card>

      <Modal
        destroyOnHidden
        footer={null}
        onCancel={() => setCreateOpen(false)}
        open={createOpen}
        title="Thêm người giám hộ"
      >
        <Form<GuardianFormValues>
          initialValues={{
            canReceiveAcademicUpdates: true,
            canReceiveBillingUpdates: false,
            learnerId: selectedLearnerId,
            primaryContact: false,
            relationshipType: "PARENT",
          }}
          layout="vertical"
          onFinish={(values) => void createRelationship(values)}
          preserve={false}
        >
          <Form.Item
            label="Học viên"
            name="learnerId"
            rules={[{ required: true, message: "Chọn học viên" }]}
          >
            <Select
              optionFilterProp="label"
              options={learnerOptions.slice(1)}
              placeholder="Chọn học viên"
              showSearch
            />
          </Form.Item>
          <Form.Item
            label="Phụ huynh / người giám hộ"
            name="guardianId"
            rules={[{ required: true, message: "Chọn người giám hộ" }]}
          >
            <Select
              optionFilterProp="label"
              options={guardianOptions}
              placeholder="Chọn tài khoản người giám hộ"
              showSearch
            />
          </Form.Item>
          <Form.Item
            label="Mối quan hệ"
            name="relationshipType"
            rules={[{ required: true, message: "Chọn mối quan hệ" }]}
          >
            <Select options={relationshipTypeOptions} />
          </Form.Item>
          <Form.Item name="primaryContact" valuePropName="checked">
            <Checkbox>Đặt làm liên hệ chính</Checkbox>
          </Form.Item>
          <Form.Item
            name="canReceiveAcademicUpdates"
            valuePropName="checked"
          >
            <Checkbox>Nhận cập nhật học tập</Checkbox>
          </Form.Item>
          <Form.Item name="canReceiveBillingUpdates" valuePropName="checked">
            <Checkbox>Nhận cập nhật học phí</Checkbox>
          </Form.Item>
          <Space>
            <Button onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button
              htmlType="submit"
              loading={createMutation.isPending}
              type="primary"
            >
              Lưu quan hệ
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        destroyOnHidden
        footer={null}
        key={editing?._id ?? "edit-guardian"}
        onCancel={() => setEditing(null)}
        open={Boolean(editing)}
        title="Sửa quan hệ người giám hộ"
      >
        {editing && (
          <Form<EditGuardianFormValues>
            initialValues={{
              canReceiveAcademicUpdates:
                editing.canReceiveAcademicUpdates,
              canReceiveBillingUpdates:
                editing.canReceiveBillingUpdates ?? false,
              primaryContact: editing.primaryContact,
              relationshipType: editing.relationshipType,
              status: editing.status,
            }}
            layout="vertical"
            onFinish={(values) => void updateRelationship(values)}
            preserve={false}
          >
            <Alert
              description={`${editing.learnerId.fullName} · ${editing.guardianId.fullName}`}
              showIcon
              title="Quan hệ đang chỉnh sửa"
              type="info"
            />
            <Form.Item
              label="Mối quan hệ"
              name="relationshipType"
              rules={[{ required: true, message: "Chọn mối quan hệ" }]}
            >
              <Select options={relationshipTypeOptions} />
            </Form.Item>
            <Form.Item
              label="Trạng thái"
              name="status"
              rules={[{ required: true, message: "Chọn trạng thái" }]}
            >
              <Select options={statusOptions} />
            </Form.Item>
            <Form.Item name="primaryContact" valuePropName="checked">
              <Checkbox>Đặt làm liên hệ chính</Checkbox>
            </Form.Item>
            <Form.Item
              name="canReceiveAcademicUpdates"
              valuePropName="checked"
            >
              <Checkbox>Nhận cập nhật học tập</Checkbox>
            </Form.Item>
            <Form.Item
              name="canReceiveBillingUpdates"
              valuePropName="checked"
            >
              <Checkbox>Nhận cập nhật học phí</Checkbox>
            </Form.Item>
            <Space>
              <Button onClick={() => setEditing(null)}>Hủy</Button>
              <Button
                htmlType="submit"
                loading={updateMutation.isPending}
                type="primary"
              >
                Lưu thay đổi
              </Button>
            </Space>
          </Form>
        )}
      </Modal>
    </div>
  );
}
