"use client";

import { ArrowLeftOutlined, PlayCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Result, Spin } from "antd";
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
  const { message } = App.useApp();
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
    return <div aria-label="Đang tải chi tiết bài kiểm tra" className="page-loading" role="status"><Spin size="large" /></div>;
  }
  if (detailQuery.error || !detailQuery.data) {
    const hidden = detailQuery.error instanceof ApiError && detailQuery.error.code === "ASSESSMENT_NOT_FOUND";
    return (
      <Result
        extra={(
          <div className={styles.inlineActions}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/assessments")}>Về danh sách</Button>
            {!hidden && <Button icon={<ReloadOutlined />} onClick={() => void detailQuery.refetch()} type="primary">Thử lại</Button>}
          </div>
        )}
        status={hidden ? "404" : "error"}
        subTitle={hidden
          ? "Bài kiểm tra không còn khả dụng trong workspace của bạn."
          : detailQuery.error instanceof Error ? detailQuery.error.message : "Không thể tải dữ liệu."}
        title={hidden ? "Không tìm thấy bài kiểm tra" : "Không tải được bài kiểm tra"}
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
    ? "Tiếp tục lượt làm đang mở"
    : readOnly
      ? "Workspace chỉ đọc: không thể bắt đầu lượt làm mới"
      : availability === "UPCOMING"
        ? "Bài kiểm tra chưa mở"
        : availability === "CLOSED"
          ? "Bài kiểm tra đã đóng"
          : assessment.attemptsRemaining < 1 ? "Bạn đã dùng hết lượt làm" : undefined;
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
      message.error(error instanceof Error ? error.message : "Không thể bắt đầu lượt làm");
      void detailQuery.refetch();
    } finally {
      starting.current = false;
    }
  };

  return (
    <main aria-labelledby="assessment-detail-title" className="page-shell">
      <header className={`${styles.pageHeader} page-heading`}>
        <div className="page-heading-copy">
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/assessments")} type="link">Bài kiểm tra</Button>
          <h1 id="assessment-detail-title">{assessment.title}</h1>
          <p>{assessment.instructions || "Không có hướng dẫn bổ sung."}</p>
        </div>
        <AvailabilityTag availability={availability} />
      </header>
      {readOnly && !resume && <Alert description="Bạn vẫn xem được thông tin, nhưng không thể bắt đầu lượt làm mới." showIcon title="Chế độ chỉ đọc" type="warning" />}
      <Card className="surface-card" title="Thông tin lượt làm">
        <dl className={styles.cardMeta}>
          <div><dt>Thời lượng</dt><dd>{formatAssessmentDuration(assessment.timeLimitSeconds)}</dd></div>
          <div><dt>Điểm đạt</dt><dd>{assessment.passPercent}%</dd></div>
          <div><dt>Đã làm</dt><dd>{assessment.attemptsUsed}/{assessment.maxAttempts} lượt</dd></div>
          <div><dt>Còn lại</dt><dd>{assessment.attemptsRemaining} lượt</dd></div>
          <div><dt>Mở lúc</dt><dd>{formatAssessmentDate(assessment.opensAt)}</dd></div>
          <div><dt>Đóng lúc</dt><dd>{formatAssessmentDate(assessment.closesAt)}</dd></div>
          <div><dt>Tổng điểm</dt><dd>{assessment.maxScore.toLocaleString("vi-VN")}</dd></div>
          <div><dt>Công bố kết quả</dt><dd>{resultVisibilityLabels[assessment.resultVisibility]}</dd></div>
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
            {resume ? "Tiếp tục làm bài" : "Bắt đầu lượt làm"}
          </Button>
        </div>
      </Card>
      {resume && readOnly && (
        <Alert
          description="Bạn có thể mở lượt làm để xem các đáp án đã lưu, nhưng thay đổi và nộp bài đang tạm khóa."
          showIcon
          title="Lượt làm đang mở trong chế độ chỉ đọc"
          type="info"
        />
      )}
    </main>
  );
}

export default function AssessmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { effectiveAccess, organization, token, user } = useAuth();
  const scope = getViewerScope(user, organization);
  if (!effectiveModuleEnabled(effectiveAccess, "ASSESSMENTS")) {
    return <Alert showIcon title="Module Bài kiểm tra không khả dụng trong workspace này." type="warning" />;
  }
  if (!token || !scope) return <Alert showIcon title="Phiên thành viên không hợp lệ. Vui lòng đăng nhập lại." type="error" />;
  if (user?.role !== "LEARNER") {
    return (
      <Result
        extra={<Button onClick={() => router.push(`/assessments/manage/${params.id}`)} type="primary">Mở trang soạn bài</Button>}
        status="info"
        subTitle="Trang chi tiết khởi động lượt làm chỉ dành cho học viên."
        title="Bạn đang ở vai trò quản lý"
      />
    );
  }
  const readOnly = effectiveAccess?.readOnly ?? false;
  const authorityKey = `${scope.tenantId}:${scope.membershipId}:${scope.viewerId}:${scope.role}:${params.id}:${readOnly ? "READ_ONLY" : "WRITABLE"}`;
  return <LearnerAssessmentDetail assessmentId={params.id} key={authorityKey} readOnly={readOnly} scope={scope} token={token} />;
}
