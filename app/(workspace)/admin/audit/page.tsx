"use client";

import { Alert, Card, Select } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AuditLedgerView } from "@/components/audit/audit-ledger-view";
import { useAuth } from "@/components/providers/app-providers";
import { apiFetch } from "@/lib/api";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import type { Organization } from "@/lib/types";

export default function PlatformAuditPage() {
  const { organization, token, user } = useAuth();
  const viewerScope = getViewerScope(user, organization);
  const [requestedTenantId, setRequestedTenantId] = useState("");
  const tenantsKey = viewerScope
    ? lmsQueryKeys.tenants(viewerScope)
    : ["lms", "signed-out", "organizations"] as const;
  const tenantsQuery = useQuery({
    enabled: Boolean(token && viewerScope && user?.role === "SUPER_ADMIN"),
    queryFn: () => apiFetch<Organization[]>("/organizations", { token }),
    queryKey: tenantsKey,
  });

  const tenantId = requestedTenantId && tenantsQuery.data?.some((tenant) => tenant._id === requestedTenantId)
    ? requestedTenantId
    : tenantsQuery.data?.[0]?._id ?? "";

  if (user?.role !== "SUPER_ADMIN" || !viewerScope) {
    return <Alert showIcon title="Chỉ quản trị viên nền tảng được xem audit liên tenant." type="warning" />;
  }

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div className="page-heading-copy">
          <h1>Audit tenant</h1>
          <p>Chọn một tenant để xem snapshot bất biến và xác minh chuỗi quản trị mà không cần chuyển workspace.</p>
        </div>
      </div>
      {tenantsQuery.error ? (
        <Alert showIcon title={tenantsQuery.error instanceof Error ? tenantsQuery.error.message : "Không tải được danh sách tenant"} type="error" />
      ) : (
        <Card className="surface-card" style={{ marginBottom: 18 }} title="Tenant cần kiểm tra">
          <Select
            aria-label="Chọn tenant audit"
            loading={tenantsQuery.isLoading}
            onChange={setRequestedTenantId}
            options={(tenantsQuery.data ?? []).map((tenant) => ({
              label: `${tenant.name} · ${tenant.slug}`,
              value: tenant._id,
            }))}
            placeholder="Chọn tenant"
            showSearch
            style={{ maxWidth: 560, width: "100%" }}
            value={tenantId || undefined}
          />
        </Card>
      )}
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
