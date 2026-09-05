"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { authMessages } from "@/lib/i18n/auth-messages";
import {
  ApartmentOutlined,
  CheckCircleFilled,
  LockOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { DxBrandMark } from "./dx-brand-lockup";
import styles from "./auth-workspace-visual.module.css";

type AuthVisualVariant = "login" | "register" | "security";

const visualContent: Record<AuthVisualVariant, {
  eyebrow: string;
  rows: readonly [string, string][];
  status: string;
  title: string;
}> = {
  login: {
    eyebrow: "TRUY CẬP WORKSPACE",
    title: "Đúng người · Đúng phạm vi",
    status: "Sẵn sàng đăng nhập",
    rows: [["Tổ chức", "DX English Center"], ["Vai trò", "Theo tài khoản"], ["Phiên truy cập", "Được bảo vệ"]],
  },
  register: {
    eyebrow: "KHỞI TẠO WORKSPACE",
    title: "Khởi tạo trong 3 bước",
    status: "30 ngày dùng thử",
    rows: [["01", "Tạo tài khoản quản trị"], ["02", "Nhận workspace riêng"], ["03", "Mời đội ngũ tham gia"]],
  },
  security: {
    eyebrow: "BẢO MẬT TÀI KHOẢN",
    title: "Khôi phục quyền truy cập",
    status: "Xác minh an toàn",
    rows: [["Liên kết", "Có thời hạn"], ["Mật khẩu", "Được cập nhật"], ["Phiên cũ", "Được đóng lại"]],
  },
};

export function AuthWorkspaceVisual({
  className,
  variant,
}: {
  className?: string;
  variant: AuthVisualVariant;
}) {
  const { t } = useI18n(authMessages);
  const content = visualContent[variant];
  return (
    <figure className={[styles.visual, className].filter(Boolean).join(" ")} aria-label={t(content.title)}>
      <div className={styles.topbar}>
        <DxBrandMark />
        <span><small>{t(content.eyebrow)}</small><strong>DX LMS</strong></span>
        <CheckCircleFilled aria-hidden="true" />
      </div>
      <div className={styles.body}>
        <span className={styles.heroIcon} aria-hidden="true">
          {variant === "register" ? <ApartmentOutlined /> : variant === "security" ? <SafetyCertificateOutlined /> : <LockOutlined />}
        </span>
        <h2>{t(content.title)}</h2>
        <div className={styles.rows}>
          {content.rows.map(([label, value], index) => (
            <div key={label}>
              <span aria-hidden="true">{variant === "register" ? <TeamOutlined /> : <CheckCircleFilled />}</span>
              <small>{t(label)}</small>
              <strong>{t(value)}</strong>
              <i>{index === 2 ? t("Hoàn tất") : t("Đã kiểm tra")}</i>
            </div>
          ))}
        </div>
        <div className={styles.status}><i aria-hidden="true" /><strong>{t(content.status)}</strong></div>
      </div>
    </figure>
  );
}
