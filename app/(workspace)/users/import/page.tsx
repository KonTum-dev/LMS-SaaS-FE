"use client";

import { ArrowLeftOutlined, CopyOutlined, DownloadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
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
import {
  buildUserOrgUnitOptions,
  userRoleLabels,
} from "@/lib/user-management";

const SAMPLE = `email,fullName,role
an.nguyen@example.com,Nguyễn Văn An,LEARNER
phuhuynh.an@example.com,Nguyễn Thị Mai,GUARDIAN`;

export default function UserImportPage() {
  const { message } = App.useApp();
  const { effectiveAccess, organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [source, setSource] = useState("");
  const [previewedSource, setPreviewedSource] = useState("");
  const [results, setResults] = useState<UserImportResultRow[]>([]);
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
    [orgUnitsQuery.data?.items],
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
        typeof window === "undefined" ? "http://localhost" : window.location.origin,
        effectiveOrgUnitId,
      ),
    onSuccess: async (created) => {
      setResults(created);
      const successCount = created.filter((row) => row.status === "CREATED").length;
      message.success(`Đã tạo ${successCount.toLocaleString("vi-VN")} lời mời`);
      if (scope) {
        await queryClient.invalidateQueries({
          queryKey: lmsQueryKeys.invitations(scope),
        });
      }
    },
  });

  if (user?.role !== "TENANT_ADMIN") {
    return (
      <Alert
        showIcon
        title="Chỉ quản trị tổ chức được nhập danh sách người dùng."
        type="warning"
      />
    );
  }

  const previewColumns: ColumnsType<UserImportPreviewRow> = [
    { dataIndex: "rowNumber", title: "Dòng", width: 72 },
    {
      key: "person",
      render: (_, row) => (
        <div>
          <strong>{row.displayName || "Chưa có họ tên"}</strong>
          <div className="table-muted">{row.email || "Chưa có email"}</div>
        </div>
      ),
      title: "Người dùng",
    },
    {
      dataIndex: "role",
      render: (role: UserImportPreviewRow["role"]) => userRoleLabels[role],
      title: "Vai trò",
      width: 160,
    },
    {
      key: "status",
      render: (_, row) =>
        row.valid ? (
          <Tag color="green">Hợp lệ</Tag>
        ) : (
          <Typography.Text type="danger">{row.errors.join("; ")}</Typography.Text>
        ),
      title: "Kiểm tra",
    },
  ];

  const loadFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 1_000_000) {
      message.error("Tệp CSV không được vượt quá 1 MB");
      return;
    }
    setSource(await file.text());
    setPreviewedSource("");
    setResults([]);
  };
  const copyLinks = async () => {
    const links = results
      .filter((row) => row.status === "CREATED" && row.acceptUrl)
      .map((row) => `${row.email},${row.acceptUrl}`)
      .join("\n");
    if (!links) return;
    await navigator.clipboard.writeText(links);
    message.success("Đã sao chép danh sách liên kết mời");
  };
  const downloadResults = () => {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", userImportResultsCsv(results)], {
        type: "text/csv;charset=utf-8",
      }),
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
          <h1 id="user-import-title">Nhập người dùng từ CSV</h1>
          <p>
            Kiểm tra toàn bộ dữ liệu trước, sau đó tạo lời mời theo từng dòng hợp lệ.
          </p>
        </div>
        <Link href="/users">
          <Button icon={<ArrowLeftOutlined />}>Quay lại người dùng</Button>
        </Link>
      </header>

      {readOnly && (
        <Alert
          showIcon
          title="Workspace chỉ đọc; chưa thể tạo lời mời mới."
          type="warning"
        />
      )}
      {orgUnitsQuery.error && (
        <Alert
          showIcon
          title="Không tải được danh sách cơ sở; hãy thử lại trước khi nhập người dùng theo chi nhánh."
          type="warning"
        />
      )}
      <Card className="surface-card" title="1. Dữ liệu CSV">
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Typography.Text type="secondary">
            Cần cột <code>email</code>, <code>fullName</code>; cột <code>role</code>
            có thể bỏ trống và mặc định là LEARNER. Tối đa 500 dòng, 1 MB.
          </Typography.Text>
          {showOrgUnitSelector && (
            <div>
              <Typography.Text strong>Cơ sở áp dụng cho cả lô</Typography.Text>
              <Select
                allowClear={!scopedAdmin}
                aria-label="Cơ sở áp dụng cho cả lô"
                loading={orgUnitsQuery.isLoading}
                onChange={setOrgUnitId}
                options={orgUnitOptions}
                placeholder={
                  scopedAdmin
                    ? "Chọn cơ sở trong phạm vi quản lý"
                    : "Không gắn cơ sở (không bắt buộc)"
                }
                showSearch
                optionFilterProp="label"
                style={{ display: "block", marginTop: 8, maxWidth: 520 }}
                value={effectiveOrgUnitId}
              />
              <Typography.Text type="secondary">
                Mọi lời mời hợp lệ trong lần nhập này sẽ được gắn vào cùng cơ sở.
              </Typography.Text>
            </div>
          )}
          {scopedAdmin && (
            <Alert
              description="Quản lý cơ sở chỉ có thể nhập học viên và phụ huynh trong phạm vi được giao."
              showIcon
              type="info"
            />
          )}
          <label>
            <span className="sr-only">Chọn tệp CSV</span>
            <input
              accept=".csv,text/csv"
              aria-label="Chọn tệp CSV"
              onChange={(event) => void loadFile(event.target.files?.[0])}
              type="file"
            />
          </label>
          <Input.TextArea
            aria-label="Nội dung CSV"
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
              Kiểm tra dữ liệu
            </Button>
            <Button onClick={() => setSource(SAMPLE)}>Dùng dữ liệu mẫu</Button>
          </Space>
        </Space>
      </Card>

      {previewedSource && (
        <Card className="surface-card" title="2. Xác nhận lời mời">
          {preview.errors.map((error) => (
            <Alert key={error} showIcon title={error} type="error" />
          ))}
          <Space size="large" wrap>
            <Tag color="blue">{preview.totalCount} dòng</Tag>
            <Tag color="green">{preview.validCount} hợp lệ</Tag>
            <Tag color={preview.invalidCount ? "red" : "default"}>
              {preview.invalidCount} cần sửa
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
            onClick={() => void importMutation.mutateAsync(preview.rows)}
            type="primary"
          >
            Tạo {preview.validCount} lời mời
          </Button>
        </Card>
      )}

      {results.length > 0 && (
        <Card className="surface-card" title="3. Kết quả nhập">
          <Alert
            description="Liên kết chứa token một lần. Hãy tải hoặc sao chép ngay; hệ thống không hiển thị lại token này."
            showIcon
            title="Lưu kết quả trước khi rời trang"
            type="warning"
          />
          <Space wrap>
            <Button icon={<CopyOutlined />} onClick={() => void copyLinks()}>
              Sao chép liên kết thành công
            </Button>
            <Button icon={<DownloadOutlined />} onClick={downloadResults}>
              Tải CSV kết quả
            </Button>
          </Space>
          <Table
            columns={[
              { dataIndex: "email", title: "Email" },
              {
                dataIndex: "status",
                render: (status: UserImportResultRow["status"]) => (
                  <Tag color={status === "CREATED" ? "green" : "red"}>
                    {status === "CREATED" ? "Đã tạo" : "Thất bại"}
                  </Tag>
                ),
                title: "Kết quả",
              },
              {
                key: "detail",
                render: (_: unknown, row: UserImportResultRow) =>
                  row.acceptUrl ?? row.error ?? "—",
                title: "Liên kết / lỗi",
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
