import { SafetyCertificateOutlined } from "@ant-design/icons";
import Image from "next/image";
import type { ReactNode } from "react";

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
        <div className="brand-lockup"><span className="brand-mark light">DX</span><span>DX LMS</span></div>
        <div className="auth-copy">
          <h1>Bảo vệ tài khoản học tập của bạn.</h1>
          <p>Khôi phục quyền truy cập an toàn và tiếp tục công việc trong không gian đào tạo của tổ chức.</p>
        </div>
        <figure aria-hidden="true" className="auth-mascot">
          <Image alt="" height={900} preload sizes="(max-width: 900px) 190px, 29vw" src="/graphics/dx-lms-dolphin-contact.png" width={750} />
        </figure>
        <div className="auth-proof"><span>Không lưu token khôi phục</span><span>Phiên cũ được đóng an toàn</span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="brand-lockup"><span className="brand-mark">DX</span><span>DX LMS</span></span>
          <h2>{title}</h2>
          <span className="subtitle">{subtitle}</span>
          {children}
          <div className="auth-security-note"><SafetyCertificateOutlined /> Kết nối được bảo vệ</div>
        </div>
      </section>
    </main>
  );
}
