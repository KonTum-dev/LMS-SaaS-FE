"use client";

import { LockOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
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
  const { logout, token } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<Error | null>(null);
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
        setError(caught instanceof Error ? caught : new Error("Không thể đổi mật khẩu"));
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
        <div><h1>Bảo mật tài khoản</h1><p>Đổi mật khẩu đăng nhập cho tài khoản hiện tại.</p></div>
      </div>
      <Card className="surface-card" title={<span><SafetyCertificateOutlined /> Đổi mật khẩu</span>}>
        {error && (
          <Alert
            showIcon
            style={{ marginBottom: 20 }}
            title={error.message}
            type="error"
          />
        )}
        <Form<ChangePasswordValues> layout="vertical" onFinish={(values) => void submit(values)} requiredMark={false} size="large">
          <Form.Item label="Mật khẩu hiện tại" name="currentPassword" rules={[{ message: "Nhập mật khẩu hiện tại", required: true }]}>
            <Input.Password autoComplete="current-password" prefix={<LockOutlined />} placeholder="Mật khẩu hiện tại" />
          </Form.Item>
          <Form.Item
            label="Mật khẩu mới"
            name="newPassword"
            rules={[
              { message: "Nhập mật khẩu mới", required: true },
              { validator: async (_rule, value: string) => {
                const error = passwordValidationError(value ?? "");
                if (error) throw new Error(error);
              } },
            ]}
          >
            <Input.Password autoComplete="new-password" prefix={<LockOutlined />} placeholder="Mật khẩu mới" />
          </Form.Item>
          <Form.Item
            dependencies={["newPassword"]}
            label="Xác nhận mật khẩu mới"
            name="newPasswordConfirmation"
            rules={[
              { message: "Nhập lại mật khẩu mới", required: true },
              ({ getFieldValue }) => ({
                validator: async (_rule, value: string) => {
                  const error = passwordConfirmationError(getFieldValue("newPassword") ?? "", value ?? "");
                  if (error) throw new Error(error);
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" prefix={<LockOutlined />} placeholder="Nhập lại mật khẩu mới" />
          </Form.Item>
          <Button htmlType="submit" loading={pending} type="primary">Đổi mật khẩu</Button>
        </Form>
      </Card>
    </div>
  );
}
