"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { accountPolishMessages as authMessages } from "@/lib/i18n/account-polish-messages";
import { describeFeedbackError } from "@/lib/feedback-errors";


import { ArrowLeftOutlined, LockOutlined } from "@ant-design/icons";
import { Alert, Button, Input, Spin } from "antd";
import { Form } from "@/components/form/localized-form";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthSecurityLayout } from "@/components/account-security/auth-security-layout";
import { useFeedback } from "@/components/feedback/feedback-provider";
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
const usePrePaintEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function ResetPasswordPage() {
  const { t, locale } = useI18n(authMessages);
  const { message, reportError } = useFeedback();
  const { logout } = useAuth();
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);
  const consumedFragmentRef = useRef(false);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>("loading");
  const [error, setError] = useState<{ cause: unknown; fallback?: string } | null>(null);
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
        setError({ cause: null, fallback: "Liên kết đặt lại mật khẩu không hợp lệ" });
        message.error(
          "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.",
        );
        return;
      }
      setError(null);
      setPending(true);
      try {
        await accountSecurityApi.resetPassword({
          newPassword: values.newPassword,
          token,
        });
        tokenRef.current = null;
        logout();
        message.success(
          "Đã đặt lại mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới.",
        );
        router.replace("/login");
      } catch (caught) {
        if (
          caught instanceof ApiError &&
          caught.status === 409 &&
          [
            "PASSWORD_RESET_ALREADY_APPLIED",
            "CREDENTIAL_CHANGED_RELOGIN",
          ].includes(caught.code ?? "")
        ) {
          tokenRef.current = null;
          logout();
          message.warning(
            caught.code === "PASSWORD_RESET_ALREADY_APPLIED"
              ? "Yêu cầu đặt lại mật khẩu đã được xử lý trước đó. Vui lòng đăng nhập lại."
              : "Thông tin đăng nhập đã thay đổi. Vui lòng đăng nhập lại.",
          );
          router.replace("/login");
          return;
        }
        if (
          caught instanceof ApiError &&
          caught.status === 410 &&
          caught.code === "PASSWORD_RESET_TOKEN_INVALID"
        ) {
          tokenRef.current = null;
          setError(null);
          setTokenStatus("invalid");
          reportError(
            caught,
            "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.",
          );
          return;
        }
        setError({ cause: caught });
        reportError(caught, "Không thể đặt lại mật khẩu. Vui lòng thử lại.");
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
      subtitle={t("Tạo mật khẩu mới có ít nhất 8 ký tự.")}
      title={t("Đặt lại mật khẩu")}
    >
      {tokenStatus === "loading" && (
        <div aria-live="polite" className="auth-token-loading">
          <Spin />
          <span>{t("Đang xác minh liên kết...")}</span>
        </div>
      )}
      {tokenStatus === "invalid" && (
        <>
          <Alert
            description={t("Hãy yêu cầu một liên kết mới để tiếp tục.")}
            showIcon
            title={t("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã thiếu token")}
            type="error"
          />
          <div className="auth-return-link">
            <Link href="/forgot-password">
              <ArrowLeftOutlined /> {t("Yêu cầu liên kết mới")}</Link>
          </div>
        </>
      )}
      {tokenStatus === "ready" && (
        <>
          {error && (
            <Alert
              showIcon
              style={{ marginBottom: 20 }}
              title={describeFeedbackError(error.cause, locale, t(error.fallback ?? "Không thể đặt lại mật khẩu")).message}
              type="error"
            />
          )}
          <Form<ResetPasswordValues>
            layout="vertical"
            onFinish={(values) => void submit(values)}
            requiredMark={false}
            size="large"
          >
            <Form.Item
              label={t("Mật khẩu mới")}
              name="newPassword"
              rules={[
                { message: t("Nhập mật khẩu mới"), required: true },
                {
                  validator: async (_rule, value: string) => {
                    const error = passwordValidationError(value ?? "");
                    if (error) throw new Error(t(error));
                  },
                },
              ]}
            >
              <Input.Password
                autoComplete="new-password"
                prefix={<LockOutlined />}
                placeholder={t("Mật khẩu mới")}
              />
            </Form.Item>
            <Form.Item
              dependencies={["newPassword"]}
              label={t("Xác nhận mật khẩu mới")}
              name="newPasswordConfirmation"
              rules={[
                { message: t("Nhập lại mật khẩu mới"), required: true },
                ({ getFieldValue }) => ({
                  validator: async (_rule, value: string) => {
                    const error = passwordConfirmationError(
                      getFieldValue("newPassword") ?? "",
                      value ?? "",
                    );
                    if (error) throw new Error(t(error));
                  },
                }),
              ]}
            >
              <Input.Password
                autoComplete="new-password"
                prefix={<LockOutlined />}
                placeholder={t("Nhập lại mật khẩu mới")}
              />
            </Form.Item>
            <Button
              block
              htmlType="submit"
              loading={pending}
              style={{ height: 48 }}
              type="primary"
            >
              {t("Đặt lại mật khẩu")}</Button>
          </Form>
        </>
      )}
    </AuthSecurityLayout>
  );
}
