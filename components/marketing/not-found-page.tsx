"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { marketingMessages } from "@/lib/i18n/marketing-messages";
import Link from "next/link";
import styles from "@/app/marketing-v2.module.css";
import { MarketingShell } from "./site";

export function NotFoundMarketingPage() {
  const { t } = useI18n(marketingMessages);
  return (
    <MarketingShell includeNewsletter={false}>
      <section className={styles.notFound}>
        <div className={styles.notFoundInner}>
          <div>
            <div className={styles.notFoundCode}>404</div>
            <h1>{t("Khoan đã, trang này không còn ở đây")}</h1>
            <p>
              {t(
                "Đường dẫn có thể đã được chuyển hoặc không tồn tại. Bạn có thể quay về trang chủ, xem tính năng hoặc mô tả điều mình đang tìm.",
              )}
            </p>
            <div
              className={styles.heroActions}
              style={{ justifyContent: "flex-start" }}
            >
              <Link className={styles.button} href="/">
                {t("Về trang chủ")} <span className={styles.buttonIcon}>→</span>
              </Link>
              <Link className={styles.buttonSecondary} href="/contact-us">
                {t("Liên hệ")}
              </Link>
            </div>
          </div>
          <nav
            className={styles.notFoundVisual}
            aria-label={t("Các lối đi gợi ý")}
          >
            <span className={styles.routeOrigin}>
              <i>404</i>
              <strong>{t("Đường dẫn hiện tại")}</strong>
              <small>{t("Không tìm thấy nội dung")}</small>
            </span>
            <span className={styles.routeLine} aria-hidden="true" />
            <div className={styles.routeDestinations}>
              <Link href="/">
                <i>01</i>
                <span>
                  <strong>{t("Trang chủ")}</strong>
                  <small>{t("Tổng quan DX LMS")}</small>
                </span>
                <b>→</b>
              </Link>
              <Link href="/features">
                <i>02</i>
                <span>
                  <strong>{t("Tính năng")}</strong>
                  <small>{t("Xem các mô-đun")}</small>
                </span>
                <b>→</b>
              </Link>
              <Link href="/contact-us">
                <i>03</i>
                <span>
                  <strong>{t("Liên hệ")}</strong>
                  <small>{t("Mô tả điều bạn cần")}</small>
                </span>
                <b>→</b>
              </Link>
            </div>
          </nav>
        </div>
      </section>
    </MarketingShell>
  );
}
