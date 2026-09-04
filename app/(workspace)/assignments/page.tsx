"use client";

import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Tag,
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
import { useState } from "react";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { isFormValidationError } from "@/components/form/validation-error";
import { useAuth } from "@/components/providers/app-providers";
import { DataTable } from "@/components/table/data-table";
import { apiFetch } from "@/lib/api";
import { effectiveModuleEnabled } from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import { invalidateAssignmentQueries } from "@/lib/query-invalidation";
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
  const { message } = App.useApp();
  const { effectiveAccess, organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<AssignmentForm>();
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [formCourseId, setFormCourseId] = useState("");
  const [open, setOpen] = useState(false);
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
  const items = assignmentsQuery.data ?? [];
  const courses = coursesQuery.data ?? [];
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
          "Bạn không có quyền cập nhật bài tập trong workspace này",
        );
      }
      const targetCourseId = editing
        ? objectId(editing.courseId)
        : values.courseId;
      if (values.submissionMode === "FILES" && !mediaEnabled) {
        throw new Error(
          "Module Tài liệu riêng tư phải hoạt động để lưu bài tập nhận tệp.",
        );
      }
      const targetCourse = courses.find(
        (course) => course._id === targetCourseId,
      );
      const publishing = values.published && !editing?.published;
      if (publishing && targetCourse?.status !== "PUBLISHED") {
        throw new Error("Chỉ có thể công bố bài tập khi khóa học đang mở");
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
          "Bạn không có quyền lưu trữ bài tập trong workspace này",
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
        message.error(
          caught instanceof Error ? caught.message : "Không thể lưu bài tập",
        );
    }
  };
  const archive = async (item: Assignment) => {
    try {
      await archiveMutation.mutateAsync(item);
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : "Không thể lưu trữ bài tập",
      );
    }
  };

  const columns: ColumnDef<StockFeatures, Assignment>[] = [
    {
      header: "Bài tập",
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
              : "Khóa học"}
          </div>
        </div>
      ),
    },
    {
      header: "Hạn nộp",
      accessorKey: "dueAt",
      cell: ({ getValue }) => {
        const value = getValue<string | undefined>();
        return value ? (
          dayjs(value).format("DD/MM/YYYY HH:mm")
        ) : (
          <span className="table-muted">Không giới hạn</span>
        );
      },
      meta: { responsive: ["sm"] },
    },
    {
      header: "Điểm",
      accessorKey: "maxPoints",
      cell: ({ getValue }) => getValue<number>(),
      meta: { responsive: ["md"], width: 90 },
    },
    {
      header: "Hình thức nộp",
      accessorKey: "submissionMode",
      cell: ({ getValue, row }) => (
        <div>
          {submissionModeLabels[getValue<AssignmentSubmissionMode>()] ??
            "Văn bản"}
          {row.original.allowLate && (
            <div className="table-muted">Cho phép nộp muộn</div>
          )}
        </div>
      ),
      meta: { responsive: ["lg"] },
    },
    {
      header: "Trạng thái",
      accessorKey: "published",
      cell: ({ getValue }) => {
        const value = getValue<boolean>();
        return (
          <Tag color={value ? "green" : "gold"}>
            {value ? "Đã giao" : "Bản nháp"}
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
              const editLabel = `Chỉnh sửa bài tập ${row.original.title}`;
              const archiveLabel = `Lưu trữ bài tập ${row.original.title}`;
              const courseArchived =
                courses.find(
                  (course) => course._id === objectId(row.original.courseId),
                )?.status === "ARCHIVED";
              const filesLocked =
                row.original.submissionMode === "FILES" && !mediaEnabled;
              return (
                <div
                  aria-label={`Thao tác với bài tập ${row.original.title}`}
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
                        ? "Không thể sửa bài tập thuộc khóa học đã lưu trữ"
                        : filesLocked
                          ? "Bật module Tài liệu riêng tư để sửa bài tập nhận tệp"
                          : editLabel
                    }
                    type="text"
                  />
                  <Popconfirm
                    cancelText="Hủy"
                    okText="Lưu trữ"
                    onConfirm={() => void archive(row.original)}
                    title="Lưu trữ bài tập này?"
                  >
                    <Button
                      aria-label={archiveLabel}
                      className="table-row-action"
                      danger
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
        title="Bài tập được quản lý trong từng tổ chức."
        type="info"
      />
    );
  if (!assignmentsEnabled)
    return (
      <Alert
        showIcon
        title="Module Bài tập không khả dụng trong workspace này."
        type="warning"
      />
    );
  return (
    <div className="page-shell">
      <div className="page-heading page-toolbar">
        <div className="page-heading-copy">
          <h1>Bài tập</h1>
          <p>
            {canManageRole
              ? "Tạo đầu việc học tập, đặt hạn nộp và kiểm soát thời điểm công bố."
              : "Theo dõi các bài tập đã được giao trong khóa học của bạn."}
          </p>
        </div>
        {canManageRole && (
          <Button
            className="page-toolbar-action"
            disabled={readOnly || !availableCourses.length}
            icon={<PlusOutlined />}
            onClick={create}
            title={
              readOnly
                ? "Gia hạn thuê bao để tạo bài tập"
                : !availableCourses.length
                  ? "Cần ít nhất một khóa học chưa lưu trữ để tạo bài tập"
                  : undefined
            }
            type="primary"
          >
            Tạo bài tập
          </Button>
        )}
      </div>
      {assignmentsQuery.error || (canManageRole && coursesQuery.error) ? (
        <Alert
          showIcon
          title={
            (assignmentsQuery.error ?? coursesQuery.error) instanceof Error
              ? (assignmentsQuery.error ?? coursesQuery.error)?.message
              : "Không tải được bài tập"
          }
          type="error"
        />
      ) : (
        <Card className="surface-card table-surface">
          <DataTable
            ariaLabel="Danh sách bài tập"
            columns={columns}
            data={items}
            emptyText={
              canManage ? "Chưa có bài tập" : "Chưa có bài tập được giao"
            }
            loading={
              assignmentsQuery.isLoading ||
              (canManageRole && coursesQuery.isLoading)
            }
            rowKey="_id"
            scrollX={680}
          />
        </Card>
      )}
      <Modal
        cancelText="Hủy"
        confirmLoading={saveMutation.isPending}
        okButtonProps={{ disabled: !canManage || filesAssignmentLocked }}
        okText={editing ? "Lưu thay đổi" : "Tạo bài tập"}
        onCancel={() => setOpen(false)}
        onOk={() => void save()}
        open={open}
        title={editing ? "Chỉnh sửa bài tập" : "Tạo bài tập"}
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
              extra="Không thể chuyển bài tập sang khóa học khác sau khi tạo."
              label="Khóa học"
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
                          )?.title ?? "Khóa học hiện tại"),
                    value: objectId(editing.courseId),
                  },
                ]}
                value={objectId(editing.courseId)}
              />
            </Form.Item>
          ) : (
            <Form.Item
              label="Khóa học"
              name="courseId"
              rules={[{ required: true, message: "Chọn khóa học" }]}
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
            label="Tên bài tập"
            name="title"
            rules={[{ required: true, min: 2, message: "Nhập tên bài tập" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Hạn nộp" name="dueAt">
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            extra={
              gradingLocked
                ? "Không thể đổi điểm tối đa sau lần công bố đầu tiên."
                : undefined
            }
            label="Điểm tối đa"
            name="maxPoints"
            rules={[
              {
                max: 10000,
                message: "Điểm tối đa không vượt quá 10.000",
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
          <Form.Item
            extra={
              gradingLocked
                ? "Không thể đổi hình thức nộp sau lần công bố đầu tiên."
                : !mediaEnabled
                  ? "Văn bản và liên kết HTTPS vẫn dùng bình thường; nhận tệp yêu cầu module Tài liệu riêng tư."
                  : "Tệp được tải thẳng lên kho riêng tư và kiểm tra an toàn trước khi nộp."
            }
            label="Hình thức nộp bài"
            name="submissionMode"
            rules={[{ required: true }]}
          >
            <Select
              disabled={gradingLocked}
              options={[
                { label: "Văn bản", value: "TEXT" },
                { label: "Liên kết HTTPS", value: "HTTPS_LINK" },
                {
                  disabled: !mediaEnabled,
                  label: "Tệp riêng tư",
                  value: "FILES",
                },
              ]}
            />
          </Form.Item>
          {filesAssignmentLocked && (
            <Alert
              showIcon
              title="Module Tài liệu riêng tư đang tắt; bài tập nhận tệp chỉ được xem, không thể cập nhật."
              type="warning"
            />
          )}
          <Form.Item
            label="Cho phép nộp sau hạn"
            name="allowLate"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            extra={
              !canPublishAssignment
                ? editing?.published
                  ? "Khóa học hiện không mở; bạn có thể giữ trạng thái hiện tại hoặc chuyển bài tập về nháp."
                  : "Cần mở khóa học trước khi công bố bài tập cho học viên."
                : undefined
            }
            label="Công bố cho học viên"
            name="published"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Đã giao"
              disabled={!canPublishAssignment && !editing?.published}
              unCheckedChildren="Bản nháp"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
