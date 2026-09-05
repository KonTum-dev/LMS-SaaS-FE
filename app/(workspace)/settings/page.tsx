"use client";
import { useI18n } from "@/components/i18n/i18n-provider";
import { operationsPolishMessages as operationsMessages } from "@/lib/i18n/learning-polish-messages";
import { useMemo as useI18nMemo } from "react";

import { useFeedback } from "@/components/feedback/feedback-provider";

import { CheckCircleOutlined } from "@ant-design/icons";
import { Alert, Avatar, Button, Card, ColorPicker, Input, Space, Tag } from "antd";
import { Form } from "@/components/form/localized-form";
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
  const {
    t,
    lmsModuleLabels,
    getSubscriptionAccessPresentation,
    formatEntitlementLimit,
  } = useOperationsCopy();
  const { message, reportError } = useFeedback();
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
        reportError(caught, "Không thể lưu cấu hình");
    }
  };

  if (user?.role !== "TENANT_ADMIN")
    return (
      <Alert
        showIcon
        title={t("Chỉ quản trị tổ chức được thay đổi cấu hình.")}
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
          <h1>{t("Nhận diện workspace")}</h1>
          <p>
            {t(
              "Thiết lập tên, màu sắc và logo riêng cho không gian đào tạo của tổ chức.",
            )}{" "}
          </p>
        </div>
      </div>
      <div className="settings-grid">
        <Card className="surface-card" title={t("Thương hiệu tổ chức")}>
          <ProfileImageEditor
            alt={t("Logo của {value0}", { value0: organizationName })}
            disabled={!organization}
            fallback={organizationInitial(previewName ?? organization?.name)}
            help={t(
              "JPEG, PNG hoặc WebP · tối đa 5 MB.",
            )}
            imageUrl={organization?.logoUrl}
            label={t("Logo không gian làm việc")}
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
              label={t("Tên hiển thị")}
              name="name"
              rules={[
                {
                  required: true,
                  min: 2,
                  message: t("Tên cần ít nhất 2 ký tự"),
                },
                { max: 160, message: t("Tên không được vượt quá 160 ký tự") },
              ]}
            >
              <Input maxLength={160} />
            </Form.Item>
            <Form.Item
              label={t("Màu chủ đạo")}
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
              {t("Lưu và áp dụng")}{" "}
            </Button>
          </Form>
          <details className="settings-module-summary">
            <summary>{t("Tính năng và giới hạn sử dụng")}</summary>
            <Space wrap>
              {(effectiveAccess?.modules ?? []).map((module) => (
                <Tag color="blue" key={module}>
                  {t(lmsModuleLabels[module])}
                </Tag>
              ))}
              {!effectiveAccess?.modules.length && (
                <Tag>{t("Chưa có module hiệu lực")}</Tag>
              )}
            </Space>
            {effectiveAccess && (
              <Space orientation="vertical" size={4}>
                {missingSubscription ? (
                  <Tag>{t("Chưa có thuê bao")}</Tag>
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
          </details>
        </Card>
        <Card className="surface-card" title={t("Xem trước")}>
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
                <small>{t("Không gian đào tạo")}</small>
                <h3>{t("Giao diện mang nhận diện của tổ chức")}</h3>
                <span
                  className="settings-preview-action"
                  style={{ background: primaryColor }}
                >
                  {t("Hành động chính")}{" "}
                </span>
              </div>
            </div>
          </div>
          <div className="settings-note">
            <CheckCircleOutlined />
            <span>
              <strong>{t("Cấu hình tách biệt")}</strong>
              <small>{t("Thay đổi chỉ áp dụng cho tổ chức hiện tại.")}</small>
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function useOperationsCopy() {
  const i18n = useI18n(operationsMessages);
  return useI18nMemo(() => {
    const { t } = i18n;

    const translatedLmsModuleLabels = Object.fromEntries(
      Object.entries(lmsModuleLabels).map(([key, label]) => [key, t(label)]),
    ) as typeof lmsModuleLabels;
    const translatedGetSubscriptionAccessPresentation = (
      state: Parameters<typeof getSubscriptionAccessPresentation>[0],
    ) => {
      const presentation = getSubscriptionAccessPresentation(state);
      return {
        ...presentation,
        label: t(presentation.label),
        description: t(presentation.description),
      };
    };
    const translatedFormatEntitlementLimit = (
      value: number | null,
      resource: Parameters<typeof formatEntitlementLimit>[1],
    ) => {
      const label = t(
        {
          activeLearners: "học viên hoạt động",
          branches: "chi nhánh hoạt động",
          courses: "khóa học",
          users: "người dùng",
        }[resource],
      );
      return value === null
        ? t("Không giới hạn {resource}", { resource: label })
        : t("Tối đa {count} {resource}", {
            count: i18n.formatNumber(value),
            resource: label,
          });
    };
    return {
      ...i18n,
      lmsModuleLabels: translatedLmsModuleLabels,
      getSubscriptionAccessPresentation:
        translatedGetSubscriptionAccessPresentation,
      formatEntitlementLimit: translatedFormatEntitlementLimit,
    };
  }, [i18n]);
}
