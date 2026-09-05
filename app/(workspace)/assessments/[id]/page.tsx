"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { learningMessages } from "@/lib/i18n/learning-messages";

import { useFeedback } from "@/components/feedback/feedback-provider";

import { ArrowLeftOutlined, PlayCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Result, Spin } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "@/components/assessments/assessments.module.css";
import {
  AvailabilityTag,
  formatAssessmentDate,
  formatAssessmentDuration,
  resultVisibilityLabels,
} from "@/components/assessments/assessment-presenters";
import { useServerAlignedNow } from "@/components/assessments/use-assessment-clock";
import { useAuth } from "@/components/providers/app-providers";
import {
  assessmentApi,
  createAssessmentMutationId,
  type AssessmentLearnerDetail,
} from "@/lib/assessment-api";
import { assessmentAvailabilityAt } from "@/lib/assessment-time";
import { ApiError } from "@/lib/api";
import { effectiveModuleEnabled } from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";

function LearnerAssessmentDetail({
  assessmentId,
  readOnly,
  scope,
  token,
}: {
  assessmentId: string;
  readOnly: boolean;
  scope: ViewerScope;
  token: string;
}) {
  const { t, locale } = useI18n(learningMessages);
  const { reportError, formatError } = useFeedback();
  const router = useRouter();
  const queryClient = useQueryClient();
  const mounted = useRef(true);
  const starting = useRef(false);
  const startMutationId = useRef(createAssessmentMutationId());
  const detailQuery = useQuery({
    queryFn: () => assessmentApi.getLearnerDetail({ token }, assessmentId),
    queryKey: lmsQueryKeys.assessmentLearnerDetail(scope, assessmentId),
  });
  const startMutation = useMutation({
    mutationFn: () => assessmentApi.startAttempt({ token }, assessmentId, {
      clientMutationId: startMutationId.current,
    }),
    onSuccess: (attempt) => {
      if (!mounted.current) return;
      queryClient.setQueryData(lmsQueryKeys.assessmentAttempt(scope, attempt._id), attempt);
      const detailKey = lmsQueryKeys.assessmentLearnerDetail(scope, assessmentId);
      queryClient.setQueryData<AssessmentLearnerDetail>(detailKey, (current) => current
        ? {
          ...current,
          activeAttemptId: attempt._id,
          attemptsRemaining: Math.max(current.maxAttempts - attempt.attemptNumber, 0),
          attemptsUsed: Math.max(current.attemptsUsed, attempt.attemptNumber),
        }
        : current);
      void queryClient.invalidateQueries({ exact: true, queryKey: detailKey }).catch(() => undefined);
      startMutationId.current = createAssessmentMutationId();
      router.push(`/assessments/attempts/${attempt._id}`);
    },
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const liveServerNow = useServerAlignedNow(
    detailQuery.data?.serverNow,
    detailQuery.dataUpdatedAt,
    Boolean(detailQuery.data?.opensAt || detailQuery.data?.closesAt),
  );

  if (detailQuery.isPending) {
    return <div aria-label={t("Đang tải chi tiết bài kiểm tra")} className="page-loading" role="status"><Spin size="large" /></div>;
  }
  if (detailQuery.error || !detailQuery.data) {
    const hidden = detailQuery.error instanceof ApiError && detailQuery.error.code === "ASSESSMENT_NOT_FOUND";
    return (
      <Result
        extra={(
          <div className={styles.inlineActions}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/assessments")}>{t("Về danh sách")}</Button>
            {!hidden && <Button disabled={detailQuery.isFetching} icon={<ReloadOutlined />} loading={detailQuery.isFetching} onClick={() => { if (!detailQuery.isFetching) void detailQuery.refetch(); }} type="primary">{t("Thử lại")}</Button>}
          </div>
        )}
        status={hidden ? "404" : "error"}
        subTitle={hidden
          ? t("Bài kiểm tra không còn khả dụng trong workspace của bạn.")
          : formatError(detailQuery.error, "Không thể tải dữ liệu.")}
        title={hidden ? t("Không tìm thấy bài kiểm tra") : t("Không tải được bài kiểm tra")}
      />
    );
  }
  const assessment = detailQuery.data;
  const availability = assessmentAvailabilityAt(
    assessment,
    liveServerNow,
    assessment.availability,
  );
  const canStart = availability === "OPEN" && assessment.attemptsRemaining > 0;
  const resume = Boolean(assessment.activeAttemptId);
  const launchDisabled = resume ? false : readOnly || !canStart;
  const launchTitle = resume
    ? t("Tiếp tục lượt làm đang mở")
    : readOnly
      ? t("Workspace chỉ đọc: không thể bắt đầu lượt làm mới")
      : availability === "UPCOMING"
        ? t("Bài kiểm tra chưa mở")
        : availability === "CLOSED"
          ? t("Bài kiểm tra đã đóng")
          : assessment.attemptsRemaining < 1 ? t("Bạn đã dùng hết lượt làm") : undefined;
  const launch = async () => {
    if (assessment.activeAttemptId) {
      router.push(`/assessments/attempts/${assessment.activeAttemptId}`);
      return;
    }
    if (readOnly || starting.current || !canStart) return;
    starting.current = true;
    try {
      await startMutation.mutateAsync();
    } catch (error) {
      if (!mounted.current) return;
      reportError(error, "Không thể bắt đầu lượt làm");
      void detailQuery.refetch();
    } finally {
      starting.current = false;
    }
  };

  return (
    <main aria-labelledby="assessment-detail-title" className="page-shell">
      <header className={`${styles.pageHeader} page-heading`}>
        <div className="page-heading-copy">
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/assessments")} type="link">{t("Bài kiểm tra")}</Button>
          <h1 id="assessment-detail-title">{assessment.title}</h1>
          {assessment.instructions && <p>{assessment.instructions}</p>}
        </div>
        <AvailabilityTag availability={availability} />
      </header>
      {readOnly && !resume && <Alert description={t("Bạn vẫn xem được thông tin, nhưng không thể bắt đầu lượt làm mới.")} showIcon title={t("Chế độ chỉ đọc")} type="warning" />}
      <Card className="surface-card" title={t("Thông tin lượt làm")}>
        <dl className={styles.cardMeta}>
          <div><dt>{t("Thời lượng")}</dt><dd>{formatAssessmentDuration(assessment.timeLimitSeconds, locale)}</dd></div>
          <div><dt>{t("Điểm đạt")}</dt><dd>{assessment.passPercent}%</dd></div>
          <div><dt>{t("Đã làm")}</dt><dd>{assessment.attemptsUsed}/{assessment.maxAttempts} {t("lượt")}</dd></div>
          <div><dt>{t("Còn lại")}</dt><dd>{assessment.attemptsRemaining} {t("lượt")}</dd></div>
          <div><dt>{t("Mở lúc")}</dt><dd>{formatAssessmentDate(assessment.opensAt, locale)}</dd></div>
          <div><dt>{t("Đóng lúc")}</dt><dd>{formatAssessmentDate(assessment.closesAt, locale)}</dd></div>
          <div><dt>{t("Tổng điểm")}</dt><dd>{assessment.maxScore.toLocaleString(locale === "en" ? "en-US" : "vi-VN")}</dd></div>
          <div><dt>{t("Công bố kết quả")}</dt><dd>{t(resultVisibilityLabels[assessment.resultVisibility])}</dd></div>
        </dl>
        <div className={styles.cardActions} style={{ marginTop: 22 }}>
          <Button
            disabled={launchDisabled}
            icon={<PlayCircleOutlined />}
            loading={startMutation.isPending}
            onClick={() => void launch()}
            title={launchTitle}
            type="primary"
          >
            {resume ? t("Tiếp tục làm bài") : t("Bắt đầu lượt làm")}
          </Button>
        </div>
      </Card>
      {resume && readOnly && (
        <Alert
          description={t("Bạn có thể mở lượt làm để xem các đáp án đã lưu, nhưng thay đổi và nộp bài đang tạm khóa.")}
          showIcon
          title={t("Lượt làm đang mở trong chế độ chỉ đọc")}
          type="info"
        />
      )}
    </main>
  );
}

export default function AssessmentDetailPage() {
  const { t } = useI18n(learningMessages);
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { effectiveAccess, organization, token, user } = useAuth();
  const scope = getViewerScope(user, organization);
  if (!effectiveModuleEnabled(effectiveAccess, "ASSESSMENTS")) {
    return <Alert showIcon title={t("Module Bài kiểm tra không khả dụng trong workspace này.")} type="warning" />;
  }
  if (!token || !scope) return <Alert showIcon title={t("Phiên thành viên không hợp lệ. Vui lòng đăng nhập lại.")} type="error" />;
  if (user?.role !== "LEARNER") {
    return (
      <Result
        extra={<Button onClick={() => router.push(`/assessments/manage/${params.id}`)} type="primary">{t("Mở trang soạn bài")}</Button>}
        status="info"
        subTitle={t("Trang chi tiết khởi động lượt làm chỉ dành cho học viên.")}
        title={t("Bạn đang ở vai trò quản lý")}
      />
    );
  }
  const readOnly = effectiveAccess?.readOnly ?? false;
  const authorityKey = `${scope.tenantId}:${scope.membershipId}:${scope.viewerId}:${scope.role}:${params.id}:${readOnly ? "READ_ONLY" : "WRITABLE"}`;
  return <LearnerAssessmentDetail assessmentId={params.id} key={authorityKey} readOnly={readOnly} scope={scope} token={token} />;
}
