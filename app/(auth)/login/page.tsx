"use client";

import { LockOutlined, MailOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input } from "antd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { GoogleIdentityButton } from "@/components/account-security/google-identity-button";
import { DxBrandLockup } from "@/components/brand/dx-brand-lockup";
import { AuthWorkspaceVisual } from "@/components/brand/auth-workspace-visual";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { useAuth } from "@/components/providers/app-providers";
import { googleAuthApi, googleAuthErrorMessage } from "@/lib/google-auth-api";
import { resolveSafeInternalPath } from "@/lib/safe-navigation";
import styles from "./page.module.css";

interface LoginValues { email: string; password: string }

function LoginContent() {
  const {
    captureAuthGeneration,
    consumeAuthResponse,
    loading,
    login,
    user,
  } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const destination = resolveSafeInternalPath(searchParams.get("next"));
  const tanstackForm = useAntdTanStackForm<LoginValues>(
    { email: "", password: "" },
    async (values) => {
      await login(values.email, values.password);
      router.replace(destination);
    },
  );

  useEffect(() => {
    if (!loading && user) router.replace(destination);
  }, [destination, loading, router, user]);

  const getGoogleChallenge = useCallback(
    (signal: AbortSignal) => googleAuthApi.createLoginChallenge(signal),
    [],
  );

  const signInWithGoogle = useCallback(
    async (credential: string, challengeToken: string) => {
      const expectedGeneration = captureAuthGeneration();
      setError("");
      setGoogleSubmitting(true);
      try {
        const payload = await googleAuthApi.login({
          challengeToken,
          credential,
        });
        await consumeAuthResponse(payload, expectedGeneration);
        router.replace(destination);
      } finally {
        setGoogleSubmitting(false);
      }
    },
    [
      captureAuthGeneration,
      consumeAuthResponse,
      destination,
      router,
    ],
  );

  const submit = async (values: LoginValues) => {
    setSubmitting(true);
    setError("");
    try {
      await tanstackForm.submit(values);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể đăng nhập");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <DxBrandLockup variant="inverse" />
        <div className="auth-copy">
          <h1>Vận hành đào tạo. Đúng người, đúng việc.</h1>
          <p>Quản lý người dùng, khóa học, ghi danh và bài tập trong không gian riêng mang bản sắc của tổ chức.</p>
        </div>
        <AuthWorkspaceVisual className="auth-mascot" variant="login" />
        <div className="auth-proof"><span>Dữ liệu tách biệt theo tổ chức</span><span>Phân quyền rõ ràng</span><span>Tùy biến thương hiệu</span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <DxBrandLockup />
          <h2>Chào mừng trở lại</h2>
          <span className="subtitle">Đăng nhập để tiếp tục vào không gian quản lý đào tạo.</span>
          {error && <Alert closable onClose={() => setError("")} showIcon style={{ marginBottom: 20 }} title={error} type="error" />}
          <div className={styles.googleSection}>
            <GoogleIdentityButton
              accessibleLabel="Đăng nhập bằng Google"
              disabled={loading || submitting || googleSubmitting}
              getChallenge={getGoogleChallenge}
              intent="LOGIN"
              onCredential={signInWithGoogle}
              onError={(caught) =>
                setError(googleAuthErrorMessage(caught, "LOGIN"))
              }
            />
            <div className={styles.divider}>Hoặc dùng email</div>
          </div>
          <Form<LoginValues> disabled={googleSubmitting} layout="vertical" onFinish={submit} requiredMark={false} size="large">
            <Form.Item label="Email" name="email" rules={[{ required: true, message: "Nhập email" }, { type: "email", message: "Email chưa đúng định dạng" }]}>
              <Input autoComplete="email" prefix={<MailOutlined />} placeholder="ban@truong.edu.vn" />
            </Form.Item>
            <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: "Nhập mật khẩu" }]}>
              <Input.Password autoComplete="current-password" prefix={<LockOutlined />} placeholder="Mật khẩu" />
            </Form.Item>
            <div className="auth-form-link"><Link href="/forgot-password">Quên mật khẩu?</Link></div>
            <Button block disabled={loading || googleSubmitting} htmlType="submit" loading={submitting || loading} style={{ height: 48, marginTop: 6 }} type="primary">Đăng nhập</Button>
          </Form>
          <div className="auth-account-switch">
            Chưa có tài khoản? <Link href="/register">Tạo workspace dùng thử</Link>
          </div>
          <div className="auth-security-note"><SafetyCertificateOutlined /> Phiên đăng nhập được bảo vệ</div>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main aria-busy="true" className="auth-page" />}>
      <LoginContent />
    </Suspense>
  );
}
