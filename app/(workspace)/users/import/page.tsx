"use client";
import { useI18n } from "@/components/i18n/i18n-provider";
import { operationsMessages } from "@/lib/i18n/operations-messages";
import { describeOperationsError } from "@/lib/i18n/operations-errors";
import { useMemo as useI18nMemo } from "react";

import {
  ArrowLeftOutlined,
  CopyOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useAuth } from "@/components/providers/app-providers";
import { orgUnitQueryKeys, orgUnitsApi } from "@/lib/org-units-api";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import {
  createImportedInvitations,
  parseUserImportCsv,
  userImportResultsCsv,
  type UserImportPreviewRow,
  type UserImportResultRow,
} from "@/lib/user-import";
import { buildUserOrgUnitOptions, userRoleLabels } from "@/lib/user-management";

const SAMPLE = `email,fullName,role
an.nguyen@example.com,Nguyễn Văn An,LEARNER
phuhuynh.an@example.com,Nguyễn Thị Mai,GUARDIAN`;

export default function UserImportPage() {
  const { t, userRoleLabels, buildUserOrgUnitOptions, importErrorMessage } =
    useOperationsCopy();
  const { message, reportError } = useFeedback();
  const { effectiveAccess, organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [source, setSource] = useState("");
  const [previewedSource, setPreviewedSource] = useState("");
  const [results, setResults] = useState<UserImportResultRow[]>([]);
  const [copyingLinks, setCopyingLinks] = useState(false);
  const [orgUnitId, setOrgUnitId] = useState<string>();
  const scope = getViewerScope(user, organization);
  const preview = useMemo(
    () => parseUserImportCsv(previewedSource),
    [previewedSource],
  );
  const readOnly = effectiveAccess?.readOnly ?? false;
  const scopedAdmin =
    user?.role === "TENANT_ADMIN" && user.orgUnitScopeMode === "SCOPED";
  const orgUnitsKey = scope
    ? orgUnitQueryKeys.tree(scope, false)
    : (["lms", "signed-out", "org-units", "tree"] as const);
  const orgUnitsQuery = useQuery({
    enabled: Boolean(token && scope && user?.role === "TENANT_ADMIN"),
    queryFn: ({ signal }) =>
      orgUnitsApi.tree({ token: token ?? "" }, false, { signal }),
    queryKey: orgUnitsKey,
  });
  const orgUnitOptions = useMemo(
    () => buildUserOrgUnitOptions(orgUnitsQuery.data?.items ?? []),
    [buildUserOrgUnitOptions, orgUnitsQuery.data?.items],
  );
  const effectiveOrgUnitId =
    orgUnitId ??
    (scopedAdmin && orgUnitOptions.length === 1
      ? orgUnitOptions[0].value
      : undefined);
  const showOrgUnitSelector =
    scopedAdmin || orgUnitsQuery.isLoading || orgUnitOptions.length > 0;
  const importMutation = useMutation({
    mutationFn: (rows: UserImportPreviewRow[]) =>
      createImportedInvitations(
        rows,
        token ?? "",
        typeof window === "undefined"
          ? "http://localhost"
          : window.location.origin,
        effectiveOrgUnitId,
      ),
    onSuccess: async (created) => {
      setResults(created);
      const successCount = created.filter(
        (row) => row.status === "CREATED",
      ).length;
      const failedCount = created.length - successCount;
      if (failedCount === 0) {
        message.success(
          `Đã tạo ${successCount.toLocaleString("vi-VN")} lời mời`,
        );
      } else if (successCount > 0) {
        message.warning(
          `Đã tạo ${successCount.toLocaleString("vi-VN")} lời mời; ${failedCount.toLocaleString("vi-VN")} lời mời chưa tạo được. Hãy xem chi tiết từng dòng trước khi thử lại.`,
        );
      } else {
        message.error(
          `Không tạo được ${failedCount.toLocaleString("vi-VN")} lời mời. Hãy xem chi tiết từng dòng trước khi thử lại.`,
        );
      }
      if (scope) {
        await queryClient.invalidateQueries({
          queryKey: lmsQueryKeys.invitations(scope),
        });
      }
    },
    onError: (caught) =>
      reportError(
        caught,
        "Không thể nhập danh sách lời mời. Vui lòng thử lại.",
      ),
  });

  if (user?.role !== "TENANT_ADMIN") {
    return (
      <Alert
        showIcon
        title={t("Chỉ quản trị tổ chức được nhập danh sách người dùng.")}
        type="warning"
      />
    );
  }

  const previewColumns: ColumnsType<UserImportPreviewRow> = [
    { dataIndex: "rowNumber", title: t("Dòng"), width: 72 },
    {
      key: "person",
      render: (_, row) => (
        <div>
          <strong>{row.displayName || t("Chưa có họ tên")}</strong>
          <div className="table-muted">{row.email || t("Chưa có email")}</div>
        </div>
      ),
      title: t("Người dùng"),
    },
    {
      dataIndex: "role",
      render: (role: UserImportPreviewRow["role"]) => userRoleLabels[role],
      title: t("Vai trò"),
      width: 160,
    },
    {
      key: "status",
      render: (_, row) =>
        row.valid ? (
          <Tag color="green">{t("Hợp lệ")}</Tag>
        ) : (
          <Typography.Text type="danger">
            {row.errors.map((error) => t(error)).join("; ")}
          </Typography.Text>
        ),
      title: t("Kiểm tra"),
    },
  ];

  const loadFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 1_000_000) {
      message.error("Tệp CSV không được vượt quá 1 MB");
      return;
    }
    try {
      const content = await file.text();
      setSource(content);
      setPreviewedSource("");
      setResults([]);
    } catch {
      message.error(
        "Không thể đọc tệp CSV. Hãy chọn lại tệp hoặc dán nội dung trực tiếp.",
      );
    }
  };
  const copyLinks = async () => {
    if (copyingLinks) return;
    const links = results
      .filter((row) => row.status === "CREATED" && row.acceptUrl)
      .map((row) => `${row.email},${row.acceptUrl}`)
      .join("\n");
    if (!links) {
      message.info("Chưa có liên kết lời mời thành công để sao chép");
      return;
    }
    setCopyingLinks(true);
    try {
      await navigator.clipboard.writeText(links);
      message.success("Đã sao chép danh sách liên kết mời");
    } catch {
      message.error(
        "Trình duyệt không cho phép sao chép. Hãy tải CSV kết quả để lưu liên kết mời.",
      );
    } finally {
      setCopyingLinks(false);
    }
  };
  const downloadResults = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          "\uFEFF",
          userImportResultsCsv(
            results.map((row) => ({
              ...row,
              error: row.error ? importErrorMessage(row.error) : undefined,
            })),
          ),
        ],
        {
          type: "text/csv;charset=utf-8",
        },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "dx-lms-import-results.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main aria-labelledby="user-import-title" className="page-shell">
      <header className="page-heading page-toolbar">
        <div className="page-heading-copy">
          <h1 id="user-import-title">{t("Nhập người dùng từ CSV")}</h1>
          <p>
            {t(
              "Kiểm tra toàn bộ dữ liệu trước, sau đó tạo lời mời theo từng dòng hợp lệ.",
            )}{" "}
          </p>
        </div>
        <Link href="/users">
          <Button icon={<ArrowLeftOutlined />}>
            {t("Quay lại người dùng")}
          </Button>
        </Link>
      </header>

      {readOnly && (
        <Alert
          showIcon
          title={t("Workspace chỉ đọc; chưa thể tạo lời mời mới.")}
          type="warning"
        />
      )}
      {orgUnitsQuery.error && (
        <Alert
          showIcon
          title={t(
            "Không tải được danh sách cơ sở; hãy thử lại trước khi nhập người dùng theo chi nhánh.",
          )}
          type="warning"
        />
      )}
      <Card className="surface-card" title={t("1. Dữ liệu CSV")}>
        <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
          <Typography.Text type="secondary">
            {t("Cần cột")} <code>email</code>, <code>fullName</code>
            {t("; cột")} <code>role</code>{" "}
            {t(
              "có thể bỏ trống và mặc định là LEARNER. Tối đa 500 dòng, 1 MB.",
            )}{" "}
          </Typography.Text>
          {showOrgUnitSelector && (
            <div>
              <Typography.Text strong>
                {t("Cơ sở áp dụng cho cả lô")}
              </Typography.Text>
              <Select
                allowClear={!scopedAdmin}
                aria-label={t("Cơ sở áp dụng cho cả lô")}
                loading={orgUnitsQuery.isLoading}
                onChange={setOrgUnitId}
                options={orgUnitOptions}
                placeholder={
                  scopedAdmin
                    ? t("Chọn cơ sở trong phạm vi quản lý")
                    : t("Không gắn cơ sở (không bắt buộc)")
                }
                showSearch
                optionFilterProp="label"
                style={{ display: "block", marginTop: 8, maxWidth: 520 }}
                value={effectiveOrgUnitId}
              />
              <Typography.Text type="secondary">
                {t(
                  "Mọi lời mời hợp lệ trong lần nhập này sẽ được gắn vào cùng cơ sở.",
                )}{" "}
              </Typography.Text>
            </div>
          )}
          {scopedAdmin && (
            <Alert
              description={t(
                "Quản lý cơ sở chỉ có thể nhập học viên và phụ huynh trong phạm vi được giao.",
              )}
              showIcon
              type="info"
            />
          )}
          <label>
            <span className="visually-hidden">{t("Chọn tệp CSV")}</span>
            <input
              accept=".csv,text/csv"
              aria-label={t("Chọn tệp CSV")}
              onChange={(event) => void loadFile(event.target.files?.[0])}
              type="file"
            />
          </label>
          <Input.TextArea
            aria-label={t("Nội dung CSV")}
            onChange={(event) => {
              setSource(event.target.value);
              setPreviewedSource("");
              setResults([]);
            }}
            placeholder={SAMPLE}
            rows={9}
            value={source}
          />
          <Space wrap>
            <Button
              disabled={!source.trim()}
              onClick={() => {
                setPreviewedSource(source);
                setResults([]);
              }}
              type="primary"
            >
              {t("Kiểm tra dữ liệu")}{" "}
            </Button>
            <Button onClick={() => setSource(SAMPLE)}>
              {t("Dùng dữ liệu mẫu")}
            </Button>
          </Space>
        </Space>
      </Card>

      {previewedSource && (
        <Card className="surface-card" title={t("2. Xác nhận lời mời")}>
          {preview.errors.map((error) => (
            <Alert key={error} showIcon title={t(error)} type="error" />
          ))}
          <Space size="large" wrap>
            <Tag color="blue">
              {preview.totalCount} {t("dòng")}
            </Tag>
            <Tag color="green">
              {preview.validCount} {t("hợp lệ")}
            </Tag>
            <Tag color={preview.invalidCount ? "red" : "default"}>
              {preview.invalidCount} {t("cần sửa")}{" "}
            </Tag>
          </Space>
          <Table
            columns={previewColumns}
            dataSource={preview.rows}
            pagination={{ pageSize: 20 }}
            rowKey="rowNumber"
            scroll={{ x: 760 }}
          />
          <Button
            disabled={
              readOnly ||
              (scopedAdmin && !effectiveOrgUnitId) ||
              (scopedAdmin && Boolean(orgUnitsQuery.error)) ||
              preview.validCount === 0 ||
              preview.invalidCount > 0 ||
              preview.errors.length > 0
            }
            loading={importMutation.isPending}
            onClick={() => importMutation.mutate(preview.rows)}
            type="primary"
          >
            {t("Tạo")} {preview.validCount} {t("lời mời")}{" "}
          </Button>
        </Card>
      )}

      {results.length > 0 && (
        <Card className="surface-card" title={t("3. Kết quả nhập")}>
          <Alert
            description={t(
              "Liên kết chứa token một lần. Hãy tải hoặc sao chép ngay; hệ thống không hiển thị lại token này.",
            )}
            showIcon
            title={t("Lưu kết quả trước khi rời trang")}
            type="warning"
          />
          <Space wrap>
            <Button icon={<CopyOutlined />} loading={copyingLinks} onClick={() => void copyLinks()}>
              {t("Sao chép liên kết thành công")}{" "}
            </Button>
            <Button icon={<DownloadOutlined />} onClick={downloadResults}>
              {t("Tải CSV kết quả")}{" "}
            </Button>
          </Space>
          <Table
            columns={[
              { dataIndex: "email", title: "Email" },
              {
                dataIndex: "status",
                render: (status: UserImportResultRow["status"]) => (
                  <Tag color={status === "CREATED" ? "green" : "red"}>
                    {status === "CREATED" ? t("Đã tạo") : t("Thất bại")}
                  </Tag>
                ),
                title: t("Kết quả"),
              },
              {
                key: "detail",
                render: (_: unknown, row: UserImportResultRow) =>
                  row.acceptUrl ??
                  (row.error ? importErrorMessage(row.error) : "—"),
                title: t("Liên kết / lỗi"),
              },
            ]}
            dataSource={results}
            pagination={false}
            rowKey="rowNumber"
            scroll={{ x: 760 }}
          />
        </Card>
      )}
    </main>
  );
}

function useOperationsCopy() {
  const i18n = useI18n(operationsMessages);
  return useI18nMemo(() => {
    const { t, locale } = i18n;
    const importErrorMessage = (error: string) =>
      describeOperationsError(
        new Error(error),
        locale,
        t("Không thể tạo lời mời"),
      );

    const translatedUserRoleLabels = Object.fromEntries(
      Object.entries(userRoleLabels).map(([key, label]) => [key, t(label)]),
    ) as typeof userRoleLabels;
    const translatedBuildUserOrgUnitOptions = (
      roots: Parameters<typeof buildUserOrgUnitOptions>[0],
    ) =>
      buildUserOrgUnitOptions(roots).map((option) => ({
        ...option,
        label: option.label.replace(
          / · (Chi nhánh|Phòng ban|Trung tâm)$/,
          (_match, label: string) => " · " + t(label),
        ),
      }));
    return {
      ...i18n,
      importErrorMessage,
      userRoleLabels: translatedUserRoleLabels,
      buildUserOrgUnitOptions: translatedBuildUserOrgUnitOptions,
    };
  }, [i18n]);
}
