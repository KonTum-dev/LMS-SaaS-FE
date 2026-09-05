"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { marketingMessages } from "@/lib/i18n/marketing-messages";
import Link from "next/link";
import styles from "@/app/marketing.module.css";
import { Brand } from "./brand";
import { MarketingIcon } from "./marketing-icon";
import { SectionMascot } from "./section-mascot";

export function FinalCta() {
  const { t } = useI18n(marketingMessages);
  return (
    <section
      className={styles.ctaSection}
      aria-labelledby="cta-title"
      data-section="cta"
    >
      <div className={styles.container}>
        <div className={styles.ctaPanel} data-reveal>
          <span className={styles.ctaOrb} aria-hidden="true" />
          <div>
            <span className={styles.sectionLabelLight}>
              {t("Sẵn sàng bắt đầu?")}
            </span>
            <h2 id="cta-title">
              {t("Tạo workspace và đưa lớp học vào guồng.")}
            </h2>
          </div>
          <SectionMascot variant="cta" />
          <Link className={styles.lightButton} href="/register">
            {t("Tạo workspace dùng thử")} <MarketingIcon name="arrowRight" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function ContactCta() {
  const { t } = useI18n(marketingMessages);
  return (
    <section
      className={styles.contactSection}
      id="lien-he"
      aria-labelledby="contact-title"
      data-section="contact"
    >
      <div className={`${styles.container} ${styles.contactGrid}`} data-reveal>
        <div>
          <span className={styles.sectionLabel}>{t("Bắt đầu với DX LMS")}</span>
          <h2 id="contact-title">{t("Tổ chức của bạn đã có tài khoản?")}</h2>
          <p>
            {t(
              "Dùng tài khoản được cấp để vào không gian đào tạo của tổ chức và tiếp tục công việc đang phụ trách.",
            )}
          </p>
        </div>
        <SectionMascot variant="contact" />
        <Link className={styles.primaryButton} href="/login">
          {t("Đi tới đăng nhập")} <MarketingIcon name="arrowRight" />
        </Link>
      </div>
    </section>
  );
}

export function MarketingFooter() {
  const { t } = useI18n(marketingMessages);
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerInner}`}>
        <div className={styles.footerBrand}>
          <Brand inverse />
          <p>{t("Nền tảng đa tổ chức cho vận hành đào tạo rõ ràng.")}</p>
        </div>
        <nav aria-label={t("Điều hướng chân trang")}>
          <a href="#gioi-thieu">{t("Giới thiệu")}</a>
          <a href="#gia-tri">{t("Giá trị")}</a>
          <a href="#nang-luc">{t("Tính năng")}</a>
          <a href="#quy-mo">{t("Quy mô")}</a>
          <Link href="/register">{t("Dùng thử")}</Link>
          <Link href="/login">{t("Đăng nhập")}</Link>
        </nav>
        <p className={styles.footerNote}>© 2026 DX LMS · DolphinX Studio</p>
      </div>
    </footer>
  );
}
