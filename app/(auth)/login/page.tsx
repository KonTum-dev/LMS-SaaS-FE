"use client";

import { LockOutlined, MailOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { useAuth } from "@/components/providers/app-providers";

interface LoginValues { email: string; password: string }

export default function LoginPage() {
  const { loading, login, user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const tanstackForm = useAntdTanStackForm<LoginValues>(
    { email: "", password: "" },
    async (values) => {
      await login(values.email, values.password);
      router.replace("/dashboard");
    },
  );

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, router, user]);

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
        <div className="brand-lockup"><span className="brand-mark light">N</span><span>NovaLMS</span></div>
        <div className="auth-copy">
          <h1>Một không gian học tập. Theo cách của bạn.</h1>
          <p>Quản lý trung tâm, trường học và lớp học thêm trên một nền tảng linh hoạt, an toàn và mang trọn bản sắc riêng.</p>
        </div>
        <div className="auth-proof"><span>● Dữ liệu tách biệt theo tổ chức</span><span>● Phân quyền rõ ràng</span><span>● Tùy biến thương hiệu</span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="brand-lockup"><span className="brand-mark">N</span><span>NovaLMS</span></span>
          <h2>Chào mừng trở lại</h2>
          <span className="subtitle">Đăng nhập để tiếp tục vào không gian quản lý đào tạo.</span>
          {error && <Alert closable message={error} onClose={() => setError("")} showIcon style={{ marginBottom: 20 }} type="error" />}
          <Form<LoginValues> layout="vertical" onFinish={submit} requiredMark={false} size="large">
            <Form.Item label="Email" name="email" rules={[{ required: true, message: "Nhập email" }, { type: "email", message: "Email chưa đúng định dạng" }]}>
              <Input autoComplete="email" prefix={<MailOutlined />} placeholder="ban@truong.edu.vn" />
            </Form.Item>
            <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: "Nhập mật khẩu" }]}>
              <Input.Password autoComplete="current-password" prefix={<LockOutlined />} placeholder="Mật khẩu" />
            </Form.Item>
            <Button block htmlType="submit" loading={submitting} style={{ height: 48, marginTop: 6 }} type="primary">Đăng nhập</Button>
          </Form>
          <div style={{ alignItems: "center", color: "#667085", display: "flex", fontSize: 12, gap: 8, justifyContent: "center", marginTop: 26 }}><SafetyCertificateOutlined /> Phiên làm việc được bảo vệ bằng JWT</div>
        </div>
      </section>
    </main>
  );
}
