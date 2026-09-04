"use client";

import { SafetyCertificateOutlined, UserAddOutlined } from "@ant-design/icons";
import { Alert, Avatar, Button, Form, Input, Spin, Tag } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

const invitationExpiry = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function normalizedEmail(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function invitationErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "Không thể xử lý lời mời";
  }
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
      return error.message;
  }
}

export default function InvitationPage() {
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
  const [error, setError] = useState("");
  const loading = Boolean(invitationToken) && loadedToken !== invitationToken;
  const currentInspection = loadedToken === invitationToken ? inspection : null;

  useEffect(() => {
    if (!invitationToken) return;

    const controller = new AbortController();
    let active = true;
    void apiFetch<InvitationInspection>(endpoint, { signal: controller.signal })
      .then((payload) => {
        if (active) {
          setError("");
          setInspection(payload);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(invitationErrorMessage(caught));
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
    setError("");
    try {
      const payload = await request();
      await consumeAuthResponse(payload, expectedAuthGeneration);
      router.replace("/dashboard");
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "INVITATION_ACCOUNT_EXISTS") {
        setInspection((current) => current ? { ...current, requiresAuthentication: true } : current);
      }
      setError(invitationErrorMessage(caught));
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
      return <div aria-label="Đang kiểm tra lời mời" style={{ display: "grid", justifyItems: "center", padding: "40px 0" }}><Spin size="large" /></div>;
    }
    if (!currentInspection) {
      return <Alert description={error || (invitationToken ? "Không thể tải thông tin lời mời." : "Lời mời không hợp lệ.")} showIcon title="Không thể mở lời mời" type="error" />;
    }
    if (emailMismatch) {
      return (
        <>
          <Alert description={`Bạn đang đăng nhập bằng ${user?.email}. Lời mời này dành cho ${currentInspection.email}.`} showIcon title="Sai tài khoản" type="warning" />
          <Button block onClick={signInWithAnotherAccount} style={{ height: 46, marginTop: 20 }} type="primary">Đăng nhập bằng tài khoản khác</Button>
        </>
      );
    }
    if (currentInspection.requiresAuthentication && !user) {
      return (
        <>
          <Alert description={`Đăng nhập bằng ${currentInspection.email} để xác nhận tham gia tổ chức.`} showIcon title="Tài khoản đã tồn tại" type="info" />
          {error && <Alert closable onClose={() => setError("")} showIcon style={{ marginTop: 16 }} title={error} type="error" />}
          <Form<ExistingAccountValues> layout="vertical" onFinish={(values) => void acceptExisting(values)} requiredMark={false} size="large" style={{ marginTop: 20 }}>
            <Form.Item label="Mật khẩu tài khoản" name="password" rules={[{ message: "Nhập mật khẩu", required: true }, { message: "Mật khẩu cần ít nhất 8 ký tự", min: 8 }]}>
              <Input.Password autoComplete="current-password" placeholder="Mật khẩu của tài khoản hiện có" />
            </Form.Item>
            <Button block htmlType="submit" loading={submitting} style={{ height: 46 }} type="primary">Xác nhận và tham gia</Button>
          </Form>
          <Button block disabled={submitting} onClick={signIn} style={{ marginTop: 10 }} type="link">Đăng nhập để chấp nhận</Button>
        </>
      );
    }
    if (user) {
      return (
        <>
          {error && <Alert closable onClose={() => setError("")} showIcon title={error} type="error" />}
          <Button block loading={submitting} onClick={() => void accept()} style={{ height: 46, marginTop: error ? 20 : 0 }} type="primary">Chấp nhận lời mời</Button>
        </>
      );
    }
    return (
      <>
        {error && <Alert closable onClose={() => setError("")} showIcon style={{ marginBottom: 20 }} title={error} type="error" />}
        <Form<RegistrationValues> layout="vertical" onFinish={(values) => void register(values)} requiredMark={false} size="large">
          <Form.Item label="Họ và tên" name="fullName" rules={[{ message: "Nhập họ và tên", required: true }, { message: "Họ và tên cần ít nhất 2 ký tự", min: 2 }]}>
            <Input autoComplete="name" placeholder="Nguyễn Văn An" />
          </Form.Item>
          <Form.Item label="Mật khẩu" name="password" rules={[{ message: "Nhập mật khẩu", required: true }, { message: "Mật khẩu cần ít nhất 8 ký tự", min: 8 }]}>
            <Input.Password autoComplete="new-password" placeholder="Ít nhất 8 ký tự" />
          </Form.Item>
          <Form.Item dependencies={["password"]} label="Nhập lại mật khẩu" name="passwordConfirmation" rules={[
            { message: "Nhập lại mật khẩu", required: true },
            ({ getFieldValue }) => ({ validator: (_, value) => !value || getFieldValue("password") === value ? Promise.resolve() : Promise.reject(new Error("Mật khẩu nhập lại chưa khớp")) }),
          ]}>
            <Input.Password autoComplete="new-password" placeholder="Nhập lại mật khẩu" />
          </Form.Item>
          <Button block htmlType="submit" loading={submitting} style={{ height: 46 }} type="primary">Tạo tài khoản và tham gia</Button>
        </Form>
      </>
    );
  })();

  return (
    <>
      <meta content="noindex,nofollow,noarchive" name="robots" />
      <meta content="no-referrer" name="referrer" />
      <main className="auth-page">
        <section className="auth-hero">
          <div className="brand-lockup"><span className="brand-mark light">DX</span><span>DX LMS</span></div>
          <div className="auth-copy">
            <h1>{currentInspection ? `Tham gia ${currentInspection.organization.name}` : "Bạn được mời vào DX LMS"}</h1>
            <p>Lời mời chỉ có thể được dùng cho đúng email và tổ chức đã chỉ định.</p>
          </div>
          <div className="auth-proof"><span>Bảo vệ bằng liên kết riêng</span><span>Phân quyền theo tổ chức</span><span>Chuyển không gian an toàn</span></div>
        </section>
        <section className="auth-panel">
          <div className="auth-card">
            <span className="brand-lockup"><span className="brand-mark">DX</span><span>DX LMS</span></span>
            <Avatar icon={<UserAddOutlined />} size={54} style={{ background: currentInspection?.organization.primaryColor || "#176BFF", marginTop: 28 }} />
            <h2>Lời mời tham gia</h2>
            {currentInspection && (
              <div style={{ color: "#58708F", lineHeight: 1.7, marginBottom: 24 }}>
                <strong style={{ color: "#10233F", display: "block" }}>{currentInspection.organization.name}</strong>
                <span style={{ display: "block" }}>{currentInspection.email}</span>
                <Tag color="blue" style={{ marginTop: 8 }}>{roleLabels[currentInspection.role]}</Tag>
                <small style={{ display: "block", marginTop: 8 }}>Hết hạn: {invitationExpiry.format(new Date(currentInspection.expiresAt))}</small>
              </div>
            )}
            {content}
            <div className="auth-security-note"><SafetyCertificateOutlined /> Email, vai trò và tổ chức được máy chủ xác minh</div>
          </div>
        </section>
      </main>
    </>
  );
}
