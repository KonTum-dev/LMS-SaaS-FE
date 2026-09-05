"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { formatDate as formatUiDate } from "@/lib/i18n/translate";
import { learningPolishMessages as learningMessages } from "@/lib/i18n/learning-polish-messages";
import polish from "@/components/layout/learning-polish.module.css";

import { useFeedback } from "@/components/feedback/feedback-provider";

import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Card, DatePicker, Input, InputNumber, Modal, Popconfirm, Select, Switch, Tag } from "antd";
import { Form } from "@/components/form/localized-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { isFormValidationError } from "@/components/form/validation-error";
import { useAuth } from "@/components/providers/app-providers";
import { DataTable } from "@/components/table/data-table";
import { apiFetch } from "@/lib/api";
import { effectiveModuleEnabled } from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import { invalidateAssignmentQueries } from "@/lib/query-invalidation";
import { normalizeListSearch } from "@/lib/list-controls";
import type { Assignment, AssignmentSubmissionMode, Course } from "@/lib/types";

interface AssignmentForm {
  allowLate: boolean;
  courseId: string;
  description?: string;
  dueAt?: Dayjs;
  maxPoints: number;
  published: boolean;
  submissionMode: AssignmentSubmissionMode;
  title: string;
}
const objectId = (value: { _id: string } | string) =>
  typeof value === "string" ? value : value._id;
const selectedValue = (value: unknown) =>
  typeof value === "string"
    ? value
    : value && typeof value === "object" && "target" in value
      ? String((value as { target?: { value?: unknown } }).target?.value ?? "")
      : "";
const assignmentDefaults = {
  allowLate: false,
  maxPoints: 100,
  published: false,
  submissionMode: "TEXT" as const,
};
const submissionModeLabels: Record<AssignmentSubmissionMode, string> = {
  FILES: "Tệp riêng tư",
  HTTPS_LINK: "Liên kết HTTPS",
  TEXT: "Văn bản",
};

export default function AssignmentsPage() {
  const { t, locale } = useI18n(learningMessages);
  const { message, reportError, formatError } = useFeedback();
  const { effectiveAccess, organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<AssignmentForm>();
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [formCourseId, setFormCourseId] = useState("");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const gradingLocked = Boolean(
    editing && (editing.published || editing.publishedAt),
  );
  const assignmentsEnabled = effectiveModuleEnabled(
    effectiveAccess,
    "ASSIGNMENTS",
  );
  const mediaEnabled = effectiveModuleEnabled(effectiveAccess, "MEDIA");
  const canManageRole =
    user?.role === "TENANT_ADMIN" || user?.role === "INSTRUCTOR";
  const readOnly = effectiveAccess?.readOnly ?? false;
  const canManage = canManageRole && !readOnly;
  const filesAssignmentLocked =
    editing?.submissionMode === "FILES" && !mediaEnabled;
  const scope = getViewerScope(user, organization);
  const archiveRequests = useRef(new Map<string, Promise<void>>());
  const [archiving, setArchiving] = useState<ReadonlySet<string>>(new Set());
  const archiveKey = (id: string) => JSON.stringify([scope, id]);
  const assignmentsKey = scope
    ? lmsQueryKeys.assignments(scope)
    : (["lms", "signed-out", "assignments"] as const);
  const coursesKey = scope
    ? lmsQueryKeys.courses(scope)
    : (["lms", "signed-out", "courses"] as const);
  const assignmentsQuery = useQuery({
    enabled: Boolean(
      token && scope && assignmentsEnabled && user?.role !== "SUPER_ADMIN",
    ),
    queryKey: assignmentsKey,
    queryFn: () => apiFetch<Assignment[]>("/assignments", { token }),
  });
  const coursesQuery = useQuery({
    enabled: Boolean(
      token &&
      scope &&
      assignmentsEnabled &&
      canManageRole &&
      user?.role !== "SUPER_ADMIN",
    ),
    queryKey: coursesKey,
    queryFn: () => apiFetch<Course[]>("/courses", { token }),
  });
  const courses = coursesQuery.data ?? [];
  const normalizedSearch = normalizeListSearch(search);
  const filteredItems = useMemo(() => (assignmentsQuery.data ?? []).filter((item) =>
    (!normalizedSearch || normalizeListSearch(`${item.title} ${item.description ?? ""}`).includes(normalizedSearch)) &&
    (!courseFilter || objectId(item.courseId) === courseFilter) &&
    (!canManageRole || !statusFilter || item.published === (statusFilter === "PUBLISHED")),
  ), [assignmentsQuery.data, canManageRole, courseFilter, normalizedSearch, statusFilter]);
  const filterCourseOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const item of assignmentsQuery.data ?? []) {
      const id = objectId(item.courseId);
      options.set(id, typeof item.courseId === "string"
        ? coursesQuery.data?.find((course) => course._id === id)?.title ?? id
        : item.courseId.title);
    }
    return [...options].map(([value, label]) => ({ value, label }));
  }, [assignmentsQuery.data, coursesQuery.data]);
  const filtersActive = Boolean(normalizedSearch || courseFilter || (canManageRole && statusFilter));
  const filterKey = JSON.stringify([normalizedSearch, courseFilter, canManageRole ? statusFilter : ""]);
  const availableCourses = courses.filter(
    (course) => course.status !== "ARCHIVED",
  );
  const selectedCourseId = editing ? objectId(editing.courseId) : formCourseId;
  const selectedCourse = courses.find(
    (course) => course._id === selectedCourseId,
  );
  const canPublishAssignment = selectedCourse?.status === "PUBLISHED";

  const saveMutation = useMutation({
    mutationFn: (values: AssignmentForm) => {
      if (!assignmentsEnabled || !canManage) {
        throw new Error(
          t("Bạn không có quyền cập nhật bài tập trong workspace này"),
        );
      }
      const targetCourseId = editing
        ? objectId(editing.courseId)
        : values.courseId;
      if (values.submissionMode === "FILES" && !mediaEnabled) {
        throw new Error(
          t("Module Tài liệu riêng tư phải hoạt động để lưu bài tập nhận tệp."),
        );
      }
      const targetCourse = courses.find(
        (course) => course._id === targetCourseId,
      );
      const publishing = values.published && !editing?.published;
      if (publishing && targetCourse?.status !== "PUBLISHED") {
        throw new Error(t("Chỉ có thể công bố bài tập khi khóa học đang mở"));
      }
      const { courseId, maxPoints, submissionMode, ...mutableValues } = values;
      return apiFetch(
        editing ? `/assignments/${editing._id}` : "/assignments",
        {
          token,
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify({
            ...(editing ? {} : { courseId }),
            ...mutableValues,
            ...(gradingLocked ? {} : { maxPoints, submissionMode }),
            dueAt: values.dueAt?.toISOString() ?? (editing ? null : undefined),
          }),
        },
      );
    },
    onSuccess: async () => {
      message.success(editing ? "Đã cập nhật bài tập" : "Đã tạo bài tập");
      setOpen(false);
      if (scope) await invalidateAssignmentQueries(queryClient, scope);
    },
  });
  const archiveMutation = useMutation({
    mutationFn: (item: Assignment) => {
      if (!assignmentsEnabled || !canManage) {
        throw new Error(
          t("Bạn không có quyền lưu trữ bài tập trong workspace này"),
        );
      }
      return apiFetch(`/assignments/${item._id}`, { token, method: "DELETE" });
    },
    onSuccess: async () => {
      message.success("Đã lưu trữ bài tập");
      if (scope) await invalidateAssignmentQueries(queryClient, scope);
    },
  });
  const tanstackForm = useAntdTanStackForm<AssignmentForm>(
    { ...assignmentDefaults, courseId: "", title: "" },
    (values) => saveMutation.mutateAsync(values).then(() => undefined),
  );

  const create = () => {
    setEditing(null);
    setFormCourseId("");
    form.resetFields();
    form.setFieldsValue(assignmentDefaults);
    setOpen(true);
  };
  const edit = (item: Assignment) => {
    setEditing(item);
    setFormCourseId(objectId(item.courseId));
    form.resetFields();
    form.setFieldsValue({
      allowLate: item.allowLate ?? false,
      description: item.description,
      dueAt: item.dueAt ? dayjs(item.dueAt) : undefined,
      maxPoints: item.maxPoints ?? 100,
      published: item.published,
      submissionMode: item.submissionMode ?? "TEXT",
      title: item.title,
    });
    setOpen(true);
  };
  const save = async () => {
    try {
      await tanstackForm.submit(await form.validateFields());
    } catch (caught) {
      if (!isFormValidationError(caught))
        reportError(caught, "Không thể lưu bài tập");
    }
  };
  const archive = (item: Assignment) => {
    const key = archiveKey(item._id);
    const existing = archiveRequests.current.get(key);
    if (existing) return existing;
    const request = Promise.resolve().then(async () => {
      try {
        await archiveMutation.mutateAsync(item);
      } catch (caught) {
        reportError(caught, "Không thể lưu trữ bài tập");
      }
    }).finally(() => {
      archiveRequests.current.delete(key);
      setArchiving(current => { const next = new Set(current); next.delete(key); return next; });
    });
    archiveRequests.current.set(key, request);
    setArchiving(current => new Set(current).add(key));
    return request;
  };

  const columns: ColumnDef<StockFeatures, Assignment>[] = [
    {
      header: t("Bài tập"),
      accessorKey: "title",
      cell: ({ row }) => (
        <div className="table-primary-cell">
          <strong>
            {user?.role === "LEARNER" ? (
              <Link href={`/assignments/${row.original._id}`}>
                {row.original.title}
              </Link>
            ) : (
              row.original.title
            )}
          </strong>
          <div className="table-muted">
            {typeof row.original.courseId === "object"
              ? row.original.courseId.title
              : t("Khóa học")}
          </div>
        </div>
      ),
    },
    {
      header: t("Hạn nộp"),
      accessorKey: "dueAt",
      cell: ({ getValue }) => {
        const value = getValue<string | undefined>();
        return value ? (
          formatUiDate(value, locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
        ) : (
          <span className="table-muted">{t("Không giới hạn")}</span>
        );
      },
      meta: { responsive: ["sm"] },
    },
    {
      header: t("Điểm"),
      accessorKey: "maxPoints",
      cell: ({ getValue }) => getValue<number>(),
      meta: { responsive: ["md"], width: 90 },
    },
    {
      header: t("Hình thức nộp"),
      accessorKey: "submissionMode",
      cell: ({ getValue, row }) => (
        <div>
          {t(submissionModeLabels[getValue<AssignmentSubmissionMode>()]) ??
            t("Văn bản")}
          {row.original.allowLate && (
            <div className="table-muted">{t("Cho phép nộp muộn")}</div>
          )}
        </div>
      ),
      meta: { responsive: ["lg"] },
    },
    {
      header: t("Trạng thái"),
      accessorKey: "published",
      cell: ({ getValue }) => {
        const value = getValue<boolean>();
        return (
          <Tag color={value ? "green" : "gold"}>
            {value ? t("Đã giao") : t("Bản nháp")}
          </Tag>
        );
      },
      meta: { width: 130 },
    },
    ...(canManage
      ? [
        {
          id: "actions",
          header: "",
          cell: ({ row }) => {
            const editLabel = t("Chỉnh sửa bài tập {p0}", { p0: row.original.title });
            const archiveLabel = t("Lưu trữ bài tập {p0}", { p0: row.original.title });
            const courseArchived =
              courses.find(
                (course) => course._id === objectId(row.original.courseId),
              )?.status === "ARCHIVED";
            const filesLocked =
              row.original.submissionMode === "FILES" && !mediaEnabled;
            return (
              <div
                aria-label={t("Thao tác với bài tập {p0}", { p0: row.original.title })}
                className="table-row-actions"
                role="group"
              >
                <Button
                  aria-label={editLabel}
                  className="table-row-action"
                  disabled={courseArchived || filesLocked}
                  icon={<EditOutlined />}
                  onClick={() => edit(row.original)}
                  size="small"
                  title={
                    courseArchived
                      ? t("Không thể sửa bài tập thuộc khóa học đã lưu trữ")
                      : filesLocked
                        ? t("Bật module Tài liệu riêng tư để sửa bài tập nhận tệp")
                        : editLabel
                  }
                  type="text"
                />
                <Popconfirm
                  cancelText={t("Hủy")}
                  okText={t("Lưu trữ")}
                  onConfirm={() => archive(row.original)}
                  okButtonProps={{ loading: archiving.has(archiveKey(row.original._id)) }}
                  title={t("Lưu trữ bài tập này?")}
                >
                  <Button
                    aria-label={archiveLabel}
                    className="table-row-action"
                    danger
                    loading={archiving.has(archiveKey(row.original._id))}
                    icon={<DeleteOutlined />}
                    size="small"
                    title={archiveLabel}
                    type="text"
                  />
                </Popconfirm>
              </div>
            );
          },
          meta: { width: 105 },
        } satisfies ColumnDef<StockFeatures, Assignment>,
      ]
      : []),
  ];

  if (user?.role === "SUPER_ADMIN")
    return (
      <Alert
        showIcon
        title={t("Bài tập được quản lý trong từng tổ chức.")}
        type="info"
      />
    );
  if (!assignmentsEnabled)
    return (
      <Alert
        showIcon
        title={t("Module Bài tập không khả dụng trong workspace này.")}
        type="warning"
      />
    );
  return (
    <main aria-labelledby="assignments-page-title" className="page-shell">
      <header className="page-heading">
        <div className="page-heading-copy">
          <h1 id="assignments-page-title">{t("Bài tập")}</h1>
          <p>
            {canManageRole
              ? t("Tạo bài tập, đặt hạn nộp và công bố cho học viên.")
              : t("Xem bài tập và hạn nộp của bạn.")}
          </p>
        </div>
        {canManageRole && (
          <Button
            className="page-primary-action"
            disabled={readOnly || !availableCourses.length}
            icon={<PlusOutlined />}
            onClick={create}
            title={
              readOnly
                ? t("Gia hạn thuê bao để tạo bài tập")
                : !availableCourses.length
                  ? t("Cần ít nhất một khóa học chưa lưu trữ để tạo bài tập")
                  : undefined
            }
            type="primary"
          >{t("Tạo bài tập")}</Button>
        )}
      </header>
      {assignmentsQuery.error || (canManageRole && coursesQuery.error) ? (
        <Alert
          showIcon
          title={
            formatError((assignmentsQuery.error ?? coursesQuery.error), "Không tải được bài tập")
          }
          type="error"
        />
      ) : (
        <Card className="surface-card table-surface">
          <div className="list-filter-bar" role="search" aria-label={t("Bộ lọc bài tập")}>
            <Input
              allowClear
              aria-label={t("Tìm bài tập")}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("Tìm theo tên hoặc mô tả")}
              style={{ width: 280 }}
              type="search"
              value={search}
            />
            <Select
              aria-label={t("Lọc theo khóa học")}
              onChange={(value) => setCourseFilter(selectedValue(value))}
              options={[{ label: t("Tất cả khóa học"), value: "" }, ...filterCourseOptions]}
              style={{ width: 230 }}
              value={courseFilter}
            />
            {canManageRole && <Select
              aria-label={t("Lọc trạng thái bài tập")}
              onChange={(value) => setStatusFilter(selectedValue(value))}
              options={[
                { label: t("Tất cả trạng thái"), value: "" },
                { label: t("Bản nháp"), value: "DRAFT" },
                { label: t("Đã giao"), value: "PUBLISHED" },
              ]}
              style={{ width: 190 }}
              value={statusFilter}
            />}
            <Button disabled={!search && !courseFilter && !statusFilter} onClick={() => { setSearch(""); setCourseFilter(""); setStatusFilter(""); }}>
              {t("Xóa bộ lọc")}
            </Button>
          </div>
          <DataTable
            ariaLabel={t("Danh sách bài tập")}
            columns={columns}
            data={filteredItems}
            emptyText={
              filtersActive ? t("Không có bài tập phù hợp") : canManage ? t("Chưa có bài tập") : t("Chưa có bài tập được giao")
            }
            loading={
              assignmentsQuery.isLoading ||
              (canManageRole && coursesQuery.isLoading)
            }
            rowKey="_id"
            paginationResetKey={filterKey}
            scrollX={680}
          />
        </Card>
      )}
      <Modal
        cancelText={t("Hủy")}
        confirmLoading={saveMutation.isPending}
        okButtonProps={{ disabled: !canManage || filesAssignmentLocked }}
        okText={editing ? t("Lưu thay đổi") : t("Tạo bài tập")}
        onCancel={() => setOpen(false)}
        onOk={() => void save()}
        open={open}
        title={editing ? t("Chỉnh sửa bài tập") : t("Tạo bài tập")}
      >
        <Form
          disabled={!canManage}
          form={form}
          layout="vertical"
          requiredMark={false}
          style={{ marginTop: 22 }}
        >
          {editing ? (
            <Form.Item
              extra={t("Không thể chuyển bài tập sang khóa học khác sau khi tạo.")}
              label={t("Khóa học")}
            >
              <Select
                disabled
                options={[
                  {
                    label:
                      typeof editing.courseId === "object"
                        ? editing.courseId.title
                        : (courses.find(
                          (course) =>
                            course._id === objectId(editing.courseId),
                        )?.title ?? t("Khóa học hiện tại")),
                    value: objectId(editing.courseId),
                  },
                ]}
                value={objectId(editing.courseId)}
              />
            </Form.Item>
          ) : (
            <Form.Item
              label={t("Khóa học")}
              name="courseId"
              rules={[{ required: true, message: t("Chọn khóa học") }]}
            >
              <Select
                onChange={(value) => {
                  const courseId = selectedValue(value);
                  setFormCourseId(courseId);
                  if (
                    courses.find((course) => course._id === courseId)
                      ?.status !== "PUBLISHED"
                  ) {
                    form.setFieldsValue({ published: false });
                  }
                }}
                optionFilterProp="label"
                options={availableCourses.map((course) => ({
                  label: course.title,
                  value: course._id,
                }))}
                showSearch
              />
            </Form.Item>
          )}
          <Form.Item
            label={t("Tên bài tập")}
            name="title"
            rules={[{ required: true, min: 2, message: t("Nhập tên bài tập") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label={t("Mô tả")} name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <section className={polish.formSection}>
          <h3>{t("Thiết lập nộp bài")}</h3>
          <div className={polish.formGrid}>
          <Form.Item label={t("Hạn nộp")} name="dueAt">
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            extra={
              gradingLocked
                ? t("Không thể đổi điểm tối đa sau lần công bố đầu tiên.")
                : undefined
            }
            label={t("Điểm tối đa")}
            name="maxPoints"
            rules={[
              {
                max: 10000,
                message: t("Điểm tối đa không vượt quá 10.000"),
                min: 1,
                required: true,
                type: "number",
              },
            ]}
          >
            <InputNumber
              disabled={gradingLocked}
              max={10000}
              min={1}
              precision={0}
              style={{ width: "100%" }}
            />
          </Form.Item>
          </div>
          <Form.Item
            extra={
              gradingLocked
                ? t("Không thể đổi hình thức nộp sau lần công bố đầu tiên.")
                : !mediaEnabled
                  ? t("Văn bản và liên kết HTTPS vẫn dùng bình thường; nhận tệp yêu cầu module Tài liệu riêng tư.")
                  : undefined
            }
            label={t("Hình thức nộp bài")}
            name="submissionMode"
            rules={[{ required: true }]}
          >
            <Select
              disabled={gradingLocked}
              options={[
                { label: t("Văn bản"), value: "TEXT" },
                { label: t("Liên kết HTTPS"), value: "HTTPS_LINK" },
                {
                  disabled: !mediaEnabled,
                  label: t("Tệp riêng tư"),
                  value: "FILES",
                },
              ]}
            />
          </Form.Item>
          {filesAssignmentLocked && (
            <Alert
              showIcon
              title={t("Module Tài liệu riêng tư đang tắt; bài tập nhận tệp chỉ được xem, không thể cập nhật.")}
              type="warning"
            />
          )}
          <div className={polish.formGrid}>
          <Form.Item
            label={t("Cho phép nộp sau hạn")}
            name="allowLate"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            extra={
              !canPublishAssignment
                ? editing?.published
                  ? t("Khóa học hiện không mở; bạn có thể giữ trạng thái hiện tại hoặc chuyển bài tập về nháp.")
                  : t("Cần mở khóa học trước khi công bố bài tập cho học viên.")
                : undefined
            }
            label={t("Công bố cho học viên")}
            name="published"
            valuePropName="checked"
          >
            <Switch
              checkedChildren={t("Đã giao")}
              disabled={!canPublishAssignment && !editing?.published}
              unCheckedChildren={t("Bản nháp")}
            />
          </Form.Item>
          </div>
          </section>
        </Form>
      </Modal>
    </main>
  );
}
