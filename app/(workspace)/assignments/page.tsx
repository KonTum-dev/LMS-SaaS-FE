"use client";

import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, DatePicker, Empty, Form, Input, Modal, Popconfirm, Select, Switch, Tag } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import dayjs, { type Dayjs } from "dayjs";
import { useState } from "react";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { isFormValidationError } from "@/components/form/validation-error";
import { useAuth } from "@/components/providers/app-providers";
import { DataTable } from "@/components/table/data-table";
import { apiFetch } from "@/lib/api";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import { invalidateAssignmentQueries } from "@/lib/query-invalidation";
import type { Assignment, Course } from "@/lib/types";

interface AssignmentForm { courseId: string; title: string; description?: string; dueAt?: Dayjs; published: boolean }
const objectId = (value: { _id: string } | string) => typeof value === "string" ? value : value._id;

export default function AssignmentsPage() {
  const { message } = App.useApp();
  const { organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<AssignmentForm>();
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [open, setOpen] = useState(false);
  const canManage = user?.role === "TENANT_ADMIN" || user?.role === "INSTRUCTOR";
  const scope = getViewerScope(user, organization);
  const assignmentsKey = scope ? lmsQueryKeys.assignments(scope) : ["lms", "signed-out", "assignments"] as const;
  const coursesKey = scope ? lmsQueryKeys.courses(scope) : ["lms", "signed-out", "courses"] as const;
  const assignmentsQuery = useQuery({
    enabled: Boolean(token && scope && user?.role !== "SUPER_ADMIN"),
    queryKey: assignmentsKey,
    queryFn: () => apiFetch<Assignment[]>("/assignments", { token }),
  });
  const coursesQuery = useQuery({
    enabled: Boolean(token && scope && user?.role !== "SUPER_ADMIN"),
    queryKey: coursesKey,
    queryFn: () => apiFetch<Course[]>("/courses", { token }),
  });
  const items = assignmentsQuery.data ?? [];
  const courses = coursesQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: (values: AssignmentForm) => apiFetch(editing ? `/assignments/${editing._id}` : "/assignments", {
      token,
      method: editing ? "PATCH" : "POST",
      body: JSON.stringify({ ...values, dueAt: values.dueAt?.toISOString() ?? (editing ? null : undefined) }),
    }),
    onSuccess: async () => {
      message.success(editing ? "Đã cập nhật bài tập" : "Đã tạo bài tập");
      setOpen(false);
      if (scope) await invalidateAssignmentQueries(queryClient, scope);
    },
  });
  const removeMutation = useMutation({
    mutationFn: (item: Assignment) => apiFetch(`/assignments/${item._id}`, { token, method: "DELETE" }),
    onSuccess: async () => {
      message.success("Đã xóa bài tập");
      if (scope) await invalidateAssignmentQueries(queryClient, scope);
    },
  });
  const tanstackForm = useAntdTanStackForm<AssignmentForm>(
    { courseId: "", published: false, title: "" },
    (values) => saveMutation.mutateAsync(values).then(() => undefined),
  );

  const create = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ published: false }); setOpen(true); };
  const edit = (item: Assignment) => {
    setEditing(item);
    form.setFieldsValue({ courseId: objectId(item.courseId), title: item.title, description: item.description, dueAt: item.dueAt ? dayjs(item.dueAt) : undefined, published: item.published });
    setOpen(true);
  };
  const save = async () => {
    try { await tanstackForm.submit(await form.validateFields()); }
    catch (caught) {
      if (!isFormValidationError(caught)) message.error(caught instanceof Error ? caught.message : "Không thể lưu bài tập");
    }
  };
  const remove = async (item: Assignment) => {
    try { await removeMutation.mutateAsync(item); }
    catch (caught) { message.error(caught instanceof Error ? caught.message : "Không thể xóa bài tập"); }
  };

  const columns: ColumnDef<StockFeatures, Assignment>[] = [
    { header: "Bài tập", accessorKey: "title", cell: ({ row }) => <div><strong>{row.original.title}</strong><div className="table-muted">{typeof row.original.courseId === "object" ? row.original.courseId.title : "Khóa học"}</div></div> },
    { header: "Hạn nộp", accessorKey: "dueAt", cell: ({ getValue }) => { const value = getValue<string | undefined>(); return value ? dayjs(value).format("DD/MM/YYYY HH:mm") : <span className="table-muted">Không giới hạn</span>; }, meta: { responsive: ["sm"] } },
    { header: "Trạng thái", accessorKey: "published", cell: ({ getValue }) => { const value = getValue<boolean>(); return <Tag color={value ? "green" : "gold"}>{value ? "Đã giao" : "Bản nháp"}</Tag>; }, meta: { width: 130 } },
    ...(canManage ? [{ id: "actions", header: "", cell: ({ row }) => <><Button icon={<EditOutlined />} onClick={() => edit(row.original)} size="small" type="text" /><Popconfirm cancelText="Hủy" okText="Xóa" onConfirm={() => void remove(row.original)} title="Xóa bài tập này?"><Button danger icon={<DeleteOutlined />} size="small" type="text" /></Popconfirm></>, meta: { width: 105 } } satisfies ColumnDef<StockFeatures, Assignment>] : []),
  ];

  if (user?.role === "SUPER_ADMIN") return <Alert message="Bài tập được quản lý trong từng tổ chức." showIcon type="info" />;
  return <div className="page-shell">
    <div className="page-heading"><div><h1>Bài tập</h1><p>{canManage ? "Tạo đầu việc học tập, đặt hạn nộp và kiểm soát thời điểm công bố." : "Theo dõi các bài tập đã được giao trong khóa học của bạn."}</p></div>{canManage && <Button disabled={!courses.length} icon={<PlusOutlined />} onClick={create} type="primary">Tạo bài tập</Button>}</div>
    {(assignmentsQuery.error || coursesQuery.error)
      ? <Alert message={(assignmentsQuery.error ?? coursesQuery.error) instanceof Error ? (assignmentsQuery.error ?? coursesQuery.error)?.message : "Không tải được bài tập"} showIcon type="error" />
      : <Card className="surface-card"><DataTable columns={columns} data={items} emptyText={<Empty description={canManage ? "Chưa có bài tập" : "Chưa có bài tập được giao"} image={Empty.PRESENTED_IMAGE_SIMPLE} />} loading={assignmentsQuery.isLoading || coursesQuery.isLoading} rowKey="_id" scrollX={680} /></Card>}
    <Modal cancelText="Hủy" confirmLoading={saveMutation.isPending} okText={editing ? "Lưu thay đổi" : "Tạo bài tập"} onCancel={() => setOpen(false)} onOk={() => void save()} open={open} title={editing ? "Chỉnh sửa bài tập" : "Tạo bài tập"}>
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 22 }}>
        <Form.Item label="Khóa học" name="courseId" rules={[{ required: true, message: "Chọn khóa học" }]}><Select optionFilterProp="label" options={courses.filter((course) => course.status !== "ARCHIVED").map((course) => ({ label: course.title, value: course._id }))} showSearch /></Form.Item>
        <Form.Item label="Tên bài tập" name="title" rules={[{ required: true, min: 2, message: "Nhập tên bài tập" }]}><Input /></Form.Item>
        <Form.Item label="Mô tả" name="description"><Input.TextArea rows={3} /></Form.Item>
        <Form.Item label="Hạn nộp" name="dueAt"><DatePicker showTime style={{ width: "100%" }} /></Form.Item>
        <Form.Item label="Công bố cho học viên" name="published" valuePropName="checked"><Switch checkedChildren="Đã giao" unCheckedChildren="Bản nháp" /></Form.Item>
      </Form>
    </Modal>
  </div>;
}
