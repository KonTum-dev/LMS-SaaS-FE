"use client";

import { useFeedback } from "@/components/feedback/feedback-provider";
import { useI18n } from "@/components/i18n/i18n-provider";
import { learningMessages } from "@/lib/i18n/learning-messages";

import { ArrowLeftOutlined, ReloadOutlined, SendOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Checkbox, Popconfirm, Radio, Result, Spin, Tag } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "@/components/assessments/assessments.module.css";
import { AttemptStatusTag } from "@/components/assessments/assessment-presenters";
import { useServerAlignedNow } from "@/components/assessments/use-assessment-clock";
import {
  assessmentApi,
  type AssessmentAttempt,
  type AssessmentSavedAnswer,
} from "@/lib/assessment-api";
import {
  assessmentAnswerRecoveryKey,
  clearAssessmentAnswerRecovery,
  readAssessmentAnswerRecovery,
  writeAssessmentAnswerRecovery,
} from "@/lib/assessment-answer-recovery";
import {
  SerializedAssessmentAnswerQueue,
  type AssessmentAnswerQueueState,
} from "@/lib/assessment-answer-queue";
import { assessmentRemainingSeconds, serverAlignedNow } from "@/lib/assessment-time";
import { ApiError } from "@/lib/api";
import { lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";
import { invalidateAssessmentAttemptCompletionQueries } from "@/lib/query-invalidation";

interface AssessmentAttemptRunnerProps {
  attemptId: string;
  readOnly: boolean;
  scope: ViewerScope;
  token: string;
}

interface AssessmentAttemptSessionProps extends AssessmentAttemptRunnerProps {
  initialAttempt: AssessmentAttempt;
  initialDataUpdatedAt: number;
  refetchAttempt: () => Promise<{
    data: AssessmentAttempt | undefined;
    error: unknown | null;
  }>;
}

type AnswerMap = Record<string, string[]>;

const EMPTY_QUEUE_STATE: AssessmentAnswerQueueState = {
  error: null,
  pendingCount: 0,
  saving: false,
};

function answersToMap(answers: AssessmentSavedAnswer[]): AnswerMap {
  return Object.fromEntries(answers.map((answer) => [
    answer.questionId,
    [...answer.selectedChoiceIds],
  ]));
}

function sameSelection(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function formatRemaining(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function AssessmentAttemptSession({
  attemptId,
  initialDataUpdatedAt,
  initialAttempt,
  readOnly,
  refetchAttempt,
  scope,
  token,
}: AssessmentAttemptSessionProps) {
  const { t } = useI18n(learningMessages);
  const { formatError } = useFeedback();
  const router = useRouter();
  const queryClient = useQueryClient();
  const mounted = useRef(true);
  const queueRef = useRef<SerializedAssessmentAnswerQueue<AssessmentAttempt> | null>(null);
  const answersRef = useRef<AnswerMap>(answersToMap(initialAttempt.answers));
  const dirtyQuestions = useRef(new Set<string>());
  const submittingRef = useRef(false);
  const leavingRef = useRef(false);
  const submitController = useRef<AbortController | null>(null);
  const expiryChecked = useRef<string | null>(null);
  const initialQuestions = useRef(initialAttempt.questions);
  const initialRecoveryAuthority = useRef({
    dataUpdatedAt: initialDataUpdatedAt,
    deadlineAt: initialAttempt.deadlineAt,
    serverNow: initialAttempt.serverNow,
    status: initialAttempt.status,
  });
  const initialScope = useRef(scope);
  const [attempt, setAttempt] = useState(initialAttempt);
  const [answers, setAnswers] = useState<AnswerMap>(() => answersToMap(initialAttempt.answers));
  const [initialRevision] = useState(initialAttempt.revision);
  const [clockReceivedAt, setClockReceivedAt] = useState(
    () => initialDataUpdatedAt || Date.now(),
  );
  const [queueState, setQueueState] = useState(EMPTY_QUEUE_STATE);
  const [leaving, setLeaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  type AttemptNotice = { source: string; error?: unknown; interpolate?: boolean };
  const noticeText = (notice: AttemptNotice) => notice.error === undefined ? t(notice.source) : notice.interpolate ? t(notice.source, { p0: formatError(notice.error) }) : formatError(notice.error, notice.source);
  const [submitError, setSubmitError] = useState<AttemptNotice | null>(null);
  const [expiryError, setExpiryError] = useState<AttemptNotice | null>(null);
  const [expiryRetry, setExpiryRetry] = useState(0);
  const recoveryKey = assessmentAnswerRecoveryKey(scope, attemptId);
  const persistDirtyAnswers = useCallback(() => {
    const pending = new Map<string, readonly string[]>();
    dirtyQuestions.current.forEach((questionId) => {
      pending.set(questionId, answersRef.current[questionId] ?? []);
    });
    writeAssessmentAnswerRecovery(recoveryKey, pending);
  }, [recoveryKey]);
  const liveServerNow = useServerAlignedNow(
    attempt.serverNow,
    clockReceivedAt,
    Boolean(attempt.deadlineAt && attempt.status === "IN_PROGRESS"),
  );
  const remaining = assessmentRemainingSeconds(
    attempt.deadlineAt,
    attempt.status,
    liveServerNow,
  );

  useEffect(() => {
    mounted.current = true;
    const queue = new SerializedAssessmentAnswerQueue<AssessmentAttempt>({
      initialRevision,
      onSaved: (canonical, questionId, selection) => {
        if (!mounted.current) return;
        setClockReceivedAt(Date.now());
        setAttempt(canonical);
        queryClient.setQueryData(
          lmsQueryKeys.assessmentAttempt(initialScope.current, attemptId),
          canonical,
        );
        if (sameSelection(answersRef.current[questionId] ?? [], selection)
          && !queue.hasPending(questionId)) {
          dirtyQuestions.current.delete(questionId);
        }
        persistDirtyAnswers();
      },
      onStateChange: (state) => {
        if (mounted.current) setQueueState(state);
      },
      save: (questionId, selectedChoiceIds, expectedRevision, signal) =>
        assessmentApi.saveAnswer(
          { token },
          attemptId,
          questionId,
          { expectedRevision, selectedChoiceIds },
          { signal },
        ),
    });
    queueRef.current = queue;
    const recovered = readAssessmentAnswerRecovery(recoveryKey, initialQuestions.current);
    const recoveryAuthority = initialRecoveryAuthority.current;
    const cachedSnapshotNow = serverAlignedNow(
      recoveryAuthority.serverNow,
      recoveryAuthority.dataUpdatedAt,
      Date.now(),
    );
    const recoveryCanMutate = !readOnly
      && recoveryAuthority.status === "IN_PROGRESS"
      && assessmentRemainingSeconds(
        recoveryAuthority.deadlineAt,
        recoveryAuthority.status,
        cachedSnapshotNow,
      ) !== 0;
    if (recovered.size > 0 && recoveryCanMutate) {
      const merged = { ...answersRef.current };
      recovered.forEach((selection, questionId) => {
        merged[questionId] = [...selection];
        dirtyQuestions.current.add(questionId);
        queue.enqueue(questionId, selection);
      });
      answersRef.current = merged;
      setAnswers(merged);
    }
    return () => {
      mounted.current = false;
      queue.dispose();
      if (queueRef.current === queue) queueRef.current = null;
      submitController.current?.abort();
    };
  }, [
    attemptId,
    initialRevision,
    persistDirtyAnswers,
    queryClient,
    readOnly,
    recoveryKey,
    token,
  ]);

  const retrySavesAgainstLatest = async () => {
    setSubmitError(null);
    const response = await refetchAttempt();
    if (!mounted.current) return;
    if (response.error) {
      setSubmitError({ error: response.error, source: "Không thể tải trạng thái mới nhất của lượt làm." });
      return;
    }
    if (!response.data) return;
    if (response.data.status !== "IN_PROGRESS") {
      clearAssessmentAnswerRecovery(recoveryKey);
      queueRef.current?.dispose();
      setClockReceivedAt(Date.now());
      setAttempt(response.data);
      queryClient.setQueryData(lmsQueryKeys.assessmentAttempt(scope, attemptId), response.data);
      router.replace(`/assessments/results/${attemptId}`);
      return;
    }
    const serverAnswers = answersToMap(response.data.answers);
    const merged = { ...serverAnswers };
    const pending = new Map<string, readonly string[]>();
    dirtyQuestions.current.forEach((questionId) => {
      const local = answersRef.current[questionId] ?? [];
      merged[questionId] = [...local];
      pending.set(questionId, local);
    });
    answersRef.current = merged;
    setAnswers(merged);
    setClockReceivedAt(Date.now());
    setAttempt(response.data);
    queryClient.setQueryData(lmsQueryKeys.assessmentAttempt(scope, attemptId), response.data);
    queueRef.current?.replacePending(pending);
    queueRef.current?.retryFromRevision(response.data.revision);
    persistDirtyAnswers();
  };

  const changeAnswer = (questionId: string, selectedChoiceIds: string[]) => {
    if (
      !attempt
      || attempt.status !== "IN_PROGRESS"
      || readOnly
      || leavingRef.current
      || submittingRef.current
      || remaining === 0
    ) return;
    const next = { ...answersRef.current, [questionId]: [...selectedChoiceIds] };
    answersRef.current = next;
    dirtyQuestions.current.add(questionId);
    setAnswers(next);
    persistDirtyAnswers();
    queueRef.current?.enqueue(questionId, selectedChoiceIds);
  };

  const leaveAttempt = async () => {
    if (leavingRef.current || submittingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    setSubmitError(null);
    try {
      await queueRef.current?.flush();
      if (!mounted.current) return;
      router.push(`/assessments/${attempt.assessmentId}`);
    } catch (error) {
      if (!mounted.current) return;
      setSubmitError(error instanceof Error
        ? { source: "Chưa thể rời trang vì đáp án chưa lưu: {p0}", error, interpolate: true }
        : { source: "Chưa thể rời trang vì còn đáp án chưa lưu." });
    } finally {
      leavingRef.current = false;
      if (mounted.current) setLeaving(false);
    }
  };

  const submit = async () => {
    if (
      !attempt
      || readOnly
      || leavingRef.current
      || submittingRef.current
      || remaining === 0
      || attempt.status !== "IN_PROGRESS"
    ) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const expectedRevision = await queueRef.current?.flush() ?? attempt.revision;
      const controller = new AbortController();
      submitController.current = controller;
      const terminal = await assessmentApi.submitAttempt(
        { token },
        attemptId,
        { expectedRevision },
        { signal: controller.signal },
      );
      if (!mounted.current) return;
      clearAssessmentAnswerRecovery(recoveryKey);
      setClockReceivedAt(Date.now());
      setAttempt(terminal);
      queryClient.setQueryData(lmsQueryKeys.assessmentAttempt(scope, attemptId), terminal);
      void invalidateAssessmentAttemptCompletionQueries(
        queryClient,
        scope,
        terminal.assessmentId,
        attemptId,
      ).catch(() => undefined);
      router.replace(`/assessments/results/${attemptId}`);
    } catch (error) {
      if (!mounted.current || (error instanceof DOMException && error.name === "AbortError")) return;
      const conflict = error instanceof ApiError
        && (error.code === "ATTEMPT_REVISION_MISMATCH" || error.status === 409);
      setSubmitError(conflict
        ? { source: "Revision lượt làm đã thay đổi. Tải bản mới, lưu lại các lựa chọn rồi nộp lại." }
        : { source: "Không thể nộp bài", error });
    } finally {
      submitController.current = null;
      submittingRef.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!attempt.deadlineAt || attempt.status !== "IN_PROGRESS" || remaining !== 0) return;
    if (expiryChecked.current === attempt.deadlineAt) return;
    expiryChecked.current = attempt.deadlineAt;
    void refetchAttempt().then((response) => {
      if (!mounted.current) return;
      if (response.error || !response.data) {
        setExpiryError(response.error instanceof Error
          ? { source: "Chưa thể xác nhận hết giờ: {p0}", error: response.error, interpolate: true }
          : { source: "Chưa thể xác nhận trạng thái hết giờ với máy chủ." });
        return;
      }
      setExpiryError(null);
      setClockReceivedAt(Date.now());
      setAttempt(response.data);
      queryClient.setQueryData(lmsQueryKeys.assessmentAttempt(scope, attemptId), response.data);
      if (response.data.status !== "IN_PROGRESS") {
        clearAssessmentAnswerRecovery(recoveryKey);
        queueRef.current?.dispose();
        router.replace(`/assessments/results/${attemptId}`);
      } else {
        const freshRemaining = assessmentRemainingSeconds(
          response.data.deadlineAt,
          response.data.status,
          Date.parse(response.data.serverNow),
        );
        if (freshRemaining === 0) {
          setExpiryError({ source: "Máy chủ chưa chốt lượt làm. Vui lòng thử xác nhận lại." });
        } else {
          expiryChecked.current = null;
        }
      }
    }, (error: unknown) => {
      if (!mounted.current) return;
      setExpiryError(error instanceof Error
        ? { source: "Chưa thể xác nhận hết giờ: {p0}", error, interpolate: true }
        : { source: "Chưa thể xác nhận trạng thái hết giờ với máy chủ." });
    });
  }, [attempt.deadlineAt, attempt.status, attemptId, expiryRetry, queryClient, recoveryKey, refetchAttempt, remaining, router, scope]);

  const hasUnsavedAnswers = queueState.pendingCount > 0 || Boolean(queueState.error);
  useEffect(() => {
    if (!hasUnsavedAnswers) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedAnswers]);

  const answeredCount = useMemo(
    () => attempt.questions.filter((question) => (answers[question.id]?.length ?? 0) > 0).length,
    [answers, attempt.questions],
  );
  const queueError = queueState.error;
  const queueConflict = queueError instanceof ApiError
    && queueError.code === "ATTEMPT_REVISION_MISMATCH";
  const unanswered = attempt.questions.length - answeredCount;
  const inputsDisabled = readOnly
    || leaving
    || submitting
    || remaining === 0
    || attempt.status !== "IN_PROGRESS";
  const saveMessage = queueError
    ? t("Có đáp án chưa được lưu.")
    : queueState.saving
      ? t("Đang lưu {p0} thay đổi…", { p0: queueState.pendingCount })
      : queueState.pendingCount > 0
        ? t("Đang đồng bộ thay đổi…")
        : t("Mọi thay đổi đã được lưu.");

  return (
    <main aria-labelledby="attempt-title" className="page-shell">
      <header className={`${styles.attemptHeader} page-heading`}>
        <div className="page-heading-copy">
          <Button icon={<ArrowLeftOutlined />} loading={leaving} onClick={() => void leaveAttempt()} type="link">{t("Chi tiết bài kiểm tra")}</Button>
          <h1 id="attempt-title">{attempt.title}</h1>
          <p>{t("Lượt")} {attempt.attemptNumber} {t("· Phiên bản")} {attempt.versionNumber}</p>
        </div>
        <div className={styles.attemptStatus}>
          <AttemptStatusTag status={attempt.status} />
          {remaining !== null ? (
            <time aria-label={t("Thời gian còn lại {p0}", { p0: formatRemaining(remaining) })} className={`${styles.timer} ${remaining <= 300 ? styles.timerUrgent : ""}`} dateTime={`PT${remaining}S`}>
              {formatRemaining(remaining)}
            </time>
          ) : <Tag>{t("Không giới hạn thời gian")}</Tag>}
          <span className={styles.muted}>{answeredCount}/{attempt.questions.length} {t("câu đã trả lời")}</span>
        </div>
      </header>

      {attempt.instructions && <Alert description={attempt.instructions} showIcon title={t("Hướng dẫn")} type="info" />}
      {readOnly && <Alert description={t("Bạn xem được đáp án đã lưu, nhưng không thể thay đổi hoặc nộp bài trong chế độ chỉ đọc.")} showIcon title={t("Chế độ chỉ đọc")} type="warning" />}
      {remaining === 0 && <Alert description={t("Hệ thống đang chốt lượt làm theo thời gian máy chủ.")} showIcon title={t("Đã hết thời gian")} type="warning" />}
      {expiryError && (
        <Alert
          action={(
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                expiryChecked.current = null;
                setExpiryError(null);
                setExpiryRetry((current) => current + 1);
              }}
            >{t("Thử xác nhận lại")}</Button>
          )}
          description={noticeText(expiryError)}
          showIcon
          title={t("Chưa chốt được lượt làm")}
          type="error"
        />
      )}
      {Boolean(queueError) && (
        <Alert
          action={<Button icon={<ReloadOutlined />} onClick={() => void retrySavesAgainstLatest()}>{queueConflict ? t("Nạp bản mới và lưu lại") : t("Thử lưu lại")}</Button>}
          description={queueConflict
            ? t("Lượt làm đã được cập nhật ở nơi khác. Các lựa chọn trên màn hình này vẫn được giữ để bạn đồng bộ lại.")
            : formatError(queueError, "Kiểm tra kết nối rồi thử lại.")}
          showIcon
          title={t("Chưa lưu được đáp án")}
          type="error"
        />
      )}
      {submitError && (
        <Alert
          action={<Button icon={<ReloadOutlined />} onClick={() => void retrySavesAgainstLatest()}>{t("Tải bản mới")}</Button>}
          closable
          onClose={() => setSubmitError(null)}
          showIcon
          title={noticeText(submitError)}
          type="error"
        />
      )}

      <nav aria-label={t("Đi tới câu hỏi")} className={styles.questionNav}>
        {attempt.questions.map((question, index) => (
          <Button
            aria-label={t("Đi tới câu {p0}{p1}", { p0: index + 1, p1: answers[question.id]?.length ? t(", đã trả lời") : t(", chưa trả lời") })}
            key={question.id}
            onClick={() => {
              const element = document.getElementById(`attempt-question-${question.id}`);
              element?.scrollIntoView({ behavior: "smooth", block: "start" });
              element?.focus({ preventScroll: true });
            }}
            shape="circle"
            type={answers[question.id]?.length ? "primary" : "default"}
          >
            {index + 1}
          </Button>
        ))}
      </nav>

      <section aria-label={t("Câu hỏi")} className={styles.questionList}>
        {attempt.questions.map((question, index) => {
          const selected = answers[question.id] ?? [];
          return (
            <Card className={`${styles.attemptQuestion} surface-card`} id={`attempt-question-${question.id}`} key={question.id} tabIndex={-1}>
              <article aria-labelledby={`attempt-question-title-${question.id}`}>
                <div className={styles.statusLine}>
                  <Tag color="blue">{t("Câu")} {index + 1}</Tag>
                  <span className={styles.muted}>{question.points} {t("điểm ·")} {question.type === "SINGLE_CHOICE" ? t("Một đáp án") : t("Nhiều đáp án")}</span>
                </div>
                <h2 id={`attempt-question-title-${question.id}`}>{question.prompt}</h2>
                {question.type === "SINGLE_CHOICE" ? (
                  <Radio.Group
                    aria-labelledby={`attempt-question-title-${question.id}`}
                    className={styles.choiceGroup}
                    disabled={inputsDisabled}
                    onChange={(event) => changeAnswer(question.id, [String(event.target.value)])}
                    value={selected[0] ?? null}
                  >
                    {question.choices.map((choice) => <Radio className={styles.choiceOption} key={choice.id} value={choice.id}>{choice.text}</Radio>)}
                  </Radio.Group>
                ) : (
                  <Checkbox.Group
                    aria-labelledby={`attempt-question-title-${question.id}`}
                    className={styles.choiceGroup}
                    disabled={inputsDisabled}
                    onChange={(values) => changeAnswer(question.id, values.map(String))}
                    value={selected}
                  >
                    {question.choices.map((choice) => <Checkbox className={styles.choiceOption} key={choice.id} value={choice.id}>{choice.text}</Checkbox>)}
                  </Checkbox.Group>
                )}
                {selected.length > 0 && (
                  <Button disabled={inputsDisabled} onClick={() => changeAnswer(question.id, [])} size="small" style={{ marginTop: 12 }} type="link">{t("Xóa lựa chọn câu này")}</Button>
                )}
              </article>
            </Card>
          );
        })}
      </section>

      <Card className="surface-card">
        <div className={styles.pageHeader}>
          <div aria-live="polite" className={styles.saveState} role="status">
            <strong>{saveMessage}</strong>
            {unanswered > 0 && <div className={styles.muted}>{t("Còn")} {unanswered} {t("câu chưa trả lời. Bạn vẫn có thể nộp bài.")}</div>}
          </div>
          <Popconfirm
            cancelText={t("Tiếp tục làm")}
            description={unanswered > 0 ? t("Bạn còn {p0} câu chưa trả lời.", { p0: unanswered }) : t("Bạn đã trả lời tất cả câu hỏi.")}
            disabled={inputsDisabled || Boolean(queueError)}
            okText={t("Nộp bài")}
            onConfirm={() => void submit()}
            title={t("Nộp và kết thúc lượt làm?")}
          >
            <Button disabled={inputsDisabled || Boolean(queueError)} icon={<SendOutlined />} loading={submitting} type="primary">{t("Nộp bài")}</Button>
          </Popconfirm>
        </div>
      </Card>
    </main>
  );
}

export function AssessmentAttemptRunner(props: AssessmentAttemptRunnerProps) {
  const { t } = useI18n(learningMessages);
  const { formatError } = useFeedback();
  const router = useRouter();
  const attemptQuery = useQuery({
    queryFn: () => assessmentApi.getAttempt({ token: props.token }, props.attemptId),
    queryKey: lmsQueryKeys.assessmentAttempt(props.scope, props.attemptId),
  });
  const recoveryKey = assessmentAnswerRecoveryKey(props.scope, props.attemptId);
  useEffect(() => {
    if (attemptQuery.data && attemptQuery.data.status !== "IN_PROGRESS") {
      clearAssessmentAnswerRecovery(recoveryKey);
    }
  }, [attemptQuery.data, recoveryKey]);

  if (attemptQuery.isPending && !attemptQuery.data) {
    return <div aria-label={t("Đang tải lượt làm")} className="page-loading" role="status"><Spin size="large" /></div>;
  }
  if (!attemptQuery.data) {
    const hidden = attemptQuery.error instanceof ApiError
      && attemptQuery.error.code === "ASSESSMENT_ATTEMPT_NOT_FOUND";
    return (
      <Result
        extra={(
          <div className={styles.inlineActions}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/assessments")}>{t("Về danh sách")}</Button>
            {!hidden && <Button icon={<ReloadOutlined />} onClick={() => void attemptQuery.refetch()} type="primary">{t("Thử lại")}</Button>}
          </div>
        )}
        status={hidden ? "404" : "error"}
        subTitle={hidden ? t("Lượt làm không còn khả dụng trong workspace của bạn.") : formatError(attemptQuery.error, "Không thể tải lượt làm.")}
        title={hidden ? t("Không tìm thấy lượt làm") : t("Không tải được lượt làm")}
      />
    );
  }
  if (attemptQuery.data.status !== "IN_PROGRESS") {
    return (
      <Result
        extra={<Button onClick={() => router.replace(`/assessments/results/${props.attemptId}`)} type="primary">{t("Xem trạng thái kết quả")}</Button>}
        status="success"
        subTitle={t("Lượt làm đã kết thúc và không thể thay đổi đáp án.")}
        title={attemptQuery.data.status === "TIMED_OUT" ? t("Lượt làm đã hết giờ") : t("Bạn đã nộp bài")}
      />
    );
  }

  const authorityKey = `${props.scope.tenantId}:${props.scope.membershipId}:${props.scope.viewerId}:${props.scope.role}:${props.attemptId}`;
  return (
    <AssessmentAttemptSession
      {...props}
      initialDataUpdatedAt={attemptQuery.dataUpdatedAt}
      initialAttempt={attemptQuery.data}
      key={authorityKey}
      refetchAttempt={attemptQuery.refetch}
    />
  );
}
