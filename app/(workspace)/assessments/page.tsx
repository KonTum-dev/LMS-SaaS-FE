"use client";

import { BarChartOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Empty, Form, Input, Modal, Pagination, Select, Spin } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/assessments/assessments.module.css";
import {
  AssessmentStatusTag,
  AvailabilityTag,
  formatAssessmentDate,
  formatAssessmentDuration,
} from "@/components/assessments/assessment-presenters";
import { useServerAlignedNow } from "@/components/assessments/use-assessment-clock";
import { useAuth } from "@/components/providers/app-providers";
import {
  assessmentApi,
  type AssessmentLearnerListItem,
  type AssessmentManagerListItem,
  type AssessmentStatus,
} from "@/lib/assessment-api";
import { createAssessmentDraft, validateAssessmentDraft } from "@/lib/assessment-draft";
import { assessmentAvailabilityAt } from "@/lib/assessment-time";
import { effectiveModuleEnabled } from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";
import { invalidateAssessmentListQueries } from "@/lib/query-invalidation";
import type { Course } from "@/lib/types";
import { apiFetch } from "@/lib/api";

const PAGE_SIZE = 12;

interface CreateAssessmentForm {
  choiceA: string;
  choiceB: string;
  correctChoice: "A" | "B";
  courseId: string;
  instructions?: string;
  question: string;
  title: string;
}

interface ListProps {
  readOnly: boolean;
  scope: ViewerScope;
  token: string;
}

const statusOptions: Array<{ label: string; value: AssessmentStatus }> = [
  { label: "Bản nháp", value: "DRAFT" },
  { label: "Đã xuất bản", value: "PUBLISHED" },
  { label: "Đã lưu trữ", value: "ARCHIVED" },
];

function QueryError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <Alert
      action={<Button icon={<ReloadOutlined />} onClick={retry}>Thử lại</Button>}
      description={error instanceof Error ? error.message : "Không thể tải dữ liệu bài kiểm tra."}
      showIcon
      title="Không tải được bài kiểm tra"
      type="error"
    />
  );
}

function ManagerAssessmentList({ readOnly, scope, token }: ListProps) {
  const { message } = App.useApp();
  const router = useRouter();
  const queryClient = useQueryClient();
  const mounted = useRef(true);
  const createInFlight = useRef(false);
  const [form] = Form.useForm<CreateAssessmentForm>();
  const [createOpen, setCreateOpen] = useState(false);
  const [courseId, setCourseId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AssessmentStatus | undefined>();
  const filters = useMemo(() => ({ courseId, limit: PAGE_SIZE, page, status }), [courseId, page, status]);
  const listQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => assessmentApi.listForManager({ token }, filters),
    queryKey: lmsQueryKeys.assessmentList(scope, filters),
  });
  const coursesQuery = useQuery({
    queryFn: () => apiFetch<Course[]>("/courses", { token }),
    queryKey: lmsQueryKeys.courses(scope),
  });
  const courses = useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);
  const courseTitles = useMemo(
    () => new Map(courses.map((course) => [course._id, course.title])),
    [courses],
  );
  const availableCourses = courses.filter((course) => course.status !== "ARCHIVED");
  const createMutation = useMutation({
    mutationFn: async (values: CreateAssessmentForm) => {
      if (readOnly) throw new Error("Workspace đang ở chế độ chỉ đọc.");
      const draft = createAssessmentDraft();
      draft.title = values.title;
      draft.instructions = values.instructions ?? "";
      draft.questions[0].prompt = values.question;
      draft.questions[0].choices[0].text = values.choiceA;
      draft.questions[0].choices[1].text = values.choiceB;
      draft.questions[0].correctChoiceIds = [
        draft.questions[0].choices[values.correctChoice === "B" ? 1 : 0].id,
      ];
      const issues = validateAssessmentDraft(draft);
      if (issues.length) throw new Error(issues[0]);
      return assessmentApi.create({ token }, { ...draft, courseId: values.courseId });
    },
    onSuccess: async (created) => {
      if (!mounted.current) return;
      queryClient.setQueryData(lmsQueryKeys.assessmentAuthoring(scope, created._id), created);
      await invalidateAssessmentListQueries(queryClient, scope);
      if (!mounted.current) return;
      message.success("Đã tạo bản nháp bài kiểm tra");
      setCreateOpen(false);
      form.resetFields();
      router.push(`/assessments/manage/${created._id}`);
    },
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const create = async () => {
    if (readOnly || createInFlight.current) return;
    createInFlight.current = true;
    try {
      await createMutation.mutateAsync(await form.validateFields());
    } catch (error) {
      if (!mounted.current) return;
      if ((error as { errorFields?: unknown }).errorFields) return;
      message.error(error instanceof Error ? error.message : "Không thể tạo bài kiểm tra");
    } finally {
      createInFlight.current = false;
    }
  };

  return (
    <main aria-labelledby="assessments-title" className="page-shell">
      <header className={`${styles.pageHeader} page-heading`}>
        <div className="page-heading-copy">
          <h1 id="assessments-title">Bài kiểm tra</h1>
          <p>Soạn câu hỏi, xuất bản phiên bản bất biến và theo dõi kết quả học viên.</p>
        </div>
        <div className={styles.headerActions}>
          <Button icon={<BarChartOutlined />} onClick={() => router.push("/assessments/reports")}>Báo cáo lượt làm</Button>
          <Button
            disabled={readOnly || !availableCourses.length}
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              form.setFieldsValue({ correctChoice: "A" });
              setCreateOpen(true);
            }}
            title={readOnly
              ? "Workspace chỉ đọc: không thể tạo bài kiểm tra"
              : !availableCourses.length ? "Cần một khóa học chưa lưu trữ" : undefined}
            type="primary"
          >
            Tạo bài kiểm tra
          </Button>
        </div>
      </header>

      {readOnly && (
        <Alert
          description="Bạn vẫn có thể xem nội dung và báo cáo. Tạo, sửa, xuất bản và lưu trữ đang tạm khóa."
          showIcon
          title="Chế độ chỉ đọc"
          type="warning"
        />
      )}

      <section aria-label="Bộ lọc bài kiểm tra" className={styles.filters}>
        <Select
          allowClear
          aria-label="Lọc theo khóa học"
          className={styles.filterControl}
          loading={coursesQuery.isLoading}
          onChange={(value) => { setCourseId(value); setPage(1); }}
          optionFilterProp="label"
          options={courses.map((course) => ({ label: course.title, value: course._id }))}
          placeholder="Tất cả khóa học"
          showSearch
          value={courseId}
        />
        <Select
          allowClear
          aria-label="Lọc theo trạng thái"
          className={styles.filterControl}
          onChange={(value) => { setStatus(value); setPage(1); }}
          options={statusOptions}
          placeholder="Tất cả trạng thái"
          value={status}
        />
      </section>

      {listQuery.isPending ? (
        <div aria-label="Đang tải bài kiểm tra" className="page-loading" role="status"><Spin size="large" /></div>
      ) : listQuery.error ? (
        <QueryError error={listQuery.error} retry={() => void listQuery.refetch()} />
      ) : listQuery.data.items.length ? (
        <>
          <section aria-label="Danh sách bài kiểm tra" className={styles.cardGrid}>
            {listQuery.data.items.map((assessment: AssessmentManagerListItem) => (
              <Card className={`${styles.assessmentCard} surface-card`} key={assessment._id}>
                <article aria-labelledby={`assessment-${assessment._id}`} className={styles.cardBody}>
                  <div className={styles.statusLine}>
                    <AssessmentStatusTag status={assessment.status} />
                    {assessment.hasUnpublishedChanges && assessment.status !== "DRAFT" ? <span className={styles.muted}>Có thay đổi chưa xuất bản</span> : null}
                  </div>
                  <h2 className={styles.cardTitle} id={`assessment-${assessment._id}`}>{assessment.title}</h2>
                  <dl className={styles.cardMeta}>
                    <div><dt>Khóa học</dt><dd>{courseTitles.get(assessment.courseId) ?? assessment.courseId}</dd></div>
                    <div><dt>Phiên bản</dt><dd>{assessment.currentVersionNumber || "Chưa xuất bản"}</dd></div>
                    <div><dt>Cập nhật</dt><dd>{formatAssessmentDate(assessment.updatedAt)}</dd></div>
                    <div><dt>Lần xuất bản cuối</dt><dd>{formatAssessmentDate(assessment.lastPublishedAt)}</dd></div>
                  </dl>
                  <div className={styles.cardActions}>
                    <Button icon={<EditOutlined />} onClick={() => router.push(`/assessments/manage/${assessment._id}`)} type="primary">
                      {assessment.status === "ARCHIVED" || readOnly ? "Xem nội dung" : "Soạn bài"}
                    </Button>
                  </div>
                </article>
              </Card>
            ))}
          </section>
          <div className={styles.pagination}>
            <Pagination
              current={listQuery.data.page}
              onChange={setPage}
              pageSize={listQuery.data.limit}
              showSizeChanger={false}
              total={listQuery.data.total}
            />
          </div>
        </>
      ) : (
        <Card className="surface-card"><Empty description="Chưa có bài kiểm tra phù hợp bộ lọc" /></Card>
      )}

      <Modal
        cancelText="Hủy"
        confirmLoading={createMutation.isPending}
        okButtonProps={{ disabled: readOnly }}
        okText="Tạo và tiếp tục soạn"
        onCancel={() => setCreateOpen(false)}
        onOk={() => void create()}
        open={createOpen}
        title="Tạo bản nháp bài kiểm tra"
      >
        <div className={styles.createNote}>
          Bản nháp ban đầu có 1 lượt làm, mức đạt 70%, không giới hạn thời gian và công bố kết quả sau khi hết lượt. Bạn có thể đổi toàn bộ thiết lập ở bước tiếp theo.
        </div>
        <Form disabled={readOnly} form={form} layout="vertical" requiredMark={false}>
          <Form.Item label="Khóa học" name="courseId" rules={[{ required: true, message: "Chọn khóa học" }]}>
            <Select optionFilterProp="label" options={availableCourses.map((course) => ({ label: course.title, value: course._id }))} showSearch />
          </Form.Item>
          <Form.Item label="Tên bài kiểm tra" name="title" rules={[{ max: 200, min: 2, required: true, message: "Nhập tên từ 2 đến 200 ký tự" }]}>
            <Input autoComplete="off" maxLength={200} />
          </Form.Item>
          <Form.Item label="Hướng dẫn (không bắt buộc)" name="instructions" rules={[{ max: 20_000 }]}>
            <Input.TextArea maxLength={20_000} rows={3} showCount />
          </Form.Item>
          <Form.Item label="Câu hỏi đầu tiên" name="question" rules={[{ max: 10_000, required: true, whitespace: true, message: "Nhập nội dung câu hỏi" }]}>
            <Input.TextArea maxLength={10_000} rows={3} />
          </Form.Item>
          <Form.Item label="Lựa chọn A" name="choiceA" rules={[{ max: 2_000, required: true, whitespace: true, message: "Nhập lựa chọn A" }]}>
            <Input maxLength={2_000} />
          </Form.Item>
          <Form.Item label="Lựa chọn B" name="choiceB" rules={[{ max: 2_000, required: true, whitespace: true, message: "Nhập lựa chọn B" }]}>
            <Input maxLength={2_000} />
          </Form.Item>
          <Form.Item label="Đáp án đúng" name="correctChoice" rules={[{ required: true }]}>
            <Select options={[{ label: "Lựa chọn A", value: "A" }, { label: "Lựa chọn B", value: "B" }]} />
          </Form.Item>
        </Form>
      </Modal>
    </main>
  );
}

function LearnerAssessmentList({ readOnly, scope, token }: ListProps) {
  const router = useRouter();
  const [courseId, setCourseId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const filters = useMemo(() => ({ courseId, limit: PAGE_SIZE, page }), [courseId, page]);
  const listQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => assessmentApi.listForLearner({ token }, filters),
    queryKey: lmsQueryKeys.assessmentList(scope, filters),
  });
  const coursesQuery = useQuery({
    queryFn: () => apiFetch<Course[]>("/courses", { token }),
    queryKey: lmsQueryKeys.courses(scope),
  });
  const courses = useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);
  const courseTitles = useMemo(() => new Map(courses.map((course) => [course._id, course.title])), [courses]);
  const assessments = listQuery.data?.items ?? [];
  const liveServerNow = useServerAlignedNow(
    assessments[0]?.serverNow,
    listQuery.dataUpdatedAt,
    assessments.some((assessment) => assessment.opensAt !== null || assessment.closesAt !== null),
  );

  return (
    <main aria-labelledby="assessments-title" className="page-shell">
      <header className={`${styles.pageHeader} page-heading`}>
        <div className="page-heading-copy">
          <h1 id="assessments-title">Bài kiểm tra của tôi</h1>
          <p>Xem lịch mở, số lượt làm và bắt đầu khi bạn đã sẵn sàng.</p>
        </div>
      </header>
      {readOnly && <Alert description="Bạn có thể xem và tiếp tục lượt làm đã có, nhưng không thể bắt đầu, lưu đáp án hoặc nộp bài." showIcon title="Chế độ chỉ đọc" type="warning" />}
      <section aria-label="Bộ lọc bài kiểm tra" className={styles.filters}>
        <Select
          allowClear
          aria-label="Lọc theo khóa học"
          className={styles.filterControl}
          loading={coursesQuery.isLoading}
          onChange={(value) => { setCourseId(value); setPage(1); }}
          optionFilterProp="label"
          options={courses.map((course) => ({ label: course.title, value: course._id }))}
          placeholder="Tất cả khóa học"
          showSearch
          value={courseId}
        />
      </section>
      {listQuery.isPending ? (
        <div aria-label="Đang tải bài kiểm tra" className="page-loading" role="status"><Spin size="large" /></div>
      ) : listQuery.error ? (
        <QueryError error={listQuery.error} retry={() => void listQuery.refetch()} />
      ) : listQuery.data.items.length ? (
        <>
          <section aria-label="Danh sách bài kiểm tra" className={styles.cardGrid}>
            {listQuery.data.items.map((assessment: AssessmentLearnerListItem) => {
              const availability = assessmentAvailabilityAt(
                assessment,
                liveServerNow,
                assessment.availability,
              );
              return (
                <Card className={`${styles.assessmentCard} surface-card`} key={assessment._id}>
                  <article aria-labelledby={`assessment-${assessment._id}`} className={styles.cardBody}>
                    <div className={styles.statusLine}><AvailabilityTag availability={availability} /></div>
                  <h2 className={styles.cardTitle} id={`assessment-${assessment._id}`}>{assessment.title}</h2>
                  <p className={styles.cardDescription}>{assessment.instructions || "Không có hướng dẫn bổ sung."}</p>
                  <dl className={styles.cardMeta}>
                    <div><dt>Khóa học</dt><dd>{courseTitles.get(assessment.courseId) ?? "Khóa học đã ghi danh"}</dd></div>
                    <div><dt>Thời lượng</dt><dd>{formatAssessmentDuration(assessment.timeLimitSeconds)}</dd></div>
                    <div><dt>Mở lúc</dt><dd>{formatAssessmentDate(assessment.opensAt)}</dd></div>
                    <div><dt>Đóng lúc</dt><dd>{formatAssessmentDate(assessment.closesAt)}</dd></div>
                  </dl>
                  <div className={styles.cardActions}>
                    <Button onClick={() => router.push(`/assessments/${assessment._id}`)} type="primary">Xem chi tiết</Button>
                  </div>
                  </article>
                </Card>
              );
            })}
          </section>
          <div className={styles.pagination}>
            <Pagination current={listQuery.data.page} onChange={setPage} pageSize={listQuery.data.limit} showSizeChanger={false} total={listQuery.data.total} />
          </div>
        </>
      ) : (
        <Card className="surface-card"><Empty description="Chưa có bài kiểm tra đang hoạt động" /></Card>
      )}
    </main>
  );
}

export default function AssessmentsPage() {
  const { effectiveAccess, organization, token, user } = useAuth();
  const scope = getViewerScope(user, organization);
  const enabled = effectiveModuleEnabled(effectiveAccess, "ASSESSMENTS");
  if (!enabled) return <Alert showIcon title="Module Bài kiểm tra không khả dụng trong workspace này." type="warning" />;
  if (!token || !scope || user?.role === "SUPER_ADMIN") {
    return <Alert showIcon title="Phiên làm việc thiếu phạm vi thành viên hợp lệ. Vui lòng đăng nhập lại." type="error" />;
  }
  const readOnly = effectiveAccess?.readOnly ?? false;
  const authorityKey = `${scope.tenantId}:${scope.membershipId}:${scope.viewerId}:${scope.role}:${readOnly ? "READ_ONLY" : "WRITABLE"}`;
  return user?.role === "LEARNER"
    ? <LearnerAssessmentList key={authorityKey} readOnly={readOnly} scope={scope} token={token} />
    : <ManagerAssessmentList key={authorityKey} readOnly={readOnly} scope={scope} token={token} />;
}
