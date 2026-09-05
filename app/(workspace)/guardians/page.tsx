"use client";
import { describeOperationsError } from "@/lib/i18n/operations-errors";
import { useI18n } from "@/components/i18n/i18n-provider";
import { operationsPolishMessages as operationsMessages } from "@/lib/i18n/learning-polish-messages";
import { userCreationMessages } from "@/components/users/user-creation-messages";
import { useMemo as useI18nMemo } from "react";

import { useFeedback } from "@/components/feedback/feedback-provider";

import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Checkbox, Empty, Modal, Popconfirm, Select, Space, Spin, Table, Tag, Typography } from "antd";
import { Form } from "@/components/form/localized-form";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useRef, useState } from "react";
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

export default function GuardiansPage() {
  const {
    t,
    relationshipTypeLabels,
    relationshipTypeOptions,
    statusOptions,
    guardianRootKey,
    guardianRelationshipKey,
    selectValue,
    roleDescription,
    locale,
  } = useOperationsCopy();
  const { message, reportError } = useFeedback();
  const { effectiveAccess, organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>();
  const [status, setStatus] = useState<GuardianRelationshipStatus>("ACTIVE");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<GuardianRelationship | null>(null);
  const mutationLock = useRef(false);
  const [mutationPending, setMutationPending] = useState(false);

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
  const canManage = Boolean(token && scope && isTenantAdmin && !readOnly);
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
          mode: isGuardian ? "guardian-me" : (role ?? "unknown"),
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
      { label: t("Chọn học viên"), value: "" },
      ...learners.map((entry) => ({
        label: `${entry.fullName} · ${entry.email}`,
        value: guardianDirectoryUserId(entry),
      })),
    ],
    [learners, t],
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

  const runRelationshipMutation = async (
    operation: () => Promise<unknown>,
    fallback: string,
  ) => {
    // Lock synchronously: form submits can repeat before React paints loading.
    // Conflicting edits are dropped, never queued with an outdated consent value.
    if (!canManage || mutationLock.current) return;
    mutationLock.current = true;
    setMutationPending(true);
    try {
      await operation();
    } catch (caught) {
      reportError(caught, fallback);
    } finally {
      mutationLock.current = false;
      setMutationPending(false);
    }
  };

  const createRelationship = (values: GuardianFormValues) =>
    runRelationshipMutation(
      () => createMutation.mutateAsync({
        canReceiveAcademicUpdates: Boolean(values.canReceiveAcademicUpdates),
        canReceiveBillingUpdates: Boolean(values.canReceiveBillingUpdates),
        guardianId: values.guardianId,
        learnerId: values.learnerId,
        primaryContact: Boolean(values.primaryContact),
        relationshipType: values.relationshipType,
      }),
      "Không thể thêm người giám hộ",
    );

  const updateRelationship = async (values: EditGuardianFormValues) => {
    if (!editing) return;
    return runRelationshipMutation(
      () => updateMutation.mutateAsync({
        input: {
          canReceiveAcademicUpdates: Boolean(values.canReceiveAcademicUpdates),
          canReceiveBillingUpdates: Boolean(values.canReceiveBillingUpdates),
          primaryContact: Boolean(values.primaryContact),
          relationshipType: values.relationshipType,
          status: values.status,
        },
        relationshipId: editing._id,
      }),
      "Không thể cập nhật người giám hộ",
    );
  };

  const archiveRelationship = (relationshipId: string) =>
    runRelationshipMutation(
      () => archiveMutation.mutateAsync(relationshipId),
      "Không thể lưu trữ người giám hộ",
    );

  const closeCreate = () => {
    if (!mutationLock.current) setCreateOpen(false);
  };
  const closeEdit = () => {
    if (!mutationLock.current) setEditing(null);
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
      title: t("Học viên"),
    },
    {
      key: "guardian",
      render: (_, relationship) => (
        <div>
          <strong>{relationship.guardianId.fullName}</strong>
          <div className="table-muted">{relationship.guardianId.email}</div>
        </div>
      ),
      title: t("Phụ huynh / người giám hộ"),
    },
    {
      dataIndex: "relationshipType",
      key: "relationshipType",
      render: (value: GuardianRelationshipType) =>
        relationshipTypeLabels[value],
      responsive: ["sm"],
      title: t("Quan hệ"),
    },
    {
      key: "consents",
      render: (_, relationship) => (
        <Space wrap>
          {relationship.primaryContact && (
            <Tag color="blue">{t("Liên hệ chính")}</Tag>
          )}
          {relationship.canReceiveAcademicUpdates && (
            <Tag color="green">{t("Cập nhật học tập")}</Tag>
          )}
          {canSeeBillingConsent && relationship.canReceiveBillingUpdates && (
            <Tag color="gold">{t("Cập nhật học phí")}</Tag>
          )}
          {!relationship.primaryContact &&
            !relationship.canReceiveAcademicUpdates &&
            (!canSeeBillingConsent ||
              !relationship.canReceiveBillingUpdates) && (
              <Typography.Text type="secondary">
                {t("Chưa bật cập nhật")}{" "}
              </Typography.Text>
            )}
        </Space>
      ),
      title: t("Phạm vi liên hệ"),
    },
    {
      dataIndex: "status",
      key: "status",
      render: (value: GuardianRelationshipStatus) => (
        <Tag color={value === "ACTIVE" ? "green" : "default"}>
          {value === "ACTIVE" ? t("Đang hoạt động") : t("Đã lưu trữ")}
        </Tag>
      ),
      responsive: ["lg"],
      title: t("Trạng thái"),
    },
    ...(isTenantAdmin
      ? [
          {
            key: "actions",
            render: (_: unknown, relationship: GuardianRelationship) => (
              <Space wrap>
                <Button
                  aria-label={t("Sửa quan hệ {value0}", {
                    value0: relationship.guardianId.fullName,
                  })}
                  disabled={!canManage || mutationPending}
                  icon={<EditOutlined />}
                  onClick={() => {
                    if (canManage && !mutationLock.current) setEditing(relationship);
                  }}
                  size="small"
                >
                  {t("Sửa")}{" "}
                </Button>
                {relationship.status === "ACTIVE" && (
                  <Popconfirm
                    cancelText={t("Giữ quan hệ")}
                    disabled={!canManage || mutationPending}
                    okText={t("Xác nhận lưu trữ")}
                    onConfirm={() => archiveRelationship(relationship._id)}
                    title={t("Lưu trữ quan hệ người giám hộ này?")}
                  >
                    <Button
                      aria-label={t("Lưu trữ quan hệ {value0}", {
                        value0: relationship.guardianId.fullName,
                      })}
                      danger
                      disabled={!canManage || mutationPending}
                      icon={<DeleteOutlined />}
                      loading={
                        archiveMutation.isPending &&
                        archiveMutation.variables === relationship._id
                      }
                      size="small"
                    >
                      {t("Lưu trữ")}{" "}
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            ),
            title: t("Thao tác"),
          },
        ]
      : []),
  ];

  if (!supportedRole) {
    return (
      <Alert
        showIcon
        title={t("Bạn không có quyền truy cập quan hệ người giám hộ.")}
        type="warning"
      />
    );
  }
  if (!scope) {
    return (
      <Alert
        showIcon
        title={t("Phiên làm việc thiếu phạm vi thành viên hợp lệ.")}
        type="error"
      />
    );
  }

  const requiresLearnerSelection = isTenantAdmin || isInstructor;

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <h1>{t("Phụ huynh & người giám hộ")}</h1>
          <p>{roleDescription(role)}</p>
        </div>
        {isTenantAdmin && (
          <Button
            disabled={
              !canManage || mutationPending || learners.length === 0 || guardians.length === 0
            }
            icon={<PlusOutlined />}
            onClick={() => {
              if (canManage && !mutationLock.current) setCreateOpen(true);
            }}
            title={
              readOnly
                ? t("Workspace chỉ đọc")
                : guardians.length === 0
                  ? t("Cần ít nhất một tài khoản người giám hộ hoạt động")
                  : undefined
            }
            type="primary"
          >
            {t("Thêm người giám hộ")}{" "}
          </Button>
        )}
      </div>

      {isTenantAdmin && effectiveAccess?.modules.includes("USERS") && (
        <Alert
          type="info"
          showIcon
          title={t("Tạo hoặc mời tài khoản có vai trò Phụ huynh trong mục Người dùng, sau đó liên kết với học viên tại đây.")}
          action={<Button href="/users">{t("Tài khoản phụ huynh")}</Button>}
        />
      )}

      {isTenantAdmin && readOnly && (
        <Alert
          description={t(
            "Bạn vẫn có thể tra cứu dữ liệu; thêm, sửa và lưu trữ quan hệ đang tạm khóa.",
          )}
          showIcon
          title={t("Workspace đang ở chế độ chỉ đọc")}
          type="warning"
        />
      )}
      {directoryQuery.error && (
        <Alert
          action={
            <Button loading={directoryQuery.isFetching} onClick={() => void directoryQuery.refetch()} size="small">
              {t("Thử lại")}{" "}
            </Button>
          }
          description={
            directoryQuery.error instanceof Error
              ? describeOperationsError(
                  directoryQuery.error,
                  locale,
                  t("Không thể tải danh sách người dùng"),
                )
              : t("Không thể tải danh sách người dùng")
          }
          showIcon
          title={t("Không tải được danh sách học viên")}
          type="error"
        />
      )}
      {relationshipsQuery.error && (
        <Alert
          action={
            <Button
              loading={relationshipsQuery.isFetching}
              onClick={() => void relationshipsQuery.refetch()}
              size="small"
            >
              {t("Thử lại")}{" "}
            </Button>
          }
          description={
            relationshipsQuery.error instanceof Error
              ? describeOperationsError(
                  relationshipsQuery.error,
                  locale,
                  t("Không thể tải quan hệ người giám hộ"),
                )
              : t("Không thể tải quan hệ người giám hộ")
          }
          showIcon
          title={t("Không tải được quan hệ người giám hộ")}
          type="error"
        />
      )}

      <Card className="surface-card table-surface" title={t("Danh sách quan hệ")} extra={<Typography.Text type="secondary">{t("{count} quan hệ", { count: relationships.length })}</Typography.Text>}>
        <div className="list-filter-bar admin-list-toolbar">
          {requiresLearnerSelection && (
            <Select<string>
              aria-label={t("Chọn học viên để tra cứu")}
              disabled={mutationPending}
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
              aria-label={t("Lọc trạng thái quan hệ")}
              disabled={mutationPending}
              onChange={(nextValue) =>
                setStatus(selectValue(nextValue) as GuardianRelationshipStatus)
              }
              options={statusOptions}
              value={status}
            />
          )}
          {isInstructor && (
            <Tag color="blue">{t("Đã đồng ý nhận cập nhật học tập")}</Tag>
          )}
        </div>

        {requiresLearnerSelection && !selectedLearnerId ? (
          directoryQuery.isLoading ? (
            <div
              aria-label={t("Đang tải danh sách học viên")}
              className="page-loading"
              role="status"
            >
              <Spin size="large" />
            </div>
          ) : (
            <Empty
              description={t("Chọn một học viên để xem quan hệ người giám hộ")}
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
                  description={t("Chưa có quan hệ người giám hộ phù hợp")}
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
        closable={!mutationPending}
        destroyOnHidden
        footer={null}
        keyboard={!mutationPending}
        mask={{ closable: !mutationPending }}
        onCancel={closeCreate}
        open={createOpen}
        title={t("Thêm người giám hộ")}
      >
        <Form<GuardianFormValues>
          disabled={mutationPending || !canManage}
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
            label={t("Học viên")}
            name="learnerId"
            rules={[{ required: true, message: t("Chọn học viên") }]}
          >
            <Select
              optionFilterProp="label"
              options={learnerOptions.slice(1)}
              placeholder={t("Chọn học viên")}
              showSearch
            />
          </Form.Item>
          <Form.Item
            label={t("Phụ huynh / người giám hộ")}
            name="guardianId"
            rules={[{ required: true, message: t("Chọn người giám hộ") }]}
          >
            <Select
              optionFilterProp="label"
              options={guardianOptions}
              placeholder={t("Chọn tài khoản người giám hộ")}
              showSearch
            />
          </Form.Item>
          <Form.Item
            label={t("Mối quan hệ")}
            name="relationshipType"
            rules={[{ required: true, message: t("Chọn mối quan hệ") }]}
          >
            <Select options={relationshipTypeOptions} />
          </Form.Item>
          <Form.Item name="primaryContact" valuePropName="checked">
            <Checkbox>{t("Đặt làm liên hệ chính")}</Checkbox>
          </Form.Item>
          <Form.Item name="canReceiveAcademicUpdates" valuePropName="checked">
            <Checkbox>{t("Nhận cập nhật học tập")}</Checkbox>
          </Form.Item>
          <Form.Item name="canReceiveBillingUpdates" valuePropName="checked">
            <Checkbox>{t("Nhận cập nhật học phí")}</Checkbox>
          </Form.Item>
          <Space>
            <Button disabled={mutationPending} onClick={closeCreate}>{t("Hủy")}</Button>
            <Button
              disabled={mutationPending || !canManage}
              htmlType="submit"
              loading={createMutation.isPending}
              type="primary"
            >
              {t("Lưu quan hệ")}{" "}
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        closable={!mutationPending}
        destroyOnHidden
        footer={null}
        keyboard={!mutationPending}
        key={editing?._id ?? "edit-guardian"}
        mask={{ closable: !mutationPending }}
        onCancel={closeEdit}
        open={Boolean(editing)}
        title={t("Sửa quan hệ người giám hộ")}
      >
        {editing && (
          <Form<EditGuardianFormValues>
            disabled={mutationPending || !canManage}
            initialValues={{
              canReceiveAcademicUpdates: editing.canReceiveAcademicUpdates,
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
              title={t("Quan hệ đang chỉnh sửa")}
              type="info"
            />
            <Form.Item
              label={t("Mối quan hệ")}
              name="relationshipType"
              rules={[{ required: true, message: t("Chọn mối quan hệ") }]}
            >
              <Select options={relationshipTypeOptions} />
            </Form.Item>
            <Form.Item
              label={t("Trạng thái")}
              name="status"
              rules={[{ required: true, message: t("Chọn trạng thái") }]}
            >
              <Select options={statusOptions} />
            </Form.Item>
            <Form.Item name="primaryContact" valuePropName="checked">
              <Checkbox>{t("Đặt làm liên hệ chính")}</Checkbox>
            </Form.Item>
            <Form.Item name="canReceiveAcademicUpdates" valuePropName="checked">
              <Checkbox>{t("Nhận cập nhật học tập")}</Checkbox>
            </Form.Item>
            <Form.Item name="canReceiveBillingUpdates" valuePropName="checked">
              <Checkbox>{t("Nhận cập nhật học phí")}</Checkbox>
            </Form.Item>
            <Space>
              <Button disabled={mutationPending} onClick={closeEdit}>{t("Hủy")}</Button>
              <Button
                disabled={mutationPending || !canManage}
                htmlType="submit"
                loading={updateMutation.isPending}
                type="primary"
              >
                {t("Lưu thay đổi")}{" "}
              </Button>
            </Space>
          </Form>
        )}
      </Modal>
    </div>
  );
}

const guardianMessages = { ...operationsMessages, ...userCreationMessages };

function useOperationsCopy() {
  const i18n = useI18n(guardianMessages);
  return useI18nMemo(() => {
    const { t } = i18n;
    const relationshipTypeLabels: Record<GuardianRelationshipType, string> = {
      GUARDIAN: t("Người giám hộ"),
      OTHER: t("Quan hệ khác"),
      PARENT: t("Cha/mẹ"),
    };

    const statusOptions: Array<{
      label: string;
      value: GuardianRelationshipStatus;
    }> = [
      { label: t("Đang hoạt động"), value: "ACTIVE" },
      { label: t("Đã lưu trữ"), value: "INACTIVE" },
    ];

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
        return t(
          "Tra cứu người liên hệ đã đồng ý nhận cập nhật học tập của học viên.",
        );
      }
      if (role === "LEARNER") {
        return t(
          "Xem người giám hộ và phạm vi cập nhật đang được liên kết với bạn.",
        );
      }
      if (role === "GUARDIAN") {
        return t(
          "Xem các học viên và phạm vi cập nhật được liên kết với tài khoản của bạn.",
        );
      }
      return t(
        "Quản lý mối liên hệ giữa học viên và phụ huynh hoặc người giám hộ.",
      );
    }
    const relationshipTypeOptions = (
      Object.entries(relationshipTypeLabels) as Array<
        [GuardianRelationshipType, string]
      >
    ).map(([value, label]) => ({ label, value }));
    return {
      ...i18n,
      relationshipTypeLabels,
      relationshipTypeOptions,
      statusOptions,
      guardianRootKey,
      guardianRelationshipKey,
      selectValue,
      roleDescription,
    };
  }, [i18n]);
}
