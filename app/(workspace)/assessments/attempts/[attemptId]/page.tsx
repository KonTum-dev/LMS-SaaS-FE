"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { learningMessages } from "@/lib/i18n/learning-messages";

import { Alert } from "antd";
import { useParams } from "next/navigation";
import { AssessmentAttemptRunner } from "@/components/assessments/assessment-attempt-runner";
import { useAuth } from "@/components/providers/app-providers";
import { effectiveModuleEnabled } from "@/lib/entitlements";
import { getViewerScope } from "@/lib/query-keys";

export default function AssessmentAttemptPage() {
  const { t } = useI18n(learningMessages);
  const params = useParams<{ attemptId: string }>();
  const { effectiveAccess, organization, token, user } = useAuth();
  const scope = getViewerScope(user, organization);
  if (!effectiveModuleEnabled(effectiveAccess, "ASSESSMENTS")) {
    return <Alert showIcon title={t("Module Bài kiểm tra không khả dụng trong workspace này.")} type="warning" />;
  }
  if (user?.role !== "LEARNER") return <Alert showIcon title={t("Chỉ học viên được mở lượt làm bài.")} type="error" />;
  if (!token || !scope) return <Alert showIcon title={t("Phiên thành viên không hợp lệ. Vui lòng đăng nhập lại.")} type="error" />;
  const readOnly = effectiveAccess?.readOnly ?? false;
  const authorityKey = `${scope.tenantId}:${scope.membershipId}:${scope.viewerId}:${scope.role}:${params.attemptId}:${readOnly ? "READ_ONLY" : "WRITABLE"}`;
  return <AssessmentAttemptRunner attemptId={params.attemptId} key={authorityKey} readOnly={readOnly} scope={scope} token={token} />;
}
