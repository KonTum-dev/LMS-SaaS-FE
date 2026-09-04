"use client";

import {
  ApartmentOutlined,
  ArrowRightOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Button, Form, Input } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DxBrandLockup } from "@/components/brand/dx-brand-lockup";
import { AuthWorkspaceVisual } from "@/components/brand/auth-workspace-visual";
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
  type RegistrationErrorPresentation,
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
  const {
    captureAuthGeneration,
    consumeAuthResponse,
    loading,
    user,
  } = useAuth();
  const router = useRouter();
  const [form] = Form.useForm<RegistrationFormValues>();
  const [notice, setNotice] =
    useState<RegistrationErrorPresentation | null>(null);
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
    setNotice(null);
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
      router.replace("/billing?onboarding=1");
    } catch (caught) {
      if (controller.signal.aborted) return;
      registrationSucceededRef.current = false;
      setNotice(registrationErrorPresentation(caught));
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
      <main aria-busy="true" aria-label="Đang kiểm tra phiên đăng nhập" className="auth-page auth-page--register" />
    );
  }

  return (
    <main className="auth-page auth-page--register">
      <section className="auth-hero auth-register-hero">
        <Link className="auth-brand-link" href="/" aria-label="DX LMS, về trang chủ">
          <DxBrandLockup variant="inverse" />
        </Link>
        <div className="auth-copy auth-register-copy">
          <span className="auth-eyebrow">Khởi tạo workspace</span>
          <h1>Mở không gian đào tạo của riêng bạn.</h1>
          <p>
            Tạo tài khoản quản trị, nhận workspace dùng thử tự động và bắt đầu
            sắp xếp lớp học trong vài bước rõ ràng.
          </p>
          <ol className="auth-onboarding-steps" aria-label="Các bước bắt đầu">
            <li><span>01</span><div><strong>Tạo tài khoản</strong><small>Bạn là quản trị viên đầu tiên</small></div></li>
            <li><span>02</span><div><strong>Nhận workspace</strong><small>Dùng thử được kích hoạt tự động</small></div></li>
            <li><span>03</span><div><strong>Chọn gói khi sẵn sàng</strong><small>Thanh toán trong trang quản lý gói</small></div></li>
          </ol>
        </div>
        <AuthWorkspaceVisual className="auth-mascot auth-register-mascot" variant="register" />
        <div className="auth-proof">
          <span>Không cần nhập thông tin thanh toán</span>
          <span>Mỗi workspace một kỳ dùng thử</span>
        </div>
      </section>

      <section className="auth-panel auth-register-panel">
        <div className="auth-card auth-register-card">
          <div className="auth-register-heading">
            <DxBrandLockup />
            <p>Đã có tài khoản? <Link href="/login">Đăng nhập</Link></p>
          </div>
          <h2>Tạo tài khoản quản trị</h2>
          <span className="subtitle">
            Sau khi tạo xong, bạn sẽ vào trang gói để xem trial và chọn thuê bao phù hợp.
          </span>

          <div aria-live="polite">
            {notice && (
              <Alert
                closable
                description={notice.description}
                onClose={() => setNotice(null)}
                showIcon
                style={{ marginBottom: 22 }}
                title={notice.title}
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
              setNotice(null);
              if (Object.hasOwn(changedValues, "workspaceSlug")) {
                slugEdited.current = true;
              }
              if (
                Object.hasOwn(changedValues, "workspaceName") &&
                !slugEdited.current
              ) {
                form.setFieldValue(
                  "workspaceSlug",
                  workspaceSlugFromName(String(changedValues.workspaceName ?? "")),
                );
              }
            }}
            requiredMark={false}
            size="large"
          >
            <div className="auth-form-section" role="group" aria-labelledby="owner-fields-title">
              <div className="auth-form-section-title" id="owner-fields-title">
                <span>1</span><div><strong>Thông tin của bạn</strong><small>Dùng để đăng nhập và quản trị workspace</small></div>
              </div>
              <div className="auth-form-grid">
                <Form.Item
                  label="Họ và tên"
                  name="fullName"
                  rules={[
                    { required: true, whitespace: true, message: "Nhập họ và tên" },
                    { min: 2, message: "Họ tên cần ít nhất 2 ký tự" },
                    { max: 160, message: "Họ tên không được vượt quá 160 ký tự" },
                  ]}
                >
                  <Input autoComplete="name" maxLength={160} prefix={<UserOutlined />} placeholder="Nguyễn Minh Anh" />
                </Form.Item>
                <Form.Item
                  label="Email đăng nhập"
                  name="email"
                  rules={[
                    { required: true, message: "Nhập email" },
                    { type: "email", message: "Email chưa đúng định dạng" },
                    { max: 254, message: "Email không được vượt quá 254 ký tự" },
                  ]}
                >
                  <Input autoComplete="email" maxLength={254} prefix={<MailOutlined />} placeholder="ban@trungtam.edu.vn" />
                </Form.Item>
              </div>
              <div className="auth-form-grid">
                <Form.Item
                  label="Mật khẩu"
                  name="password"
                  rules={[
                    {
                      required: true,
                      validator: async (_, value: unknown) => {
                        const issue = passwordValidationError(
                          typeof value === "string" ? value : "",
                        );
                        if (issue) throw new Error(issue);
                      },
                    },
                  ]}
                >
                  <Input.Password autoComplete="new-password" prefix={<LockOutlined />} placeholder="Tối thiểu 8 ký tự" />
                </Form.Item>
                <Form.Item
                  dependencies={["password"]}
                  label="Nhập lại mật khẩu"
                  name="passwordConfirmation"
                  rules={[
                    { required: true, message: "Nhập lại mật khẩu" },
                    ({ getFieldValue }) => ({
                      validator: async (_, value: unknown) => {
                        const issue = passwordConfirmationError(
                          String(getFieldValue("password") ?? ""),
                          typeof value === "string" ? value : "",
                        );
                        if (issue) throw new Error(issue);
                      },
                    }),
                  ]}
                >
                  <Input.Password autoComplete="new-password" prefix={<LockOutlined />} placeholder="Nhập lại mật khẩu" />
                </Form.Item>
              </div>
            </div>

            <div className="auth-form-section" role="group" aria-labelledby="workspace-fields-title">
              <div className="auth-form-section-title" id="workspace-fields-title">
                <span>2</span><div><strong>Workspace đào tạo</strong><small>Có thể đổi tên và màu nhận diện sau</small></div>
              </div>
              <Form.Item
                label="Tên workspace"
                name="workspaceName"
                rules={[
                  { required: true, whitespace: true, message: "Nhập tên workspace" },
                  { min: 2, message: "Tên cần ít nhất 2 ký tự" },
                  { max: 160, message: "Tên không được vượt quá 160 ký tự" },
                ]}
              >
                <Input autoComplete="organization" maxLength={160} prefix={<ApartmentOutlined />} placeholder="Trung tâm Ánh Dương" />
              </Form.Item>
              <Form.Item
                extra="Mã nhận diện nội bộ, viết thường và dùng số hoặc dấu gạch ngang."
                label="Mã workspace"
                name="workspaceSlug"
                rules={[
                  { required: true, message: "Nhập mã workspace" },
                  {
                    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                    message: "Chỉ dùng chữ thường, số và dấu gạch ngang",
                  },
                  { max: 100, message: "Mã không được vượt quá 100 ký tự" },
                ]}
              >
                <Input maxLength={100} placeholder="trung-tam-anh-duong" />
              </Form.Item>
            </div>

            <div className="auth-trial-note">
              <SafetyCertificateOutlined />
              <span><strong>Trial tự động theo workspace.</strong> Thành viên bạn mời sau này dùng chung quyền của workspace, không tạo trial mới.</span>
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
              Tạo workspace dùng thử
            </Button>
          </Form>
          <p className="auth-register-legal">
            Bạn có thể cập nhật tên, màu nhận diện và thông tin workspace sau khi đăng ký.
          </p>
        </div>
      </section>
    </main>
  );
}
