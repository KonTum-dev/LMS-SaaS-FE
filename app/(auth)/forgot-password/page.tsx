"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { authMessages } from "@/lib/i18n/auth-messages";
import { describeFeedbackError } from "@/lib/feedback-errors";


import { ArrowLeftOutlined, MailOutlined } from "@ant-design/icons";
import { Alert, Button, Input } from "antd";
import { Form } from "@/components/form/localized-form";
import Link from "next/link";
import { useState } from "react";
import { AuthSecurityLayout } from "@/components/account-security/auth-security-layout";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { accountSecurityApi } from "@/lib/account-security-api";

interface ForgotPasswordValues {
  email: string;
}

export default function ForgotPasswordPage() {
  const { t, locale } = useI18n(authMessages);
  const { message, reportError } = useFeedback();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<{ cause: unknown } | null>(null);
  const [pending, setPending] = useState(false);
  const tanstackForm = useAntdTanStackForm<ForgotPasswordValues>(
    { email: "" },
    async (values) => {
      setError(null);
      setPending(true);
      try {
        await accountSecurityApi.forgotPassword({
          email: values.email.trim(),
          locale,
        });
        setAccepted(true);
        message.success(
          "Đã tiếp nhận yêu cầu. Nếu email thuộc một tài khoản, hướng dẫn đặt lại mật khẩu sẽ được gửi trong ít phút.",
        );
      } catch (caught) {
        setError({ cause: caught });
        reportError(
          caught,
          "Không thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại.",
        );
      } finally {
        setPending(false);
      }
    },
  );

  const submit = async (values: ForgotPasswordValues) => {
    await tanstackForm.submit(values);
  };

  return (
    <AuthSecurityLayout
      subtitle={t("Nhập email đăng nhập. Nếu tài khoản tồn tại, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.")}
      title={t("Quên mật khẩu")}
    >
      {accepted ? (
        <>
          <Alert
            description={t("Nếu email thuộc một tài khoản, hướng dẫn đặt lại mật khẩu sẽ được gửi trong ít phút.")}
            showIcon
            title={t("Đã tiếp nhận yêu cầu")}
            type="success"
          />
          <div className="auth-return-link">
            <Link href="/login">
              <ArrowLeftOutlined /> {t("Quay lại đăng nhập")}</Link>
          </div>
        </>
      ) : (
        <>
          {error && (
            <Alert
              showIcon
              style={{ marginBottom: 20 }}
              title={describeFeedbackError(error.cause, locale, t("Không thể gửi yêu cầu")).message}
              type="error"
            />
          )}
          <Form<ForgotPasswordValues>
            aria-busy={pending}
            disabled={pending}
            layout="vertical"
            onFinish={(values) => void submit(values)}
            requiredMark={false}
            size="large"
          >
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { message: t("Nhập email"), required: true },
                { message: t("Email chưa đúng định dạng"), type: "email" },
              ]}
            >
              <Input
                autoComplete="email"
                prefix={<MailOutlined />}
                placeholder="ban@truong.edu.vn"
              />
            </Form.Item>
            <Button
              block
              htmlType="submit"
              loading={pending}
              style={{ height: 48 }}
              type="primary"
            >
              {t("Gửi hướng dẫn")}</Button>
          </Form>
          <div className="auth-return-link">
            <Link href="/login">
              <ArrowLeftOutlined /> {t("Quay lại đăng nhập")}</Link>
          </div>
        </>
      )}
    </AuthSecurityLayout>
  );
}
