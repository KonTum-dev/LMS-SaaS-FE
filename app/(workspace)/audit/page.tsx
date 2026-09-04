"use client";

import { Alert } from "antd";
import { AuditLedgerView } from "@/components/audit/audit-ledger-view";
import { useAuth } from "@/components/providers/app-providers";
import { getViewerScope } from "@/lib/query-keys";

export default function TenantAuditPage() {
  const { organization, token, user } = useAuth();
  const viewerScope = getViewerScope(user, organization);

  if (user?.role !== "TENANT_ADMIN" || !user.tenantId || !viewerScope) {
    return <Alert showIcon title="Chỉ quản trị viên tenant được xem nhật ký của workspace." type="warning" />;
  }

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div className="page-heading-copy">
          <h1>Nhật ký quản trị</h1>
          <p>Theo dõi các thay đổi quản trị quan trọng và kiểm tra tính toàn vẹn của chuỗi audit trong tenant hiện tại.</p>
        </div>
      </div>
      <AuditLedgerView
        scope={{ kind: "CURRENT_TENANT" }}
        token={token}
        viewerScope={viewerScope}
      />
    </div>
  );
}
