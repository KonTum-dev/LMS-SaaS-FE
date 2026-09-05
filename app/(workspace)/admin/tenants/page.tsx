"use client";
import { describeOperationsError } from "@/lib/i18n/operations-errors";
import { useI18n } from "@/components/i18n/i18n-provider";
import { operationsMessages } from "@/lib/i18n/operations-messages";
import { workspacePolishMessages } from "@/lib/i18n/workspace-polish-messages";
import { useMemo as useI18nMemo } from "react";

import { useFeedback } from "@/components/feedback/feedback-provider";

import { EllipsisOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  ColorPicker,
  Descriptions,
  Dropdown,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { Form } from "@/components/form/localized-form";
import { ModulePicker } from "@/components/form/module-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ProfileImageEditor } from "@/components/account-security/profile-image-editor";
import { useAuth } from "@/components/providers/app-providers";
import { DataTable } from "@/components/table/data-table";
import { TenantMembersManager } from "@/components/users/tenant-members-manager";
import { ApiError, apiFetch } from "@/lib/api";
import {
  includeLmsModulePrerequisites,
  lmsModuleLabels,
  lmsModuleOptions,
} from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import { passwordValidationError } from "@/lib/password-security";
import { organizationLogoApi } from "@/lib/profile-api";
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
import { normalizeListSearch } from "@/lib/list-controls";

const STATUS_RECHECK_MAX_DELAY_SECONDS = 10;
const tenantMessages = { ...operationsMessages, ...workspacePolishMessages };
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

export default function TenantsPage() {
  const { t } = useOperationsCopy();
  const { captureAuthGeneration, organization, token, user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") {
    return (
      <Alert
        showIcon
        title={t("Bạn không có quyền truy cập khu vực quản trị nền tảng.")}
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
  const {
    t,
    locale,
    provisioningNoticeDescription,
    waitForStatus,
    errorMessage,
    lmsModuleLabels,
    lmsModuleOptions,
  } = useOperationsCopy();
  const { message, modal, reportError } = useFeedback();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<TenantFormValues>();
  const [editing, setEditing] = useState<Organization | null>(null);
  const [managedTenant, setManagedTenant] = useState<Organization | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrganizationStatus>();
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
  const lifecycleInFlight = useRef<Promise<Organization> | null>(null);
  const requestAbort = useRef<AbortController | null>(null);
  const statusAbort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const modalKind = useRef<ModalKind>("closed");
  const modulesDisclosureRef = useRef<HTMLDetailsElement>(null);
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
  const tenantDetail = useQuery({
    enabled: Boolean(token && scope && selectedTenantId),
    queryFn: () =>
      apiFetch<Organization>(`/organizations/${selectedTenantId}`, { token }),
    queryKey: [...tenantsKey, "detail", selectedTenantId],
  });
  const normalizedSearch = normalizeListSearch(search);
  const items = (tenantsQuery.data ?? []).filter(
    (tenant) =>
      (!statusFilter || tenant.status === statusFilter) &&
      normalizeListSearch(`${tenant.name} ${tenant.slug}`).includes(normalizedSearch),
  );
  const tenantLifecycle = useMutation({
    mutationFn: (tenant: Organization) =>
      apiFetch<Organization>(
        `/organizations/${tenant._id}${tenant.status === "ACTIVE" ? "" : "/restore"}`,
        { method: tenant.status === "ACTIVE" ? "DELETE" : "POST", token },
      ),
    onError: (error) =>
      reportError(error, "Không thể cập nhật trạng thái tổ chức"),
    onSuccess: async (tenant) => {
      message.success(
        tenant.status === "ACTIVE" ? "Đã khôi phục tổ chức" : "Đã khóa tổ chức",
      );
      setManagedTenant((current) =>
        current?._id === tenant._id ? tenant : current,
      );
      await queryClient.invalidateQueries({ queryKey: tenantsKey });
    },
  });
  const requestTenantLifecycle = (tenant: Organization) => {
    const suspending = tenant.status === "ACTIVE";
    modal.confirm({
      cancelText: t("Hủy"),
      content: suspending
        ? t(
            "Thành viên sẽ không thể truy cập tổ chức này. Không xóa tài khoản, khóa học hay dữ liệu; có thể khôi phục tổ chức sau.",
          )
        : t(
            "Tổ chức sẽ hoạt động trở lại. Trạng thái tài khoản, thành viên và quyền lợi thuê bao vẫn được kiểm tra riêng.",
          ),
      okButtonProps: { danger: suspending },
      okText: suspending ? t("Khóa tổ chức") : t("Khôi phục"),
      onOk: () => {
        if (lifecycleInFlight.current) return lifecycleInFlight.current;
        const pending = tenantLifecycle.mutateAsync(tenant).finally(() => {
          lifecycleInFlight.current = null;
        });
        lifecycleInFlight.current = pending;
        return pending;
      },
      title: t("{value0} tổ chức {value1}?", {
        value0: suspending ? t("Khóa") : t("Khôi phục"),
        value1: tenant.name,
      }),
    });
  };

  useEffect(() => {
    return () => {
      generation.current += 1;
      requestAbort.current?.abort();
      statusAbort.current?.abort();
    };
  }, []);

  const resetCreateForm = useCallback(() => {
    if (modulesDisclosureRef.current) modulesDisclosureRef.current.open = false;
    form.resetFields();
    form.setFieldsValue({
      enabledModules: lmsModuleOptions.map((item) => item.value),
      primaryColor: DEFAULT_PRIMARY_COLOR,
    });
  }, [form, lmsModuleOptions]);

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
      description: t(
        "Khóa retry cũ đã được xóa. Hãy kiểm tra lại dữ liệu trước khi bắt đầu một thao tác mới.",
      ),
      title: t("Thao tác khôi phục đã hết hạn"),
      type: "warning",
    });
  }, [discardAttempt, t]);

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
          throw new Error(t("Mã operation trả về không khớp yêu cầu đối soát"));
        }
        if (operation.status === "SUCCEEDED") {
          await finishProvisioning(operation, expectedGeneration);
          return;
        }
        if (operation.status === "FAILED") {
          failProvisioning(
            t("Không thể tạo tenant"),
            operation.failureCode
              ? t("Mã lỗi: {value0}", { value0: operation.failureCode })
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
          description: t(
            "Operation vẫn đang chờ. Hãy kiểm tra lại hoặc tiếp tục bằng đúng dữ liệu của lần gửi trước.",
          ),
          title: t("Tenant vẫn đang được xử lý"),
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
            t("Không tìm thấy thao tác tạo tenant"),
            t(
              "Khóa khôi phục đã được xóa; bạn có thể bắt đầu một thao tác mới.",
            ),
            attempt.operationId,
          );
          return;
        }
        setProvisioningNotice({
          description: t(
            "Khóa retry vẫn được giữ trong phiên này. Bạn có thể kiểm tra lại sau.",
          ),
          title: errorMessage(
            caught,
            t("Không thể kiểm tra trạng thái tenant"),
          ),
          type: "error",
        });
      } finally {
        if (statusAbort.current === controller) statusAbort.current = null;
        if (generation.current === expectedGeneration) {
          setCheckingRecovery(false);
        }
      }
    },
    [
      errorMessage,
      failProvisioning,
      finishProvisioning,
      t,
      token,
      waitForStatus,
    ],
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
    if (modulesDisclosureRef.current) modulesDisclosureRef.current.open = false;
    createAttemptKey.current = null;
    setAttemptMode("none");
    setEditing(tenant);
    form.resetFields();
    form.setFieldsValue({
      enabledModules: tenant.enabledModules,
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
      description: t(
        "Điền lại chính xác dữ liệu của lần gửi trước. Lần gửi tiếp theo sẽ dùng khóa retry đã lưu.",
      ),
      title: t("Đang tiếp tục thao tác cũ"),
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

  const applyTenantLogo = async (updated: Organization) => {
    setEditing((current) => (current?._id === updated._id ? updated : current));
    queryClient.setQueryData<Organization[]>(tenantsKey, (current) =>
      current?.map((tenant) => (tenant._id === updated._id ? updated : tenant)),
    );
    await queryClient.invalidateQueries({ queryKey: tenantsKey });
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
        description: t(
          "Hãy chọn tiếp tục bằng đúng dữ liệu cũ hoặc bỏ khóa khôi phục trước khi tạo tenant mới.",
        ),
        title: t("Cần xử lý thao tác chưa hoàn tất"),
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
        throw new Error(t("Mã operation trả về không khớp khóa retry"));
      }
      if (operation.status === "FAILED") {
        failProvisioning(
          t("Không thể tạo tenant"),
          operation.failureCode
            ? t("Mã lỗi: {value0}", { value0: operation.failureCode })
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
          title: t("Tenant chưa hoàn tất"),
          description: t(
            "Máy chủ chưa xác nhận thành công. Khóa retry đã được giữ để đối soát.",
          ),
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
      if (isFormValidationError(caught)) {
        const first = (caught as { errorFields: Array<{ name?: (string | number)[] }> }).errorFields[0]?.name;
        if (first?.[0] === "enabledModules" && modulesDisclosureRef.current) {
          modulesDisclosureRef.current.open = true;
        }
        if (first) form.scrollToField(first, { block: "nearest", behavior: "auto", focus: true });
        return;
      }

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
          t("Không thể đối soát tenant"),
          t("Mã operation trả về không khớp khóa retry đã lưu."),
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
          t("Không thể tạo tenant"),
          describeOperationsError(caught, locale),
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
        description: t(
          "Dữ liệu nhạy cảm chỉ còn trong biểu mẫu đang mở. Không sửa dữ liệu nếu bạn muốn retry cùng thao tác.",
        ),
        title: errorMessage(caught, t("Không thể lưu tổ chức")),
        type: "error",
      });
      reportError(caught, "Không thể lưu tổ chức");
    } finally {
      if (requestAbort.current === controller) requestAbort.current = null;
      if (generation.current === expectedGeneration) setSaving(false);
      submitInFlight.current = false;
    }
  };

  const columns: ColumnDef<StockFeatures, Organization>[] = [
    {
      header: t("Tổ chức"),
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="table-primary-cell">
          <strong>{row.original.name}</strong>
          <div className="table-muted">{row.original.slug}</div>
        </div>
      ),
    },
    {
      header: t("Module của tổ chức"),
      accessorKey: "enabledModules",
      cell: ({ getValue }) =>
        t("{value0}/{value1} được cấp", {
          value0: getValue<LmsModule[]>().length,
          value1: lmsModuleOptions.length,
        }),
      meta: { responsive: ["md"] },
    },
    {
      header: t("Trạng thái"),
      accessorKey: "status",
      cell: ({ getValue }) => {
        const value = getValue<OrganizationStatus>();
        return (
          <Tag color={value === "ACTIVE" ? "green" : "red"}>
            {value === "ACTIVE" ? t("Hoạt động") : t("Đã khóa")}
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
            aria-label={t("Xem chi tiết tổ chức {value0}", {
              value0: row.original.name,
            })}
            onClick={() => setSelectedTenantId(row.original._id)}
            type="link"
          >
            {t("Chi tiết")}{" "}
          </Button>
          <Dropdown
            trigger={["click"]}
            menu={{ items: [
              { key: "members", label: t("Thành viên"), onClick: () => setManagedTenant(row.original) },
              { key: "edit", label: t("Sửa"), disabled: tenantLifecycle.isPending || saving, onClick: () => showEdit(row.original) },
              { type: "divider" },
              { key: "lifecycle", label: row.original.status === "ACTIVE" ? t("Khóa") : t("Khôi phục"), danger: row.original.status === "ACTIVE", disabled: tenantLifecycle.isPending || saving, onClick: () => requestTenantLifecycle(row.original) },
            ] }}
          >
            <Button
              aria-label={t("Thao tác với tổ chức {name}", { name: row.original.name })}
              disabled={tenantLifecycle.isPending || saving}
              loading={tenantLifecycle.isPending && tenantLifecycle.variables?._id === row.original._id}
              icon={<EllipsisOutlined />}
              title={t("Thao tác khác")}
            />
          </Dropdown>
        </div>
      ),
      meta: { width: 160 },
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
          {t("Kiểm tra trạng thái")}{" "}
        </Button>
      )}
      <Button
        disabled={saving || checkingRecovery}
        onClick={continueRecovery}
        size="small"
      >
        {t("Tiếp tục bằng đúng dữ liệu cũ")}{" "}
      </Button>
      <Button
        disabled={saving || checkingRecovery}
        onClick={() => discardAttempt(modalKind.current === "create")}
        size="small"
      >
        {t("Bỏ khóa và bắt đầu mới")}{" "}
      </Button>
    </Space>
  ) : null;

  return (
    <div className="page-shell">
      <div className="page-heading page-toolbar">
        <div className="page-heading-copy">
          <h1>{t("Quản lý tổ chức")}</h1>
          <p>{t("Quản lý tổ chức và dịch vụ được cấp.")}</p>
        </div>
        <Button
          className="page-toolbar-action"
          icon={<PlusOutlined />}
          onClick={showCreate}
          type="primary"
        >
          {t("Thêm tổ chức")}{" "}
        </Button>
      </div>
      {!open && recoveryAttempt && (
        <Alert
          action={recoveryActions}
          description={t(
            "Chỉ khóa retry và mã operation được lưu trong phiên; dữ liệu tenant và mật khẩu không được lưu.",
          )}
          showIcon
          style={{ marginBottom: 18 }}
          title={t("Có thao tác tạo tenant chưa được đối soát")}
          type="warning"
        />
      )}
      {!open && provisioningNotice && (
        <Alert
          description={provisioningNoticeDescription(provisioningNotice)}
          showIcon
          style={{ marginBottom: 18 }}
          title={t(provisioningNotice.title)}
          type={provisioningNotice.type}
        />
      )}
      {tenantsQuery.error ? (
        <Alert
          action={<Button loading={tenantsQuery.isFetching} onClick={() => void tenantsQuery.refetch({ cancelRefetch: false })}>{t("Thử lại")}</Button>}
          showIcon
          title={
            tenantsQuery.error instanceof Error
              ? describeOperationsError(
                  tenantsQuery.error,
                  locale,
                  t("Không tải được tổ chức"),
                )
              : t("Không tải được tổ chức")
          }
          type="error"
        />
      ) : null}
        <Card className="surface-card table-surface">
          <div className="list-filter-bar admin-list-toolbar" role="search" aria-label={t("Danh sách tổ chức")}>
            <Input
              allowClear
              aria-label={t("Tìm tổ chức")}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("Tên hoặc slug tổ chức")}
              prefix={<SearchOutlined />}
              value={search}
            />
            <Select
              allowClear
              aria-label={t("Lọc trạng thái tổ chức")}
              onChange={setStatusFilter}
              options={[
                { label: t("Hoạt động"), value: "ACTIVE" },
                { label: t("Đã khóa"), value: "SUSPENDED" },
              ]}
              placeholder={t("Trạng thái")}
              value={statusFilter}
            />
            {(search || statusFilter) ? <Button onClick={() => {
              setSearch("");
              setStatusFilter(undefined);
            }}>{t("Xóa bộ lọc")}</Button> : null}
            <Button aria-label={t("Tải lại")} icon={<ReloadOutlined />} loading={tenantsQuery.isFetching} onClick={() => void tenantsQuery.refetch({ cancelRefetch: false })} />
          </div>
          {!tenantsQuery.isError && (
          <DataTable
            ariaLabel={t("Danh sách tổ chức")}
            columns={columns}
            data={items}
            emptyText={t(normalizedSearch || statusFilter ? "Không tìm thấy tổ chức phù hợp" : "Chưa có tổ chức")}
            loading={tenantsQuery.isFetching}
            paginationResetKey={JSON.stringify([normalizedSearch, statusFilter ?? ""])}
            pageSize={8}
            rowKey="_id"
            scrollX={620}
          />
          )}
        </Card>
      <Modal
        footer={null}
        onCancel={() => setSelectedTenantId(null)}
        open={Boolean(selectedTenantId)}
        title={t("Chi tiết tổ chức")}
        width={680}
      >
        {tenantDetail.isPending ? (
          <p role="status">{t("Đang tải chi tiết tổ chức…")}</p>
        ) : tenantDetail.error ? (
          <Alert
            showIcon
            title={errorMessage(
              tenantDetail.error,
              t("Không tải được chi tiết tổ chức"),
            )}
            type="error"
          />
        ) : tenantDetail.data ? (
          <Descriptions bordered column={1}>
            <Descriptions.Item label={t("Tên tổ chức")}>
              {tenantDetail.data.name}
            </Descriptions.Item>
            <Descriptions.Item label="Slug">
              {tenantDetail.data.slug}
            </Descriptions.Item>
            <Descriptions.Item label="ID">
              {tenantDetail.data._id}
            </Descriptions.Item>
            <Descriptions.Item label={t("Trạng thái")}>
              {tenantDetail.data.status === "ACTIVE"
                ? t("Hoạt động")
                : t("Đã khóa")}
            </Descriptions.Item>
            <Descriptions.Item label={t("Màu thương hiệu")}>
              {tenantDetail.data.primaryColor}
            </Descriptions.Item>
            <Descriptions.Item label={t("Module được cấp")}>
              {tenantDetail.data.enabledModules
                .map((module) => lmsModuleLabels[module])
                .join(" · ") || t("Không có module")}
            </Descriptions.Item>
            <Descriptions.Item label={t("Tạo lúc")}>
              {tenantDetail.data.createdAt
                ? new Date(tenantDetail.data.createdAt).toLocaleString(
                    locale === "en" ? "en-US" : "vi-VN",
                  )
                : "—"}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
      <Modal
        cancelButtonProps={{ disabled: saving || checkingRecovery }}
        cancelText={t("Hủy")}
        className="admin-form-modal"
        closable={!saving && !checkingRecovery}
        confirmLoading={saving}
        keyboard={!saving && !checkingRecovery}
        mask={{ closable: !saving && !checkingRecovery }}
        okButtonProps={{
          disabled:
            checkingRecovery ||
            (!editing && Boolean(recoveryAttempt) && attemptMode === "none"),
        }}
        okText={editing ? t("Lưu thay đổi") : t("Tạo tổ chức")}
        onCancel={cancelModal}
        onOk={() => void save()}
        open={open}
        title={editing ? t("Cập nhật tổ chức") : t("Tạo tổ chức mới")}
        width={720}
      >
        {!editing && recoveryAttempt && attemptMode === "none" && (
          <Alert
            action={recoveryActions}
            description={t(
              "Chọn cách xử lý trước khi gửi một yêu cầu tạo tenant khác.",
            )}
            showIcon
            style={{ marginTop: 18 }}
            title={t("Có thao tác cũ cần đối soát")}
            type="warning"
          />
        )}
        {provisioningNotice && (
          <Alert
            description={provisioningNoticeDescription(provisioningNotice)}
            showIcon
            style={{ marginTop: 18 }}
            title={t(provisioningNotice.title)}
            type={provisioningNotice.type}
          />
        )}
        {editing ? (
          <div style={{ marginTop: 22 }}>
            <ProfileImageEditor
              alt={t("Logo của {value0}", { value0: editing.name })}
              disabled={saving || checkingRecovery}
              fallback={
                Array.from(editing.name.trim())[0]?.toLocaleUpperCase("vi") ||
                "DX"
              }
              help={t(
                "JPEG, PNG hoặc WebP, tối đa 5 MiB. Logo được lưu trên máy chủ riêng.",
              )}
              imageUrl={editing.logoUrl}
              label={t("Logo tổ chức")}
              onRemove={async () => {
                await applyTenantLogo(
                  await organizationLogoApi.removeTenant(token, editing._id),
                );
                message.success("Đã gỡ logo tổ chức");
              }}
              onUpload={async (file, options) => {
                await applyTenantLogo(
                  await organizationLogoApi.uploadTenant(
                    token,
                    editing._id,
                    file,
                    options,
                  ),
                );
                message.success("Đã cập nhật logo tổ chức");
              }}
              shape="square"
            />
          </div>
        ) : null}
        <Form
          className="admin-entity-form"
          disabled={saving || checkingRecovery}
          form={form}
          layout="vertical"
          name="tenant-editor"
          noValidate
          onValuesChange={() => {
            if (
              !editing &&
              attemptMode === "current" &&
              !submitInFlight.current &&
              !saving
            ) {
              discardAttempt();
              setProvisioningNotice({
                description: t(
                  "Lần gửi tiếp theo sẽ dùng khóa mới vì dữ liệu đã thay đổi.",
                ),
                title: t("Đã bắt đầu thao tác mới"),
                type: "info",
              });
            }
          }}
          requiredMark
          style={{ marginTop: editing ? 22 : 4 }}
        >
          <section className="form-section" aria-labelledby="tenant-details-heading">
          <h3 className="form-section-title" id="tenant-details-heading">{t("Thông tin tổ chức")}</h3>
          {!editing && <p className="form-section-note">{t("Bạn có thể thêm logo sau khi tạo tổ chức.")}</p>}
          <div className="form-field-grid">
          <Form.Item
            label={t("Tên tổ chức")}
            name="name"
            rules={[
              {
                required: true,
                min: 2,
                message: t("Tên cần ít nhất 2 ký tự"),
              },
              { max: 160, message: t("Tên không được vượt quá 160 ký tự") },
            ]}
          >
            <Input autoComplete="off" maxLength={160} placeholder="Bright Academy" />
          </Form.Item>
          <Form.Item
            extra={t("Dùng chữ thường, số và dấu gạch ngang.")}
            label={t("Mã đường dẫn tổ chức")}
            name="slug"
            rules={[
              {
                required: true,
                pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                message: t("Dùng chữ thường, số và dấu gạch ngang"),
              },
              {
                max: 100,
                message: t("Mã đường dẫn không được vượt quá 100 ký tự"),
              },
            ]}
          >
            <Input autoCapitalize="none" autoComplete="off" maxLength={100} placeholder="bright-academy" spellCheck={false} />
          </Form.Item>
          {editing && (
            <Form.Item label={t("Trạng thái")} name="status">
              <Select
                options={[
                  { label: t("Hoạt động"), value: "ACTIVE" },
                  { label: t("Khóa truy cập"), value: "SUSPENDED" },
                ]}
              />
            </Form.Item>
          )}
          <Form.Item
            label={t("Màu thương hiệu")}
            name="primaryColor"
            rules={[{ required: true }]}
          >
            <ColorPicker showText />
          </Form.Item>
          </div>
          </section>
          <details className="form-section admin-detail-disclosure" ref={modulesDisclosureRef}>
          <summary>{t("Tùy chỉnh tính năng (không bắt buộc)")}</summary>
          <Form.Item
            extra={t("Tính năng phụ thuộc sẽ được tự động chọn.")}
            label={t("Tính năng được phép")}
            name="enabledModules"
            normalize={(modules: LmsModule[] | undefined) =>
              includeLmsModulePrerequisites(modules ?? [])
            }
            rules={[{ required: true, message: t("Chọn ít nhất một module") }]}
          >
            <ModulePicker aria-label={t("Tính năng được phép")} disabled={saving || checkingRecovery} options={lmsModuleOptions} />
          </Form.Item>
          </details>
          {!editing && (
            <section className="form-section" aria-labelledby="tenant-admin-heading">
              <h3 className="form-section-title" id="tenant-admin-heading">{t("Quản trị viên đầu tiên")}</h3>
              <p className="form-section-note">{t("Tạo tài khoản quản lý cho tổ chức này.")}</p>
              <div className="form-field-grid">
              <Form.Item
                label={t("Tên quản trị viên đầu tiên")}
                name="adminFullName"
                rules={[
                  {
                    required: true,
                    min: 2,
                    message: t("Nhập họ tên quản trị viên"),
                  },
                  {
                    max: 160,
                    message: t("Họ tên không được vượt quá 160 ký tự"),
                  },
                ]}
              >
                <Input autoComplete="off" maxLength={160} />
              </Form.Item>
              <Form.Item
                label={t("Email quản trị viên")}
                name="adminEmail"
                rules={[
                  {
                    required: true,
                    type: "email",
                    message: t("Email chưa hợp lệ"),
                  },
                ]}
              >
                <Input autoCapitalize="none" autoComplete="off" inputMode="email" spellCheck={false} type="email" />
              </Form.Item>
              </div>
              <Form.Item
                extra={t("Mật khẩu phải có ít nhất 8 ký tự")}
                label={t("Mật khẩu ban đầu")}
                name="adminPassword"
                rules={[
                  {
                    required: true,
                    validator: async (_, value: unknown) => {
                      const issue = passwordValidationError(
                        typeof value === "string" ? value : "",
                      );
                      if (issue) throw new Error(t(issue));
                    },
                  },
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
            </section>
          )}
        </Form>
      </Modal>
      <TenantMembersManager
        key={managedTenant?._id ?? "closed"}
        onClose={() => setManagedTenant(null)}
        tenant={managedTenant}
      />
    </div>
  );
}

function useOperationsCopy() {
  const i18n = useI18n(tenantMessages);
  return useI18nMemo(() => {
    const { t, locale } = i18n;
    function provisioningNoticeDescription(
      notice: ProvisioningNotice,
    ): ReactNode {
      if (!notice.description && !notice.operationId) return undefined;
      return (
        <Space direction="vertical" size={0}>
          {notice.description && <span>{t(notice.description)}</span>}
          {notice.operationId && (
            <span>
              {t("Mã operation:")}{" "}
              <Typography.Text code copyable={{ text: notice.operationId }}>
                {notice.operationId}
              </Typography.Text>
            </span>
          )}
        </Space>
      );
    }

    function waitForStatus(
      seconds: number,
      signal: AbortSignal,
    ): Promise<void> {
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
      return error instanceof Error
        ? describeOperationsError(error, locale, fallback)
        : fallback;
    }
    const translatedLmsModuleLabels = Object.fromEntries(
      Object.entries(lmsModuleLabels).map(([key, label]) => [key, t(label)]),
    ) as typeof lmsModuleLabels;
    const translatedLmsModuleOptions = lmsModuleOptions.map((option) => ({
      ...option,
      label: t(option.label),
    }));
    return {
      ...i18n,
      lmsModuleLabels: translatedLmsModuleLabels,
      lmsModuleOptions: translatedLmsModuleOptions,
      provisioningNoticeDescription,
      waitForStatus,
      errorMessage,
    };
  }, [i18n]);
}
