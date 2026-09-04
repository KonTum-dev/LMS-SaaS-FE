"use client";

import { CheckCircleOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  ColorPicker,
  Form,
  Input,
  Space,
  Tag,
} from "antd";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { isFormValidationError } from "@/components/form/validation-error";
import { ProfileImageEditor } from "@/components/account-security/profile-image-editor";
import { useAuth } from "@/components/providers/app-providers";
import { apiFetch } from "@/lib/api";
import {
  formatEntitlementLimit,
  getSubscriptionAccessPresentation,
  lmsModuleLabels,
} from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import { organizationLogoApi } from "@/lib/profile-api";
import {
  buildTenantSettingsPayload,
  normalizeColor,
  type TenantSettingsFormValues,
} from "@/lib/tenant-management";
import type { Organization } from "@/lib/types";
import {
  DEFAULT_PRIMARY_COLOR,
  organizationDisplayName,
  organizationInitial,
  tenantPrimaryColor,
} from "@/lib/workspace";

export default function SettingsPage() {
  const { message } = App.useApp();
  const { effectiveAccess, organization, token, updateOrganization, user } =
    useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<TenantSettingsFormValues>();

  useEffect(() => {
    if (organization)
      form.setFieldsValue({
        name: organization.name,
        primaryColor: organization.primaryColor,
      });
  }, [form, organization]);

  const previewName = Form.useWatch("name", form);
  const previewColorValue = Form.useWatch("primaryColor", form);

  const scope = getViewerScope(user, organization);
  const saveMutation = useMutation({
    mutationFn: (values: TenantSettingsFormValues) =>
      apiFetch<Organization>("/organizations/current", {
        body: JSON.stringify(buildTenantSettingsPayload(values)),
        method: "PATCH",
        token,
      }),
    onSuccess: async (updated) => {
      updateOrganization(updated);
      message.success("Đã áp dụng cấu hình thương hiệu");
      if (scope)
        await queryClient.invalidateQueries({
          queryKey: lmsQueryKeys.viewer(scope),
        });
    },
  });
  const tanstackForm = useAntdTanStackForm<TenantSettingsFormValues>(
    { name: "", primaryColor: DEFAULT_PRIMARY_COLOR },
    (values) => saveMutation.mutateAsync(values).then(() => undefined),
  );

  const applyOrganization = async (updated: Organization) => {
    updateOrganization(updated);
    if (scope) {
      await queryClient.invalidateQueries({
        queryKey: lmsQueryKeys.viewer(scope),
      });
    }
  };

  const save = async () => {
    try {
      await tanstackForm.submit(await form.validateFields());
    } catch (caught) {
      if (!isFormValidationError(caught))
        message.error(
          caught instanceof Error ? caught.message : "Không thể lưu cấu hình",
        );
    }
  };

  if (user?.role !== "TENANT_ADMIN")
    return (
      <Alert
        showIcon
        title="Chỉ quản trị tổ chức được thay đổi cấu hình."
        type="warning"
      />
    );
  const organizationName = organizationDisplayName(
    previewName ?? organization?.name,
  );
  const primaryColor = previewColorValue
    ? normalizeColor(previewColorValue)
    : tenantPrimaryColor(organization);
  const accessPresentation = effectiveAccess
    ? getSubscriptionAccessPresentation(effectiveAccess.state)
    : null;
  const missingSubscription =
    effectiveAccess?.state === "READ_ONLY" &&
    effectiveAccess.graceEndsAt === null;
  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <h1>Nhận diện workspace</h1>
          <p>
            Thiết lập tên, màu sắc và logo riêng cho không gian đào tạo của tổ
            chức.
          </p>
        </div>
      </div>
      <div className="settings-grid">
        <Card className="surface-card" title="Thương hiệu tổ chức">
          <ProfileImageEditor
            alt={`Logo của ${organizationName}`}
            disabled={!organization}
            fallback={organizationInitial(previewName ?? organization?.name)}
            help="JPEG, PNG hoặc WebP, tối đa 5 MiB. Logo được xử lý và lưu trên máy chủ riêng."
            imageUrl={organization?.logoUrl}
            label="Logo workspace"
            onRemove={async () => {
              await applyOrganization(
                await organizationLogoApi.removeCurrent(token),
              );
              message.success("Đã gỡ logo workspace");
            }}
            onUpload={async (file, options) => {
              await applyOrganization(
                await organizationLogoApi.uploadCurrent(token, file, options),
              );
              message.success("Đã cập nhật logo workspace");
            }}
            shape="square"
          />
          <Form
            form={form}
            layout="vertical"
            onFinish={() => void save()}
            requiredMark={false}
            style={{ marginTop: 28 }}
          >
            <Form.Item
              label="Tên hiển thị"
              name="name"
              rules={[
                { required: true, min: 2, message: "Tên cần ít nhất 2 ký tự" },
                { max: 160, message: "Tên không được vượt quá 160 ký tự" },
              ]}
            >
              <Input maxLength={160} />
            </Form.Item>
            <Form.Item
              label="Màu chủ đạo"
              name="primaryColor"
              rules={[{ required: true }]}
            >
              <ColorPicker showText />
            </Form.Item>
            <Button
              htmlType="submit"
              loading={saveMutation.isPending}
              type="primary"
            >
              Lưu và áp dụng
            </Button>
          </Form>
          <div className="settings-module-summary">
            <strong>Quyền workspace hiệu lực</strong>
            <p>
              Danh sách này là phần giao giữa gói thuê bao và module quản trị
              nền tảng cấp riêng cho tenant.
            </p>
            <Space wrap>
              {(effectiveAccess?.modules ?? []).map((module) => (
                <Tag color="blue" key={module}>
                  {lmsModuleLabels[module]}
                </Tag>
              ))}
              {!effectiveAccess?.modules.length && (
                <Tag>Chưa có module hiệu lực</Tag>
              )}
            </Space>
            {effectiveAccess && (
              <Space orientation="vertical" size={4}>
                {missingSubscription ? (
                  <Tag>Chưa có thuê bao</Tag>
                ) : (
                  <>
                    <span>
                      {formatEntitlementLimit(
                        effectiveAccess.limits.maxUsers,
                        "users",
                      )}
                    </span>
                    <span>
                      {formatEntitlementLimit(
                        effectiveAccess.limits.maxCourses,
                        "courses",
                      )}
                    </span>
                    {accessPresentation && (
                      <Tag color={accessPresentation.color}>
                        {accessPresentation.label}
                      </Tag>
                    )}
                  </>
                )}
              </Space>
            )}
          </div>
        </Card>
        <Card className="surface-card" title="Xem trước">
          <div className="settings-preview-shell">
            <div className="settings-preview-header">
              <Avatar
                shape="square"
                size={30}
                src={organization?.logoUrl || undefined}
                style={{ background: primaryColor }}
              >
                {organizationInitial(previewName ?? organization?.name)}
              </Avatar>
              <strong>{organizationName}</strong>
            </div>
            <div className="settings-preview-body">
              <div
                className="settings-preview-nav"
                style={{ color: primaryColor }}
                aria-hidden="true"
              >
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="settings-preview-content">
                <small>Không gian đào tạo</small>
                <h3>Giao diện mang nhận diện của tổ chức</h3>
                <span
                  className="settings-preview-action"
                  style={{ background: primaryColor }}
                >
                  Hành động chính
                </span>
              </div>
            </div>
          </div>
          <div className="settings-note">
            <CheckCircleOutlined />
            <span>
              <strong>Cấu hình tách biệt</strong>
              <small>Thay đổi chỉ áp dụng cho tổ chức hiện tại.</small>
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
