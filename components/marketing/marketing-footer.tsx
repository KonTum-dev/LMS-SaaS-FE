import Link from "next/link";
import styles from "@/app/marketing.module.css";
import { Brand } from "./brand";
import { MarketingIcon } from "./marketing-icon";

export function FinalCta() {
  return (
    <section className={styles.ctaSection} aria-labelledby="cta-title" data-section="cta">
      <div className={styles.container}>
        <div className={styles.ctaPanel}>
          <span className={styles.ctaOrb} aria-hidden="true" />
          <div>
            <span className={styles.sectionLabelLight}>Workspace của bạn đã sẵn sàng?</span>
            <h2 id="cta-title">Quay lại đúng tổ chức, đúng vai trò, đúng việc cần làm.</h2>
          </div>
          <Link className={styles.lightButton} href="/login">
            Đăng nhập DX LMS <MarketingIcon name="arrowRight" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function ContactCta() {
  return (
    <section
      className={styles.contactSection}
      id="lien-he"
      aria-labelledby="contact-title"
      data-section="contact"
    >
      <div className={`${styles.container} ${styles.contactGrid}`}>
        <div>
          <span className={styles.sectionLabel}>Bắt đầu với DX LMS</span>
          <h2 id="contact-title">Tổ chức của bạn đã có workspace?</h2>
          <p>
            Dùng tài khoản được cấp để vào không gian đào tạo của tổ chức và
            tiếp tục công việc đang phụ trách.
          </p>
        </div>
        <Link className={styles.primaryButton} href="/login">
          Đi tới đăng nhập <MarketingIcon name="arrowRight" />
        </Link>
      </div>
    </section>
  );
}

export function MarketingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerWave} aria-hidden="true">
        <svg viewBox="0 0 1440 190" preserveAspectRatio="none">
          <path d="M0 118C180 46 343 42 520 100c201 66 329 59 475 3 151-58 284-66 445-10v97H0Z" />
        </svg>
      </div>
      <div className={`${styles.container} ${styles.footerInner}`}>
        <div className={styles.footerBrand}>
          <Brand inverse />
          <p>Nền tảng Web multi-tenant cho vận hành đào tạo rõ ràng.</p>
        </div>
        <nav aria-label="Điều hướng chân trang">
          <a href="#gioi-thieu">Giới thiệu</a>
          <a href="#gia-tri">Giá trị</a>
          <a href="#nang-luc">Năng lực</a>
          <Link href="/login">Đăng nhập</Link>
        </nav>
        <p className={styles.footerNote}>© 2026 DX LMS · DolphinX Studio</p>
      </div>
    </footer>
  );
}
