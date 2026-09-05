"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { authMessages } from "@/lib/i18n/auth-messages";
import { describeFeedbackError } from "@/lib/feedback-errors";


import { LockOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Input } from "antd";
import { Form } from "@/components/form/localized-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { GoogleSignInMethodCard } from "@/components/account-security/google-sign-in-method-card";
import { useAuth } from "@/components/providers/app-providers";
import { accountSecurityApi } from "@/lib/account-security-api";
import { ApiError } from "@/lib/api";
import { passwordConfirmationError, passwordValidationError } from "@/lib/password-security";

interface ChangePasswordValues {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirmation: string;
}

export default function AccountSecurityPage() {
  const { t, locale } = useI18n(authMessages);
  const { logout, token } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<{ cause: unknown } | null>(null);
  const [pending, setPending] = useState(false);
  const tanstackForm = useAntdTanStackForm<ChangePasswordValues>(
    { currentPassword: "", newPassword: "", newPasswordConfirmation: "" },
    async (values) => {
      setError(null);
      setPending(true);
      try {
        await accountSecurityApi.changePassword(
          { token },
          { currentPassword: values.currentPassword, newPassword: values.newPassword },
        );
        logout();
        router.replace("/login");
      } catch (caught) {
        if (
          caught instanceof ApiError
          && caught.status === 409
          && caught.code === "CREDENTIAL_CHANGED_RELOGIN"
        ) {
          logout();
          router.replace("/login");
          return;
        }
        setError({ cause: caught });
      } finally {
        setPending(false);
      }
    },
  );

  const submit = async (values: ChangePasswordValues) => {
    await tanstackForm.submit(values);
  };

  return (
    <div className="page-shell account-security-page">
      <div className="page-heading">
        <div><h1>{t("Bảo mật tài khoản")}</h1><p>{t("Quản lý phương thức đăng nhập và mật khẩu cho tài khoản hiện tại.")}</p></div>
      </div>
      <div style={{ display: "grid", gap: 20, maxWidth: 720 }}>
        <GoogleSignInMethodCard />
        <Card className="surface-card" title={<span><SafetyCertificateOutlined />  {t("Đổi mật khẩu")}</span>}>
          {error && (
            <Alert
              showIcon
              style={{ marginBottom: 20 }}
              title={describeFeedbackError(error.cause, locale, t("Không thể đổi mật khẩu")).message}
              type="error"
            />
          )}
          <Form<ChangePasswordValues> layout="vertical" onFinish={(values) => void submit(values)} requiredMark={false} size="large">
            <Form.Item label={t("Mật khẩu hiện tại")} name="currentPassword" rules={[{ message: t("Nhập mật khẩu hiện tại"), required: true }]}>
              <Input.Password autoComplete="current-password" prefix={<LockOutlined />} placeholder={t("Mật khẩu hiện tại")} />
            </Form.Item>
            <Form.Item
              label={t("Mật khẩu mới")}
              name="newPassword"
              rules={[
                { message: t("Nhập mật khẩu mới"), required: true },
                { validator: async (_rule, value: string) => {
                  const error = passwordValidationError(value ?? "");
                  if (error) throw new Error(t(error));
                } },
              ]}
            >
              <Input.Password autoComplete="new-password" prefix={<LockOutlined />} placeholder={t("Mật khẩu mới")} />
            </Form.Item>
            <Form.Item
              dependencies={["newPassword"]}
              label={t("Xác nhận mật khẩu mới")}
              name="newPasswordConfirmation"
              rules={[
                { message: t("Nhập lại mật khẩu mới"), required: true },
                ({ getFieldValue }) => ({
                  validator: async (_rule, value: string) => {
                    const error = passwordConfirmationError(getFieldValue("newPassword") ?? "", value ?? "");
                    if (error) throw new Error(t(error));
                  },
                }),
              ]}
            >
              <Input.Password autoComplete="new-password" prefix={<LockOutlined />} placeholder={t("Nhập lại mật khẩu mới")} />
            </Form.Item>
            <Button htmlType="submit" loading={pending} type="primary">{t("Đổi mật khẩu")}</Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
