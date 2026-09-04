"use client";

import {
  ApartmentOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Skeleton,
  Space,
  Switch,
  Tag,
  Tree,
  Typography,
  type TreeDataNode,
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isFormValidationError } from "@/components/form/validation-error";
import { useAuth } from "@/components/providers/app-providers";
import {
  orgUnitQueryKeys,
  orgUnitsApi,
  type CreateOrgUnitInput,
  type OrgUnit,
  type OrgUnitAddress,
  type OrgUnitContact,
  type OrgUnitTreeNode,
  type OrgUnitType,
  type UpdateOrgUnitInput,
} from "@/lib/org-units-api";
import { getViewerScope } from "@/lib/query-keys";

const TYPE_PRESENTATION: Record<OrgUnitType, { color: string; label: string }> =
  {
    BRANCH: { color: "blue", label: "Chi nhánh" },
    DEPARTMENT: { color: "purple", label: "Phòng ban" },
    ROOT: { color: "gold", label: "Trung tâm" },
  };

interface OrgUnitFormValues {
  addressCountryCode?: string;
  addressDistrict?: string;
  addressLine1?: string;
  addressPostalCode?: string;
  addressProvince?: string;
  addressWard?: string;
  code: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWebsiteUrl?: string;
  name: string;
  parentId?: string;
  policyOverridesText?: string;
  timezone: string;
  type: OrgUnitType;
}

type SaveRequest =
  | { input: CreateOrgUnitInput; kind: "create" }
  | {
      input: UpdateOrgUnitInput;
      kind: "update";
      orgUnitId: string;
    };

export default function OrganizationPage() {
  const { message } = App.useApp();
  const { organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<OrgUnitFormValues>();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<OrgUnitTreeNode | null>(null);
  const [draftType, setDraftType] = useState<OrgUnitType>("ROOT");
  const scope = getViewerScope(user, organization);
  const tenantPersona =
    user?.role === "TENANT_ADMIN" || user?.role === "INSTRUCTOR";
  const scopedAdmin =
    user?.role === "TENANT_ADMIN" && user.orgUnitScopeMode === "SCOPED";
  const canManage =
    user?.role === "TENANT_ADMIN" && user.orgUnitScopeMode !== "SCOPED";
  const treeKey = scope
    ? orgUnitQueryKeys.tree(scope, includeArchived)
    : ([
        "lms",
        "signed-out",
        "org-units",
        "tree",
        { includeArchived },
      ] as const);

  const treeQuery = useQuery({
    enabled: Boolean(token && scope && tenantPersona),
    queryFn: ({ signal }) =>
      orgUnitsApi.tree({ token }, includeArchived, { signal }),
    queryKey: treeKey,
  });
  const units = useMemo(
    () => flattenUnits(treeQuery.data?.items ?? []),
    [treeQuery.data?.items],
  );
  const selected =
    units.find((unit) => unit._id === selectedId) ?? units[0] ?? null;
  const root = units.find((unit) => unit.type === "ROOT") ?? null;
  const activeUnits = units.filter((unit) => unit.status === "ACTIVE");
  const selectedHasActiveChildren = Boolean(
    selected?.children.some((child) => child.status === "ACTIVE"),
  );
  const excludedParentIds = useMemo(
    () =>
      editing
        ? new Set([editing._id, ...collectDescendantIds(editing)])
        : new Set<string>(),
    [editing],
  );
  const parentOptions = useMemo(() => {
    if (draftType === "ROOT") return [];
    return activeUnits
      .filter(
        (unit) =>
          !excludedParentIds.has(unit._id) &&
          (draftType !== "BRANCH" || unit.type === "ROOT"),
      )
      .map((unit) => ({
        label: unit.path.join(" / ") + " · " + unit.name,
        value: unit._id,
      }));
  }, [activeUnits, draftType, excludedParentIds]);

  const saveMutation = useMutation({
    mutationFn: (request: SaveRequest) =>
      request.kind === "create"
        ? orgUnitsApi.create({ token }, request.input)
        : orgUnitsApi.update({ token }, request.orgUnitId, request.input),
    onSuccess: async (unit, request) => {
      setModalMode(null);
      setEditing(null);
      setSelectedId(unit._id);
      message.success(
        request.kind === "create"
          ? "Đã thêm đơn vị tổ chức"
          : "Đã cập nhật cơ cấu tổ chức",
      );
      if (scope) {
        await queryClient.invalidateQueries({
          queryKey: orgUnitQueryKeys.root(scope),
        });
      }
    },
  });
  const archiveMutation = useMutation({
    mutationFn: (unit: OrgUnitTreeNode) =>
      orgUnitsApi.archive({ token }, unit._id, unit.revision),
    onSuccess: async () => {
      message.success("Đã lưu trữ đơn vị tổ chức");
      if (scope) {
        await queryClient.invalidateQueries({
          queryKey: orgUnitQueryKeys.root(scope),
        });
      }
    },
  });
  const treeData = useMemo<TreeDataNode[]>(
    () => (treeQuery.data?.items ?? []).map(toTreeDataNode),
    [treeQuery.data?.items],
  );

  const showCreate = () => {
    const type: OrgUnitType = !root
      ? "ROOT"
      : selected?.status === "ACTIVE" && selected.type !== "ROOT"
        ? "DEPARTMENT"
        : "BRANCH";
    const parentId =
      type === "ROOT"
        ? undefined
        : selected?.status === "ACTIVE"
          ? selected._id
          : root?._id;
    setEditing(null);
    setDraftType(type);
    form.resetFields();
    form.setFieldsValue({
      addressCountryCode: "VN",
      parentId,
      policyOverridesText: "{}",
      timezone: selected?.timezone ?? root?.timezone ?? "Asia/Ho_Chi_Minh",
      type,
    });
    saveMutation.reset();
    setModalMode("create");
  };

  const showEdit = () => {
    if (!selected || selected.status !== "ACTIVE") return;
    setEditing(selected);
    setDraftType(selected.type);
    form.resetFields();
    form.setFieldsValue(editorValues(selected));
    saveMutation.reset();
    setModalMode("edit");
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      const input = createInput(values);
      await saveMutation.mutateAsync(
        modalMode === "edit" && editing
          ? {
              input: { ...input, expectedRevision: editing.revision },
              kind: "update",
              orgUnitId: editing._id,
            }
          : { input, kind: "create" },
      );
    } catch (caught) {
      if (!isFormValidationError(caught)) {
        message.error(
          caught instanceof Error
            ? caught.message
            : "Không thể lưu đơn vị tổ chức",
        );
      }
    }
  };

  const archive = async () => {
    if (!selected) return;
    try {
      await archiveMutation.mutateAsync(selected);
    } catch (caught) {
      message.error(
        caught instanceof Error
          ? caught.message
          : "Không thể lưu trữ đơn vị tổ chức",
      );
    }
  };

  if (user?.role === "SUPER_ADMIN") {
    return (
      <Alert
        showIcon
        title="Cơ cấu tổ chức chỉ dành cho thành viên trong workspace tenant."
        type="warning"
      />
    );
  }
  if (!user || !tenantPersona || !scope) {
    return (
      <Alert
        showIcon
        title="Không tìm thấy workspace để tải cơ cấu tổ chức."
        type="warning"
      />
    );
  }

  return (
    <main className="organization-page page-shell">
      <header className="page-heading">
        <div>
          <span className="page-eyebrow">Vận hành trung tâm</span>
          <h1>Cơ cấu tổ chức</h1>
          <p>
            Quản lý trung tâm gốc, chi nhánh và phòng ban trong workspace{" "}
            {organization?.name ?? "hiện tại"}.
          </p>
        </div>
        <Space align="center" wrap>
          <Space size={6}>
            <span>Hiển thị đã lưu trữ</span>
            <Switch
              aria-label="Hiển thị đơn vị đã lưu trữ"
              checked={includeArchived}
              onChange={setIncludeArchived}
            />
          </Space>
          {canManage && units.length > 0 && (
            <Button icon={<PlusOutlined />} onClick={showCreate} type="primary">
              Thêm đơn vị
            </Button>
          )}
        </Space>
      </header>

      {!canManage && (
        <Alert
          description={
            scopedAdmin
              ? "Bạn đang quản lý theo phạm vi đơn vị. Chỉ quản trị viên toàn tổ chức mới có thể thay đổi cây chi nhánh để tránh tự mở rộng quyền."
              : "Giảng viên có thể xem cơ cấu; chỉ quản trị tổ chức được thay đổi."
          }
          showIcon
          title={scopedAdmin ? "Cơ cấu ở chế độ chỉ xem" : "Chế độ xem"}
          type="info"
        />
      )}

      <Space size={[8, 8]} wrap>
        <Tag color="gold">
          {activeUnits.filter((unit) => unit.type === "ROOT").length} trung tâm
        </Tag>
        <Tag color="blue">
          {activeUnits.filter((unit) => unit.type === "BRANCH").length} chi
          nhánh
        </Tag>
        <Tag color="purple">
          {activeUnits.filter((unit) => unit.type === "DEPARTMENT").length}{" "}
          phòng ban
        </Tag>
        {includeArchived && (
          <Tag>
            {units.filter((unit) => unit.status === "ARCHIVED").length} đã lưu
            trữ
          </Tag>
        )}
      </Space>

      <Row gutter={[20, 20]}>
        <Col lg={14} xs={24}>
          <Card className="surface-card" title="Sơ đồ đơn vị">
            {treeQuery.isPending ? (
              <div aria-label="Đang tải cơ cấu tổ chức" role="status">
                <Skeleton active paragraph={{ rows: 8 }} />
              </div>
            ) : treeQuery.error ? (
              <Alert
                action={
                  <Button onClick={() => void treeQuery.refetch()}>
                    Thử lại
                  </Button>
                }
                description={
                  treeQuery.error instanceof Error
                    ? treeQuery.error.message
                    : "Không thể tải cây đơn vị"
                }
                showIcon
                title="Chưa tải được cơ cấu tổ chức"
                type="error"
              />
            ) : treeData.length ? (
              <Tree
                blockNode
                defaultExpandAll
                onSelect={(keys) =>
                  setSelectedId(keys.length ? String(keys[0]) : null)
                }
                selectedKeys={selected ? [selected._id] : []}
                showLine
                treeData={treeData}
              />
            ) : (
              <Empty
                description={
                  <Space direction="vertical" size={4}>
                    <strong>Chưa có cơ cấu tổ chức</strong>
                    <span>
                      {canManage
                        ? "Tạo trung tâm gốc trước khi thêm chi nhánh và phòng ban."
                        : "Quản trị tổ chức chưa thiết lập cơ cấu cho workspace này."}
                    </span>
                  </Space>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                {canManage && (
                  <Button onClick={showCreate} type="primary">
                    Tạo ROOT
                  </Button>
                )}
              </Empty>
            )}
          </Card>
        </Col>

        <Col lg={10} xs={24}>
          <Card className="surface-card" title="Chi tiết đơn vị">
            {selected ? (
              <Space
                direction="vertical"
                size="middle"
                style={{ width: "100%" }}
              >
                <Space align="center" wrap>
                  <h2 style={{ margin: 0 }}>{selected.name}</h2>
                  <Tag color={TYPE_PRESENTATION[selected.type].color}>
                    {TYPE_PRESENTATION[selected.type].label}
                  </Tag>
                  <Tag
                    color={selected.status === "ACTIVE" ? "green" : undefined}
                  >
                    {selected.status === "ACTIVE"
                      ? "Đang hoạt động"
                      : "Đã lưu trữ"}
                  </Tag>
                </Space>
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="Mã đơn vị">
                    <Typography.Text code copyable>
                      {selected.code}
                    </Typography.Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Đơn vị cha">
                    {unitName(units, selected.parentId)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Đường dẫn">
                    {selected.path.join(" / ")}
                  </Descriptions.Item>
                  <Descriptions.Item label="Múi giờ">
                    {selected.timezone}
                  </Descriptions.Item>
                  <Descriptions.Item label="Địa chỉ">
                    {formatAddress(selected.address)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Liên hệ">
                    {formatContact(selected.contact)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Phiên bản">
                    revision {selected.revision}
                  </Descriptions.Item>
                  <Descriptions.Item label="Policy ghi đè">
                    {Object.keys(selected.policyOverrides).length ? (
                      <pre style={{ margin: 0, overflowX: "auto" }}>
                        {JSON.stringify(selected.policyOverrides, null, 2)}
                      </pre>
                    ) : (
                      "Không có"
                    )}
                  </Descriptions.Item>
                </Descriptions>

                {canManage && selected.status === "ACTIVE" && (
                  <Space wrap>
                    <Button icon={<EditOutlined />} onClick={showEdit}>
                      Chỉnh sửa / di chuyển
                    </Button>
                    {selected.type !== "ROOT" && (
                      <Popconfirm
                        disabled={selectedHasActiveChildren}
                        okText="Xác nhận lưu trữ"
                        onConfirm={archive}
                        title={
                          selectedHasActiveChildren
                            ? "Đơn vị còn con hoạt động"
                            : "Lưu trữ " + selected.name + "?"
                        }
                      >
                        <Button
                          danger
                          disabled={selectedHasActiveChildren}
                          loading={archiveMutation.isPending}
                        >
                          Lưu trữ
                        </Button>
                      </Popconfirm>
                    )}
                    {selectedHasActiveChildren && (
                      <Typography.Text type="secondary">
                        Hãy di chuyển hoặc lưu trữ các đơn vị con trước.
                      </Typography.Text>
                    )}
                  </Space>
                )}
              </Space>
            ) : (
              <Empty description="Chọn một đơn vị trên cây để xem chi tiết." />
            )}
          </Card>
        </Col>
      </Row>

      <OrgUnitEditorModal
        draftType={draftType}
        editing={editing}
        form={form}
        modalMode={modalMode}
        onCancel={() => {
          setModalMode(null);
          setEditing(null);
        }}
        onDraftTypeChange={setDraftType}
        onSave={() => void save()}
        parentOptions={parentOptions}
        rootExists={Boolean(root)}
        rootId={root?._id}
        saving={saveMutation.isPending}
      />
    </main>
  );
}

function OrgUnitEditorModal({
  draftType,
  editing,
  form,
  modalMode,
  onCancel,
  onDraftTypeChange,
  onSave,
  parentOptions,
  rootExists,
  rootId,
  saving,
}: {
  draftType: OrgUnitType;
  editing: OrgUnitTreeNode | null;
  form: ReturnType<typeof Form.useForm<OrgUnitFormValues>>[0];
  modalMode: "create" | "edit" | null;
  onCancel: () => void;
  onDraftTypeChange: (type: OrgUnitType) => void;
  onSave: () => void;
  parentOptions: Array<{ label: string; value: string }>;
  rootExists: boolean;
  rootId?: string;
  saving: boolean;
}) {
  return (
    <Modal
      destroyOnHidden
      okButtonProps={{ loading: saving }}
      okText={modalMode === "edit" ? "Lưu thay đổi" : "Tạo đơn vị"}
      onCancel={onCancel}
      onOk={onSave}
      open={modalMode !== null}
      title={
        modalMode === "edit"
          ? "Chỉnh sửa " + (editing?.name ?? "đơn vị")
          : draftType === "ROOT"
            ? "Tạo ROOT"
            : "Thêm đơn vị tổ chức"
      }
      width={760}
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={(changed: Partial<OrgUnitFormValues>) => {
          if (changed.type) {
            onDraftTypeChange(changed.type);
            form.setFieldValue(
              "parentId",
              changed.type === "ROOT" ? undefined : rootId,
            );
          }
        }}
      >
        <Row gutter={16}>
          <Col md={12} xs={24}>
            <Form.Item
              label="Loại đơn vị"
              name="type"
              rules={[{ required: true, message: "Chọn loại đơn vị" }]}
            >
              <Select
                disabled={editing?.type === "ROOT"}
                options={
                  editing?.type === "ROOT"
                    ? [{ label: "Trung tâm gốc", value: "ROOT" }]
                    : rootExists
                      ? [
                          { label: "Chi nhánh", value: "BRANCH" },
                          { label: "Phòng ban", value: "DEPARTMENT" },
                        ]
                      : [{ label: "Trung tâm gốc", value: "ROOT" }]
                }
              />
            </Form.Item>
          </Col>
          <Col md={12} xs={24}>
            {draftType !== "ROOT" && (
              <Form.Item
                label="Đơn vị cha"
                name="parentId"
                rules={[{ required: true, message: "Chọn đơn vị cha" }]}
              >
                <Select
                  optionFilterProp="label"
                  options={parentOptions}
                  placeholder="Chọn vị trí trong cây"
                  showSearch
                />
              </Form.Item>
            )}
          </Col>
        </Row>
        <Row gutter={16}>
          <Col md={12} xs={24}>
            <Form.Item
              label="Tên đơn vị"
              name="name"
              rules={[
                { required: true, message: "Nhập tên đơn vị" },
                { max: 160, min: 2 },
              ]}
            >
              <Input maxLength={160} placeholder="Ví dụ: Chi nhánh Quận 1" />
            </Form.Item>
          </Col>
          <Col md={12} xs={24}>
            <Form.Item
              extra="Chữ, số và dấu gạch ngang; duy nhất trong workspace."
              label="Mã đơn vị"
              name="code"
              rules={[
                { required: true, message: "Nhập mã đơn vị" },
                {
                  pattern: /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/,
                  message: "Mã chỉ gồm chữ, số và dấu gạch ngang",
                },
                { max: 64, min: 2 },
              ]}
            >
              <Input maxLength={64} placeholder="hcm-01" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          label="Múi giờ"
          name="timezone"
          rules={[{ required: true, message: "Nhập múi giờ IANA" }]}
        >
          <Input maxLength={100} placeholder="Asia/Ho_Chi_Minh" />
        </Form.Item>

        <Typography.Title level={5}>Địa chỉ</Typography.Title>
        <Form.Item label="Địa chỉ chính" name="addressLine1">
          <Input maxLength={200} />
        </Form.Item>
        <Row gutter={16}>
          <Col md={8} xs={24}>
            <Form.Item label="Phường / xã" name="addressWard">
              <Input maxLength={120} />
            </Form.Item>
          </Col>
          <Col md={8} xs={24}>
            <Form.Item label="Quận / huyện" name="addressDistrict">
              <Input maxLength={120} />
            </Form.Item>
          </Col>
          <Col md={8} xs={24}>
            <Form.Item label="Tỉnh / thành" name="addressProvince">
              <Input maxLength={120} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col md={12} xs={24}>
            <Form.Item label="Mã bưu chính" name="addressPostalCode">
              <Input maxLength={20} />
            </Form.Item>
          </Col>
          <Col md={12} xs={24}>
            <Form.Item
              label="Mã quốc gia"
              name="addressCountryCode"
              rules={[{ len: 2, message: "Dùng mã quốc gia 2 ký tự" }]}
            >
              <Input maxLength={2} />
            </Form.Item>
          </Col>
        </Row>

        <Typography.Title level={5}>Liên hệ</Typography.Title>
        <Row gutter={16}>
          <Col md={12} xs={24}>
            <Form.Item
              label="Email"
              name="contactEmail"
              rules={[{ type: "email", message: "Email chưa hợp lệ" }]}
            >
              <Input maxLength={254} />
            </Form.Item>
          </Col>
          <Col md={12} xs={24}>
            <Form.Item label="Điện thoại" name="contactPhone">
              <Input maxLength={32} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          label="Website"
          name="contactWebsiteUrl"
          rules={[{ type: "url", message: "Website chưa hợp lệ" }]}
        >
          <Input maxLength={2048} placeholder="https://..." />
        </Form.Item>
        <Form.Item
          extra="Object JSON dùng để ghi đè policy được kế thừa ở đơn vị này."
          label="Policy ghi đè"
          name="policyOverridesText"
          rules={[
            {
              validator: (_, value: unknown) => {
                try {
                  parsePolicyOverrides(value);
                  return Promise.resolve();
                } catch (error) {
                  return Promise.reject(error);
                }
              },
            },
          ]}
        >
          <Input.TextArea autoSize={{ minRows: 4, maxRows: 10 }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function flattenUnits(nodes: readonly OrgUnitTreeNode[]): OrgUnitTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenUnits(node.children)]);
}

function collectDescendantIds(node: OrgUnitTreeNode): string[] {
  return node.children.flatMap((child) => [
    child._id,
    ...collectDescendantIds(child),
  ]);
}

function toTreeDataNode(unit: OrgUnitTreeNode): TreeDataNode {
  const presentation = TYPE_PRESENTATION[unit.type];
  return {
    children: unit.children.map(toTreeDataNode),
    key: unit._id,
    title: (
      <Space size={6} wrap>
        <ApartmentOutlined />
        <strong>{unit.name}</strong>
        <Typography.Text code>{unit.code}</Typography.Text>
        <Tag color={presentation.color}>{presentation.label}</Tag>
        <Tag>revision {unit.revision}</Tag>
        {unit.status === "ARCHIVED" && <Tag>Đã lưu trữ</Tag>}
      </Space>
    ),
  };
}

function editorValues(unit: OrgUnit): OrgUnitFormValues {
  return {
    addressCountryCode: unit.address?.countryCode ?? "VN",
    addressDistrict: unit.address?.district,
    addressLine1: unit.address?.line1,
    addressPostalCode: unit.address?.postalCode,
    addressProvince: unit.address?.province,
    addressWard: unit.address?.ward,
    code: unit.code,
    contactEmail: unit.contact?.email,
    contactPhone: unit.contact?.phone,
    contactWebsiteUrl: unit.contact?.websiteUrl,
    name: unit.name,
    parentId: unit.parentId ?? undefined,
    policyOverridesText: JSON.stringify(unit.policyOverrides, null, 2),
    timezone: unit.timezone,
    type: unit.type,
  };
}

function createInput(values: OrgUnitFormValues): CreateOrgUnitInput {
  const address: OrgUnitAddress = {
    countryCode: values.addressCountryCode?.trim().toUpperCase(),
    district: values.addressDistrict,
    line1: values.addressLine1,
    postalCode: values.addressPostalCode,
    province: values.addressProvince,
    ward: values.addressWard,
  };
  const contact: OrgUnitContact = {
    email: values.contactEmail?.trim().toLowerCase(),
    phone: values.contactPhone,
    websiteUrl: values.contactWebsiteUrl,
  };
  return {
    address,
    code: values.code,
    contact,
    name: values.name,
    ...(values.type !== "ROOT" && values.parentId
      ? { parentId: values.parentId }
      : {}),
    policyOverrides: parsePolicyOverrides(values.policyOverridesText),
    timezone: values.timezone,
    type: values.type,
  };
}

function parsePolicyOverrides(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null || String(value).trim() === "") {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value));
  } catch {
    throw new Error("Policy ghi đè phải là JSON hợp lệ");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Policy ghi đè phải là một object JSON");
  }
  return parsed as Record<string, unknown>;
}

function unitName(units: readonly OrgUnit[], parentId: string | null): string {
  if (!parentId) return "Không có (ROOT)";
  return units.find((unit) => unit._id === parentId)?.name ?? "Không xác định";
}

function formatAddress(address?: OrgUnitAddress | null): string {
  if (!address) return "Chưa cập nhật";
  return (
    [
      address.line1,
      address.ward,
      address.district,
      address.province,
      address.postalCode,
      address.countryCode,
    ]
      .filter(Boolean)
      .join(", ") || "Chưa cập nhật"
  );
}

function formatContact(contact?: OrgUnitContact | null): string {
  if (!contact) return "Chưa cập nhật";
  return (
    [contact.email, contact.phone, contact.websiteUrl]
      .filter(Boolean)
      .join(" · ") || "Chưa cập nhật"
  );
}
