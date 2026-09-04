"use client";

import { ArrowLeftOutlined, LockOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, Spin } from "antd";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthSecurityLayout } from "@/components/account-security/auth-security-layout";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { useAuth } from "@/components/providers/app-providers";
import { accountSecurityApi } from "@/lib/account-security-api";
import { ApiError } from "@/lib/api";
import {
  consumePasswordResetToken,
  passwordConfirmationError,
  passwordValidationError,
} from "@/lib/password-security";

interface ResetPasswordValues {
  newPassword: string;
  newPasswordConfirmation: string;
}

type TokenStatus = "loading" | "ready" | "invalid";
const usePrePaintEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function ResetPasswordPage() {
  const { logout } = useAuth();
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);
  const consumedFragmentRef = useRef(false);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>("loading");
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);

  usePrePaintEffect(() => {
    if (consumedFragmentRef.current) return;
    consumedFragmentRef.current = true;
    const token = consumePasswordResetToken(window.location, window.history);
    tokenRef.current = token;
    setTokenStatus(token ? "ready" : "invalid");
  }, []);

  const tanstackForm = useAntdTanStackForm<ResetPasswordValues>(
    { newPassword: "", newPasswordConfirmation: "" },
    async (values) => {
      const token = tokenRef.current;
      if (!token) {
        setError(new Error("Liên kết đặt lại mật khẩu không hợp lệ"));
        return;
      }
      setError(null);
      setPending(true);
      try {
        await accountSecurityApi.resetPassword({ newPassword: values.newPassword, token });
        tokenRef.current = null;
        logout();
        router.replace("/login");
      } catch (caught) {
        if (
          caught instanceof ApiError
          && caught.status === 409
          && ["PASSWORD_RESET_ALREADY_APPLIED", "CREDENTIAL_CHANGED_RELOGIN"].includes(caught.code ?? "")
        ) {
          tokenRef.current = null;
          logout();
          router.replace("/login");
          return;
        }
        if (
          caught instanceof ApiError
          && caught.status === 410
          && caught.code === "PASSWORD_RESET_TOKEN_INVALID"
        ) {
          tokenRef.current = null;
          setError(null);
          setTokenStatus("invalid");
          return;
        }
        setError(caught instanceof Error ? caught : new Error("Không thể đặt lại mật khẩu"));
      } finally {
        setPending(false);
      }
    },
  );

  const submit = async (values: ResetPasswordValues) => {
    await tanstackForm.submit(values);
  };

  return (
    <AuthSecurityLayout
      subtitle="Tạo mật khẩu mới có ít nhất 8 ký tự và không vượt quá 72 byte UTF-8."
      title="Đặt lại mật khẩu"
    >
      {tokenStatus === "loading" && <div aria-live="polite" className="auth-token-loading"><Spin /><span>Đang xác minh liên kết...</span></div>}
      {tokenStatus === "invalid" && (
        <>
          <Alert
            description="Hãy yêu cầu một liên kết mới để tiếp tục."
            showIcon
            title="Liên kết đặt lại mật khẩu không hợp lệ hoặc đã thiếu token"
            type="error"
          />
          <div className="auth-return-link"><Link href="/forgot-password"><ArrowLeftOutlined /> Yêu cầu liên kết mới</Link></div>
        </>
      )}
      {tokenStatus === "ready" && (
        <>
          {error && (
            <Alert
              showIcon
              style={{ marginBottom: 20 }}
              title={error.message}
              type="error"
            />
          )}
          <Form<ResetPasswordValues> layout="vertical" onFinish={(values) => void submit(values)} requiredMark={false} size="large">
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
            <Button block htmlType="submit" loading={pending} style={{ height: 48 }} type="primary">Đặt lại mật khẩu</Button>
          </Form>
        </>
      )}
    </AuthSecurityLayout>
  );
}
