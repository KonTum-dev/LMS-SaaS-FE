"use client";

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
  const [submitError, setSubmitError] = useState("");
  const [expiryError, setExpiryError] = useState("");
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
    setSubmitError("");
    const response = await refetchAttempt();
    if (!mounted.current) return;
    if (response.error) {
      setSubmitError(response.error instanceof Error
        ? response.error.message
        : "Không thể tải trạng thái mới nhất của lượt làm.");
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
    setSubmitError("");
    try {
      await queueRef.current?.flush();
      if (!mounted.current) return;
      router.push(`/assessments/${attempt.assessmentId}`);
    } catch (error) {
      if (!mounted.current) return;
      setSubmitError(error instanceof Error
        ? `Chưa thể rời trang vì đáp án chưa lưu: ${error.message}`
        : "Chưa thể rời trang vì còn đáp án chưa lưu.");
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
    setSubmitError("");
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
        ? "Revision lượt làm đã thay đổi. Tải bản mới, lưu lại các lựa chọn rồi nộp lại."
        : error instanceof Error ? error.message : "Không thể nộp bài");
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
          ? `Chưa thể xác nhận hết giờ: ${response.error.message}`
          : "Chưa thể xác nhận trạng thái hết giờ với máy chủ.");
        return;
      }
      setExpiryError("");
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
          setExpiryError("Máy chủ chưa chốt lượt làm. Vui lòng thử xác nhận lại.");
        } else {
          expiryChecked.current = null;
        }
      }
    }, (error: unknown) => {
      if (!mounted.current) return;
      setExpiryError(error instanceof Error
        ? `Chưa thể xác nhận hết giờ: ${error.message}`
        : "Chưa thể xác nhận trạng thái hết giờ với máy chủ.");
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
    ? "Có đáp án chưa được lưu."
    : queueState.saving
      ? `Đang lưu ${queueState.pendingCount} thay đổi…`
      : queueState.pendingCount > 0
        ? "Đang đồng bộ thay đổi…"
        : "Mọi thay đổi đã được lưu.";

  return (
    <main aria-labelledby="attempt-title" className="page-shell">
      <header className={`${styles.attemptHeader} page-heading`}>
        <div className="page-heading-copy">
          <Button icon={<ArrowLeftOutlined />} loading={leaving} onClick={() => void leaveAttempt()} type="link">Chi tiết bài kiểm tra</Button>
          <h1 id="attempt-title">{attempt.title}</h1>
          <p>Lượt {attempt.attemptNumber} · Phiên bản {attempt.versionNumber}</p>
        </div>
        <div className={styles.attemptStatus}>
          <AttemptStatusTag status={attempt.status} />
          {remaining !== null ? (
            <time aria-label={`Thời gian còn lại ${formatRemaining(remaining)}`} className={`${styles.timer} ${remaining <= 300 ? styles.timerUrgent : ""}`} dateTime={`PT${remaining}S`}>
              {formatRemaining(remaining)}
            </time>
          ) : <Tag>Không giới hạn thời gian</Tag>}
          <span className={styles.muted}>{answeredCount}/{attempt.questions.length} câu đã trả lời</span>
        </div>
      </header>

      {attempt.instructions && <Alert description={attempt.instructions} showIcon title="Hướng dẫn" type="info" />}
      {readOnly && <Alert description="Bạn xem được đáp án đã lưu, nhưng không thể thay đổi hoặc nộp bài trong chế độ chỉ đọc." showIcon title="Chế độ chỉ đọc" type="warning" />}
      {remaining === 0 && <Alert description="Hệ thống đang chốt lượt làm theo thời gian máy chủ." showIcon title="Đã hết thời gian" type="warning" />}
      {expiryError && (
        <Alert
          action={(
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                expiryChecked.current = null;
                setExpiryError("");
                setExpiryRetry((current) => current + 1);
              }}
            >
              Thử xác nhận lại
            </Button>
          )}
          description={expiryError}
          showIcon
          title="Chưa chốt được lượt làm"
          type="error"
        />
      )}
      {Boolean(queueError) && (
        <Alert
          action={<Button icon={<ReloadOutlined />} onClick={() => void retrySavesAgainstLatest()}>{queueConflict ? "Nạp bản mới và lưu lại" : "Thử lưu lại"}</Button>}
          description={queueConflict
            ? "Lượt làm đã được cập nhật ở nơi khác. Các lựa chọn trên màn hình này vẫn được giữ để bạn đồng bộ lại."
            : queueError instanceof Error ? queueError.message : "Kiểm tra kết nối rồi thử lại."}
          showIcon
          title="Chưa lưu được đáp án"
          type="error"
        />
      )}
      {submitError && (
        <Alert
          action={<Button icon={<ReloadOutlined />} onClick={() => void retrySavesAgainstLatest()}>Tải bản mới</Button>}
          closable
          onClose={() => setSubmitError("")}
          showIcon
          title={submitError}
          type="error"
        />
      )}

      <nav aria-label="Đi tới câu hỏi" className={styles.questionNav}>
        {attempt.questions.map((question, index) => (
          <Button
            aria-label={`Đi tới câu ${index + 1}${answers[question.id]?.length ? ", đã trả lời" : ", chưa trả lời"}`}
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

      <section aria-label="Câu hỏi" className={styles.questionList}>
        {attempt.questions.map((question, index) => {
          const selected = answers[question.id] ?? [];
          return (
            <Card className={`${styles.attemptQuestion} surface-card`} id={`attempt-question-${question.id}`} key={question.id} tabIndex={-1}>
              <article aria-labelledby={`attempt-question-title-${question.id}`}>
                <div className={styles.statusLine}>
                  <Tag color="blue">Câu {index + 1}</Tag>
                  <span className={styles.muted}>{question.points} điểm · {question.type === "SINGLE_CHOICE" ? "Một đáp án" : "Nhiều đáp án"}</span>
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
                  <Button disabled={inputsDisabled} onClick={() => changeAnswer(question.id, [])} size="small" style={{ marginTop: 12 }} type="link">Xóa lựa chọn câu này</Button>
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
            {unanswered > 0 && <div className={styles.muted}>Còn {unanswered} câu chưa trả lời. Bạn vẫn có thể nộp bài.</div>}
          </div>
          <Popconfirm
            cancelText="Tiếp tục làm"
            description={unanswered > 0 ? `Bạn còn ${unanswered} câu chưa trả lời.` : "Bạn đã trả lời tất cả câu hỏi."}
            disabled={inputsDisabled || Boolean(queueError)}
            okText="Nộp bài"
            onConfirm={() => void submit()}
            title="Nộp và kết thúc lượt làm?"
          >
            <Button disabled={inputsDisabled || Boolean(queueError)} icon={<SendOutlined />} loading={submitting} type="primary">Nộp bài</Button>
          </Popconfirm>
        </div>
      </Card>
    </main>
  );
}

export function AssessmentAttemptRunner(props: AssessmentAttemptRunnerProps) {
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
    return <div aria-label="Đang tải lượt làm" className="page-loading" role="status"><Spin size="large" /></div>;
  }
  if (!attemptQuery.data) {
    const hidden = attemptQuery.error instanceof ApiError
      && attemptQuery.error.code === "ASSESSMENT_ATTEMPT_NOT_FOUND";
    return (
      <Result
        extra={(
          <div className={styles.inlineActions}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/assessments")}>Về danh sách</Button>
            {!hidden && <Button icon={<ReloadOutlined />} onClick={() => void attemptQuery.refetch()} type="primary">Thử lại</Button>}
          </div>
        )}
        status={hidden ? "404" : "error"}
        subTitle={hidden ? "Lượt làm không còn khả dụng trong workspace của bạn." : attemptQuery.error instanceof Error ? attemptQuery.error.message : "Không thể tải lượt làm."}
        title={hidden ? "Không tìm thấy lượt làm" : "Không tải được lượt làm"}
      />
    );
  }
  if (attemptQuery.data.status !== "IN_PROGRESS") {
    return (
      <Result
        extra={<Button onClick={() => router.replace(`/assessments/results/${props.attemptId}`)} type="primary">Xem trạng thái kết quả</Button>}
        status="success"
        subTitle="Lượt làm đã kết thúc và không thể thay đổi đáp án."
        title={attemptQuery.data.status === "TIMED_OUT" ? "Lượt làm đã hết giờ" : "Bạn đã nộp bài"}
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
