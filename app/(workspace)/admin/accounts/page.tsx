"use client";
import { describeOperationsError } from "@/lib/i18n/operations-errors";
import { useI18n } from "@/components/i18n/i18n-provider";
import { operationsMessages } from "@/lib/i18n/operations-messages";
import { workspacePolishMessages } from "@/lib/i18n/workspace-polish-messages";
import { useMemo as useI18nMemo } from "react";

import { PlusOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { Form } from "@/components/form/localized-form";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useAuth } from "@/components/providers/app-providers";
import { DataTable } from "@/components/table/data-table";
import { ApiError } from "@/lib/api";
import {
  adminAccountsApi,
  type AdminAccount,
  type AdminAccountDetail,
  type AdminAccountsQuery,
  type PlatformAccountRole,
} from "@/lib/admin-accounts-api";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import type { CurrentUser } from "@/lib/types";

type Editor =
  { kind: "create" } | { kind: "edit"; account: AdminAccountDetail };
type StatusAction = {
  kind: "disable" | "restore";
  account: AdminAccountDetail;
};
interface AccountForm {
  email: string;
  fullName: string;
  password: string;
  platformRole: "SUPER_ADMIN" | "USER";
  reason: string;
}
const EMPTY_FORM: AccountForm = {
  email: "",
  fullName: "",
  password: "",
  platformRole: "USER",
  reason: "",
};
const accountMessages = { ...operationsMessages, ...workspacePolishMessages };

function AccountStatus({ status }: { status: AdminAccount["status"] }) {
  const { t } = useOperationsCopy();
  return (
    <Tag color={status === "ACTIVE" ? "green" : "default"}>
      {status === "ACTIVE" ? t("Hoạt động") : t("Đã vô hiệu hóa")}
    </Tag>
  );
}

export default function AdminAccountsPage() {
  const { t } = useOperationsCopy();
  const { captureAuthGeneration, token, updateUserProfile, user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") {
    return (
      <Alert
        showIcon
        title={t("Chỉ quản trị nền tảng được quản lý tài khoản toàn hệ thống.")}
        type="warning"
      />
    );
  }
  return (
    <PlatformAccounts
      key={`${user.sub}:${captureAuthGeneration()}`}
      token={token}
      updateUserProfile={updateUserProfile}
      user={user}
    />
  );
}

function PlatformAccounts({
  token,
  updateUserProfile,
  user,
}: {
  token: string;
  updateUserProfile: (
    profile: Pick<CurrentUser, "sub" | "fullName" | "avatarUrl">,
  ) => void;
  user: CurrentUser;
}) {
  const {
    t,
    roleOptions,
    membershipRoleLabels,
    auditStatusLabels,
    dateLabel,
    errorMessage,
  } = useOperationsCopy();
  const { message, reportError } = useFeedback();
  const queryClient = useQueryClient();
  const scope = useMemo(() => getViewerScope(user, null)!, [user]);
  const [query, setQuery] = useState<AdminAccountsQuery>({
    page: 1,
    limit: 20,
  });
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM);
  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [uncertain, setUncertain] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);

  const accountsQuery = useQuery({
    enabled: Boolean(token),
    queryKey: lmsQueryKeys.adminAccounts(scope, query),
    queryFn: ({ signal }) => adminAccountsApi.list({ token, signal }, query),
  });
  const detailQuery = useQuery({
    enabled: Boolean(token && selectedId),
    queryKey: lmsQueryKeys.adminAccount(scope, selectedId ?? "none"),
    queryFn: ({ signal }) =>
      adminAccountsApi.get({ token, signal }, selectedId!),
    staleTime: 0,
  });
  const detail = detailQuery.isError ? undefined : detailQuery.data;

  function openCreate() {
    setError("");
    setUncertain(false);
    setForm(EMPTY_FORM);
    setEditor({ kind: "create" });
  }
  function openEdit(account: AdminAccountDetail) {
    setError("");
    setUncertain(false);
    setForm({
      email: account.email,
      fullName: account.fullName,
      password: "",
      platformRole: account.platformRole ?? "USER",
      reason: "",
    });
    setSelectedId(null);
    setEditor({ kind: "edit", account });
  }
  function openStatusAction(
    kind: StatusAction["kind"],
    account: AdminAccountDetail,
  ) {
    if (kind === "disable" && account._id === user.sub) return;
    setError("");
    setReason("");
    setUncertain(false);
    setSelectedId(null);
    setStatusAction({ kind, account });
  }
  function closeEditor() {
    if (inFlight.current) return;
    if (uncertain) void accountsQuery.refetch();
    setEditor(null);
    setForm(EMPTY_FORM);
    setError("");
    setUncertain(false);
  }
  function closeStatusAction() {
    if (inFlight.current) return;
    if (uncertain) void accountsQuery.refetch();
    setStatusAction(null);
    setReason("");
    setError("");
    setUncertain(false);
  }

  async function submit() {
    if (inFlight.current || uncertain || (!editor && !statusAction)) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    const context = { token, signal: controller.signal };
    try {
      let result: AdminAccountDetail;
      if (editor?.kind === "create") {
        result = await adminAccountsApi.create(context, {
          ...form,
          platformRole: form.platformRole === "USER" ? null : form.platformRole,
        });
      } else if (editor?.kind === "edit") {
        const platformRole: PlatformAccountRole =
          form.platformRole === "USER" ? null : form.platformRole;
        if (editor.account._id === user.sub && platformRole !== "SUPER_ADMIN")
          throw new Error(t("Không thể tự hạ quyền tài khoản đang đăng nhập."));
        if (
          platformRole === "SUPER_ADMIN" &&
          editor.account.platformRole !== "SUPER_ADMIN" &&
          editor.account.memberships.length > 0
        )
          throw new Error(
            t(
              "Tài khoản có membership tổ chức không thể được nâng thành quản trị nền tảng.",
            ),
          );
        result = await adminAccountsApi.update(context, editor.account._id, {
          fullName: form.fullName,
          platformRole,
          reason: form.reason,
        });
      } else if (statusAction?.kind === "disable") {
        if (statusAction.account._id === user.sub)
          throw new Error(
            t("Không thể tự vô hiệu hóa tài khoản đang đăng nhập."),
          );
        result = await adminAccountsApi.disable(
          context,
          statusAction.account._id,
          reason,
        );
      } else if (statusAction) {
        result = await adminAccountsApi.restore(
          context,
          statusAction.account._id,
          reason,
        );
      } else return;
      if (!mounted.current || controller.signal.aborted) return;
      if (result._id === user.sub)
        updateUserProfile({
          sub: user.sub,
          fullName: result.fullName,
          avatarUrl: user.avatarUrl,
        });
      queryClient.setQueryData(
        lmsQueryKeys.adminAccount(scope, result._id),
        result,
      );
      // Account status/role also affects tenant member and dashboard views.
      void queryClient.invalidateQueries({
        queryKey: lmsQueryKeys.viewer(scope),
      });
      setEditor(null);
      setStatusAction(null);
      setForm(EMPTY_FORM);
      setReason("");
      setSelectedId(result._id);
      void message.success({
        key: "admin-account-mutation",
        content:
          editor?.kind === "create"
            ? "Đã tạo tài khoản nền tảng."
            : editor?.kind === "edit"
              ? "Đã cập nhật tài khoản nền tảng."
              : statusAction?.kind === "disable"
                ? "Đã vô hiệu hóa tài khoản trên toàn hệ thống. Các phiên đăng nhập cũ đã bị thu hồi."
                : "Đã khôi phục tài khoản. Người dùng cần đăng nhập lại để tiếp tục.",
      });
    } catch (caught) {
      if (mounted.current && !controller.signal.aborted) {
        setError(caught);
        void reportError(
          caught,
          "Không thể hoàn tất yêu cầu. Vui lòng thử lại.",
        );
        setUncertain(
          caught instanceof ApiError &&
            (caught.status === 0 ||
              caught.code === "ACCOUNT_MUTATION_UNCERTAIN" ||
              caught.code === "ACCOUNT_AUDIT_PENDING" ||
              caught.code === "ADMIN_ACCOUNTS_RESPONSE_INVALID"),
        );
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  const columns: ColumnDef<StockFeatures, AdminAccount>[] = [
    {
      accessorKey: "fullName",
      header: t("Tài khoản"),
      cell: ({ row }) => (
        <div>
          <strong>{row.original.fullName}</strong>
          <div className="table-muted">{row.original.email}</div>
        </div>
      ),
    },
    {
      accessorKey: "platformRole",
      header: t("Quyền nền tảng"),
      cell: ({ row }) => (
        <Tag color={row.original.platformRole ? "purple" : "default"}>
          {row.original.platformRole ? t("Quản trị nền tảng") : t("Thông thường")}
        </Tag>
      ),
    },
    {
      accessorKey: "status",
      header: t("Trạng thái"),
      cell: ({ row }) => <AccountStatus status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: t("Ngày tạo"),
      cell: ({ row }) => dateLabel(row.original.createdAt),
    },
    {
      id: "actions",
      header: t("Thao tác"),
      cell: ({ row }) => (
        <Button
          aria-label={`${t("Chi tiết")} ${row.original.email}`}
          onClick={() => setSelectedId(row.original._id)}
          size="small"
        >
          {t("Chi tiết")}
        </Button>
      ),
    },
  ];
  const selfEditing =
    editor?.kind === "edit" && editor.account._id === user.sub;
  const membershipBlocksPromotion =
    editor?.kind === "edit" &&
    editor.account.platformRole !== "SUPER_ADMIN" &&
    editor.account.memberships.length > 0;

  return (
    <main className="page-shell admin-accounts-page">
      <header className="page-heading page-toolbar">
        <div className="page-heading-copy">
          <h1>{t("Tài khoản nền tảng")}</h1>
          <p>{t("Quản lý tài khoản đăng nhập trên toàn hệ thống.")}</p>
        </div>
        <Button
          className="page-toolbar-action"
          icon={<PlusOutlined aria-hidden="true" />}
          onClick={openCreate}
          type="primary"
        >
          {t("Tạo tài khoản")}
        </Button>
      </header>
      <p className="page-inline-note">
        {t("Khóa tài khoản sẽ chặn đăng nhập ở mọi tổ chức.")} {t("Quản lý vai trò tại trang Tổ chức.")}
      </p>
      <Card
        className="surface-card table-surface"
        title={t("Danh sách tài khoản")}
      >
        <form
          className="admin-filter-bar page-toolbar admin-accounts-filter list-filter-bar"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery((current) => ({
              ...current,
              search: search.trim() || undefined,
              page: 1,
            }));
          }}
        >
          <Input
            allowClear
            aria-label={t("Tìm tài khoản theo tên hoặc email")}
            className="admin-accounts-search"
            maxLength={100}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              if (!value.trim()) {
                setQuery((current) => ({ ...current, search: undefined, page: 1 }));
              }
            }}
            placeholder={t("Tên hoặc email")}
            value={search}
          />
          <Button htmlType="submit" loading={accountsQuery.isFetching}>{t("Tìm kiếm")}</Button>
          <Select
            aria-label={t("Lọc trạng thái tài khoản")}
            className="admin-accounts-status"
            onChange={(value: string) =>
              setQuery((current) => ({
                ...current,
                status:
                  value === "ALL"
                    ? undefined
                    : (value as AdminAccountsQuery["status"]),
                page: 1,
              }))
            }
            options={[
              { value: "ALL", label: t("Mọi trạng thái") },
              { value: "ACTIVE", label: t("Hoạt động") },
              { value: "INACTIVE", label: t("Đã vô hiệu hóa") },
            ]}
            value={query.status ?? "ALL"}
          />
          <Select
            aria-label={t("Lọc quyền nền tảng")}
            className="admin-accounts-role"
            onChange={(value: string) =>
              setQuery((current) => ({
                ...current,
                platformRole:
                  value === "ALL"
                    ? undefined
                    : (value as AdminAccountsQuery["platformRole"]),
                page: 1,
              }))
            }
            options={[
              { value: "ALL", label: t("Mọi quyền nền tảng") },
              ...roleOptions,
            ]}
            value={query.platformRole ?? "ALL"}
          />
          <Button
            loading={accountsQuery.isFetching}
            onClick={() => void accountsQuery.refetch({ cancelRefetch: false })}
          >
            {t("Tải lại")}{" "}
          </Button>
          {(search || query.search || query.status || query.platformRole) ? (
            <Button onClick={() => {
              setSearch("");
              setQuery((current) => ({ page: 1, limit: current.limit }));
            }}>
              {t("Xóa bộ lọc")}
            </Button>
          ) : null}
        </form>
        {accountsQuery.isError ? (
          <Alert
            showIcon
            title={t("Không tải được danh sách tài khoản")}
            description={errorMessage(accountsQuery.error)}
            type="error"
          />
        ) : null}
        {!accountsQuery.isError && <DataTable
          ariaLabel={t("Danh sách tài khoản nền tảng")}
          columns={columns}
          data={accountsQuery.data?.items ?? []}
          emptyText={t("Không có tài khoản phù hợp")}
          loading={accountsQuery.isFetching}
          onPageChange={(page, limit) => setQuery((current) => ({ ...current, limit, page: limit === current.limit ? page : 1 }))}
          page={query.page}
          pageSize={query.limit}
          rowKey="_id"
          scrollX={950}
          total={accountsQuery.data?.total ?? 0}
        />}
      </Card>

      <Modal
        destroyOnHidden
        footer={null}
        onCancel={() => setSelectedId(null)}
        open={Boolean(selectedId)}
        title={t("Chi tiết tài khoản")}
        width={900}
      >
        {detailQuery.isFetching ? (
          <Spin aria-label={t("Đang tải chi tiết tài khoản")} />
        ) : null}
        {detailQuery.isError ? (
          <Alert
            showIcon
            type="error"
            title={t("Không tải được chi tiết")}
            description={errorMessage(detailQuery.error)}
            action={
              <Button
                loading={detailQuery.isFetching}
                onClick={() => void detailQuery.refetch({ cancelRefetch: false })}
              >
                {t("Thử lại")}{" "}
              </Button>
            }
          />
        ) : null}
        {detail ? (
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <div>
              <Typography.Title level={4}>{detail.fullName}</Typography.Title>
              <Typography.Paragraph>{detail.email}</Typography.Paragraph>
              <AccountStatus status={detail.status} />
              <Tag>{detail.platformRole ? t("Quản trị nền tảng") : t("Tài khoản thông thường")}</Tag>
              {detail._id === user.sub ? (
                <Tag color="blue">{t("Tài khoản đang đăng nhập")}</Tag>
              ) : null}
            </div>
            <Typography.Text type="secondary">
              {t("Tạo:")} {dateLabel(detail.createdAt)} {t("· Cập nhật:")}{" "}
              {dateLabel(detail.updatedAt)}
            </Typography.Text>
            <Space wrap>
              <Button
                disabled={detailQuery.isFetching}
                onClick={() => openEdit(detail)}
              >
                {t("Chỉnh sửa tài khoản")}{" "}
              </Button>
              {detail.status === "ACTIVE" ? (
                <Button
                  danger
                  disabled={detailQuery.isFetching || detail._id === user.sub}
                  onClick={() => openStatusAction("disable", detail)}
                >
                  {t("Vô hiệu hóa toàn hệ thống")}{" "}
                </Button>
              ) : (
                <Button
                  disabled={detailQuery.isFetching}
                  onClick={() => openStatusAction("restore", detail)}
                >
                  {t("Khôi phục tài khoản")}{" "}
                </Button>
              )}
            </Space>
            {detail._id === user.sub ? (
              <Typography.Paragraph type="secondary">
                {t(
                  "Không thể tự vô hiệu hóa hoặc tự hạ quyền quản trị. Hệ thống cũng bảo vệ quản trị nền tảng hoạt động cuối cùng.",
                )}{" "}
              </Typography.Paragraph>
            ) : null}
            <Typography.Title level={5}>
              {t("Membership trong tổ chức (")}
              {detail.memberships.length})
            </Typography.Title>
            {detail.memberships.length ? (
              detail.memberships.map((membership) => (
                <Card key={membership.membershipId} size="small">
                  <strong>
                    {membership.tenantName ?? t("Tổ chức không còn khả dụng")}
                  </strong>
                  <div>
                    {membership.tenantSlug ?? membership.tenantId} ·{" "}
                    {membershipRoleLabels[membership.role]}
                  </div>
                  <Tag>
                    {membership.status === "ACTIVE"
                      ? t("Membership hoạt động")
                      : t("Membership không hoạt động")}
                  </Tag>
                </Card>
              ))
            ) : (
              <Typography.Paragraph>
                {t(
                  "Chưa thuộc tổ chức nào. Tài khoản thông thường cần được thêm vào tổ chức để sử dụng workspace.",
                )}{" "}
              </Typography.Paragraph>
            )}
            <Typography.Paragraph type="secondary">
              {t(
                "Khôi phục tài khoản không tự kích hoạt các membership đã bị vô hiệu hóa.",
              )}{" "}
            </Typography.Paragraph>
            <Typography.Title level={5}>
              {t("Nhật ký thay đổi tài khoản (50 mục gần nhất)")}{" "}
            </Typography.Title>
            {detail.audit.length ? (
              detail.audit.map((entry) => (
                <Card key={entry._id} size="small">
                  <Space wrap>
                    <strong>{entry.action}</strong>
                    <Tag>{auditStatusLabels[entry.status]}</Tag>
                    <span>{dateLabel(entry.createdAt)}</span>
                  </Space>
                  <div>{entry.reason}</div>
                  <div className="table-muted">
                    {t("Người thực hiện:")} {entry.actorId}
                    {entry.failureCode ? ` · ${entry.failureCode}` : ""}
                  </div>
                </Card>
              ))
            ) : (
              <Typography.Paragraph>
                {t("Chưa có thay đổi được ghi nhận.")}{" "}
              </Typography.Paragraph>
            )}
          </Space>
        ) : null}
      </Modal>

      <Modal
        cancelButtonProps={{ disabled: saving }}
        cancelText={t("Hủy")}
        closable={!saving}
        confirmLoading={saving}
        destroyOnHidden
        keyboard={!saving}
        mask={{ closable: !saving }}
        okButtonProps={{ disabled: saving || uncertain }}
        okText={
          editor?.kind === "create" ? t("Tạo tài khoản") : t("Lưu thay đổi")
        }
        onCancel={closeEditor}
        onOk={() => void submit()}
        open={Boolean(editor)}
        title={
          editor?.kind === "create"
            ? t("Tạo tài khoản nền tảng")
            : t("Chỉnh sửa tài khoản")
        }
      >
        {error ? (
          <Alert
            showIcon
            title={t("Chưa hoàn tất thao tác")}
            description={errorMessage(error)}
            type="error"
          />
        ) : null}
        {uncertain ? (
          <Alert
            showIcon
            type="warning"
            title={t("Không gửi lại thao tác khi chưa đối soát")}
            description={t(
              "Đóng hộp thoại để tải lại danh sách, sau đó kiểm tra tài khoản và nhật ký thay đổi trước khi tạo thao tác mới.",
            )}
          />
        ) : null}
        <Form layout="vertical" onFinish={() => void submit()}>
          <Form.Item label="Email" required>
            <Input
              aria-label={t("Email tài khoản")}
              autoComplete="off"
              disabled={saving || editor?.kind === "edit"}
              maxLength={254}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              type="email"
              value={form.email}
            />
          </Form.Item>
          <Form.Item label={t("Họ tên")} required>
            <Input
              aria-label={t("Họ tên tài khoản")}
              disabled={saving}
              maxLength={160}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  fullName: event.target.value,
                }))
              }
              value={form.fullName}
            />
          </Form.Item>
          {editor?.kind === "create" ? (
            <Form.Item
              extra={t(
                "Ít nhất 12 ký tự, tối đa 72 byte UTF-8. Chuyển mật khẩu qua kênh riêng và yêu cầu người dùng đổi sau đăng nhập.",
              )}
              label={t("Mật khẩu ban đầu")}
              required
            >
              <Input.Password
                aria-label={t("Mật khẩu ban đầu")}
                autoComplete="new-password"
                disabled={saving}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                value={form.password}
              />
            </Form.Item>
          ) : (
            <Typography.Paragraph type="secondary">
              {t(
                "Email không thể sửa tại đây. Người dùng tự đổi hoặc đặt lại mật khẩu qua luồng bảo mật tài khoản.",
              )}{" "}
            </Typography.Paragraph>
          )}
          <Form.Item label={t("Quyền nền tảng")}>
            <Select
              aria-label={t("Quyền nền tảng của tài khoản")}
              disabled={
                saving || Boolean(selfEditing || membershipBlocksPromotion)
              }
              onChange={(value: AccountForm["platformRole"]) =>
                setForm((current) => ({ ...current, platformRole: value }))
              }
              options={roleOptions}
              value={form.platformRole}
            />
          </Form.Item>
          {selfEditing ? (
            <Alert
              type="info"
              title={t("Không thể tự hạ quyền tài khoản đang đăng nhập.")}
            />
          ) : null}
          {membershipBlocksPromotion ? (
            <Alert
              type="warning"
              title={t(
                "Tài khoản đã có membership tổ chức không thể được nâng thành SUPER_ADMIN.",
              )}
            />
          ) : null}
          {form.platformRole === "SUPER_ADMIN" && !selfEditing ? (
            <Alert
              showIcon
              type="warning"
              title={t(
                "Quyền SUPER_ADMIN cho phép quản trị toàn bộ nền tảng và mọi tổ chức.",
              )}
            />
          ) : null}
          <Form.Item label={t("Lý do thay đổi (5–500 ký tự)")} required>
            <Input.TextArea
              aria-label={t("Lý do thay đổi tài khoản")}
              disabled={saving}
              maxLength={500}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              rows={3}
              value={form.reason}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        cancelButtonProps={{ disabled: saving }}
        cancelText={t("Hủy")}
        closable={!saving}
        confirmLoading={saving}
        destroyOnHidden
        keyboard={!saving}
        mask={{ closable: !saving }}
        okButtonProps={{
          danger: statusAction?.kind === "disable",
          disabled: saving || uncertain,
        }}
        okText={
          statusAction?.kind === "disable"
            ? t("Xác nhận vô hiệu hóa")
            : t("Xác nhận khôi phục")
        }
        onCancel={closeStatusAction}
        onOk={() => void submit()}
        open={Boolean(statusAction)}
        title={
          statusAction?.kind === "disable"
            ? t("Vô hiệu hóa tài khoản toàn hệ thống?")
            : t("Khôi phục tài khoản?")
        }
      >
        <Typography.Paragraph>
          <strong>{statusAction?.account.email}</strong>
        </Typography.Paragraph>
        <Alert
          showIcon
          type={statusAction?.kind === "disable" ? "warning" : "info"}
          title={
            statusAction?.kind === "disable"
              ? t(
                  "Chặn đăng nhập ở tất cả tổ chức và thu hồi phiên hiện có. Không xóa dữ liệu hoặc membership.",
                )
              : t(
                  "Cho phép tài khoản đăng nhập lại. Không tự khôi phục membership đã vô hiệu hóa.",
                )
          }
        />
        {error ? (
          <Alert
            showIcon
            title={t("Chưa hoàn tất thao tác")}
            description={errorMessage(error)}
            type="error"
          />
        ) : null}
        {uncertain ? (
          <Alert
            showIcon
            type="warning"
            title={t("Không gửi lại thao tác khi chưa đối soát")}
            description={t(
              "Đóng hộp thoại để tải lại danh sách, sau đó kiểm tra tài khoản và nhật ký thay đổi trước khi tạo thao tác mới.",
            )}
          />
        ) : null}
        <Form layout="vertical" onFinish={() => void submit()}>
          <Form.Item label={t("Lý do (5–500 ký tự)")} required>
            <Input.TextArea
              aria-label={t("Lý do vô hiệu hóa hoặc khôi phục")}
              disabled={saving}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              value={reason}
            />
          </Form.Item>
        </Form>
      </Modal>
    </main>
  );
}

function useOperationsCopy() {
  const i18n = useI18n(accountMessages);
  return useI18nMemo(() => {
    const { t, locale } = i18n;
    const roleOptions = [
      { value: "USER", label: t("Tài khoản thông thường") },
      { value: "SUPER_ADMIN", label: t("Quản trị nền tảng (SUPER_ADMIN)") },
    ];

    const membershipRoleLabels = {
      TENANT_ADMIN: t("Quản trị tổ chức"),
      INSTRUCTOR: t("Giảng viên"),
      LEARNER: t("Học viên"),
      GUARDIAN: t("Phụ huynh"),
    };

    const auditStatusLabels = {
      PENDING: t("Đang xử lý"),
      SUCCEEDED: t("Thành công"),
      FAILED: t("Thất bại"),
    };

    const dateFormat = new Intl.DateTimeFormat(
      locale === "en" ? "en-US" : "vi-VN",
      {
        dateStyle: "medium",
        timeStyle: "short",
      },
    );

    function dateLabel(value: string) {
      return Number.isFinite(Date.parse(value))
        ? dateFormat.format(new Date(value))
        : "—";
    }

    function errorMessage(error: unknown): string {
      if (error instanceof ApiError && error.status === 0) {
        return t(
          "Chưa xác định được kết quả. Hãy tải lại danh sách và kiểm tra tài khoản trước khi thử lại.",
        );
      }
      return error instanceof Error
        ? describeOperationsError(
            error,
            locale,
            t("Không thể hoàn tất yêu cầu. Vui lòng thử lại."),
          )
        : t("Không thể hoàn tất yêu cầu. Vui lòng thử lại.");
    }
    return {
      ...i18n,
      roleOptions,
      membershipRoleLabels,
      auditStatusLabels,
      dateFormat,
      dateLabel,
      errorMessage,
    };
  }, [i18n]);
}
