"use client";

import { BgColorsOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { Alert, App, Avatar, Button, Card, Checkbox, ColorPicker, Form, Input, Space } from "antd";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { isFormValidationError } from "@/components/form/validation-error";
import { useAuth } from "@/components/providers/app-providers";
import { apiFetch } from "@/lib/api";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import type { LmsModule, Organization } from "@/lib/types";

interface SettingsForm { name: string; primaryColor: string | { toHexString: () => string }; logoUrl?: string; enabledModules: LmsModule[] }
const moduleOptions: Array<{ label: string; value: LmsModule }> = [
  { label: "Người dùng", value: "USERS" }, { label: "Khóa học", value: "COURSES" },
  { label: "Ghi danh", value: "ENROLLMENTS" }, { label: "Bài tập", value: "ASSIGNMENTS" },
];

export default function SettingsPage() {
  const { message } = App.useApp();
  const { organization, token, updateOrganization, user } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<SettingsForm>();

  useEffect(() => {
    if (organization) form.setFieldsValue({ name: organization.name, primaryColor: organization.primaryColor, logoUrl: organization.logoUrl ?? undefined, enabledModules: organization.enabledModules });
  }, [form, organization]);

  const scope = getViewerScope(user, organization);
  const saveMutation = useMutation({
    mutationFn: async (values: SettingsForm) => {
      const primaryColor = typeof values.primaryColor === "string" ? values.primaryColor : values.primaryColor.toHexString();
      return apiFetch<Organization>("/organizations/current", { token, method: "PATCH", body: JSON.stringify({ ...values, primaryColor, logoUrl: values.logoUrl?.trim() || null }) });
    },
    onSuccess: async (updated) => {
      updateOrganization(updated);
      message.success("Đã áp dụng cấu hình thương hiệu");
      if (scope) await queryClient.invalidateQueries({ queryKey: lmsQueryKeys.viewer(scope) });
    },
  });
  const tanstackForm = useAntdTanStackForm<SettingsForm>(
    { enabledModules: [], name: "", primaryColor: "#5B5BD6" },
    (values) => saveMutation.mutateAsync(values).then(() => undefined),
  );

  const save = async () => {
    try { await tanstackForm.submit(await form.validateFields()); }
    catch (caught) {
      if (!isFormValidationError(caught)) message.error(caught instanceof Error ? caught.message : "Không thể lưu cấu hình");
    }
  };

  if (user?.role !== "TENANT_ADMIN") return <Alert message="Chỉ quản trị tổ chức được thay đổi cấu hình." showIcon type="warning" />;
  return <div className="page-shell">
    <div className="page-heading"><div><h1>Tùy biến workspace</h1><p>Thiết lập nhận diện thương hiệu và các module phù hợp với cách tổ chức vận hành.</p></div></div>
    <div className="settings-grid">
      <Card className="surface-card" title="Thương hiệu & module">
        <Form form={form} layout="vertical" onFinish={() => void save()} requiredMark={false}>
          <Form.Item label="Tên hiển thị" name="name" rules={[{ required: true, min: 2, message: "Tên cần ít nhất 2 ký tự" }]}><Input /></Form.Item>
          <Form.Item label="Màu chủ đạo" name="primaryColor" rules={[{ required: true }]}><ColorPicker showText /></Form.Item>
          <Form.Item extra="URL ảnh công khai, có đầy đủ http/https." label="Logo URL" name="logoUrl" rules={[{ type: "url", message: "URL chưa đúng định dạng" }]}><Input placeholder="https://..." /></Form.Item>
          <Form.Item extra="Menu sẽ thay đổi ngay sau khi lưu. Cần bật ít nhất một module." label="Module hoạt động" name="enabledModules" rules={[{ required: true, message: "Chọn ít nhất một module" }]}><Checkbox.Group options={moduleOptions} /></Form.Item>
          <Button htmlType="submit" loading={saveMutation.isPending} type="primary">Lưu và áp dụng</Button>
        </Form>
      </Card>
      <Card className="surface-card" title="Xem trước">
        <div style={{ background: organization?.primaryColor, borderRadius: 16, color: "white", minHeight: 190, padding: 24 }}>
          <Space direction="vertical" size={20}><span className="brand-lockup"><Avatar shape="square" src={organization?.logoUrl || undefined} style={{ background: "white", color: organization?.primaryColor }}>N</Avatar><span>{organization?.name}</span></span><div><BgColorsOutlined style={{ fontSize: 28 }} /><h3 style={{ marginBottom: 6 }}>Không gian riêng của bạn</h3><span style={{ color: "rgba(255,255,255,.75)" }}>Màu chủ đạo được áp dụng cho nút, menu và các điểm nhấn.</span></div></Space>
        </div>
        <Alert icon={<CheckCircleOutlined />} message="Cấu hình được lưu theo tenant và không ảnh hưởng tổ chức khác." showIcon style={{ marginTop: 18 }} type="success" />
      </Card>
    </div>
  </div>;
}
