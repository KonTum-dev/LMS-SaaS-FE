"use client";

import { LockOutlined, MailOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input } from "antd";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { useAuth } from "@/components/providers/app-providers";

interface LoginValues { email: string; password: string }

const DEFAULT_LOGIN_DESTINATION = "/dashboard";
const UNSAFE_NEXT_CHARACTER = /[\\\u0000-\u001f\u007f]/u;

function resolveSafeLoginNext(value: string | null | undefined): string {
  if (!value || value.length > 2_048 || value !== value.trim()) return DEFAULT_LOGIN_DESTINATION;
  if (!value.startsWith("/") || value.startsWith("//") || UNSAFE_NEXT_CHARACTER.test(value)) {
    return DEFAULT_LOGIN_DESTINATION;
  }

  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) break;
      decoded = nextDecoded;
    } catch {
      return DEFAULT_LOGIN_DESTINATION;
    }
    if (decoded.startsWith("//") || UNSAFE_NEXT_CHARACTER.test(decoded)) {
      return DEFAULT_LOGIN_DESTINATION;
    }
  }

  try {
    const base = new URL("https://dx-lms.invalid");
    if (new URL(value, base).origin !== base.origin) return DEFAULT_LOGIN_DESTINATION;
  } catch {
    return DEFAULT_LOGIN_DESTINATION;
  }

  return value;
}

function LoginContent() {
  const { loading, login, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const destination = resolveSafeLoginNext(searchParams.get("next"));
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
        <div className="brand-lockup"><span className="brand-mark light">DX</span><span>DX LMS</span></div>
        <div className="auth-copy">
          <h1>Vận hành đào tạo. Đúng người, đúng việc.</h1>
          <p>Quản lý người dùng, khóa học, ghi danh và bài tập trong không gian riêng mang bản sắc của tổ chức.</p>
        </div>
        <figure className="auth-mascot" aria-hidden="true">
          <Image alt="" height={900} preload sizes="(max-width: 900px) 190px, 29vw" src="/graphics/dx-lms-dolphin-contact.png" width={750} />
        </figure>
        <div className="auth-proof"><span>Dữ liệu tách biệt theo tổ chức</span><span>Phân quyền rõ ràng</span><span>Tùy biến thương hiệu</span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="brand-lockup"><span className="brand-mark">DX</span><span>DX LMS</span></span>
          <h2>Chào mừng trở lại</h2>
          <span className="subtitle">Đăng nhập để tiếp tục vào không gian quản lý đào tạo.</span>
          {error && <Alert closable onClose={() => setError("")} showIcon style={{ marginBottom: 20 }} title={error} type="error" />}
          <Form<LoginValues> layout="vertical" onFinish={submit} requiredMark={false} size="large">
            <Form.Item label="Email" name="email" rules={[{ required: true, message: "Nhập email" }, { type: "email", message: "Email chưa đúng định dạng" }]}>
              <Input autoComplete="email" prefix={<MailOutlined />} placeholder="ban@truong.edu.vn" />
            </Form.Item>
            <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: "Nhập mật khẩu" }]}>
              <Input.Password autoComplete="current-password" prefix={<LockOutlined />} placeholder="Mật khẩu" />
            </Form.Item>
            <div className="auth-form-link"><Link href="/forgot-password">Quên mật khẩu?</Link></div>
            <Button block disabled={loading} htmlType="submit" loading={submitting || loading} style={{ height: 48, marginTop: 6 }} type="primary">Đăng nhập</Button>
          </Form>
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
