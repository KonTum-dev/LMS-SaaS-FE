"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { accountPolishMessages as authMessages } from "@/lib/i18n/account-polish-messages";


import {
  ApartmentOutlined,
  ArrowRightOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Button, Input } from "antd";
import { Form } from "@/components/form/localized-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DxBrandLockup } from "@/components/brand/dx-brand-lockup";
import { AuthWorkspaceVisual } from "@/components/brand/auth-workspace-visual";
import authStyles from "./auth-security-layout.module.css";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { useAuth } from "@/components/providers/app-providers";
import {
  buildPublicRegistrationRequest,
  clearPublicRegistrationAttempt,
  createPublicRegistrationIdempotencyKey,
  loadPublicRegistrationAttempt,
  publicRegistrationApi,
  publicRegistrationFingerprint,
  rememberPublicRegistrationAttempt,
  registrationErrorPresentation,
  workspaceSlugFromName,
  type PublicRegistrationAttempt,
  type PublicRegistrationValues,
} from "@/lib/public-registration";
import {
  passwordConfirmationError,
  passwordValidationError,
} from "@/lib/password-security";

interface RegistrationFormValues extends PublicRegistrationValues {
  passwordConfirmation: string;
}

const initialValues: RegistrationFormValues = {
  email: "",
  fullName: "",
  password: "",
  passwordConfirmation: "",
  workspaceName: "",
  workspaceSlug: "",
};

export function PublicRegistrationPage() {
  const { t } = useI18n(authMessages);
  const { message, reportError } = useFeedback();
  const { captureAuthGeneration, consumeAuthResponse, loading, user } =
    useAuth();
  const router = useRouter();
  const [form] = Form.useForm<RegistrationFormValues>();
  const [failedAttempt, setFailedAttempt] = useState<{ error: unknown } | null>(null);
  const notice = failedAttempt ? registrationErrorPresentation(failedAttempt.error, t) : null;
  const [submitting, setSubmitting] = useState(false);
  const attemptRef = useRef<PublicRegistrationAttempt | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const registrationSucceededRef = useRef(false);
  const submitInFlight = useRef(false);
  const slugEdited = useRef(false);

  useEffect(() => {
    if (!loading && user && !registrationSucceededRef.current) {
      router.replace(user.role === "TENANT_ADMIN" ? "/billing" : "/dashboard");
    }
  }, [loading, router, user]);

  useEffect(
    () => () => {
      requestRef.current?.abort();
    },
    [],
  );

  const register = async (values: RegistrationFormValues) => {
    if (submitInFlight.current) return;
    submitInFlight.current = true;
    setFailedAttempt(null);
    setSubmitting(true);
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;

    try {
      const input = buildPublicRegistrationRequest(values);
      const fingerprint = await publicRegistrationFingerprint(input);
      if (controller.signal.aborted) return;
      if (attemptRef.current?.fingerprint !== fingerprint) {
        attemptRef.current = loadPublicRegistrationAttempt(fingerprint) ?? {
          createdAt: Date.now(),
          fingerprint,
          idempotencyKey: createPublicRegistrationIdempotencyKey(),
          version: 1,
        };
      }
      rememberPublicRegistrationAttempt(attemptRef.current);
      const expectedAuthGeneration = captureAuthGeneration();
      const response = await publicRegistrationApi.register(
        input,
        attemptRef.current.idempotencyKey,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      registrationSucceededRef.current = true;
      await consumeAuthResponse(response, expectedAuthGeneration);
      if (controller.signal.aborted) return;
      attemptRef.current = null;
      clearPublicRegistrationAttempt();
      message.success(
        "Đã tạo không gian làm việc và kích hoạt dùng thử. Bạn có thể bắt đầu thiết lập ngay.",
      );
      router.replace("/billing?onboarding=1");
    } catch (caught) {
      if (controller.signal.aborted) return;
      registrationSucceededRef.current = false;
      setFailedAttempt({ error: caught });
      reportError(
        caught,
        "Chưa thể hoàn tất đăng ký. Hãy kiểm tra hướng dẫn trên biểu mẫu trước khi thử lại.",
      );
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      submitInFlight.current = false;
      if (!controller.signal.aborted) setSubmitting(false);
    }
  };

  const tanstackForm = useAntdTanStackForm<RegistrationFormValues>(
    initialValues,
    register,
  );

  const submit = async (values: RegistrationFormValues) => {
    await tanstackForm.submit(values);
  };

  if (loading || user) {
    return (
      <main
        aria-busy="true"
        aria-label={t("Đang kiểm tra phiên đăng nhập")}
        className={`auth-page auth-page--register ${authStyles.page}`}
      />
    );
  }

  return (
    <main className={`auth-page auth-page--register ${authStyles.page}`}>
      <section className="auth-hero auth-register-hero">
        <Link
          className="auth-brand-link"
          href="/"
          aria-label={t("DX LMS, về trang chủ")}
        >
          <DxBrandLockup variant="inverse" />
        </Link>
        <div className="auth-copy auth-register-copy">
          <h1>{t("Mở không gian đào tạo của riêng bạn.")}</h1>
          <p>
            {t("Tạo không gian riêng để quản lý lớp học và học viên.")}</p>
        </div>
        <AuthWorkspaceVisual
          className="auth-mascot auth-register-mascot"
          variant="register"
        />
        <div className="auth-proof">
          <span>{t("Không cần nhập thông tin thanh toán")}</span>
        </div>
      </section>

      <section className="auth-panel auth-register-panel">
        <div className="auth-card auth-register-card">
          <div className="auth-register-heading">
            <DxBrandLockup />
            <p>
              {t("Đã có tài khoản?")}{" "}<Link href="/login">{t("Đăng nhập")}</Link>
            </p>
          </div>
          <h2>{t("Tạo tài khoản quản trị")}</h2>
          <span className="subtitle">
            {t("Bắt đầu dùng thử, mời đồng nghiệp và tạo lớp học đầu tiên.")}</span>

          <div aria-live="polite">
            {notice && (
              <Alert
                closable
                description={t(notice.description)}
                onClose={() => setFailedAttempt(null)}
                showIcon
                style={{ marginBottom: 22 }}
                title={t(notice.title)}
                type={notice.type}
              />
            )}
          </div>

          <Form<RegistrationFormValues>
            disabled={submitting}
            form={form}
            initialValues={initialValues}
            layout="vertical"
            onFinish={(values) => void submit(values)}
            onValuesChange={(changedValues) => {
              attemptRef.current = null;
              setFailedAttempt(null);
              if (Object.hasOwn(changedValues, "workspaceSlug")) {
                slugEdited.current = true;
              }
              if (
                Object.hasOwn(changedValues, "workspaceName") &&
                !slugEdited.current
              ) {
                form.setFieldValue(
                  "workspaceSlug",
                  workspaceSlugFromName(
                    String(changedValues.workspaceName ?? ""),
                  ),
                );
              }
            }}
            requiredMark={false}
            size="large"
          >
            <div
              className="auth-form-section"
              role="group"
              aria-labelledby="owner-fields-title"
            >
              <div className="auth-form-section-title" id="owner-fields-title">
                <span>1</span>
                <div>
                  <strong>{t("Thông tin của bạn")}</strong>
                  <small>{t("Dùng để đăng nhập và quản trị workspace")}</small>
                </div>
              </div>
              <div className="auth-form-grid">
                <Form.Item
                  label={t("Họ và tên")}
                  name="fullName"
                  rules={[
                    {
                      required: true,
                      whitespace: true,
                      message: t("Nhập họ và tên"),
                    },
                    { min: 2, message: t("Họ tên cần ít nhất 2 ký tự") },
                    {
                      max: 160,
                      message: t("Họ tên không được vượt quá 160 ký tự"),
                    },
                  ]}
                >
                  <Input
                    autoComplete="name"
                    maxLength={160}
                    prefix={<UserOutlined />}
                    placeholder={t("Nguyễn Minh Anh")}
                  />
                </Form.Item>
                <Form.Item
                  label={t("Email đăng nhập")}
                  name="email"
                  rules={[
                    { required: true, message: t("Nhập email") },
                    { type: "email", message: t("Email chưa đúng định dạng") },
                    {
                      max: 254,
                      message: t("Email không được vượt quá 254 ký tự"),
                    },
                  ]}
                >
                  <Input
                    autoComplete="email"
                    maxLength={254}
                    prefix={<MailOutlined />}
                    placeholder="ban@trungtam.edu.vn"
                  />
                </Form.Item>
              </div>
              <div className="auth-form-grid">
                <Form.Item
                  label={t("Mật khẩu")}
                  name="password"
                  rules={[
                    {
                      required: true,
                      validator: async (_, value: unknown) => {
                        const issue = passwordValidationError(
                          typeof value === "string" ? value : "",
                        );
                        if (issue) throw new Error(t(issue));
                      },
                    },
                  ]}
                >
                  <Input.Password
                    autoComplete="new-password"
                    prefix={<LockOutlined />}
                    placeholder={t("Tối thiểu 8 ký tự")}
                  />
                </Form.Item>
                <Form.Item
                  dependencies={["password"]}
                  label={t("Nhập lại mật khẩu")}
                  name="passwordConfirmation"
                  rules={[
                    { required: true, message: t("Nhập lại mật khẩu") },
                    ({ getFieldValue }) => ({
                      validator: async (_, value: unknown) => {
                        const issue = passwordConfirmationError(
                          String(getFieldValue("password") ?? ""),
                          typeof value === "string" ? value : "",
                        );
                        if (issue) throw new Error(t(issue));
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    autoComplete="new-password"
                    prefix={<LockOutlined />}
                    placeholder={t("Nhập lại mật khẩu")}
                  />
                </Form.Item>
              </div>
            </div>

            <div
              className="auth-form-section"
              role="group"
              aria-labelledby="workspace-fields-title"
            >
              <div
                className="auth-form-section-title"
                id="workspace-fields-title"
              >
                <span>2</span>
                <div>
                  <strong>{t("Workspace đào tạo")}</strong>
                  <small>{t("Có thể đổi tên và màu nhận diện sau")}</small>
                </div>
              </div>
              <Form.Item
                label={t("Tên workspace")}
                name="workspaceName"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: t("Nhập tên workspace"),
                  },
                  { min: 2, message: t("Tên cần ít nhất 2 ký tự") },
                  { max: 160, message: t("Tên không được vượt quá 160 ký tự") },
                ]}
              >
                <Input
                  autoComplete="organization"
                  maxLength={160}
                  prefix={<ApartmentOutlined />}
                  placeholder={t("Trung tâm Ánh Dương")}
                />
              </Form.Item>
              <Form.Item
                extra={t("Mã nhận diện nội bộ, viết thường và dùng số hoặc dấu gạch ngang.")}
                label={t("Mã workspace")}
                name="workspaceSlug"
                rules={[
                  { required: true, message: t("Nhập mã workspace") },
                  {
                    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                    message: t("Chỉ dùng chữ thường, số và dấu gạch ngang"),
                  },
                  { max: 100, message: t("Mã không được vượt quá 100 ký tự") },
                ]}
              >
                <Input maxLength={100} placeholder="trung-tam-anh-duong" />
              </Form.Item>
            </div>

            <div className="auth-trial-note">
              <SafetyCertificateOutlined />
              <span>
                {t("Không cần thông tin thanh toán để bắt đầu.")}</span>
            </div>
            <Button
              block
              disabled={loading}
              htmlType="submit"
              icon={<ArrowRightOutlined />}
              iconPlacement="end"
              loading={submitting}
              className="auth-register-submit"
              type="primary"
            >
              {t("Tạo workspace dùng thử")}</Button>
          </Form>
          <p className="auth-register-legal">
            {t("Bạn có thể thay đổi thông tin tổ chức sau.")}</p>
        </div>
      </section>
    </main>
  );
}
