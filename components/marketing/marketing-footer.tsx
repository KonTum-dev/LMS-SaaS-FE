import Link from "next/link";
import styles from "@/app/marketing.module.css";
import { Brand } from "./brand";
import { MarketingIcon } from "./marketing-icon";
import { SectionMascot } from "./section-mascot";

export function FinalCta() {
  return (
    <section className={styles.ctaSection} aria-labelledby="cta-title" data-section="cta">
      <div className={styles.container}>
        <div className={styles.ctaPanel} data-reveal>
          <span className={styles.ctaOrb} aria-hidden="true" />
          <div>
            <span className={styles.sectionLabelLight}>Đã có tài khoản DX LMS?</span>
            <h2 id="cta-title">Đăng nhập và tiếp tục công việc của bạn.</h2>
          </div>
          <SectionMascot variant="cta" />
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
      <div className={`${styles.container} ${styles.contactGrid}`} data-reveal>
        <div>
          <span className={styles.sectionLabel}>Bắt đầu với DX LMS</span>
          <h2 id="contact-title">Tổ chức của bạn đã có tài khoản?</h2>
          <p>
            Dùng tài khoản được cấp để vào không gian đào tạo của tổ chức và
            tiếp tục công việc đang phụ trách.
          </p>
        </div>
        <SectionMascot variant="contact" />
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
      <div className={`${styles.container} ${styles.footerInner}`}>
        <div className={styles.footerBrand}>
          <Brand inverse />
          <p>Nền tảng đa tổ chức cho vận hành đào tạo rõ ràng.</p>
        </div>
        <nav aria-label="Điều hướng chân trang">
          <a href="#gioi-thieu">Giới thiệu</a>
          <a href="#gia-tri">Giá trị</a>
          <a href="#nang-luc">Tính năng</a>
          <a href="#quy-mo">Quy mô</a>
          <Link href="/login">Đăng nhập</Link>
        </nav>
        <p className={styles.footerNote}>© 2026 DX LMS · DolphinX Studio</p>
      </div>
    </footer>
  );
}
