import { SafetyCertificateOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import { AuthWorkspaceVisual } from "@/components/brand/auth-workspace-visual";
import { DxBrandLockup } from "@/components/brand/dx-brand-lockup";

export function AuthSecurityLayout({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <main className="auth-page">
      <section className="auth-hero">
        <DxBrandLockup variant="inverse" />
        <div className="auth-copy">
          <h1>Bảo vệ tài khoản học tập của bạn.</h1>
          <p>Khôi phục quyền truy cập an toàn và tiếp tục công việc trong không gian đào tạo của tổ chức.</p>
        </div>
        <AuthWorkspaceVisual className="auth-mascot" variant="security" />
        <div className="auth-proof"><span>Không lưu token khôi phục</span><span>Phiên cũ được đóng an toàn</span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <DxBrandLockup />
          <h2>{title}</h2>
          <span className="subtitle">{subtitle}</span>
          {children}
          <div className="auth-security-note"><SafetyCertificateOutlined /> Kết nối được bảo vệ</div>
        </div>
      </section>
    </main>
  );
}
