"use client";

import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SendOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Divider,
  Input,
  InputNumber,
  Popconfirm,
  Radio,
  Select,
  Space,
  Spin,
  Tag,
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "@/components/assessments/assessments.module.css";
import {
  AssessmentStatusTag,
  formatAssessmentDate,
  resultVisibilityLabels,
} from "@/components/assessments/assessment-presenters";
import {
  assessmentApi,
  createAssessmentMutationId,
  type AssessmentAuthoring,
  type AssessmentChoiceDraft,
  type AssessmentDraft,
  type AssessmentQuestionDraft,
  type AssessmentQuestionType,
  type AssessmentResultVisibility,
} from "@/lib/assessment-api";
import {
  assessmentDraftsEqual,
  canonicalizeAssessmentDraft,
  cloneAssessmentDraft,
  createAssessmentQuestion,
  validateAssessmentDraft,
} from "@/lib/assessment-draft";
import { ApiError } from "@/lib/api";
import { lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";
import {
  invalidateAssessmentAuthoringQueries,
  invalidateAssessmentListQueries,
} from "@/lib/query-invalidation";

interface AssessmentAuthoringProps {
  assessmentId: string;
  readOnly: boolean;
  scope: ViewerScope;
  token: string;
}

interface AuthoringEditorProps extends AssessmentAuthoringProps {
  initialAuthoring: AssessmentAuthoring;
  refetchAuthoring: () => Promise<{
    data: AssessmentAuthoring | undefined;
    error: unknown | null;
  }>;
}

const isRevisionConflict = (error: unknown) => error instanceof ApiError
  && (error.status === 412 || error.code === "ASSESSMENT_REVISION_MISMATCH");

const replaceAt = <T,>(items: T[], index: number, replacement: T) =>
  items.map((item, itemIndex) => itemIndex === index ? replacement : item);

function AuthoringEditor({
  assessmentId,
  initialAuthoring,
  readOnly,
  refetchAuthoring,
  scope,
  token,
}: AuthoringEditorProps) {
  const { message } = App.useApp();
  const router = useRouter();
  const queryClient = useQueryClient();
  const mounted = useRef(true);
  const mutationInFlight = useRef(false);
  const publishMutationId = useRef(createAssessmentMutationId());
  const [authoring, setAuthoring] = useState(initialAuthoring);
  const [draft, setDraft] = useState(() => cloneAssessmentDraft(initialAuthoring.draft));
  const [issues, setIssues] = useState<string[]>([]);
  const [actionError, setActionError] = useState("");
  const [conflict, setConflict] = useState(false);

  const applyCanonical = (value: AssessmentAuthoring) => {
    setAuthoring(value);
    setDraft(cloneAssessmentDraft(value.draft));
    setIssues([]);
    setActionError("");
    setConflict(false);
    queryClient.setQueryData(lmsQueryKeys.assessmentAuthoring(scope, assessmentId), value);
  };

  const dirty = !assessmentDraftsEqual(draft, authoring.draft);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const saveMutation = useMutation({
    mutationFn: (input: { draft: AssessmentDraft; expectedRevision: number }) =>
      assessmentApi.updateDraft({ token }, assessmentId, {
        ...canonicalizeAssessmentDraft(input.draft),
        expectedRevision: input.expectedRevision,
      }),
    onSuccess: async (value) => {
      if (!mounted.current) return;
      applyCanonical(value);
      await invalidateAssessmentListQueries(queryClient, scope);
      if (!mounted.current) return;
      message.success("Đã lưu bản nháp");
    },
  });
  const publishMutation = useMutation({
    mutationFn: (expectedRevision: number) => assessmentApi.publish({ token }, assessmentId, {
      clientMutationId: publishMutationId.current,
      expectedRevision,
    }),
    onSuccess: async (value) => {
      if (!mounted.current) return;
      publishMutationId.current = createAssessmentMutationId();
      applyCanonical(value);
      await invalidateAssessmentAuthoringQueries(queryClient, scope, assessmentId);
      if (!mounted.current) return;
      message.success(value.currentVersionNumber === 1 ? "Đã xuất bản bài kiểm tra" : "Đã xuất bản phiên bản mới");
    },
  });
  const archiveMutation = useMutation({
    mutationFn: (expectedRevision: number) => assessmentApi.archive(
      { token },
      assessmentId,
      { expectedRevision },
    ),
    onSuccess: async (value) => {
      if (!mounted.current) return;
      applyCanonical(value);
      await invalidateAssessmentAuthoringQueries(queryClient, scope, assessmentId);
      if (!mounted.current) return;
      message.success("Đã lưu trữ bài kiểm tra");
    },
  });

  const setDraftValue = (updater: (current: AssessmentDraft) => AssessmentDraft) => {
    setDraft((current) => current ? updater(current) : current);
    setIssues([]);
    setActionError("");
  };
  const updateQuestion = (
    index: number,
    updater: (question: AssessmentQuestionDraft) => AssessmentQuestionDraft,
  ) => setDraftValue((current) => ({
    ...current,
    questions: replaceAt(current.questions, index, updater(current.questions[index])),
  }));
  const updateChoice = (
    questionIndex: number,
    choiceIndex: number,
    updater: (choice: AssessmentChoiceDraft) => AssessmentChoiceDraft,
  ) => updateQuestion(questionIndex, (question) => ({
    ...question,
    choices: replaceAt(question.choices, choiceIndex, updater(question.choices[choiceIndex])),
  }));
  const changeQuestionType = (index: number, type: AssessmentQuestionType) => {
    updateQuestion(index, (question) => {
      let choices = question.choices;
      if (type === "MULTIPLE_CHOICE" && choices.length < 3) {
        choices = [...choices, { id: createAssessmentMutationId(), text: "" }];
      }
      return {
        ...question,
        choices,
        correctChoiceIds: type === "SINGLE_CHOICE"
          ? [question.correctChoiceIds[0] ?? choices[0].id]
          : [choices[0].id, choices[1].id],
        type,
      };
    });
  };
  const removeChoice = (questionIndex: number, choiceIndex: number) => {
    updateQuestion(questionIndex, (question) => {
      if (question.choices.length <= 2) return question;
      const removed = question.choices[choiceIndex];
      const choices = question.choices.filter((_, index) => index !== choiceIndex);
      let correctChoiceIds = question.correctChoiceIds.filter((id) => id !== removed.id);
      if (question.type === "SINGLE_CHOICE" && correctChoiceIds.length !== 1) {
        correctChoiceIds = [choices[0].id];
      }
      return { ...question, choices, correctChoiceIds };
    });
  };
  const moveQuestion = (index: number, direction: -1 | 1) => {
    setDraftValue((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.questions.length) return current;
      const questions = [...current.questions];
      [questions[index], questions[target]] = [questions[target], questions[index]];
      return { ...current, questions };
    });
  };

  const showValidation = (validationIssues: string[]) => {
    setIssues(validationIssues);
    requestAnimationFrame(() => document.getElementById("assessment-validation")?.focus());
  };
  const save = async () => {
    if (
      !authoring
      || !draft
      || readOnly
      || mutationInFlight.current
      || authoring.status === "ARCHIVED"
    ) return false;
    const validationIssues = validateAssessmentDraft(draft);
    if (validationIssues.length) {
      showValidation(validationIssues);
      return false;
    }
    setActionError("");
    setConflict(false);
    mutationInFlight.current = true;
    try {
      await saveMutation.mutateAsync({ draft, expectedRevision: authoring.revision });
      return true;
    } catch (error) {
      if (!mounted.current) return false;
      if (isRevisionConflict(error)) setConflict(true);
      setActionError(error instanceof Error ? error.message : "Không thể lưu bản nháp");
      return false;
    } finally {
      mutationInFlight.current = false;
    }
  };
  const publish = async () => {
    if (
      !authoring
      || readOnly
      || dirty
      || mutationInFlight.current
      || authoring.status === "ARCHIVED"
    ) return;
    setActionError("");
    setConflict(false);
    mutationInFlight.current = true;
    try {
      await publishMutation.mutateAsync(authoring.revision);
    } catch (error) {
      if (!mounted.current) return;
      if (isRevisionConflict(error)) setConflict(true);
      setActionError(error instanceof Error ? error.message : "Không thể xuất bản bài kiểm tra");
    } finally {
      mutationInFlight.current = false;
    }
  };
  const archive = async () => {
    if (
      !authoring
      || readOnly
      || dirty
      || mutationInFlight.current
      || authoring.status !== "PUBLISHED"
    ) return;
    setActionError("");
    setConflict(false);
    mutationInFlight.current = true;
    try {
      await archiveMutation.mutateAsync(authoring.revision);
    } catch (error) {
      if (!mounted.current) return;
      if (isRevisionConflict(error)) setConflict(true);
      setActionError(error instanceof Error ? error.message : "Không thể lưu trữ bài kiểm tra");
    } finally {
      mutationInFlight.current = false;
    }
  };
  const reloadPreservingDraft = async () => {
    const localDraft = cloneAssessmentDraft(draft);
    const response = await refetchAuthoring();
    if (response.error && mounted.current) {
      setActionError(response.error instanceof Error ? response.error.message : "Không thể tải revision mới nhất");
      return;
    }
    if (response.data && mounted.current) {
      setAuthoring(response.data);
      setDraft(localDraft);
      setConflict(false);
      setActionError("");
      message.info("Đã nạp revision mới và giữ nội dung bạn đang soạn");
    }
  };
  const mutationPending = saveMutation.isPending || publishMutation.isPending || archiveMutation.isPending;
  const mutationLocked = readOnly || authoring.status === "ARCHIVED";
  const canPublish = !mutationLocked && !dirty && authoring.hasUnpublishedChanges;

  return (
    <main aria-labelledby="authoring-title" className="page-shell">
      <header className={`${styles.pageHeader} page-heading`}>
        <div className="page-heading-copy">
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/assessments")} type="link">Bài kiểm tra</Button>
          <h1 id="authoring-title">{draft.title || "Bài kiểm tra chưa đặt tên"}</h1>
          <div className={styles.statusLine}>
            <AssessmentStatusTag status={authoring.status} />
            <Tag>Revision {authoring.revision}</Tag>
            {dirty ? <Tag color="orange">Chưa lưu trên thiết bị này</Tag> : null}
            {!dirty && authoring.hasUnpublishedChanges ? <Tag color="blue">Chưa xuất bản thay đổi mới nhất</Tag> : null}
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button disabled={mutationLocked || !dirty || mutationPending} icon={<SaveOutlined />} loading={saveMutation.isPending} onClick={() => void save()} title={readOnly ? "Workspace chỉ đọc" : undefined}>Lưu bản nháp</Button>
          <Button disabled={!canPublish || mutationPending} icon={<SendOutlined />} loading={publishMutation.isPending} onClick={() => void publish()} title={dirty ? "Lưu bản nháp trước khi xuất bản" : readOnly ? "Workspace chỉ đọc" : undefined} type="primary">Xuất bản</Button>
        </div>
      </header>

      {readOnly && <Alert description="Bạn có thể xem toàn bộ bản soạn. Các thao tác lưu, xuất bản và lưu trữ đang tạm khóa." showIcon title="Chế độ chỉ đọc" type="warning" />}
      {authoring.status === "ARCHIVED" && <Alert description="Bài kiểm tra đã ở trạng thái kết thúc. V1 không hỗ trợ khôi phục hoặc chỉnh sửa bài đã lưu trữ." showIcon title="Chỉ xem bản đã lưu trữ" type="info" />}
      {conflict && (
        <Alert
          action={<Button icon={<ReloadOutlined />} onClick={() => void reloadPreservingDraft()}>Nạp revision mới</Button>}
          description="Một thay đổi khác đã được lưu trước thao tác của bạn. Nạp revision mới để giữ nội dung đang soạn rồi thử lưu lại."
          id="assessment-conflict"
          showIcon
          title="Bản soạn trên máy chủ đã thay đổi"
          type="warning"
        />
      )}
      {actionError && !conflict && <Alert closable onClose={() => setActionError("")} showIcon title={actionError} type="error" />}
      {issues.length > 0 && (
        <div id="assessment-validation" tabIndex={-1}>
          <Alert
            description={<ul className={styles.validationList}>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
            showIcon
            title="Kiểm tra lại bản soạn"
            type="error"
          />
        </div>
      )}

      <div className={styles.authoringLayout}>
        <div className={styles.authoringMain}>
          <Card className="surface-card" title="Thông tin chung">
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <label>
                <span className={styles.muted}>Tên bài kiểm tra</span>
                <Input disabled={mutationLocked} maxLength={200} onChange={(event) => setDraftValue((current) => ({ ...current, title: event.target.value }))} showCount value={draft.title} />
              </label>
              <label>
                <span className={styles.muted}>Hướng dẫn học viên</span>
                <Input.TextArea disabled={mutationLocked} maxLength={20_000} onChange={(event) => setDraftValue((current) => ({ ...current, instructions: event.target.value }))} rows={5} showCount value={draft.instructions} />
              </label>
            </Space>
          </Card>

          <section aria-label="Danh sách câu hỏi" className={styles.questionList}>
            {draft.questions.map((question, questionIndex) => (
              <Card className={`${styles.questionCard} surface-card`} id={`question-${question.id}`} key={question.id}>
                <div className={styles.questionHeader}>
                  <h2>Câu {questionIndex + 1}</h2>
                  <div aria-label={`Sắp xếp câu ${questionIndex + 1}`} className={styles.inlineActions} role="group">
                    <Button aria-label={`Đưa câu ${questionIndex + 1} lên`} disabled={mutationLocked || questionIndex === 0} icon={<ArrowUpOutlined />} onClick={() => moveQuestion(questionIndex, -1)} size="small" />
                    <Button aria-label={`Đưa câu ${questionIndex + 1} xuống`} disabled={mutationLocked || questionIndex === draft.questions.length - 1} icon={<ArrowDownOutlined />} onClick={() => moveQuestion(questionIndex, 1)} size="small" />
                    <Popconfirm cancelText="Hủy" disabled={mutationLocked || draft.questions.length <= 1} okText="Xóa" onConfirm={() => setDraftValue((current) => ({ ...current, questions: current.questions.filter((_, index) => index !== questionIndex) }))} title="Xóa câu hỏi này?">
                      <Button aria-label={`Xóa câu ${questionIndex + 1}`} danger disabled={mutationLocked || draft.questions.length <= 1} icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                  </div>
                </div>
                <Divider />
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                  <label>
                    <span className={styles.muted}>Nội dung câu hỏi</span>
                    <Input.TextArea disabled={mutationLocked} maxLength={10_000} onChange={(event) => updateQuestion(questionIndex, (current) => ({ ...current, prompt: event.target.value }))} rows={3} value={question.prompt} />
                  </label>
                  <div className={styles.filters}>
                    <label>
                      <span className={styles.muted}>Loại câu hỏi</span>
                      <Select disabled={mutationLocked} onChange={(value) => changeQuestionType(questionIndex, value)} options={[
                        { label: "Một đáp án", value: "SINGLE_CHOICE" },
                        { label: "Nhiều đáp án", value: "MULTIPLE_CHOICE" },
                      ]} value={question.type} />
                    </label>
                    <label>
                      <span className={styles.muted}>Điểm</span>
                      <InputNumber disabled={mutationLocked} max={10_000} min={1} onChange={(value) => updateQuestion(questionIndex, (current) => ({ ...current, points: value ?? 1 }))} precision={0} value={question.points} />
                    </label>
                  </div>
                  <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                    <legend style={{ fontWeight: 600, marginBottom: 10 }}>Lựa chọn và đáp án đúng</legend>
                    <p className={styles.muted}>{question.type === "SINGLE_CHOICE" ? "Chọn đúng một đáp án." : "Chọn ít nhất hai đáp án đúng và giữ ít nhất một đáp án sai."}</p>
                    <div className={styles.choiceEditorList}>
                      {question.choices.map((choice, choiceIndex) => {
                        const correct = question.correctChoiceIds.includes(choice.id);
                        return (
                          <div className={styles.choiceEditor} key={choice.id}>
                            <span className={styles.choiceCorrect}>
                              {question.type === "SINGLE_CHOICE" ? (
                                <Radio
                                  aria-label={`Đặt lựa chọn ${choiceIndex + 1} câu ${questionIndex + 1} là đáp án đúng`}
                                  checked={correct}
                                  disabled={mutationLocked}
                                  name={`assessment-correct-${question.id}`}
                                  onChange={() => updateQuestion(questionIndex, (current) => ({ ...current, correctChoiceIds: [choice.id] }))}
                                />
                              ) : (
                                <Checkbox
                                  aria-label={`Đặt lựa chọn ${choiceIndex + 1} câu ${questionIndex + 1} là đáp án đúng`}
                                  checked={correct}
                                  disabled={mutationLocked}
                                  onChange={(event) => updateQuestion(questionIndex, (current) => ({
                                    ...current,
                                    correctChoiceIds: event.target.checked
                                      ? [...current.correctChoiceIds, choice.id]
                                      : current.correctChoiceIds.filter((id) => id !== choice.id),
                                  }))}
                                />
                              )}
                            </span>
                            <Input
                              aria-label={`Nội dung lựa chọn ${choiceIndex + 1} câu ${questionIndex + 1}`}
                              disabled={mutationLocked}
                              maxLength={2_000}
                              onChange={(event) => updateChoice(questionIndex, choiceIndex, (current) => ({ ...current, text: event.target.value }))}
                              placeholder={`Lựa chọn ${choiceIndex + 1}`}
                              value={choice.text}
                            />
                            <Button aria-label={`Xóa lựa chọn ${choiceIndex + 1} câu ${questionIndex + 1}`} danger disabled={mutationLocked || question.choices.length <= 2} icon={<DeleteOutlined />} onClick={() => removeChoice(questionIndex, choiceIndex)} size="small" type="text" />
                          </div>
                        );
                      })}
                    </div>
                    <Button disabled={mutationLocked || question.choices.length >= 8} icon={<PlusOutlined />} onClick={() => updateQuestion(questionIndex, (current) => ({ ...current, choices: [...current.choices, { id: createAssessmentMutationId(), text: "" }] }))} style={{ marginTop: 12 }}>Thêm lựa chọn</Button>
                  </fieldset>
                </Space>
              </Card>
            ))}
          </section>
          <Button block disabled={mutationLocked || draft.questions.length >= 50} icon={<PlusOutlined />} onClick={() => setDraftValue((current) => ({ ...current, questions: [...current.questions, createAssessmentQuestion()] }))} size="large">Thêm câu hỏi</Button>
        </div>

        <aside aria-label="Thiết lập và xuất bản" className={styles.authoringSidebar}>
          <Card className={`${styles.stickyCard} surface-card`} title="Thiết lập">
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <label>
                <span className={styles.muted}>Mở lúc</span>
                <DatePicker allowClear disabled={mutationLocked} onChange={(value) => setDraftValue((current) => ({ ...current, opensAt: value?.toISOString() ?? null }))} showTime style={{ width: "100%" }} value={draft.opensAt ? dayjs(draft.opensAt) : null} />
              </label>
              <label>
                <span className={styles.muted}>Đóng lúc</span>
                <DatePicker allowClear disabled={mutationLocked} onChange={(value) => setDraftValue((current) => ({ ...current, closesAt: value?.toISOString() ?? null }))} showTime style={{ width: "100%" }} value={draft.closesAt ? dayjs(draft.closesAt) : null} />
              </label>
              <label>
                <span className={styles.muted}>Thời lượng (phút)</span>
                <InputNumber disabled={mutationLocked} max={180} min={1} onChange={(value) => setDraftValue((current) => ({ ...current, timeLimitSeconds: value === null ? null : value * 60 }))} placeholder="Không giới hạn" precision={0} style={{ width: "100%" }} value={draft.timeLimitSeconds === null ? null : draft.timeLimitSeconds / 60} />
              </label>
              <label>
                <span className={styles.muted}>Số lượt làm tối đa</span>
                <InputNumber disabled={mutationLocked} max={5} min={1} onChange={(value) => setDraftValue((current) => ({ ...current, maxAttempts: value ?? 1 }))} precision={0} style={{ width: "100%" }} value={draft.maxAttempts} />
              </label>
              <label>
                <span className={styles.muted}>Điểm đạt (%)</span>
                <InputNumber disabled={mutationLocked} max={100} min={0} onChange={(value) => setDraftValue((current) => ({ ...current, passPercent: value ?? 0 }))} precision={0} style={{ width: "100%" }} value={draft.passPercent} />
              </label>
              <label>
                <span className={styles.muted}>Công bố kết quả</span>
                <Select disabled={mutationLocked} onChange={(value: AssessmentResultVisibility) => setDraftValue((current) => ({ ...current, resultVisibility: value }))} options={(Object.entries(resultVisibilityLabels) as Array<[AssessmentResultVisibility, string]>).map(([value, label]) => ({ label, value }))} style={{ width: "100%" }} value={draft.resultVisibility} />
              </label>
              <Divider />
              <dl className={styles.cardMeta}>
                <div><dt>Phiên bản hiện tại</dt><dd>{authoring.currentVersionNumber || "Chưa có"}</dd></div>
                <div><dt>Xuất bản cuối</dt><dd>{formatAssessmentDate(authoring.lastPublishedAt)}</dd></div>
              </dl>
              <Button block disabled={mutationLocked || !dirty || mutationPending} icon={<SaveOutlined />} loading={saveMutation.isPending} onClick={() => void save()}>Lưu bản nháp</Button>
              <Button block disabled={!canPublish || mutationPending} icon={<SendOutlined />} loading={publishMutation.isPending} onClick={() => void publish()} title={dirty ? "Lưu bản nháp trước khi xuất bản" : undefined} type="primary">Xuất bản phiên bản</Button>
              {authoring.status === "PUBLISHED" && (
                <Popconfirm
                  cancelText="Hủy"
                  description={authoring.hasUnpublishedChanges ? "Thay đổi bản nháp chưa xuất bản sẽ không tới học viên." : undefined}
                  disabled={readOnly || dirty || mutationPending}
                  okButtonProps={{ danger: true }}
                  okText="Lưu trữ"
                  onConfirm={() => void archive()}
                  title="Lưu trữ bài kiểm tra này?"
                >
                  <Button block danger disabled={readOnly || dirty || mutationPending} loading={archiveMutation.isPending}>Lưu trữ bài kiểm tra</Button>
                </Popconfirm>
              )}
            </Space>
          </Card>
        </aside>
      </div>
    </main>
  );
}

export function AssessmentAuthoringView(props: AssessmentAuthoringProps) {
  const authoringQuery = useQuery({
    queryFn: () => assessmentApi.getAuthoring({ token: props.token }, props.assessmentId),
    queryKey: lmsQueryKeys.assessmentAuthoring(props.scope, props.assessmentId),
  });

  if (authoringQuery.isPending && !authoringQuery.data) {
    return <div aria-label="Đang tải bản soạn" className="page-loading" role="status"><Spin size="large" /></div>;
  }
  if (!authoringQuery.data) {
    return (
      <Alert
        action={<Button icon={<ReloadOutlined />} onClick={() => void authoringQuery.refetch()}>Thử lại</Button>}
        description={authoringQuery.error instanceof Error ? authoringQuery.error.message : "Không thể tải dữ liệu"}
        showIcon
        title="Không tải được bản soạn"
        type="error"
      />
    );
  }
  return (
    <AuthoringEditor
      {...props}
      initialAuthoring={authoringQuery.data}
      refetchAuthoring={async () => {
        const response = await authoringQuery.refetch();
        return { data: response.data, error: response.error };
      }}
    />
  );
}
