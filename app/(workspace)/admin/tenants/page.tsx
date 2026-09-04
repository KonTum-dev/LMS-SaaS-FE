"use client";

import { PlusOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  ColorPicker,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isFormValidationError } from "@/components/form/validation-error";
import { useAuth } from "@/components/providers/app-providers";
import { DataTable } from "@/components/table/data-table";
import { TenantMembersManager } from "@/components/users/tenant-members-manager";
import { ApiError, apiFetch } from "@/lib/api";
import {
  includeLmsModulePrerequisites,
  lmsModuleOptions,
} from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import { passwordValidationError } from "@/lib/password-security";
import {
  buildTenantCreatePayload,
  buildTenantUpdatePayload,
  clearTenantProvisioningAttempt,
  createTenantProvisioningIdempotencyKey,
  loadTenantProvisioningAttempt,
  parseTenantProvisioningOperation,
  rememberTenantProvisioningAttempt,
  TENANT_PROVISIONING_ATTEMPT_TTL_MS,
  type TenantFormValues,
  type TenantProvisioningAttempt,
} from "@/lib/tenant-management";
import type {
  CurrentUser,
  LmsModule,
  Organization,
  OrganizationStatus,
  TenantProvisioningOperation,
} from "@/lib/types";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/workspace";

const STATUS_RECHECK_MAX_DELAY_SECONDS = 10;
const TERMINAL_PROVISIONING_CODES = new Set([
  "ADMIN_EMAIL_CONFLICT",
  "IDEMPOTENCY_KEY_REUSED",
  "RESOURCE_INTEGRITY_CONFLICT",
  "TENANT_SLUG_CONFLICT",
]);

type AttemptMode = "current" | "none" | "recovered";
type ModalKind = "closed" | "create" | "edit";
type ProvisioningNotice = {
  description?: string;
  operationId?: string;
  title: string;
  type: "error" | "info" | "warning";
};

function provisioningNoticeDescription(notice: ProvisioningNotice): ReactNode {
  if (!notice.description && !notice.operationId) return undefined;
  return (
    <Space direction="vertical" size={0}>
      {notice.description && <span>{notice.description}</span>}
      {notice.operationId && (
        <span>
          Mã operation:{" "}
          <Typography.Text code copyable={{ text: notice.operationId }}>
            {notice.operationId}
          </Typography.Text>
        </span>
      )}
    </Space>
  );
}

function waitForStatus(seconds: number, signal: AbortSignal): Promise<void> {
  const delay = Math.min(
    STATUS_RECHECK_MAX_DELAY_SECONDS,
    Math.max(1, Math.trunc(seconds)),
  );
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delay * 1_000);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function TenantsPage() {
  const { captureAuthGeneration, organization, token, user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") {
    return (
      <Alert
        showIcon
        title="Bạn không có quyền truy cập khu vực quản trị nền tảng."
        type="warning"
      />
    );
  }
  return (
    <PlatformTenantsPage
      key={`${user.sub}:${captureAuthGeneration()}`}
      actorId={user.sub}
      organization={organization}
      token={token}
      user={user}
    />
  );
}

function PlatformTenantsPage({
  actorId,
  organization,
  token,
  user,
}: {
  actorId: string;
  organization: Organization | null;
  token: string;
  user: CurrentUser;
}) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<TenantFormValues>();
  const [editing, setEditing] = useState<Organization | null>(null);
  const [managedTenant, setManagedTenant] = useState<Organization | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingRecovery, setCheckingRecovery] = useState(false);
  const [attemptMode, setAttemptMode] = useState<AttemptMode>("none");
  const [recoveryAttempt, setRecoveryAttempt] =
    useState<TenantProvisioningAttempt | null>(() =>
      loadTenantProvisioningAttempt(actorId),
    );
  const recoveryAttemptRef = useRef(recoveryAttempt);
  const [provisioningNotice, setProvisioningNotice] =
    useState<ProvisioningNotice | null>(null);
  const createAttemptKey = useRef<string | null>(null);
  const submitInFlight = useRef(false);
  const requestAbort = useRef<AbortController | null>(null);
  const statusAbort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const modalKind = useRef<ModalKind>("closed");
  const scope = useMemo(
    () => getViewerScope(user, organization),
    [organization, user],
  );
  const tenantsKey = useMemo(
    () =>
      scope
        ? lmsQueryKeys.tenants(scope)
        : (["lms", "signed-out", "organizations"] as const),
    [scope],
  );
  const tenantsQuery = useQuery({
    enabled: Boolean(token && scope),
    queryKey: tenantsKey,
    queryFn: () => apiFetch<Organization[]>("/organizations", { token }),
  });
  const items = tenantsQuery.data ?? [];

  useEffect(() => {
    return () => {
      generation.current += 1;
      requestAbort.current?.abort();
      statusAbort.current?.abort();
    };
  }, []);

  const resetCreateForm = useCallback(() => {
    form.resetFields();
    form.setFieldsValue({
      enabledModules: lmsModuleOptions.map((item) => item.value),
      primaryColor: DEFAULT_PRIMARY_COLOR,
    });
  }, [form]);

  const discardAttempt = useCallback(
    (resetForm = false) => {
      clearTenantProvisioningAttempt(actorId);
      createAttemptKey.current = null;
      recoveryAttemptRef.current = null;
      setAttemptMode("none");
      setRecoveryAttempt(null);
      setProvisioningNotice(null);
      if (resetForm) resetCreateForm();
    },
    [actorId, resetCreateForm],
  );

  const expireRecoveryAttempt = useCallback(() => {
    discardAttempt(modalKind.current === "create");
    setProvisioningNotice({
      description:
        "Khóa retry cũ đã được xóa. Hãy kiểm tra lại dữ liệu trước khi bắt đầu một thao tác mới.",
      title: "Thao tác khôi phục đã hết hạn",
      type: "warning",
    });
  }, [discardAttempt]);

  const finishProvisioning = useCallback(
    async (
      operation: TenantProvisioningOperation,
      expectedGeneration: number,
    ) => {
      if (
        generation.current !== expectedGeneration ||
        operation.status !== "SUCCEEDED" ||
        operation.phase !== "SUCCEEDED" ||
        !operation.organization
      ) {
        return;
      }
      clearTenantProvisioningAttempt(actorId);
      createAttemptKey.current = null;
      recoveryAttemptRef.current = null;
      setAttemptMode("none");
      setRecoveryAttempt(null);
      setProvisioningNotice(null);
      if (modalKind.current === "create") {
        form.resetFields();
        modalKind.current = "closed";
        setOpen(false);
      }
      await queryClient.invalidateQueries({ queryKey: tenantsKey });
      if (generation.current === expectedGeneration) {
        message.success("Đã tạo tổ chức và tài khoản quản trị");
      }
    },
    [actorId, form, message, queryClient, tenantsKey],
  );

  const failProvisioning = useCallback(
    (title: string, description?: string, operationId?: string) => {
      clearTenantProvisioningAttempt(actorId);
      createAttemptKey.current = null;
      recoveryAttemptRef.current = null;
      setAttemptMode("none");
      setRecoveryAttempt(null);
      setProvisioningNotice({
        description,
        ...(operationId ? { operationId } : {}),
        title,
        type: "error",
      });
      if (modalKind.current === "create") {
        form.resetFields();
        modalKind.current = "closed";
        setOpen(false);
      }
    },
    [actorId, form],
  );

  const reconcileStatus = useCallback(
    async (
      attempt: TenantProvisioningAttempt,
      waitSeconds = 0,
      expectedGeneration = generation.current,
    ) => {
      if (!attempt.operationId || statusAbort.current) return;
      const controller = new AbortController();
      statusAbort.current = controller;
      setCheckingRecovery(true);
      try {
        if (waitSeconds > 0)
          await waitForStatus(waitSeconds, controller.signal);
        const raw = await apiFetch<unknown>(
          `/organizations/provisioning/${attempt.operationId}`,
          {
            cache: "no-store",
            referrerPolicy: "no-referrer",
            signal: controller.signal,
            token,
          },
        );
        if (
          controller.signal.aborted ||
          generation.current !== expectedGeneration
        ) {
          return;
        }
        const operation = parseTenantProvisioningOperation(raw);
        if (operation.operationId !== attempt.operationId) {
          throw new Error("Mã operation trả về không khớp yêu cầu đối soát");
        }
        if (operation.status === "SUCCEEDED") {
          await finishProvisioning(operation, expectedGeneration);
          return;
        }
        if (operation.status === "FAILED") {
          failProvisioning(
            "Không thể tạo tenant",
            operation.failureCode
              ? `Mã lỗi: ${operation.failureCode}`
              : undefined,
            operation.operationId,
          );
          return;
        }
        const pendingAttempt = {
          ...attempt,
          operationId: operation.operationId,
        };
        rememberTenantProvisioningAttempt(pendingAttempt);
        recoveryAttemptRef.current = pendingAttempt;
        setRecoveryAttempt(pendingAttempt);
        setProvisioningNotice({
          description:
            "Operation vẫn đang chờ. Hãy kiểm tra lại hoặc tiếp tục bằng đúng dữ liệu của lần gửi trước.",
          title: "Tenant vẫn đang được xử lý",
          type: "warning",
        });
      } catch (caught) {
        if (
          controller.signal.aborted ||
          generation.current !== expectedGeneration
        ) {
          return;
        }
        if (caught instanceof ApiError && caught.status === 404) {
          failProvisioning(
            "Không tìm thấy thao tác tạo tenant",
            "Khóa khôi phục đã được xóa; bạn có thể bắt đầu một thao tác mới.",
            attempt.operationId,
          );
          return;
        }
        setProvisioningNotice({
          description:
            "Khóa retry vẫn được giữ trong phiên này. Bạn có thể kiểm tra lại sau.",
          title: errorMessage(caught, "Không thể kiểm tra trạng thái tenant"),
          type: "error",
        });
      } finally {
        if (statusAbort.current === controller) statusAbort.current = null;
        if (generation.current === expectedGeneration) {
          setCheckingRecovery(false);
        }
      }
    },
    [failProvisioning, finishProvisioning, token],
  );

  const showCreate = () => {
    createAttemptKey.current = null;
    setAttemptMode("none");
    if (!recoveryAttempt) setProvisioningNotice(null);
    setEditing(null);
    resetCreateForm();
    modalKind.current = "create";
    setOpen(true);
  };

  const showEdit = (tenant: Organization) => {
    createAttemptKey.current = null;
    setAttemptMode("none");
    setEditing(tenant);
    form.resetFields();
    form.setFieldsValue({
      enabledModules: tenant.enabledModules,
      logoUrl: tenant.logoUrl ?? undefined,
      name: tenant.name,
      primaryColor: tenant.primaryColor,
      slug: tenant.slug,
      status: tenant.status,
    });
    modalKind.current = "edit";
    setOpen(true);
  };

  const continueRecovery = () => {
    if (!recoveryAttempt) return;
    if (recoveryAttempt.expiresAt <= Date.now()) {
      expireRecoveryAttempt();
      return;
    }
    createAttemptKey.current = recoveryAttempt.idempotencyKey;
    setAttemptMode("recovered");
    setEditing(null);
    resetCreateForm();
    modalKind.current = "create";
    setOpen(true);
    setProvisioningNotice({
      description:
        "Điền lại chính xác dữ liệu của lần gửi trước. Lần gửi tiếp theo sẽ dùng khóa retry đã lưu.",
      title: "Đang tiếp tục thao tác cũ",
      type: "info",
    });
  };

  const cancelModal = () => {
    if (submitInFlight.current || saving || checkingRecovery) return;
    if (modalKind.current === "create" && attemptMode !== "none") {
      discardAttempt();
    }
    form.resetFields();
    createAttemptKey.current = null;
    setAttemptMode("none");
    setEditing(null);
    modalKind.current = "closed";
    setOpen(false);
  };

  const save = async () => {
    if (submitInFlight.current || saving || checkingRecovery) return;
    if (
      !editing &&
      recoveryAttempt &&
      recoveryAttempt.expiresAt <= Date.now()
    ) {
      expireRecoveryAttempt();
      return;
    }
    if (!editing && recoveryAttempt && attemptMode === "none") {
      setProvisioningNotice({
        description:
          "Hãy chọn tiếp tục bằng đúng dữ liệu cũ hoặc bỏ khóa khôi phục trước khi tạo tenant mới.",
        title: "Cần xử lý thao tác chưa hoàn tất",
        type: "warning",
      });
      return;
    }

    submitInFlight.current = true;
    const expectedGeneration = generation.current;
    let controller: AbortController | null = null;
    try {
      const values = await form.validateFields();
      if (generation.current !== expectedGeneration) return;
      controller = new AbortController();
      requestAbort.current = controller;
      setSaving(true);

      if (editing) {
        await apiFetch<Organization>(`/organizations/${editing._id}`, {
          body: JSON.stringify(buildTenantUpdatePayload(values)),
          method: "PATCH",
          signal: controller.signal,
          token,
        });
        if (
          controller.signal.aborted ||
          generation.current !== expectedGeneration
        ) {
          return;
        }
        form.resetFields();
        modalKind.current = "closed";
        setEditing(null);
        setOpen(false);
        await queryClient.invalidateQueries({ queryKey: tenantsKey });
        if (generation.current === expectedGeneration) {
          message.success("Đã cập nhật tổ chức");
        }
        return;
      }

      const createPayload = buildTenantCreatePayload(values);
      const reusableAttempt =
        recoveryAttempt &&
        recoveryAttempt.expiresAt > Date.now() &&
        createAttemptKey.current === recoveryAttempt.idempotencyKey
          ? recoveryAttempt
          : null;
      const attempt: TenantProvisioningAttempt = reusableAttempt ?? {
        actorId,
        expiresAt: Date.now() + TENANT_PROVISIONING_ATTEMPT_TTL_MS,
        idempotencyKey: createTenantProvisioningIdempotencyKey(),
        version: 1,
      };
      createAttemptKey.current = attempt.idempotencyKey;
      recoveryAttemptRef.current = attempt;
      setAttemptMode("current");
      setRecoveryAttempt(attempt);
      rememberTenantProvisioningAttempt(attempt);

      const raw = await apiFetch<unknown>("/organizations", {
        body: JSON.stringify(createPayload),
        cache: "no-store",
        headers: { "Idempotency-Key": attempt.idempotencyKey },
        method: "POST",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
        token,
      });
      if (
        controller.signal.aborted ||
        generation.current !== expectedGeneration
      ) {
        return;
      }
      const operation = parseTenantProvisioningOperation(raw);
      if (
        attempt.operationId &&
        attempt.operationId !== operation.operationId
      ) {
        throw new Error("Mã operation trả về không khớp khóa retry");
      }
      if (operation.status === "FAILED") {
        failProvisioning(
          "Không thể tạo tenant",
          operation.failureCode
            ? `Mã lỗi: ${operation.failureCode}`
            : undefined,
          operation.operationId,
        );
        return;
      }
      if (operation.status === "PENDING") {
        const pendingAttempt = {
          ...attempt,
          operationId: operation.operationId,
        };
        rememberTenantProvisioningAttempt(pendingAttempt);
        recoveryAttemptRef.current = pendingAttempt;
        setRecoveryAttempt(pendingAttempt);
        setProvisioningNotice({
          title: "Tenant chưa hoàn tất",
          description:
            "Máy chủ chưa xác nhận thành công. Khóa retry đã được giữ để đối soát.",
          type: "warning",
        });
        return;
      }
      await finishProvisioning(operation, expectedGeneration);
    } catch (caught) {
      if (
        controller?.signal.aborted ||
        generation.current !== expectedGeneration
      ) {
        return;
      }
      if (isFormValidationError(caught)) return;

      const currentAttempt =
        recoveryAttemptRef.current && createAttemptKey.current
          ? {
              ...recoveryAttemptRef.current,
              idempotencyKey: createAttemptKey.current,
            }
          : actorId && createAttemptKey.current
            ? {
                actorId,
                expiresAt: Date.now() + TENANT_PROVISIONING_ATTEMPT_TTL_MS,
                idempotencyKey: createAttemptKey.current,
                version: 1 as const,
              }
            : null;
      if (
        currentAttempt?.operationId &&
        caught instanceof ApiError &&
        caught.operationId &&
        currentAttempt.operationId !== caught.operationId
      ) {
        failProvisioning(
          "Không thể đối soát tenant",
          "Mã operation trả về không khớp khóa retry đã lưu.",
          currentAttempt.operationId,
        );
        return;
      }
      const withOperation =
        currentAttempt && caught instanceof ApiError && caught.operationId
          ? { ...currentAttempt, operationId: caught.operationId }
          : currentAttempt;

      if (
        caught instanceof ApiError &&
        TERMINAL_PROVISIONING_CODES.has(caught.code ?? "")
      ) {
        failProvisioning(
          "Không thể tạo tenant",
          caught.message,
          withOperation?.operationId ?? caught.operationId,
        );
        return;
      }
      if (withOperation) {
        rememberTenantProvisioningAttempt(withOperation);
        recoveryAttemptRef.current = withOperation;
        setRecoveryAttempt(withOperation);
      }
      if (
        withOperation?.operationId &&
        caught instanceof ApiError &&
        caught.status === 503
      ) {
        await reconcileStatus(withOperation, 0, expectedGeneration);
        return;
      }
      if (
        withOperation?.operationId &&
        caught instanceof ApiError &&
        caught.status === 409 &&
        caught.code === "TENANT_PROVISIONING_IN_PROGRESS"
      ) {
        await reconcileStatus(
          withOperation,
          caught.retryAfterSeconds ?? 1,
          expectedGeneration,
        );
        return;
      }
      setProvisioningNotice({
        description:
          "Dữ liệu nhạy cảm chỉ còn trong biểu mẫu đang mở. Không sửa dữ liệu nếu bạn muốn retry cùng thao tác.",
        title: errorMessage(caught, "Không thể lưu tổ chức"),
        type: "error",
      });
      message.error(errorMessage(caught, "Không thể lưu tổ chức"));
    } finally {
      if (requestAbort.current === controller) requestAbort.current = null;
      if (generation.current === expectedGeneration) setSaving(false);
      submitInFlight.current = false;
    }
  };

  const columns: ColumnDef<StockFeatures, Organization>[] = [
    {
      header: "Tổ chức",
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="table-primary-cell">
          <strong>{row.original.name}</strong>
          <div className="table-muted">{row.original.slug}</div>
        </div>
      ),
    },
    {
      header: "Màu thương hiệu",
      accessorKey: "primaryColor",
      cell: ({ getValue }) => {
        const value = getValue<string>();
        return (
          <Space className="tenant-brand-color">
            <span
              aria-hidden="true"
              className="tenant-brand-color__swatch"
              style={{
                background: value,
                borderRadius: 6,
                height: 22,
                width: 22,
              }}
            />
            {value}
          </Space>
        );
      },
      meta: { width: 170 },
    },
    {
      header: "Module tenant",
      accessorKey: "enabledModules",
      cell: ({ getValue }) =>
        `${getValue<LmsModule[]>().length}/${lmsModuleOptions.length} được cấp`,
      meta: { responsive: ["md"] },
    },
    {
      header: "Trạng thái",
      accessorKey: "status",
      cell: ({ getValue }) => {
        const value = getValue<OrganizationStatus>();
        return (
          <Tag color={value === "ACTIVE" ? "green" : "red"}>
            {value === "ACTIVE" ? "Hoạt động" : "Đã khóa"}
          </Tag>
        );
      },
      meta: { width: 140 },
    },
    {
      id: "action",
      header: "",
      cell: ({ row }) => (
        <div className="table-row-actions">
          <Button
            className="table-row-action"
            onClick={() => setManagedTenant(row.original)}
            title={`Quản lý thành viên ${row.original.name}`}
            type="link"
          >
            Thành viên
          </Button>
          <Button
            className="table-row-action"
            onClick={() => showEdit(row.original)}
            title={`Chỉnh sửa tổ chức ${row.original.name}`}
            type="link"
          >
            Sửa
          </Button>
        </div>
      ),
      meta: { width: 180 },
    },
  ];

  const recoveryActions = recoveryAttempt ? (
    <Space wrap>
      {recoveryAttempt.operationId && (
        <Button
          disabled={saving}
          loading={checkingRecovery}
          onClick={() => void reconcileStatus(recoveryAttempt)}
          size="small"
        >
          Kiểm tra trạng thái
        </Button>
      )}
      <Button
        disabled={saving || checkingRecovery}
        onClick={continueRecovery}
        size="small"
      >
        Tiếp tục bằng đúng dữ liệu cũ
      </Button>
      <Button
        disabled={saving || checkingRecovery}
        onClick={() => discardAttempt(modalKind.current === "create")}
        size="small"
      >
        Bỏ khóa và bắt đầu mới
      </Button>
    </Space>
  ) : null;

  return (
    <div className="page-shell">
      <div className="page-heading page-toolbar">
        <div className="page-heading-copy">
          <h1>Quản lý tổ chức</h1>
          <p>
            Tạo không gian đào tạo, kiểm soát trạng thái và cấu hình dịch vụ cho
            từng đơn vị.
          </p>
        </div>
        <Button
          className="page-toolbar-action"
          icon={<PlusOutlined />}
          onClick={showCreate}
          type="primary"
        >
          Thêm tổ chức
        </Button>
      </div>
      {!open && recoveryAttempt && (
        <Alert
          action={recoveryActions}
          description="Chỉ khóa retry và mã operation được lưu trong phiên; dữ liệu tenant và mật khẩu không được lưu."
          showIcon
          style={{ marginBottom: 18 }}
          title="Có thao tác tạo tenant chưa được đối soát"
          type="warning"
        />
      )}
      {!open && provisioningNotice && (
        <Alert
          description={provisioningNoticeDescription(provisioningNotice)}
          showIcon
          style={{ marginBottom: 18 }}
          title={provisioningNotice.title}
          type={provisioningNotice.type}
        />
      )}
      {tenantsQuery.error ? (
        <Alert
          showIcon
          title={
            tenantsQuery.error instanceof Error
              ? tenantsQuery.error.message
              : "Không tải được tổ chức"
          }
          type="error"
        />
      ) : (
        <Card className="surface-card table-surface">
          <DataTable
            ariaLabel="Danh sách tổ chức"
            columns={columns}
            data={items}
            emptyText="Chưa có tổ chức"
            loading={tenantsQuery.isLoading}
            pageSize={8}
            rowKey="_id"
            scrollX={760}
          />
        </Card>
      )}
      <Modal
        cancelButtonProps={{ disabled: saving || checkingRecovery }}
        cancelText="Hủy"
        closable={!saving && !checkingRecovery}
        confirmLoading={saving}
        keyboard={!saving && !checkingRecovery}
        maskClosable={!saving && !checkingRecovery}
        okButtonProps={{
          disabled:
            checkingRecovery ||
            (!editing && Boolean(recoveryAttempt) && attemptMode === "none"),
        }}
        okText={editing ? "Lưu thay đổi" : "Tạo tổ chức"}
        onCancel={cancelModal}
        onOk={() => void save()}
        open={open}
        title={editing ? "Cập nhật tổ chức" : "Tạo tổ chức mới"}
      >
        {!editing && recoveryAttempt && attemptMode === "none" && (
          <Alert
            action={recoveryActions}
            description="Chọn cách xử lý trước khi gửi một yêu cầu tạo tenant khác."
            showIcon
            style={{ marginTop: 18 }}
            title="Có thao tác cũ cần đối soát"
            type="warning"
          />
        )}
        {provisioningNotice && (
          <Alert
            description={provisioningNoticeDescription(provisioningNotice)}
            showIcon
            style={{ marginTop: 18 }}
            title={provisioningNotice.title}
            type={provisioningNotice.type}
          />
        )}
        <Form
          disabled={saving || checkingRecovery}
          form={form}
          layout="vertical"
          onValuesChange={() => {
            if (
              !editing &&
              attemptMode === "current" &&
              !submitInFlight.current &&
              !saving
            ) {
              discardAttempt();
              setProvisioningNotice({
                description:
                  "Lần gửi tiếp theo sẽ dùng khóa mới vì dữ liệu đã thay đổi.",
                title: "Đã bắt đầu thao tác mới",
                type: "info",
              });
            }
          }}
          requiredMark={false}
          style={{ marginTop: 22 }}
        >
          <Form.Item
            label="Tên tổ chức"
            name="name"
            rules={[
              {
                required: true,
                min: 2,
                message: "Tên cần ít nhất 2 ký tự",
              },
              { max: 160, message: "Tên không được vượt quá 160 ký tự" },
            ]}
          >
            <Input maxLength={160} placeholder="Bright Academy" />
          </Form.Item>
          <Form.Item
            extra="Dùng chữ thường, số và dấu gạch ngang."
            label="Mã đường dẫn tổ chức"
            name="slug"
            rules={[
              {
                required: true,
                pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                message: "Dùng chữ thường, số và dấu gạch ngang",
              },
              {
                max: 100,
                message: "Mã đường dẫn không được vượt quá 100 ký tự",
              },
            ]}
          >
            <Input maxLength={100} placeholder="bright-academy" />
          </Form.Item>
          {editing && (
            <Form.Item label="Trạng thái" name="status">
              <Select
                options={[
                  { label: "Hoạt động", value: "ACTIVE" },
                  { label: "Khóa truy cập", value: "SUSPENDED" },
                ]}
              />
            </Form.Item>
          )}
          <Form.Item
            label="Màu thương hiệu"
            name="primaryColor"
            rules={[{ required: true }]}
          >
            <ColorPicker showText />
          </Form.Item>
          <Form.Item
            label="Đường dẫn ảnh logo"
            name="logoUrl"
            rules={[
              {
                type: "url",
                message: "Nhập đường dẫn đầy đủ gồm http/https",
              },
              {
                max: 2048,
                message: "Đường dẫn không được vượt quá 2.048 ký tự",
              },
            ]}
          >
            <Input maxLength={2048} placeholder="https://..." />
          </Form.Item>
          <Form.Item
            extra="Ghi danh và Tài liệu riêng tư cần Khóa học; Bài tập và Bài kiểm tra cần cả Ghi danh lẫn Khóa học. Các module bắt buộc sẽ được chọn tự động."
            label="Module tối đa tenant được phép dùng"
            name="enabledModules"
            normalize={(modules: LmsModule[] | undefined) =>
              includeLmsModulePrerequisites(modules ?? [])
            }
            rules={[{ required: true, message: "Chọn ít nhất một module" }]}
          >
            <Checkbox.Group options={lmsModuleOptions} />
          </Form.Item>
          {!editing && (
            <>
              <Form.Item
                label="Tên quản trị viên đầu tiên"
                name="adminFullName"
                rules={[
                  {
                    required: true,
                    min: 2,
                    message: "Nhập họ tên quản trị viên",
                  },
                  {
                    max: 160,
                    message: "Họ tên không được vượt quá 160 ký tự",
                  },
                ]}
              >
                <Input maxLength={160} />
              </Form.Item>
              <Form.Item
                label="Email quản trị viên"
                name="adminEmail"
                rules={[
                  {
                    required: true,
                    type: "email",
                    message: "Email chưa hợp lệ",
                  },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Mật khẩu ban đầu"
                name="adminPassword"
                rules={[
                  {
                    required: true,
                    validator: async (_, value: unknown) => {
                      const issue = passwordValidationError(
                        typeof value === "string" ? value : "",
                      );
                      if (issue) throw new Error(issue);
                    },
                  },
                ]}
              >
                <Input.Password />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
      <TenantMembersManager
        onClose={() => setManagedTenant(null)}
        tenant={managedTenant}
      />
    </div>
  );
}
