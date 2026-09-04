"use client";

import { ArrowLeftOutlined, MailOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input } from "antd";
import Link from "next/link";
import { useState } from "react";
import { AuthSecurityLayout } from "@/components/account-security/auth-security-layout";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { accountSecurityApi } from "@/lib/account-security-api";

interface ForgotPasswordValues {
  email: string;
}

export default function ForgotPasswordPage() {
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);
  const tanstackForm = useAntdTanStackForm<ForgotPasswordValues>(
    { email: "" },
    async (values) => {
      setError(null);
      setPending(true);
      try {
        await accountSecurityApi.forgotPassword({ email: values.email.trim() });
        setAccepted(true);
      } catch (caught) {
        setError(caught instanceof Error ? caught : new Error("Không thể gửi yêu cầu"));
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
      subtitle="Nhập email đăng nhập. Nếu tài khoản tồn tại, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu."
      title="Quên mật khẩu"
    >
      {accepted ? (
        <>
          <Alert
            description="Nếu email thuộc một tài khoản, hướng dẫn đặt lại mật khẩu sẽ được gửi trong ít phút."
            showIcon
            title="Đã tiếp nhận yêu cầu"
            type="success"
          />
          <div className="auth-return-link"><Link href="/login"><ArrowLeftOutlined /> Quay lại đăng nhập</Link></div>
        </>
      ) : (
        <>
          {error && (
            <Alert
              showIcon
              style={{ marginBottom: 20 }}
              title={error.message}
              type="error"
            />
          )}
          <Form<ForgotPasswordValues> layout="vertical" onFinish={(values) => void submit(values)} requiredMark={false} size="large">
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { message: "Nhập email", required: true },
                { message: "Email chưa đúng định dạng", type: "email" },
              ]}
            >
              <Input autoComplete="email" prefix={<MailOutlined />} placeholder="ban@truong.edu.vn" />
            </Form.Item>
            <Button block htmlType="submit" loading={pending} style={{ height: 48 }} type="primary">Gửi hướng dẫn</Button>
          </Form>
          <div className="auth-return-link"><Link href="/login"><ArrowLeftOutlined /> Quay lại đăng nhập</Link></div>
        </>
      )}
    </AuthSecurityLayout>
  );
}
