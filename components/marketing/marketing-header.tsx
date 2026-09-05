"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { FeedbackLanguageSwitcher } from "@/components/feedback/feedback-locale";
import { marketingMessages } from "@/lib/i18n/marketing-messages";
import Link from "next/link";
import styles from "@/app/marketing.module.css";
import { Brand } from "./brand";
import { MarketingHeaderEnhancement } from "./marketing-header-enhancement";
import { MarketingIcon } from "./marketing-icon";

const navigation = [
  { href: "#gioi-thieu", label: "Giới thiệu" },
  { href: "#gia-tri", label: "Giá trị" },
  { href: "#nang-luc", label: "Tính năng" },
  { href: "#quy-mo", label: "Quy mô" },
  { href: "#lien-he", label: "Bắt đầu" },
];

export function MarketingHeader() {
  const { t } = useI18n(marketingMessages);
  return (
    <header className={styles.header} data-marketing-header>
      <MarketingHeaderEnhancement />
      <a className={styles.skipLink} href="#noi-dung-chinh">
        {t("Bỏ qua điều hướng")}
      </a>
      <div className={styles.headerInner}>
        <a
          className={styles.brandLink}
          href="#top"
          aria-label={t("DX LMS, về đầu trang")}
        >
          <Brand />
        </a>

        <nav className={styles.desktopNav} aria-label={t("Điều hướng chính")}>
          {navigation.map((item) => (
            <a href={item.href} key={item.href}>
              {t(item.label)}
            </a>
          ))}
        </nav>

        <FeedbackLanguageSwitcher />
        <div className={styles.headerActions}>
          <Link className={styles.textLink} href="/login">
            {t("Đăng nhập")}
          </Link>
          <Link className={styles.compactButton} href="/register">
            {t("Dùng thử miễn phí")} <MarketingIcon name="right" />
          </Link>
        </div>

        <details className={styles.mobileMenu}>
          <summary aria-label={t("Menu điều hướng")}>
            <MarketingIcon name="menu" />
            <span>{t("Trình đơn")}</span>
          </summary>
          <nav aria-label={t("Điều hướng trên thiết bị di động")}>
            {navigation.map((item) => (
              <a href={item.href} key={item.href}>
                {t(item.label)}
              </a>
            ))}
            <Link href="/login">{t("Đăng nhập")}</Link>
            <Link href="/register">{t("Tạo workspace dùng thử")}</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
