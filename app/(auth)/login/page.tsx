"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { accountPolishMessages as authMessages } from "@/lib/i18n/account-polish-messages";


import { LoadingOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import { Alert, Button, Input } from "antd";
import type { InputRef } from "antd";
import { Form } from "@/components/form/localized-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { GoogleIdentityButton } from "@/components/account-security/google-identity-button";
import { DxBrandLockup } from "@/components/brand/dx-brand-lockup";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { useAuth } from "@/components/providers/app-providers";
import { useFeedback } from "@/components/feedback/feedback-provider";
import {
  googleAuthApi,
  googleAuthErrorMessage,
  googleLoginRecoveryAction,
  type GoogleLoginRecoveryAction,
} from "@/lib/google-auth-api";
import { resolveSafeInternalPath } from "@/lib/safe-navigation";
import styles from "./page.module.css";

interface LoginValues { email: string; password: string }

function LoginContent() {
  const { t } = useI18n(authMessages);
  const { message, reportError, formatError } = useFeedback();
  const {
    captureAuthGeneration,
    consumeAuthResponse,
    loading,
    login,
    user,
  } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailInputRef = useRef<InputRef>(null);
  const [error, setError] = useState("");
  const [googleRecovery, setGoogleRecovery] =
    useState<GoogleLoginRecoveryAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const destination = resolveSafeInternalPath(searchParams.get("next"));
  const tanstackForm = useAntdTanStackForm<LoginValues>(
    { email: "", password: "" },
    async (values) => {
      await login(values.email, values.password);
      message.success("Đăng nhập thành công");
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
      setGoogleRecovery(null);
      setGoogleSubmitting(true);
      try {
        const payload = await googleAuthApi.login({
          challengeToken,
          credential,
        });
        await consumeAuthResponse(payload, expectedGeneration);
        message.success("Đăng nhập thành công");
        router.replace(destination);
      } catch (caught) {
        setError(googleAuthErrorMessage(caught, "LOGIN"));
        setGoogleRecovery(googleLoginRecoveryAction(caught));
      } finally {
        setGoogleSubmitting(false);
      }
    },
    [
      captureAuthGeneration,
      consumeAuthResponse,
      destination,
      message,
      router,
    ],
  );

  const submit = async (values: LoginValues) => {
    setSubmitting(true);
    setError("");
    setGoogleRecovery(null);
    try {
      await tanstackForm.submit(values);
    } catch (caught) {
      setError(formatError(caught, "Không thể đăng nhập"));
      reportError(caught, "Không thể đăng nhập");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link aria-label={t("DX LMS, về trang chủ")} href="/" className={styles.homeLink}>
          <DxBrandLockup />
        </Link>
      </header>
      <div className={styles.content}>
        <section aria-labelledby="login-title" className={styles.card}>
          <div className={styles.intro}>
            <h1 id="login-title">{t("Chào mừng trở lại")}</h1>
            <p>{t("Đăng nhập để tiếp tục với DX LMS.")}</p>
          </div>
          {error && (
            <Alert
              action={
                googleRecovery === "EMAIL_LOGIN" ? (
                  <Button
                    onClick={() => emailInputRef.current?.focus()}
                    size="small"
                  >
                    {t("Đăng nhập bằng email")}
                  </Button>
                ) : googleRecovery === "CREATE_WORKSPACE" ? (
                  <Button onClick={() => router.push("/register")} size="small">
                    {t("Tạo workspace")}
                  </Button>
                ) : undefined
              }
              closable
              onClose={() => {
                setError("");
                setGoogleRecovery(null);
              }}
              showIcon
              className={styles.error}
              title={t(error)}
              type="error"
            />
          )}
          <div className={styles.googleSection}>
            <GoogleIdentityButton
              accessibleLabel={t("Đăng nhập bằng Google")}
              disabled={loading || submitting || googleSubmitting}
              getChallenge={getGoogleChallenge}
              intent="LOGIN"
              onCredential={signInWithGoogle}
            />
            {googleSubmitting ? (
              <p aria-live="polite" className={styles.googleProgress} role="status">
                <LoadingOutlined aria-hidden="true" /> {t("Đang xác minh với Google…")}
              </p>
            ) : null}
            <p className={styles.googleHint}>
              {t("Dùng tài khoản Google đã liên kết.")}
            </p>
          </div>
          <div className={styles.divider}>{t("hoặc dùng email")}</div>
          <Form<LoginValues> className={styles.form} disabled={googleSubmitting || submitting || loading} layout="vertical" onFinish={submit} requiredMark={false} size="large">
            <Form.Item label="Email" name="email" rules={[{ required: true, message: t("Nhập email") }, { type: "email", message: t("Email chưa đúng định dạng") }]}>
              <Input ref={emailInputRef} autoComplete="email" prefix={<MailOutlined />} placeholder="ban@truong.edu.vn" />
            </Form.Item>
            <div className={styles.passwordField}>
              <Form.Item label={t("Mật khẩu")} name="password" rules={[{ required: true, message: t("Nhập mật khẩu") }]}>
                <Input.Password autoComplete="current-password" prefix={<LockOutlined />} placeholder={t("Nhập mật khẩu")} />
              </Form.Item>
              <Link className={styles.forgotLink} href="/forgot-password">{t("Quên mật khẩu?")}</Link>
            </div>
            <Button block className={styles.submitButton} disabled={loading || googleSubmitting} htmlType="submit" loading={submitting || loading || googleSubmitting} type="primary">{t("Đăng nhập")}</Button>
          </Form>
          <p className={styles.accountSwitch}>
            {t("Chưa có tài khoản?")}{" "}<Link href="/register">{t("Tạo workspace")}</Link>
          </p>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main aria-busy="true" className={styles.page} />}>
      <LoginContent />
    </Suspense>
  );
}
