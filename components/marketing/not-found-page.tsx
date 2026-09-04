import Link from "next/link";
import styles from "@/app/marketing-v2.module.css";
import { MarketingShell } from "./site";

export function NotFoundMarketingPage() {
  return (
    <MarketingShell includeNewsletter={false}>
      <section className={styles.notFound}>
        <div className={styles.notFoundInner}>
          <div><div className={styles.notFoundCode}>404</div><h1>Khoan đã, trang này không còn ở đây</h1><p>Đường dẫn có thể đã được chuyển hoặc không tồn tại. Bạn có thể quay về trang chủ, xem tính năng hoặc mô tả điều mình đang tìm.</p><div className={styles.heroActions} style={{ justifyContent: "flex-start" }}><Link className={styles.button} href="/">Về trang chủ <span className={styles.buttonIcon}>→</span></Link><Link className={styles.buttonSecondary} href="/contact-us">Liên hệ</Link></div></div>
          <nav className={styles.notFoundVisual} aria-label="Các lối đi gợi ý">
            <span className={styles.routeOrigin}><i>404</i><strong>Đường dẫn hiện tại</strong><small>Không tìm thấy nội dung</small></span>
            <span className={styles.routeLine} aria-hidden="true" />
            <div className={styles.routeDestinations}>
              <Link href="/"><i>01</i><span><strong>Trang chủ</strong><small>Tổng quan DX LMS</small></span><b>→</b></Link>
              <Link href="/features"><i>02</i><span><strong>Tính năng</strong><small>Xem các mô-đun</small></span><b>→</b></Link>
              <Link href="/contact-us"><i>03</i><span><strong>Liên hệ</strong><small>Mô tả điều bạn cần</small></span><b>→</b></Link>
            </div>
          </nav>
        </div>
      </section>
    </MarketingShell>
  );
}
