"use client";

import {
  BankOutlined,
  DollarOutlined,
  PlusOutlined,
  SendOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import {
  getViewerScope,
  lmsQueryKeys,
  normalizeQueryFilters,
  type ViewerScope,
} from "@/lib/query-keys";
import {
  createTuitionPaymentIdempotencyKey,
  tuitionApi,
  type CreateTuitionInvoiceInput,
  type RecordTuitionPaymentInput,
  type TuitionInvoice,
  type TuitionInvoiceQuery,
  type TuitionInvoiceStatus,
  type TuitionPaymentMethod,
} from "@/lib/tuition-api";

const PAGE_SIZE = 20;
const money = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});
const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

const statusPresentation: Record<
  TuitionInvoiceStatus,
  { color: string; label: string }
> = {
  DRAFT: { color: "default", label: "Bản nháp" },
  ISSUED: { color: "processing", label: "Chờ thanh toán" },
  OVERDUE: { color: "red", label: "Quá hạn" },
  PAID: { color: "green", label: "Đã thanh toán" },
  PARTIALLY_PAID: { color: "gold", label: "Đã thanh toán một phần" },
  VOID: { color: "default", label: "Đã hủy" },
};

const statusOptions: Array<{ label: string; value: TuitionInvoiceStatus | "" }> = [
  { label: "Mọi trạng thái", value: "" },
  { label: "Bản nháp", value: "DRAFT" },
  { label: "Chờ thanh toán", value: "ISSUED" },
  { label: "Đã thanh toán một phần", value: "PARTIALLY_PAID" },
  { label: "Đã thanh toán", value: "PAID" },
  { label: "Quá hạn", value: "OVERDUE" },
  { label: "Đã hủy", value: "VOID" },
];

const paymentMethodLabels: Record<TuitionPaymentMethod, string> = {
  BANK_TRANSFER: "Chuyển khoản",
  CARD: "Thẻ",
  CASH: "Tiền mặt",
  OTHER: "Khác",
};

interface CreateInvoiceFormValues {
  amountVnd: number | string;
  cohortId?: string;
  description?: string;
  dueAt: string;
  learnerId: string;
  orgUnitId?: string;
  title: string;
}

interface PaymentFormValues {
  amountVnd: number | string;
  method: "CASH" | "BANK_TRANSFER";
  note?: string;
  paidAt?: string;
  providerReference?: string;
}

function tuitionRootKey(scope: ViewerScope) {
  return [...lmsQueryKeys.viewer(scope), "tuition"] as const;
}

function tuitionInvoiceListKey(
  scope: ViewerScope,
  query: TuitionInvoiceQuery,
) {
  return [
    ...tuitionRootKey(scope),
    "invoices",
    normalizeQueryFilters({
      cohortId: query.cohortId,
      learnerId: query.learnerId,
      limit: query.limit,
      page: query.page,
      status: query.status,
    }),
  ] as const;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : dateTime.format(parsed);
}

function positiveVnd(value: number | string, maximum?: number): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new Error("Số tiền phải là số nguyên VND lớn hơn 0");
  }
  if (maximum !== undefined && amount > maximum) {
    throw new Error("Số tiền thanh toán vượt số dư hóa đơn");
  }
  return amount;
}

function requiredIsoDate(value: string, label: string): string {
  const timestamp = Date.parse(value);
  if (!value || Number.isNaN(timestamp)) {
    throw new Error(`${label} không hợp lệ`);
  }
  return new Date(timestamp).toISOString();
}

function optionalIsoDate(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  return requiredIsoDate(value, "Thời điểm thanh toán");
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

export default function TuitionPage() {
  const { message } = App.useApp();
  const { effectiveAccess, organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [createForm] = Form.useForm<CreateInvoiceFormValues>();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TuitionInvoiceStatus | undefined>();
  const [learnerId, setLearnerId] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createLearnerId, setCreateLearnerId] = useState("");
  const [createCohortId, setCreateCohortId] = useState("");
  const [createOrgUnitId, setCreateOrgUnitId] = useState("");
  const [paymentInvoice, setPaymentInvoice] = useState<TuitionInvoice | null>(
    null,
  );
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState("");

  const scope = getViewerScope(user, organization);
  const isTenantAdmin = user?.role === "TENANT_ADMIN";
  const isLearner = user?.role === "LEARNER";
  const isGuardian = user?.role === "GUARDIAN";
  const supportedRole = isTenantAdmin || isLearner || isGuardian;
  const canLoad = Boolean(token && scope && supportedRole);
  const readOnly = effectiveAccess?.readOnly ?? false;
  const canManage = Boolean(isTenantAdmin && !readOnly);
  const listQuery = useMemo<TuitionInvoiceQuery>(
    () => ({
      ...(isTenantAdmin && learnerId ? { learnerId } : {}),
      limit: PAGE_SIZE,
      page,
      ...(status ? { status } : {}),
    }),
    [isTenantAdmin, learnerId, page, status],
  );
  const signedOutRoot = ["lms", "signed-out", "tuition"] as const;
  const rootKey = scope ? tuitionRootKey(scope) : signedOutRoot;

  const invoicesQuery = useQuery({
    enabled: canLoad,
    queryFn: ({ signal }) =>
      tuitionApi.listInvoices({ token }, listQuery, { signal }),
    queryKey: scope
      ? tuitionInvoiceListKey(scope, listQuery)
      : [...signedOutRoot, "invoices"],
  });
  const invoiceOptionsQuery = useQuery({
    enabled: Boolean(token && scope && isTenantAdmin),
    queryFn: ({ signal }) =>
      tuitionApi.getInvoiceOptions({ token }, { signal }),
    queryKey: scope
      ? [...tuitionRootKey(scope), "invoice-options"]
      : [...signedOutRoot, "invoice-options"],
  });

  const refreshTuition = () =>
    queryClient.invalidateQueries({ queryKey: rootKey });
  const createMutation = useMutation({
    mutationFn: (input: CreateTuitionInvoiceInput) =>
      tuitionApi.createInvoice({ token }, input),
    onSuccess: async () => {
      setCreateOpen(false);
      setCreateLearnerId("");
      setCreateCohortId("");
      setCreateOrgUnitId("");
      createForm.resetFields();
      message.success("Đã tạo hóa đơn học phí nháp");
      await refreshTuition();
    },
  });
  const issueMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      tuitionApi.issueInvoice({ token }, invoiceId),
    onSuccess: async () => {
      message.success("Đã phát hành hóa đơn học phí");
      await refreshTuition();
    },
  });
  const voidMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      tuitionApi.voidInvoice({ token }, invoiceId),
    onSuccess: async () => {
      message.success("Đã hủy hóa đơn học phí");
      await refreshTuition();
    },
  });
  const paymentMutation = useMutation({
    mutationFn: ({
      input,
      invoiceId,
    }: {
      input: RecordTuitionPaymentInput;
      invoiceId: string;
    }) => tuitionApi.recordPayment({ token }, invoiceId, input),
    onSuccess: async () => {
      setPaymentInvoice(null);
      setPaymentIdempotencyKey("");
      message.success("Đã ghi nhận thanh toán học phí");
      await refreshTuition();
    },
  });

  const invoiceOptions = invoiceOptionsQuery.data;
  const learners = useMemo(
    () => invoiceOptions?.learners ?? [],
    [invoiceOptions?.learners],
  );
  const learnerNames = useMemo(
    () => new Map(learners.map((learner) => [learner.userId, learner.fullName])),
    [learners],
  );
  const selectedCreateLearner = useMemo(
    () => learners.find((learner) => learner.userId === createLearnerId),
    [createLearnerId, learners],
  );
  const cohortById = useMemo(
    () =>
      new Map(
        (invoiceOptions?.cohorts ?? []).map((cohort) => [cohort._id, cohort]),
      ),
    [invoiceOptions?.cohorts],
  );
  const orgUnitById = useMemo(
    () =>
      new Map(
        (invoiceOptions?.orgUnits ?? []).map((orgUnit) => [
          orgUnit._id,
          orgUnit,
        ]),
      ),
    [invoiceOptions?.orgUnits],
  );
  const createCohortOptions = useMemo(
    () => [
      { label: "Không gắn với lớp", value: "" },
      ...(selectedCreateLearner?.cohortIds ?? [])
        .map((id) => cohortById.get(id))
        .filter((cohort) => cohort !== undefined)
        .map((cohort) => ({
          label: `${cohort.code} · ${cohort.name}${
            cohort.orgUnitId && orgUnitById.get(cohort.orgUnitId)
              ? ` · ${orgUnitById.get(cohort.orgUnitId)?.name}`
              : ""
          }`,
          value: cohort._id,
        })),
    ],
    [cohortById, orgUnitById, selectedCreateLearner?.cohortIds],
  );
  const eligibleCreateOrgUnitIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedCreateLearner?.orgUnitId) ids.add(selectedCreateLearner.orgUnitId);
    for (const cohortId of selectedCreateLearner?.cohortIds ?? []) {
      const orgUnitId = cohortById.get(cohortId)?.orgUnitId;
      if (orgUnitId) ids.add(orgUnitId);
    }
    return ids;
  }, [cohortById, selectedCreateLearner]);
  const createOrgUnitOptions = useMemo(
    () =>
      (invoiceOptions?.orgUnits ?? [])
        .filter((orgUnit) => eligibleCreateOrgUnitIds.has(orgUnit._id))
        .map((orgUnit) => ({
          label: `${orgUnit.name} · ${orgUnit.code.toUpperCase()}`,
          value: orgUnit._id,
        })),
    [eligibleCreateOrgUnitIds, invoiceOptions?.orgUnits],
  );
  const selectedCreateCohort = createCohortId
    ? cohortById.get(createCohortId)
    : undefined;
  const soloBillingMode = Boolean(
    invoiceOptions &&
      !invoiceOptions.scoped &&
      invoiceOptions.orgUnits.length === 0,
  );
  const hasCreateBillingContext = Boolean(
    createCohortId || createOrgUnitId || soloBillingMode,
  );
  const writableOrgUnitIds = useMemo(
    () => new Set((invoiceOptions?.orgUnits ?? []).map((unit) => unit._id)),
    [invoiceOptions?.orgUnits],
  );
  const canCreateInvoice = Boolean(
    canManage &&
      invoiceOptions &&
      (!invoiceOptions.scoped || invoiceOptions.orgUnits.length > 0),
  );
  const learnerOptions = useMemo(
    () => [
      { label: "Mọi học viên", value: "" },
      ...learners.map((learner) => ({
        label: `${learner.fullName} · ${learner.email}`,
        value: learner.userId,
      })),
    ],
    [learners],
  );

  const invoices = useMemo(
    () => invoicesQuery.data?.items ?? [],
    [invoicesQuery.data?.items],
  );
  const summary = useMemo(
    () => ({
      balance: invoices.reduce((total, invoice) => total + invoice.balanceVnd, 0),
      overdue: invoices.filter((invoice) => invoice.status === "OVERDUE").length,
      paid: invoices.reduce((total, invoice) => total + invoice.paidAmountVnd, 0),
    }),
    [invoices],
  );

  const createDraft = async (values: CreateInvoiceFormValues) => {
    try {
      await createMutation.mutateAsync({
        amountVnd: positiveVnd(values.amountVnd),
        ...(createCohortId
          ? { cohortId: createCohortId }
          : createOrgUnitId
            ? { orgUnitId: createOrgUnitId }
            : {}),
        ...(values.description?.trim()
          ? { description: values.description.trim() }
          : {}),
        dueAt: requiredIsoDate(values.dueAt, "Hạn thanh toán"),
        learnerId: values.learnerId,
        title: values.title.trim(),
      });
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : "Không thể tạo hóa đơn",
      );
    }
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateLearnerId("");
    setCreateCohortId("");
    setCreateOrgUnitId("");
    createForm.resetFields();
  };

  const issueInvoice = async (invoiceId: string) => {
    try {
      await issueMutation.mutateAsync(invoiceId);
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : "Không thể phát hành hóa đơn",
      );
    }
  };

  const voidInvoice = async (invoiceId: string) => {
    try {
      await voidMutation.mutateAsync(invoiceId);
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : "Không thể hủy hóa đơn",
      );
    }
  };

  const openPayment = (invoice: TuitionInvoice) => {
    setPaymentIdempotencyKey(createTuitionPaymentIdempotencyKey());
    setPaymentInvoice(invoice);
  };

  const recordPayment = async (values: PaymentFormValues) => {
    if (!paymentInvoice || !paymentIdempotencyKey) return;
    try {
      const paidAt = optionalIsoDate(values.paidAt);
      await paymentMutation.mutateAsync({
        input: {
          amountVnd: positiveVnd(values.amountVnd, paymentInvoice.balanceVnd),
          idempotencyKey: paymentIdempotencyKey,
          method: values.method,
          ...(values.note?.trim() ? { note: values.note.trim() } : {}),
          ...(paidAt ? { paidAt } : {}),
          ...(values.providerReference?.trim()
            ? { providerReference: values.providerReference.trim() }
            : {}),
        },
        invoiceId: paymentInvoice._id,
      });
    } catch (caught) {
      message.error(
        caught instanceof Error
          ? caught.message
          : "Không thể ghi nhận thanh toán",
      );
    }
  };

  const columns: ColumnsType<TuitionInvoice> = [
    {
      key: "invoice",
      render: (_, invoice) => (
        <div>
          <Typography.Text copyable>{invoice.invoiceNumber}</Typography.Text>
          <div>
            <strong>{invoice.title}</strong>
          </div>
          {invoice.description && (
            <Typography.Text type="secondary">
              {invoice.description}
            </Typography.Text>
          )}
        </div>
      ),
      title: "Hóa đơn",
    },
    ...(isTenantAdmin || isGuardian
      ? [
          {
            dataIndex: "learnerId" as const,
            key: "learner",
            render: (value: string, invoice: TuitionInvoice) => (
              <div>
                <strong>
                  {learnerNames.get(value) ??
                    invoice.learner?.fullName ??
                    "Học viên được liên kết"}
                </strong>
                <div className="table-muted">
                  {invoice.learner?.email ?? value}
                </div>
              </div>
            ),
            responsive: ["sm" as const],
            title: "Học viên",
          },
        ]
      : []),
    {
      dataIndex: "amountVnd",
      key: "amount",
      render: (value: number) => money.format(value),
      title: "Phải thu",
    },
    {
      key: "collected",
      render: (_, invoice) => (
        <div>
          <strong>{money.format(invoice.paidAmountVnd)}</strong>
          <div className="table-muted">
            Còn {money.format(invoice.balanceVnd)}
          </div>
        </div>
      ),
      responsive: ["md"],
      title: "Đã thu",
    },
    {
      dataIndex: "dueAt",
      key: "dueAt",
      render: (value: string) => formatDate(value),
      responsive: ["lg"],
      title: "Hạn thanh toán",
    },
    {
      dataIndex: "status",
      key: "status",
      render: (value: TuitionInvoiceStatus) => {
        const presentation = statusPresentation[value];
        return <Tag color={presentation.color}>{presentation.label}</Tag>;
      },
      title: "Trạng thái",
    },
    ...(isTenantAdmin
      ? [
          {
            key: "actions",
            render: (_: unknown, invoice: TuitionInvoice) => {
              const canManageInvoice = Boolean(
                canManage &&
                  invoiceOptions &&
                  (!invoiceOptions.scoped ||
                    (invoice.orgUnitId &&
                      writableOrgUnitIds.has(invoice.orgUnitId))),
              );
              const canIssue = invoice.lifecycle === "DRAFT";
              const canPay =
                invoice.lifecycle === "ISSUED" && invoice.balanceVnd > 0;
              const canVoid =
                invoice.lifecycle !== "VOID" && invoice.paidAmountVnd === 0;
              if (!canIssue && !canPay && !canVoid) {
                return (
                  <Typography.Text type="secondary">
                    Không có thao tác
                  </Typography.Text>
                );
              }
              return (
                <Space wrap>
                  {canIssue && (
                    <Button
                      disabled={!canManageInvoice}
                      icon={<SendOutlined />}
                      loading={
                        issueMutation.isPending &&
                        issueMutation.variables === invoice._id
                      }
                      onClick={() => void issueInvoice(invoice._id)}
                      size="small"
                      type="primary"
                    >
                      Phát hành
                    </Button>
                  )}
                  {canPay && (
                    <Button
                      disabled={!canManageInvoice}
                      icon={<DollarOutlined />}
                      onClick={() => openPayment(invoice)}
                      size="small"
                    >
                      Ghi nhận thanh toán
                    </Button>
                  )}
                  {canVoid && (
                    <Popconfirm
                      cancelText="Giữ hóa đơn"
                      disabled={!canManageInvoice}
                      okText="Xác nhận hủy"
                      onConfirm={() => voidInvoice(invoice._id)}
                      title="Hủy hóa đơn này?"
                    >
                      <Button
                        danger
                        disabled={!canManageInvoice}
                        icon={<StopOutlined />}
                        loading={
                          voidMutation.isPending &&
                          voidMutation.variables === invoice._id
                        }
                        size="small"
                      >
                        Hủy hóa đơn
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
              );
            },
            title: "Thao tác",
          },
        ]
      : []),
  ];

  if (!supportedRole) {
    return (
      <Alert
        showIcon
        title="Học phí chỉ dành cho quản trị tổ chức, học viên và phụ huynh."
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

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <h1>Học phí</h1>
          <p>
            {isTenantAdmin
              ? "Theo dõi công nợ, phát hành hóa đơn và ghi nhận các khoản đã thu."
              : "Theo dõi hóa đơn, hạn thanh toán và lịch sử các khoản đã ghi nhận."}
          </p>
        </div>
        {isTenantAdmin && (
          <Button
            disabled={!canCreateInvoice}
            icon={<PlusOutlined />}
            onClick={() => {
              setCreateLearnerId("");
              setCreateCohortId("");
              setCreateOrgUnitId("");
              createForm.resetFields();
              setCreateOpen(true);
            }}
            title={
              readOnly
                ? "Gia hạn thuê bao để tạo hóa đơn học phí"
                : invoiceOptions?.scoped &&
                    invoiceOptions.orgUnits.length === 0
                  ? "Bạn chưa có đơn vị được phép thu học phí"
                : undefined
            }
            type="primary"
          >
            Tạo hóa đơn
          </Button>
        )}
      </div>

      {isLearner && (
        <Alert
          description="Bạn chỉ có thể xem các hóa đơn học phí của chính mình."
          showIcon
          title="Thông tin học phí cá nhân"
          type="info"
        />
      )}
      {isTenantAdmin && readOnly && (
        <Alert
          description="Bạn vẫn có thể xem và lọc dữ liệu; tạo, phát hành, hủy và ghi nhận thanh toán đang tạm khóa."
          showIcon
          title="Workspace đang ở chế độ chỉ đọc"
          type="warning"
        />
      )}
      {invoicesQuery.error && (
        <Alert
          action={
            <Button onClick={() => void invoicesQuery.refetch()} size="small">
              Thử lại
            </Button>
          }
          description={
            invoicesQuery.error instanceof Error
              ? invoicesQuery.error.message
              : "Không thể tải danh sách hóa đơn"
          }
          showIcon
          title="Không tải được học phí"
          type="error"
        />
      )}
      {isTenantAdmin && invoiceOptionsQuery.error && (
        <Alert
          description="Danh sách hóa đơn vẫn dùng được, nhưng chưa thể chọn đúng học viên, lớp và đơn vị để lập hóa đơn mới."
          showIcon
          title="Không tải được danh mục lập hóa đơn"
          type="warning"
        />
      )}
      {isTenantAdmin && invoiceOptions?.scoped && invoiceOptions.orgUnits.length === 0 && (
        <Alert
          description="Bạn vẫn có thể xem hóa đơn trong phạm vi hiện tại, nhưng cần quyền Nhân sự vận hành trở lên tại ít nhất một đơn vị để lập và thu học phí."
          showIcon
          title="Chưa có đơn vị được phép thu học phí"
          type="info"
        />
      )}

      <Row gutter={[16, 16]}>
        <Col sm={12} xl={6} xs={24}>
          <Card className="surface-card">
            <Statistic
              title="Hóa đơn theo bộ lọc"
              value={invoicesQuery.data?.total ?? 0}
            />
          </Card>
        </Col>
        <Col sm={12} xl={6} xs={24}>
          <Card className="surface-card">
            <Statistic
              title="Đã thu (trang này)"
              value={money.format(summary.paid)}
            />
          </Card>
        </Col>
        <Col sm={12} xl={6} xs={24}>
          <Card className="surface-card">
            <Statistic
              title="Còn phải thu (trang này)"
              value={money.format(summary.balance)}
            />
          </Card>
        </Col>
        <Col sm={12} xl={6} xs={24}>
          <Card className="surface-card">
            <Statistic title="Quá hạn (trang này)" value={summary.overdue} />
          </Card>
        </Col>
      </Row>

      <Card className="surface-card" title="Danh sách hóa đơn">
        <Space wrap>
          <Select<TuitionInvoiceStatus | "">
            aria-label="Lọc theo trạng thái"
            onChange={(nextValue) => {
              const value = selectValue(nextValue) as
                | TuitionInvoiceStatus
                | "";
              setStatus(value || undefined);
              setPage(1);
            }}
            options={statusOptions}
            value={status ?? ""}
          />
          {isTenantAdmin && (
            <Select<string>
              aria-label="Lọc theo học viên"
              loading={invoiceOptionsQuery.isLoading}
              onChange={(nextValue) => {
                const value = selectValue(nextValue);
                setLearnerId(value || undefined);
                setPage(1);
              }}
              optionFilterProp="label"
              options={learnerOptions}
              showSearch
              value={learnerId ?? ""}
            />
          )}
        </Space>

        <Table<TuitionInvoice>
          columns={columns}
          dataSource={invoices}
          loading={invoicesQuery.isLoading}
          locale={{
            emptyText: (
              <Empty
                description={
                  isLearner
                    ? "Bạn chưa có hóa đơn học phí"
                    : "Chưa có hóa đơn phù hợp"
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
          pagination={{
            current: invoicesQuery.data?.page ?? page,
            onChange: (nextPage) => setPage(nextPage),
            pageSize: invoicesQuery.data?.limit ?? PAGE_SIZE,
            showSizeChanger: false,
            total: invoicesQuery.data?.total ?? 0,
          }}
          rowKey="_id"
          scroll={{ x: 980 }}
        />
      </Card>

      <Modal
        destroyOnHidden
        footer={null}
        onCancel={closeCreate}
        open={createOpen}
        title="Tạo hóa đơn học phí nháp"
      >
        <Form<CreateInvoiceFormValues>
          form={createForm}
          layout="vertical"
          onFinish={(values) => void createDraft(values)}
          preserve={false}
        >
          <Form.Item
            label="Học viên"
            name="learnerId"
            rules={[{ required: true, message: "Chọn học viên" }]}
          >
            <Select
              aria-label="Học viên"
              loading={invoiceOptionsQuery.isLoading}
              onChange={(nextValue) => {
                setCreateLearnerId(selectValue(nextValue));
                setCreateCohortId("");
                setCreateOrgUnitId("");
                createForm.setFieldsValue({
                  cohortId: undefined,
                  orgUnitId: undefined,
                });
              }}
              optionFilterProp="label"
              options={learnerOptions.slice(1)}
              placeholder="Chọn học viên hoạt động"
              showSearch
            />
          </Form.Item>
          <Form.Item
            extra="Gắn với lớp giúp hệ thống tự xác định đơn vị thu và kiểm tra học viên đang có trong lớp."
            label="Lớp áp dụng (khuyến nghị)"
            name="cohortId"
          >
            <Select
              allowClear
              aria-label="Lớp áp dụng"
              disabled={!createLearnerId}
              onChange={(nextValue) => {
                const value = selectValue(nextValue);
                setCreateCohortId(value);
                if (value) {
                  setCreateOrgUnitId("");
                  createForm.setFieldsValue({ orgUnitId: undefined });
                }
              }}
              optionFilterProp="label"
              options={createCohortOptions}
              placeholder="Chọn lớp của học viên"
              showSearch
            />
          </Form.Item>
          {selectedCreateCohort ? (
            <Alert
              description={
                selectedCreateCohort.orgUnitId &&
                orgUnitById.get(selectedCreateCohort.orgUnitId)
                  ? `Đơn vị thu được lấy từ lớp: ${
                      orgUnitById.get(selectedCreateCohort.orgUnitId)?.name
                    }.`
                  : "Lớp này đang vận hành theo mô hình cá nhân, không gắn đơn vị."
              }
              showIcon
              title={`${selectedCreateCohort.code} · ${selectedCreateCohort.name}`}
              type="info"
            />
          ) : soloBillingMode ? (
            <Alert
              description="Workspace chưa dùng cơ cấu chi nhánh nên hóa đơn có thể lập trực tiếp cho học viên."
              showIcon
              title="Mô hình giáo viên độc lập"
              type="info"
            />
          ) : (
            <Form.Item
              extra={
                createLearnerId && createOrgUnitOptions.length === 0
                  ? "Học viên chưa có đơn vị chính hoặc lớp đang hoạt động trong phạm vi bạn phụ trách."
                  : "Dùng khi khoản thu không thuộc một lớp cụ thể."
              }
              label="Đơn vị thu học phí"
              name="orgUnitId"
              rules={[{ required: true, message: "Chọn đơn vị thu học phí" }]}
            >
              <Select
                aria-label="Đơn vị thu học phí"
                disabled={!createLearnerId}
                onChange={(nextValue) =>
                  setCreateOrgUnitId(selectValue(nextValue))
                }
                optionFilterProp="label"
                options={createOrgUnitOptions}
                placeholder="Chọn đơn vị phù hợp với học viên"
                showSearch
              />
            </Form.Item>
          )}
          <Form.Item
            label="Nội dung thu"
            name="title"
            rules={[
              { required: true, message: "Nhập nội dung thu" },
              { min: 2, max: 200 },
            ]}
          >
            <Input maxLength={200} placeholder="Ví dụ: Học phí khóa Data đợt 1" />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea
              maxLength={1_000}
              placeholder="Thông tin bổ sung (không bắt buộc)"
              rows={3}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col sm={12} xs={24}>
              <Form.Item
                label="Số tiền"
                name="amountVnd"
                rules={[{ required: true, message: "Nhập số tiền" }]}
              >
                <InputNumber
                  addonAfter="VND"
                  min={1}
                  precision={0}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
            <Col sm={12} xs={24}>
              <Form.Item
                label="Hạn thanh toán"
                name="dueAt"
                rules={[{ required: true, message: "Chọn hạn thanh toán" }]}
              >
                <Input type="datetime-local" />
              </Form.Item>
            </Col>
          </Row>
          <Space>
            <Button onClick={closeCreate}>Hủy</Button>
            <Button
              disabled={!createLearnerId || !hasCreateBillingContext}
              htmlType="submit"
              loading={createMutation.isPending}
              type="primary"
            >
              Lưu hóa đơn nháp
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        destroyOnHidden
        footer={null}
        key={paymentInvoice?._id ?? "payment"}
        onCancel={() => {
          if (!paymentMutation.isPending) {
            setPaymentInvoice(null);
            setPaymentIdempotencyKey("");
          }
        }}
        open={Boolean(paymentInvoice)}
        title="Ghi nhận thanh toán học phí"
      >
        {paymentInvoice && (
          <Form<PaymentFormValues>
            initialValues={{
              amountVnd: paymentInvoice.balanceVnd,
              method: "CASH",
            }}
            layout="vertical"
            onFinish={(values) => void recordPayment(values)}
            preserve={false}
          >
            <Alert
              description={`Số dư hiện tại: ${money.format(paymentInvoice.balanceVnd)}`}
              showIcon
              title={paymentInvoice.invoiceNumber}
              type="info"
            />
            <Row gutter={16}>
              <Col sm={12} xs={24}>
                <Form.Item
                  label="Số tiền thanh toán"
                  name="amountVnd"
                  rules={[{ required: true, message: "Nhập số tiền" }]}
                >
                  <InputNumber
                    addonAfter="VND"
                    max={paymentInvoice.balanceVnd}
                    min={1}
                    precision={0}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </Col>
              <Col sm={12} xs={24}>
                <Form.Item
                  label="Phương thức"
                  name="method"
                  rules={[{ required: true, message: "Chọn phương thức" }]}
                >
                  <Select
                    options={[
                      { label: paymentMethodLabels.CASH, value: "CASH" },
                      {
                        label: paymentMethodLabels.BANK_TRANSFER,
                        value: "BANK_TRANSFER",
                      },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              label="Mã giao dịch"
              name="providerReference"
              extra="Nên nhập khi nhận tiền qua chuyển khoản."
            >
              <Input
                maxLength={160}
                prefix={<BankOutlined />}
                placeholder="Ví dụ: VCB-20260903-001"
              />
            </Form.Item>
            <Form.Item label="Thời điểm thanh toán" name="paidAt">
              <Input type="datetime-local" />
            </Form.Item>
            <Form.Item label="Ghi chú" name="note">
              <Input.TextArea maxLength={500} rows={3} />
            </Form.Item>
            <Space>
              <Button
                disabled={paymentMutation.isPending}
                onClick={() => {
                  setPaymentInvoice(null);
                  setPaymentIdempotencyKey("");
                }}
              >
                Hủy
              </Button>
              <Button
                htmlType="submit"
                loading={paymentMutation.isPending}
                type="primary"
              >
                Lưu thanh toán
              </Button>
            </Space>
          </Form>
        )}
      </Modal>
    </div>
  );
}
