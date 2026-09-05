"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { learningMessages } from "@/lib/i18n/learning-messages";
import { workspacePolishMessages } from "@/lib/i18n/workspace-polish-messages";

import { Alert } from "antd";
import { AuditLedgerView } from "@/components/audit/audit-ledger-view";
import { useAuth } from "@/components/providers/app-providers";
import { getViewerScope } from "@/lib/query-keys";
const pageMessages = { ...learningMessages, ...workspacePolishMessages };

export default function TenantAuditPage() {
  const { t } = useI18n(pageMessages);
  const { organization, token, user } = useAuth();
  const viewerScope = getViewerScope(user, organization);

  if (user?.role !== "TENANT_ADMIN" || !user.tenantId || !viewerScope) {
    return <Alert showIcon title={t("Chỉ quản trị viên tenant được xem nhật ký của workspace.")} type="warning" />;
  }

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div className="page-heading-copy">
          <h1>{t("Nhật ký quản trị")}</h1>
          <p>{t("Theo dõi thay đổi và người thực hiện trong tổ chức.")}</p>
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
