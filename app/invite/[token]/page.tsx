"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { FeedbackLanguageSwitcher } from "@/components/feedback/feedback-locale";
import { authMessages } from "@/lib/i18n/auth-messages";
import { describeFeedbackError } from "@/lib/feedback-errors";


import { Alert, Button, Input, Spin } from "antd";
import { Form } from "@/components/form/localized-form";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DxBrandLockup } from "@/components/brand/dx-brand-lockup";
import styles from "./page.module.css";
import { useAuth } from "@/components/providers/app-providers";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthResponse, InvitationInspection, UserRole } from "@/lib/types";

interface RegistrationValues {
  fullName: string;
  password: string;
  passwordConfirmation: string;
}

interface ExistingAccountValues {
  password: string;
}

const roleLabels: Record<Exclude<UserRole, "SUPER_ADMIN">, string> = {
  TENANT_ADMIN: "Quản trị tổ chức",
  INSTRUCTOR: "Giảng viên",
  LEARNER: "Học viên",
  GUARDIAN: "Phụ huynh",
};


function normalizedEmail(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function invitationErrorMessage(error: unknown, verifyingExistingAccount: boolean): string | null {
  if (!(error instanceof ApiError)) {
    return null;
  }
  if (error.status === 401 && verifyingExistingAccount) return "Mật khẩu hiện tại không đúng.";
  switch (error.code) {
    case "INVITATION_ACCOUNT_EXISTS":
      return "Email này đã có tài khoản. Hãy đăng nhập để chấp nhận lời mời.";
    case "INVITATION_ACCOUNT_INACTIVE":
      return "Tài khoản hiện có đang bị vô hiệu hóa. Hãy liên hệ quản trị viên nền tảng.";
    case "INVITATION_EMAIL_MISMATCH":
      return "Lời mời này dành cho một email khác với tài khoản đang đăng nhập.";
    case "INVITATION_EXPIRED":
      return "Lời mời đã hết hạn. Hãy đề nghị quản trị viên gửi lời mời mới.";
    case "INVITATION_ALREADY_MEMBER":
      return "Tài khoản này đã là thành viên của tổ chức.";
    case "INVITATION_INVALID":
      return "Lời mời không hợp lệ, đã được sử dụng hoặc đã bị thu hồi.";
    default:
      return null;
  }
}

export default function InvitationPage() {
  const { t, locale, formatDate } = useI18n(authMessages);
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const {
    captureAuthGeneration,
    consumeAuthResponse,
    loading: authLoading,
    logout,
    token: accessToken,
    user,
  } = useAuth();
  const invitationToken = typeof params.token === "string" ? params.token : "";
  const encodedToken = encodeURIComponent(invitationToken);
  const invitationPath = `/invite/${encodedToken}`;
  const loginPath = `/login?next=${encodeURIComponent(invitationPath)}`;
  const endpoint = `/auth/invitations/${encodedToken}`;
  const [inspection, setInspection] = useState<InvitationInspection | null>(null);
  const [loadedToken, setLoadedToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ cause: unknown } | null>(null);
  const loading = Boolean(invitationToken) && loadedToken !== invitationToken;
  const currentInspection = loadedToken === invitationToken ? inspection : null;
  const invitationErrorSource = error ? invitationErrorMessage(error.cause, Boolean(currentInspection?.requiresAuthentication && !user)) : null;
  const errorText = error ? invitationErrorSource ? t(invitationErrorSource) : describeFeedbackError(error.cause, locale, t("Không thể xử lý lời mời")).message : "";

  useEffect(() => {
    if (!invitationToken) return;

    const controller = new AbortController();
    let active = true;
    void apiFetch<InvitationInspection>(endpoint, { signal: controller.signal })
      .then((payload) => {
        if (active) {
          setError(null);
          setInspection(payload);
        }
      })
      .catch((caught) => {
        if (active) {
          setError({ cause: caught });
          setInspection(null);
        }
      })
      .finally(() => {
        if (active) setLoadedToken(invitationToken);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [endpoint, invitationToken]);

  const emailMismatch = useMemo(
    () => Boolean(user && currentInspection && normalizedEmail(user.email) !== normalizedEmail(currentInspection.email)),
    [currentInspection, user],
  );

  const completeInvitation = async (request: () => Promise<AuthResponse>) => {
    const expectedAuthGeneration = captureAuthGeneration();
    setSubmitting(true);
    setError(null);
    try {
      const payload = await request();
      await consumeAuthResponse(payload, expectedAuthGeneration);
      router.replace("/dashboard");
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "INVITATION_ACCOUNT_EXISTS") {
        setInspection((current) => current ? { ...current, requiresAuthentication: true } : current);
      }
      setError({ cause: caught });
    } finally {
      setSubmitting(false);
    }
  };

  const accept = () => completeInvitation(() => apiFetch<AuthResponse>(`${endpoint}/accept`, {
    method: "POST",
    token: accessToken,
  }));

  const register = (values: RegistrationValues) => completeInvitation(() => apiFetch<AuthResponse>(`${endpoint}/register`, {
    body: JSON.stringify({ fullName: values.fullName.trim(), password: values.password }),
    method: "POST",
  }));

  const acceptExisting = (values: ExistingAccountValues) => completeInvitation(() => apiFetch<AuthResponse>(`${endpoint}/accept-existing`, {
    body: JSON.stringify({ password: values.password }),
    method: "POST",
  }));

  const signIn = () => router.replace(loginPath);
  const signInWithAnotherAccount = () => {
    logout();
    router.replace(loginPath);
  };

  const content = (() => {
    if (loading || authLoading) {
      return <div aria-label={t("Đang kiểm tra lời mời")} className={styles.loading} role="status"><Spin size="large" /></div>;
    }
    if (!currentInspection) {
      return <Alert description={errorText || (invitationToken ? t("Không thể tải thông tin lời mời.") : t("Lời mời không hợp lệ."))} showIcon title={t("Không thể mở lời mời")} type="error" />;
    }
    if (emailMismatch) {
      return (
        <>
          <Alert description={t("Bạn đang đăng nhập bằng {email}. Lời mời này dành cho {invitedEmail}.", { email: user?.email ?? "", invitedEmail: currentInspection.email })} showIcon title={t("Sai tài khoản")} type="warning" />
          <Button block onClick={signInWithAnotherAccount} style={{ height: 46, marginTop: 20 }} type="primary">{t("Đăng nhập bằng tài khoản khác")}</Button>
        </>
      );
    }
    if (currentInspection.requiresAuthentication && !user) {
      return (
        <>
          <p className={styles.existingNote}>{t("Email này đã có tài khoản. Nhập mật khẩu để tham gia.")}</p>
          {error && <Alert closable onClose={() => setError(null)} showIcon style={{ marginTop: 16 }} title={errorText} type="error" />}
          <Form<ExistingAccountValues> layout="vertical" onFinish={(values) => void acceptExisting(values)} requiredMark={false} size="large" style={{ marginTop: 20 }}>
            <Form.Item label={t("Mật khẩu tài khoản")} name="password" rules={[{ message: t("Nhập mật khẩu"), required: true }, { message: t("Mật khẩu cần ít nhất 8 ký tự"), min: 8 }]}>
              <Input.Password autoComplete="current-password" placeholder={t("Mật khẩu của tài khoản hiện có")} />
            </Form.Item>
            <Button block htmlType="submit" loading={submitting} style={{ height: 46 }} type="primary">{t("Xác nhận và tham gia")}</Button>
          </Form>
          <Button block disabled={submitting} onClick={signIn} style={{ marginTop: 10 }} type="link">{t("Đăng nhập để chấp nhận")}</Button>
        </>
      );
    }
    if (user) {
      return (
        <>
          {error && <Alert closable onClose={() => setError(null)} showIcon title={errorText} type="error" />}
          <Button block loading={submitting} onClick={() => void accept()} style={{ height: 46, marginTop: error ? 20 : 0 }} type="primary">{t("Chấp nhận lời mời")}</Button>
        </>
      );
    }
    return (
      <>
        {error && <Alert closable onClose={() => setError(null)} showIcon style={{ marginBottom: 20 }} title={errorText} type="error" />}
        <Form<RegistrationValues> layout="vertical" onFinish={(values) => void register(values)} requiredMark={false} size="large">
          <Form.Item label={t("Họ và tên")} name="fullName" rules={[{ message: t("Nhập họ và tên"), required: true }, { message: t("Họ và tên cần ít nhất 2 ký tự"), min: 2 }]}>
            <Input autoComplete="name" placeholder={t("Nguyễn Văn An")} />
          </Form.Item>
          <Form.Item label={t("Mật khẩu")} name="password" rules={[{ message: t("Nhập mật khẩu"), required: true }, { message: t("Mật khẩu cần ít nhất 8 ký tự"), min: 8 }]}>
            <Input.Password autoComplete="new-password" placeholder={t("Ít nhất 8 ký tự")} />
          </Form.Item>
          <Form.Item dependencies={["password"]} label={t("Nhập lại mật khẩu")} name="passwordConfirmation" rules={[
            { message: t("Nhập lại mật khẩu"), required: true },
            ({ getFieldValue }) => ({ validator: (_, value) => !value || getFieldValue("password") === value ? Promise.resolve() : Promise.reject(new Error(t("Mật khẩu nhập lại chưa khớp"))) }),
          ]}>
            <Input.Password autoComplete="new-password" placeholder={t("Nhập lại mật khẩu")} />
          </Form.Item>
          <Button block htmlType="submit" loading={submitting} style={{ height: 46 }} type="primary">{t("Tạo tài khoản và tham gia")}</Button>
        </Form>
      </>
    );
  })();

  return (
    <>
      <meta content="noindex,nofollow,noarchive" name="robots" />
      <meta content="no-referrer" name="referrer" />
      <main className={styles.page}>
        <section aria-labelledby="invitation-heading" className={styles.card}>
          <header className={styles.header}>
            <DxBrandLockup />
            <FeedbackLanguageSwitcher />
          </header>
          <h1 id="invitation-heading">{t("Lời mời tham gia")}</h1>
          {currentInspection && (
            <div className={styles.metadata}>
              <strong className={styles.organization}>{currentInspection.organization.name}</strong>
              <p className={styles.email}>{currentInspection.email}</p>
              <dl className={styles.details}>
                <div><dt>{t("Vai trò")}</dt><dd>{t(roleLabels[currentInspection.role])}</dd></div>
                <div><dt>{t("Hết hạn:")}</dt><dd><time dateTime={currentInspection.expiresAt}>{formatDate(currentInspection.expiresAt, { dateStyle: "medium", timeStyle: "short" })}</time></dd></div>
              </dl>
            </div>
          )}
          {content}
          <p className={styles.securityNote}>{t("Lời mời chỉ có thể được dùng cho đúng email và tổ chức đã chỉ định.")}</p>
        </section>
      </main>
    </>
  );
}
