"use client";
import { describeOperationsError } from "@/lib/i18n/operations-errors";
import { useI18n } from "@/components/i18n/i18n-provider";
import { operationsPolishMessages as operationsMessages } from "@/lib/i18n/learning-polish-messages";
import polish from "@/components/layout/learning-polish.module.css";
import { useMemo as useI18nMemo } from "react";

import { useFeedback } from "@/components/feedback/feedback-provider";

import {
  BankOutlined,
  DollarOutlined,
  PlusOutlined,
  SendOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Col, Empty, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag, Typography } from "antd";
import { Form } from "@/components/form/localized-form";
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

export default function TuitionPage() {
  const {
    t,
    money,
    statusPresentation,
    statusOptions,
    paymentMethodLabels,
    tuitionRootKey,
    tuitionInvoiceListKey,
    formatDate,
    positiveVnd,
    requiredIsoDate,
    optionalIsoDate,
    selectValue,
    locale,
  } = useOperationsCopy();
  const { message, reportError } = useFeedback();
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
    () =>
      new Map(learners.map((learner) => [learner.userId, learner.fullName])),
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
      { label: t("Không gắn với lớp"), value: "" },
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
    [cohortById, orgUnitById, selectedCreateLearner?.cohortIds, t],
  );
  const eligibleCreateOrgUnitIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedCreateLearner?.orgUnitId)
      ids.add(selectedCreateLearner.orgUnitId);
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
      { label: t("Mọi học viên"), value: "" },
      ...learners.map((learner) => ({
        label: `${learner.fullName} · ${learner.email}`,
        value: learner.userId,
      })),
    ],
    [learners, t],
  );

  const invoices = useMemo(
    () => invoicesQuery.data?.items ?? [],
    [invoicesQuery.data?.items],
  );
  const summary = useMemo(
    () => ({
      balance: invoices.reduce(
        (total, invoice) => total + invoice.balanceVnd,
        0,
      ),
      overdue: invoices.filter((invoice) => invoice.status === "OVERDUE")
        .length,
      paid: invoices.reduce(
        (total, invoice) => total + invoice.paidAmountVnd,
        0,
      ),
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
        dueAt: requiredIsoDate(values.dueAt, t("Hạn thanh toán")),
        learnerId: values.learnerId,
        title: values.title.trim(),
      });
    } catch (caught) {
      reportError(caught, "Không thể tạo hóa đơn");
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
      reportError(caught, "Không thể phát hành hóa đơn");
    }
  };

  const voidInvoice = async (invoiceId: string) => {
    try {
      await voidMutation.mutateAsync(invoiceId);
    } catch (caught) {
      reportError(caught, "Không thể hủy hóa đơn");
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
      reportError(caught, "Không thể ghi nhận thanh toán");
    }
  };

  const columns: ColumnsType<TuitionInvoice> = [
    {
      key: "invoice",
      width: 240,
      render: (_, invoice) => (
        <div>
          <Typography.Text className={polish.invoiceNumber} copyable>{invoice.invoiceNumber}</Typography.Text>
          <strong className={polish.invoiceTitle}>{invoice.title}</strong>
          {invoice.description && (
            <details className={polish.invoiceNote}>
              <summary>{t("Ghi chú")}</summary>
              <p>{invoice.description}</p>
            </details>
          )}
        </div>
      ),
      title: t("Hóa đơn"),
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
                    t("Học viên được liên kết")}
                </strong>
                <div className="table-muted">
                  {invoice.learner?.email ?? value}
                </div>
              </div>
            ),
            responsive: ["sm" as const],
            title: t("Học viên"),
          },
        ]
      : []),
    {
      dataIndex: "amountVnd",
      key: "amount",
      render: (value: number) => <span className={polish.money}>{money.format(value)}</span>,
      title: t("Phải thu"),
    },
    {
      key: "collected",
      render: (_, invoice) => (
        <div className={polish.money}>
          <strong>{money.format(invoice.paidAmountVnd)}</strong>
          <div className="table-muted">
            {t("Còn")} {money.format(invoice.balanceVnd)}
          </div>
        </div>
      ),
      responsive: ["md"],
      title: t("Đã thu"),
    },
    {
      dataIndex: "dueAt",
      key: "dueAt",
      render: (value: string) => value ? <time className={polish.date} dateTime={value} title={formatDate(value)}>{formatDate(value, true)}</time> : "—",
      responsive: ["lg"],
      title: t("Hạn thanh toán"),
    },
    {
      dataIndex: "status",
      key: "status",
      render: (value: TuitionInvoiceStatus) => {
        const presentation = statusPresentation[value];
        return <Tag color={presentation.color}>{presentation.label}</Tag>;
      },
      title: t("Trạng thái"),
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
                return null;
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
                      {t("Phát hành")}{" "}
                    </Button>
                  )}
                  {canPay && (
                    <Button
                      disabled={!canManageInvoice}
                      icon={<DollarOutlined />}
                      onClick={() => openPayment(invoice)}
                      size="small"
                    >
                      {t("Ghi nhận thanh toán")}{" "}
                    </Button>
                  )}
                  {canVoid && (
                    <Popconfirm
                      cancelText={t("Giữ hóa đơn")}
                      disabled={!canManageInvoice}
                      okText={t("Xác nhận hủy")}
                      onConfirm={() => voidInvoice(invoice._id)}
                      title={t("Hủy hóa đơn này?")}
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
                        {t("Hủy hóa đơn")}{" "}
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
              );
            },
            title: t("Thao tác"),
          },
        ]
      : []),
  ];

  if (!supportedRole) {
    return (
      <Alert
        showIcon
        title={t(
          "Học phí chỉ dành cho quản trị tổ chức, học viên và phụ huynh.",
        )}
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

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <h1>{t("Học phí")}</h1>
          <p>
            {isTenantAdmin
              ? t(
                  "Theo dõi công nợ, phát hành hóa đơn và ghi nhận các khoản đã thu.",
                )
              : t(
                  "Theo dõi hóa đơn, hạn thanh toán và lịch sử các khoản đã ghi nhận.",
                )}
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
                ? t("Gia hạn thuê bao để tạo hóa đơn học phí")
                : invoiceOptions?.scoped && invoiceOptions.orgUnits.length === 0
                  ? t("Bạn chưa có đơn vị được phép thu học phí")
                  : undefined
            }
            type="primary"
          >
            {t("Tạo hóa đơn")}{" "}
          </Button>
        )}
      </div>

      {isTenantAdmin && readOnly && (
        <Alert
          description={t(
            "Bạn vẫn có thể xem và lọc dữ liệu; tạo, phát hành, hủy và ghi nhận thanh toán đang tạm khóa.",
          )}
          showIcon
          title={t("Workspace đang ở chế độ chỉ đọc")}
          type="warning"
        />
      )}
      {invoicesQuery.error && (
        <Alert
          action={
            <Button loading={invoicesQuery.isFetching} onClick={() => void invoicesQuery.refetch()} size="small">
              {t("Thử lại")}{" "}
            </Button>
          }
          description={
            invoicesQuery.error instanceof Error
              ? describeOperationsError(
                  invoicesQuery.error,
                  locale,
                  t("Không thể tải danh sách hóa đơn"),
                )
              : t("Không thể tải danh sách hóa đơn")
          }
          showIcon
          title={t("Không tải được học phí")}
          type="error"
        />
      )}
      {isTenantAdmin && invoiceOptionsQuery.error && (
        <Alert
          description={t(
            "Danh sách hóa đơn vẫn dùng được, nhưng chưa thể chọn đúng học viên, lớp và đơn vị để lập hóa đơn mới.",
          )}
          showIcon
          title={t("Không tải được danh mục lập hóa đơn")}
          type="warning"
        />
      )}
      {isTenantAdmin &&
        invoiceOptions?.scoped &&
        invoiceOptions.orgUnits.length === 0 && (
          <Alert
            description={t(
              "Bạn vẫn có thể xem hóa đơn trong phạm vi hiện tại, nhưng cần quyền Nhân sự vận hành trở lên tại ít nhất một đơn vị để lập và thu học phí.",
            )}
            showIcon
            title={t("Chưa có đơn vị được phép thu học phí")}
            type="info"
          />
        )}

      <div className={polish.summary} aria-label={t("Số liệu trang hiện tại")}>
        <span>{t("Đã thu (trang này)")}<strong>{money.format(summary.paid)}</strong></span>
        <span>{t("Còn phải thu (trang này)")}<strong>{money.format(summary.balance)}</strong></span>
        <span>{t("Quá hạn (trang này)")}<strong>{summary.overdue}</strong></span>
      </div>

      <Card className="surface-card" title={t("Danh sách hóa đơn")} extra={<Typography.Text type="secondary">{t("Tổng số hóa đơn")}: {invoicesQuery.data?.total ?? 0}</Typography.Text>}>
        <div className={`list-filter-bar ${polish.tableFilters}`}>
          <Select<TuitionInvoiceStatus | "">
            aria-label={t("Lọc theo trạng thái")}
            onChange={(nextValue) => {
              const value = selectValue(nextValue) as TuitionInvoiceStatus | "";
              setStatus(value || undefined);
              setPage(1);
            }}
            options={statusOptions}
            value={status ?? ""}
          />
          {isTenantAdmin && (
            <Select<string>
              aria-label={t("Lọc theo học viên")}
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
        </div>

        <Table<TuitionInvoice>
          columns={columns}
          dataSource={invoices}
          loading={invoicesQuery.isLoading}
          locale={{
            emptyText: (
              <Empty
                description={
                  isLearner
                    ? t("Bạn chưa có hóa đơn học phí")
                    : t("Chưa có hóa đơn phù hợp")
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
        title={t("Tạo hóa đơn học phí nháp")}
      >
        <Form<CreateInvoiceFormValues>
          form={createForm}
          layout="vertical"
          onFinish={(values) => void createDraft(values)}
          preserve={false}
        >
          <Form.Item
            label={t("Học viên")}
            name="learnerId"
            rules={[{ required: true, message: t("Chọn học viên") }]}
          >
            <Select
              aria-label={t("Học viên")}
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
              placeholder={t("Chọn học viên hoạt động")}
              showSearch
            />
          </Form.Item>
          <Form.Item
            extra={t(
              "Gắn với lớp giúp hệ thống tự xác định đơn vị thu và kiểm tra học viên đang có trong lớp.",
            )}
            label={t("Lớp áp dụng (khuyến nghị)")}
            name="cohortId"
          >
            <Select
              allowClear
              aria-label={t("Lớp áp dụng")}
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
              placeholder={t("Chọn lớp của học viên")}
              showSearch
            />
          </Form.Item>
          {selectedCreateCohort ? (
            <Alert
              description={
                selectedCreateCohort.orgUnitId &&
                orgUnitById.get(selectedCreateCohort.orgUnitId)
                  ? t("Đơn vị thu được lấy từ lớp: {value0}.", {
                      value0:
                        orgUnitById.get(selectedCreateCohort.orgUnitId)?.name ??
                        "—",
                    })
                  : t(
                      "Lớp này đang vận hành theo mô hình cá nhân, không gắn đơn vị.",
                    )
              }
              showIcon
              title={`${selectedCreateCohort.code} · ${selectedCreateCohort.name}`}
              type="info"
            />
          ) : soloBillingMode ? (
            <Alert
              description={t(
                "Workspace chưa dùng cơ cấu chi nhánh nên hóa đơn có thể lập trực tiếp cho học viên.",
              )}
              showIcon
              title={t("Mô hình giáo viên độc lập")}
              type="info"
            />
          ) : (
            <Form.Item
              extra={
                createLearnerId && createOrgUnitOptions.length === 0
                  ? t(
                      "Học viên chưa có đơn vị chính hoặc lớp đang hoạt động trong phạm vi bạn phụ trách.",
                    )
                  : t("Dùng khi khoản thu không thuộc một lớp cụ thể.")
              }
              label={t("Đơn vị thu học phí")}
              name="orgUnitId"
              rules={[
                { required: true, message: t("Chọn đơn vị thu học phí") },
              ]}
            >
              <Select
                aria-label={t("Đơn vị thu học phí")}
                disabled={!createLearnerId}
                onChange={(nextValue) =>
                  setCreateOrgUnitId(selectValue(nextValue))
                }
                optionFilterProp="label"
                options={createOrgUnitOptions}
                placeholder={t("Chọn đơn vị phù hợp với học viên")}
                showSearch
              />
            </Form.Item>
          )}
          <Form.Item
            label={t("Nội dung thu")}
            name="title"
            rules={[
              { required: true, message: t("Nhập nội dung thu") },
              { min: 2, max: 200 },
            ]}
          >
            <Input
              maxLength={200}
              placeholder={t("Ví dụ: Học phí khóa Data đợt 1")}
            />
          </Form.Item>
          <Form.Item label={t("Mô tả")} name="description">
            <Input.TextArea
              maxLength={1_000}
              placeholder={t("Thông tin bổ sung (không bắt buộc)")}
              rows={3}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col sm={12} xs={24}>
              <Form.Item
                label={t("Số tiền")}
                name="amountVnd"
                rules={[{ required: true, message: t("Nhập số tiền") }]}
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
                label={t("Hạn thanh toán")}
                name="dueAt"
                rules={[{ required: true, message: t("Chọn hạn thanh toán") }]}
              >
                <Input type="datetime-local" />
              </Form.Item>
            </Col>
          </Row>
          <Space>
            <Button onClick={closeCreate}>{t("Hủy")}</Button>
            <Button
              disabled={!createLearnerId || !hasCreateBillingContext}
              htmlType="submit"
              loading={createMutation.isPending}
              type="primary"
            >
              {t("Lưu hóa đơn nháp")}{" "}
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
        title={t("Ghi nhận thanh toán học phí")}
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
              description={t("Số dư hiện tại: {value0}", {
                value0: money.format(paymentInvoice.balanceVnd),
              })}
              showIcon
              title={paymentInvoice.invoiceNumber}
              type="info"
            />
            <Row gutter={16}>
              <Col sm={12} xs={24}>
                <Form.Item
                  label={t("Số tiền thanh toán")}
                  name="amountVnd"
                  rules={[{ required: true, message: t("Nhập số tiền") }]}
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
                  label={t("Phương thức")}
                  name="method"
                  rules={[{ required: true, message: t("Chọn phương thức") }]}
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
              label={t("Mã giao dịch")}
              name="providerReference"
              extra={t("Nên nhập khi nhận tiền qua chuyển khoản.")}
            >
              <Input
                maxLength={160}
                prefix={<BankOutlined />}
                placeholder={t("Ví dụ: VCB-20260903-001")}
              />
            </Form.Item>
            <Form.Item label={t("Thời điểm thanh toán")} name="paidAt">
              <Input type="datetime-local" />
            </Form.Item>
            <Form.Item label={t("Ghi chú")} name="note">
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
                {t("Hủy")}{" "}
              </Button>
              <Button
                htmlType="submit"
                loading={paymentMutation.isPending}
                type="primary"
              >
                {t("Lưu thanh toán")}{" "}
              </Button>
            </Space>
          </Form>
        )}
      </Modal>
    </div>
  );
}

function useOperationsCopy() {
  const i18n = useI18n(operationsMessages);
  return useI18nMemo(() => {
    const { t, locale } = i18n;
    const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN", {
      currency: "VND",
      maximumFractionDigits: 0,
      style: "currency",
    });

    const dateTime = new Intl.DateTimeFormat(
      locale === "en" ? "en-US" : "vi-VN",
      {
        dateStyle: "medium",
        timeStyle: "short",
      },
    );
    const shortDate = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });

    const statusPresentation: Record<
      TuitionInvoiceStatus,
      { color: string; label: string }
    > = {
      DRAFT: { color: "default", label: t("Bản nháp") },
      ISSUED: { color: "processing", label: t("Chờ thanh toán") },
      OVERDUE: { color: "red", label: t("Quá hạn") },
      PAID: { color: "green", label: t("Đã thanh toán") },
      PARTIALLY_PAID: { color: "gold", label: t("Đã thanh toán một phần") },
      VOID: { color: "default", label: t("Đã hủy") },
    };

    const statusOptions: Array<{
      label: string;
      value: TuitionInvoiceStatus | "";
    }> = [
      { label: t("Mọi trạng thái"), value: "" },
      { label: t("Bản nháp"), value: "DRAFT" },
      { label: t("Chờ thanh toán"), value: "ISSUED" },
      { label: t("Đã thanh toán một phần"), value: "PARTIALLY_PAID" },
      { label: t("Đã thanh toán"), value: "PAID" },
      { label: t("Quá hạn"), value: "OVERDUE" },
      { label: t("Đã hủy"), value: "VOID" },
    ];

    const paymentMethodLabels: Record<TuitionPaymentMethod, string> = {
      BANK_TRANSFER: t("Chuyển khoản"),
      CARD: t("Thẻ"),
      CASH: t("Tiền mặt"),
      OTHER: t("Khác"),
    };

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

    function formatDate(value?: string, dateOnly = false): string {
      if (!value) return "—";
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? "—" : (dateOnly ? shortDate : dateTime).format(parsed);
    }

    function positiveVnd(value: number | string, maximum?: number): number {
      const amount = Number(value);
      if (!Number.isSafeInteger(amount) || amount < 1) {
        throw new Error(t("Số tiền phải là số nguyên VND lớn hơn 0"));
      }
      if (maximum !== undefined && amount > maximum) {
        throw new Error(t("Số tiền thanh toán vượt số dư hóa đơn"));
      }
      return amount;
    }

    function requiredIsoDate(value: string, label: string): string {
      const timestamp = Date.parse(value);
      if (!value || Number.isNaN(timestamp)) {
        throw new Error(t("{value0} không hợp lệ", { value0: label }));
      }
      return new Date(timestamp).toISOString();
    }

    function optionalIsoDate(value?: string): string | undefined {
      if (!value?.trim()) return undefined;
      return requiredIsoDate(value, t("Thời điểm thanh toán"));
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
    return {
      ...i18n,
      money,
      dateTime,
      statusPresentation,
      statusOptions,
      paymentMethodLabels,
      tuitionRootKey,
      tuitionInvoiceListKey,
      formatDate,
      positiveVnd,
      requiredIsoDate,
      optionalIsoDate,
      selectValue,
    };
  }, [i18n]);
}
