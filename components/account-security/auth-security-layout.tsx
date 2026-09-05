"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { accountPolishMessages as authMessages } from "@/lib/i18n/account-polish-messages";
import { SafetyCertificateOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import { AuthWorkspaceVisual } from "@/components/brand/auth-workspace-visual";
import { DxBrandLockup } from "@/components/brand/dx-brand-lockup";
import styles from "./auth-security-layout.module.css";

export function AuthSecurityLayout({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle: string;
  title: string;
}) {
  const { t } = useI18n(authMessages);
  return (
    <main className={`auth-page ${styles.page}`}>
      <section className="auth-hero">
        <DxBrandLockup variant="inverse" />
        <div className="auth-copy">
          <h1>{t("Bảo vệ tài khoản học tập của bạn.")}</h1>
          <p>{t("Lấy lại quyền truy cập và tiếp tục học tập.")}</p>
        </div>
        <AuthWorkspaceVisual className="auth-mascot" variant="security" />
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <DxBrandLockup />
          <h2>{title}</h2>
          <span className="subtitle">{subtitle}</span>
          {children}
          <div className="auth-security-note"><SafetyCertificateOutlined />  {t("Kết nối được bảo vệ")}</div>
        </div>
      </section>
    </main>
  );
}
