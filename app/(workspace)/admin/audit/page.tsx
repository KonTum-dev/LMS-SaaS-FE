"use client";
import { describeOperationsError } from "@/lib/i18n/operations-errors";
import { useI18n } from "@/components/i18n/i18n-provider";
import { operationsMessages } from "@/lib/i18n/operations-messages";
import { workspacePolishMessages } from "@/lib/i18n/workspace-polish-messages";
import { useMemo as useI18nMemo } from "react";

import { Alert, Button, Card, Empty, Select } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AuditLedgerView } from "@/components/audit/audit-ledger-view";
import { useAuth } from "@/components/providers/app-providers";
import { apiFetch } from "@/lib/api";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import type { Organization } from "@/lib/types";
const pageMessages = { ...operationsMessages, ...workspacePolishMessages };

export default function PlatformAuditPage() {
  const { t, locale } = useOperationsCopy();
  const { organization, token, user } = useAuth();
  const viewerScope = getViewerScope(user, organization);
  const [requestedTenantId, setRequestedTenantId] = useState("");
  const tenantsKey = viewerScope
    ? lmsQueryKeys.tenants(viewerScope)
    : (["lms", "signed-out", "organizations"] as const);
  const tenantsQuery = useQuery({
    enabled: Boolean(token && viewerScope && user?.role === "SUPER_ADMIN"),
    queryFn: () => apiFetch<Organization[]>("/organizations", { token }),
    queryKey: tenantsKey,
  });

  const tenantId =
    requestedTenantId &&
    tenantsQuery.data?.some((tenant) => tenant._id === requestedTenantId)
      ? requestedTenantId
      : (tenantsQuery.data?.[0]?._id ?? "");

  if (user?.role !== "SUPER_ADMIN" || !viewerScope) {
    return (
      <Alert
        showIcon
        title={t("Chỉ quản trị viên nền tảng được xem audit liên tenant.")}
        type="warning"
      />
    );
  }

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div className="page-heading-copy">
          <h1>{t("Nhật ký tổ chức")}</h1>
          <p>
            {t(
              "Chọn tổ chức để xem lịch sử thay đổi.",
            )}
          </p>
        </div>
      </div>
      {tenantsQuery.error ? (
        <Alert
          action={<Button loading={tenantsQuery.isFetching} onClick={() => void tenantsQuery.refetch({ cancelRefetch: false })}>{t("Thử lại")}</Button>}
          showIcon
          title={
            tenantsQuery.error instanceof Error
              ? describeOperationsError(
                  tenantsQuery.error,
                  locale,
                  t("Không tải được danh sách tenant"),
                )
              : t("Không tải được danh sách tenant")
          }
          type="error"
        />
      ) : (
        <Card
          className="surface-card"
          style={{ marginBottom: 18 }}
          title={t("Tổ chức")}
        >
          <Select
            aria-label={t("Chọn tenant audit")}
            loading={tenantsQuery.isLoading}
            onChange={setRequestedTenantId}
            optionFilterProp="label"
            options={(tenantsQuery.data ?? []).map((tenant) => ({
              label: `${tenant.name} · ${tenant.slug}`,
              value: tenant._id,
            }))}
            placeholder={t("Chọn tenant")}
            showSearch
            style={{ maxWidth: 560, width: "100%" }}
            value={tenantId || undefined}
          />
        </Card>
      )}
      {!tenantsQuery.isPending && !tenantsQuery.isError && !tenantId && <Empty description={t("Chưa có tổ chức")} />}
      {tenantId && (
        <AuditLedgerView
          scope={{ kind: "PLATFORM_TENANT", tenantId }}
          token={token}
          viewerScope={viewerScope}
        />
      )}
    </div>
  );
}

function useOperationsCopy() {
  const i18n = useI18n(pageMessages);
  return useI18nMemo(() => {
    return { ...i18n };
  }, [i18n]);
}
