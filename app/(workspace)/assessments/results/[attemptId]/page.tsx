"use client";

import { useFeedback } from "@/components/feedback/feedback-provider";
import { useI18n } from "@/components/i18n/i18n-provider";
import { learningMessages } from "@/lib/i18n/learning-messages";

import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Progress, Result, Spin, Tag } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import styles from "@/components/assessments/assessments.module.css";
import { AttemptStatusTag, resultPendingMessage } from "@/components/assessments/assessment-presenters";
import { useAuth } from "@/components/providers/app-providers";
import { assessmentApi } from "@/lib/assessment-api";
import { ApiError } from "@/lib/api";
import { effectiveModuleEnabled } from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";

function AssessmentResultView({ attemptId, scope, token }: { attemptId: string; scope: ViewerScope; token: string }) {
  const { t, locale } = useI18n(learningMessages);
  const { formatError } = useFeedback();
  const router = useRouter();
  const attemptQuery = useQuery({
    queryFn: () => assessmentApi.getAttempt({ token }, attemptId),
    queryKey: lmsQueryKeys.assessmentAttempt(scope, attemptId),
  });
  const resultQuery = useQuery({
    queryFn: () => assessmentApi.getResult({ token }, attemptId),
    queryKey: lmsQueryKeys.assessmentResult(scope, attemptId),
  });
  const assessmentId = attemptQuery.data?.assessmentId ?? "";
  const detailQuery = useQuery({
    enabled: Boolean(assessmentId),
    queryFn: () => assessmentApi.getLearnerDetail({ token }, assessmentId),
    queryKey: assessmentId
      ? lmsQueryKeys.assessmentLearnerDetail(scope, assessmentId)
      : [...lmsQueryKeys.assessmentLearnerDetails(scope), "pending-result-policy"],
  });

  if ((attemptQuery.isPending && !attemptQuery.data) || resultQuery.isPending) {
    return <div aria-label={t("Đang tải kết quả")} className="page-loading" role="status"><Spin size="large" /></div>;
  }
  if (resultQuery.error || !resultQuery.data) {
    const hidden = resultQuery.error instanceof ApiError
      && resultQuery.error.code === "ASSESSMENT_ATTEMPT_NOT_FOUND";
    return (
      <Result
        extra={(
          <div className={styles.inlineActions}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/assessments")}>{t("Về danh sách")}</Button>
            {!hidden && <Button disabled={resultQuery.isFetching} icon={<ReloadOutlined />} loading={resultQuery.isFetching} onClick={() => { if (!resultQuery.isFetching) void resultQuery.refetch(); }} type="primary">{t("Thử lại")}</Button>}
          </div>
        )}
        status={hidden ? "404" : "error"}
        subTitle={hidden ? t("Kết quả không còn khả dụng trong workspace của bạn.") : formatError(resultQuery.error, "Không thể tải kết quả.")}
        title={hidden ? t("Không tìm thấy kết quả") : t("Không tải được kết quả")}
      />
    );
  }
  const result = resultQuery.data;
  const attempt = attemptQuery.data;
  if (result.status === "IN_PROGRESS") {
    return (
      <Result
        extra={<Button onClick={() => router.replace(`/assessments/attempts/${attemptId}`)} type="primary">{t("Tiếp tục làm bài")}</Button>}
        status="info"
        subTitle={t("Bạn cần kết thúc lượt làm trước khi có trạng thái kết quả.")}
        title={t("Lượt làm vẫn đang mở")}
      />
    );
  }
  if (!result.resultReleased || !result.result) {
    const detail = detailQuery.data;
    const pending = detail
      ? resultPendingMessage(detail.resultVisibility, detail.closesAt, locale)
      : t("Kết quả chưa đến thời điểm công bố theo chính sách của bài kiểm tra.");
    return (
      <main aria-labelledby="result-title" className="page-shell">
        <header className={`${styles.pageHeader} page-heading`}>
          <div className="page-heading-copy">
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/assessments")} type="link">{t("Bài kiểm tra")}</Button>
            <h1 id="result-title">{t("Trạng thái kết quả")}</h1>
            <p>{t("Lượt làm")} {result.attemptNumber}</p>
          </div>
          <AttemptStatusTag status={result.status} />
        </header>
        <Card className="surface-card">
          <Result
            extra={(
              <div className={styles.inlineActions}>
                <Button onClick={() => router.push("/assessments")}>{t("Về danh sách")}</Button>
                <Button disabled={resultQuery.isFetching || detailQuery.isFetching} icon={<ReloadOutlined />} loading={resultQuery.isFetching || detailQuery.isFetching} onClick={() => { if (!resultQuery.isFetching && !detailQuery.isFetching) void Promise.all([resultQuery.refetch(), detailQuery.refetch()]); }} type="primary">{t("Kiểm tra lại")}</Button>
              </div>
            )}
            status="info"
            subTitle={pending}
            title={result.status === "TIMED_OUT" ? t("Lượt làm đã hết giờ") : t("Bài đã được ghi nhận")}
          />
        </Card>
      </main>
    );
  }
  const score = result.result;
  return (
    <main aria-labelledby="result-title" className="page-shell">
      <header className={`${styles.pageHeader} page-heading`}>
        <div className="page-heading-copy">
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/assessments")} type="link">{t("Bài kiểm tra")}</Button>
          <h1 id="result-title">{t("Kết quả lượt làm")} {result.attemptNumber}</h1>
          <p>{t("Xem điểm và kết quả bài kiểm tra của bạn. Đáp án từng câu không hiển thị tại đây.")}</p>
        </div>
        <AttemptStatusTag status={result.status} />
      </header>
      <Card className="surface-card">
        <div className={styles.resultHero}>
          <Tag color={score.passed ? "green" : "red"}>{score.passed ? t("Đạt") : t("Chưa đạt")}</Tag>
          <div aria-label={`${score.percentage.toLocaleString(locale === "en" ? "en-US" : "vi-VN")}%`} className={styles.score}>{score.percentage.toLocaleString(locale === "en" ? "en-US" : "vi-VN")}%</div>
          <Progress aria-label={t("Tỷ lệ điểm")} percent={Math.max(0, Math.min(100, score.percentage))} showInfo={false} status={score.passed ? "success" : "normal"} />
          <p><strong>{score.score.toLocaleString(locale === "en" ? "en-US" : "vi-VN")}</strong> / {score.maxScore.toLocaleString(locale === "en" ? "en-US" : "vi-VN")} {t("điểm")}</p>
          <div className={styles.inlineActions}>
            {attempt?.assessmentId && <Button onClick={() => router.push(`/assessments/${attempt.assessmentId}`)}>{t("Xem bài kiểm tra")}</Button>}
            <Button onClick={() => router.push("/assessments")} type="primary">{t("Về danh sách")}</Button>
          </div>
        </div>
      </Card>
    </main>
  );
}

export default function AssessmentResultPage() {
  const { t } = useI18n(learningMessages);
  const params = useParams<{ attemptId: string }>();
  const { effectiveAccess, organization, token, user } = useAuth();
  const scope = getViewerScope(user, organization);
  if (!effectiveModuleEnabled(effectiveAccess, "ASSESSMENTS")) {
    return <Alert showIcon title={t("Module Bài kiểm tra không khả dụng trong workspace này.")} type="warning" />;
  }
  if (user?.role !== "LEARNER") return <Alert showIcon title={t("Chỉ học viên được xem kết quả lượt làm của mình.")} type="error" />;
  if (!token || !scope) return <Alert showIcon title={t("Phiên thành viên không hợp lệ. Vui lòng đăng nhập lại.")} type="error" />;
  const authorityKey = `${scope.tenantId}:${scope.membershipId}:${scope.viewerId}:${scope.role}:${params.attemptId}`;
  return <AssessmentResultView attemptId={params.attemptId} key={authorityKey} scope={scope} token={token} />;
}
