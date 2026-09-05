"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { learningMessages } from "@/lib/i18n/learning-messages";

import { Alert } from "antd";
import { useParams } from "next/navigation";
import { AssessmentAuthoringView } from "@/components/assessments/assessment-authoring";
import { useAuth } from "@/components/providers/app-providers";
import { effectiveModuleEnabled } from "@/lib/entitlements";
import { getViewerScope } from "@/lib/query-keys";

export default function AssessmentManagePage() {
  const { t } = useI18n(learningMessages);
  const params = useParams<{ id: string }>();
  const { effectiveAccess, organization, token, user } = useAuth();
  const scope = getViewerScope(user, organization);
  const manager = user?.role === "TENANT_ADMIN" || user?.role === "INSTRUCTOR";
  if (!effectiveModuleEnabled(effectiveAccess, "ASSESSMENTS")) {
    return <Alert showIcon title={t("Module Bài kiểm tra không khả dụng trong workspace này.")} type="warning" />;
  }
  if (!manager) return <Alert showIcon title={t("Vai trò của bạn không được phép soạn bài kiểm tra.")} type="error" />;
  if (!token || !scope) return <Alert showIcon title={t("Phiên thành viên không hợp lệ. Vui lòng đăng nhập lại.")} type="error" />;
  const readOnly = effectiveAccess?.readOnly ?? false;
  const authorityKey = `${scope.tenantId}:${scope.membershipId}:${scope.viewerId}:${scope.role}:${params.id}:${readOnly ? "READ_ONLY" : "WRITABLE"}`;
  return <AssessmentAuthoringView assessmentId={params.id} key={authorityKey} readOnly={readOnly} scope={scope} token={token} />;
}
