import Link from "next/link";
import styles from "@/app/marketing.module.css";
import { Brand } from "./brand";
import { MarketingIcon } from "./marketing-icon";

export function FinalCta() {
  return (
    <section className={styles.finalCta} id="bat-dau" aria-labelledby="final-cta-title">
      <div className={styles.container}>
        <div className={styles.finalCtaInner}>
          <span className={styles.eyebrow}>Sẵn sàng quay lại workspace?</span>
          <h2 id="final-cta-title">Tập trung vận hành đào tạo trong một không gian rõ ràng.</h2>
          <p>Đăng nhập để tiếp tục với tổ chức, vai trò và các module đã được cấp cho bạn.</p>
          <div className={styles.heroActions}>
            <Link className={styles.lightButton} href="/login">Đăng nhập DX LMS <MarketingIcon name="arrowRight" /></Link>
            <a className={styles.darkGhostButton} href="#san-pham">Xem lại năng lực</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MarketingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.footerTop}>
          <div><Brand inverse /><p>Nền tảng quản lý đào tạo multi-tenant cho trung tâm nhỏ và vừa.</p></div>
          <nav aria-label="Điều hướng chân trang">
            <a href="#san-pham">Sản phẩm</a>
            <a href="#vai-tro">Vai trò</a>
            <a href="#bao-mat">Bảo mật</a>
            <a href="#bang-gia">Gói triển khai</a>
            <a href="#faq">Hỏi đáp</a>
            <Link href="/login">Đăng nhập</Link>
          </nav>
        </div>
        <div className={styles.footerBottom}>
          <span>© 2026 DX LMS</span>
          <span>Vận hành đào tạo, đúng người, đúng việc.</span>
        </div>
      </div>
    </footer>
  );
}
