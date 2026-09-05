"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { marketingMessages } from "@/lib/i18n/marketing-messages";
import Image from "next/image";
import Link from "next/link";
import styles from "@/app/marketing.module.css";
import { MarketingIcon } from "./marketing-icon";

export function MarketingHero() {
  const { t } = useI18n(marketingMessages);
  return (
    <section
      className={styles.hero}
      aria-labelledby="hero-title"
      data-section="hero"
    >
      <div className={styles.heroBackdrop} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={`${styles.container} ${styles.heroInner}`}>
        <div className={styles.heroCopy} data-reveal>
          <span className={styles.heroKicker}>
            <span className={styles.kickerMark} aria-hidden="true">
              <i />
            </span>
            {t("Từ một lớp học đến chuỗi trung tâm")}
          </span>
          <h1 id="hero-title">
            <span className={styles.headlineLine}>
              {t("Một hệ thống cho mọi")}
            </span>{" "}
            <span className={styles.headlineGradient}>
              {t("quy mô đào tạo.")}
            </span>
          </h1>
          <p>
            {t(
              "Một giáo viên có thể mở lớp và điểm danh ngay. Khi trung tâm lớn lên, DX LMS mở rộng cùng bạn với học phí, phụ huynh, đội ngũ và phân quyền theo từng chi nhánh.",
            )}
          </p>
          <div className={styles.heroActionRail}>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/register">
                {t("Tạo workspace dùng thử")}{" "}
                <MarketingIcon name="arrowRight" />
              </Link>
              <a className={styles.secondaryButton} href="#gioi-thieu">
                {t("Khám phá DX LMS")}
              </a>
            </div>
            <a className={styles.scrollCue} href="#gioi-thieu">
              <span aria-hidden="true" />
              {t("Xem thêm")}
            </a>
          </div>
          <div
            className={styles.heroProof}
            aria-label={t("Điểm nổi bật của DX LMS")}
          >
            <span>
              <MarketingIcon name="checkCircle" /> {t("Lớp & điểm danh")}
            </span>
            <span>
              <MarketingIcon name="checkCircle" /> {t("Học phí & phụ huynh")}
            </span>
            <span>
              <MarketingIcon name="checkCircle" /> {t("Phân quyền chi nhánh")}
            </span>
          </div>
        </div>

        <div className={styles.heroVisual} data-hero-visual data-reveal>
          <div className={styles.visualGrid} aria-hidden="true" />
          <div className={styles.visualGlow} aria-hidden="true" />
          <div className={styles.mosaicSquare} aria-hidden="true">
            <strong>01</strong>
            <span>{t("không gian chung")}</span>
          </div>
          <figure className={styles.dolphinFigure}>
            <Image
              className={styles.dolphinImage}
              src="/graphics/dx-lms-dolphin-mascot.png"
              alt={t("Mascot cá heo 3D của DX LMS")}
              width={1230}
              height={1278}
              preload
              sizes="(max-width: 360px) 42vw, (max-width: 768px) 38vw, (max-width: 1050px) 28vw, 310px"
            />
            <figcaption>
              <i aria-hidden="true" /> {t("DolphinX · Linh vật DX LMS")}
            </figcaption>
          </figure>
          <div className={styles.mosaicPill} aria-hidden="true">
            <MarketingIcon name="checkCircle" />
            <span>
              <small>{t("Hệ thống")}</small>
              <strong>{t("Sẵn sàng sử dụng")}</strong>
            </span>
          </div>
          <WorkspacePreview />
          <div className={styles.mosaicDot} aria-hidden="true" />
          <span
            className={`${styles.orbitTag} ${styles.orbitTagOne}`}
            aria-hidden="true"
          >
            {t("Khóa học")}
          </span>
          <span
            className={`${styles.orbitTag} ${styles.orbitTagTwo}`}
            aria-hidden="true"
          >
            {t("Ghi danh")}
          </span>
        </div>
      </div>
      <div className={styles.heroMarquee} aria-hidden="true">
        <div>
          <span>{t("Lớp học linh hoạt")}</span>
          <i />
          <span>{t("Điểm danh theo buổi")}</span>
          <i />
          <span>{t("Học phí minh bạch")}</span>
          <i />
          <span>{t("Báo cáo theo chi nhánh")}</span>
          <i />
          <span>{t("Thông báo đúng người")}</span>
          <i />
          <span>{t("Lớp học linh hoạt")}</span>
          <i />
          <span>{t("Điểm danh theo buổi")}</span>
          <i />
          <span>{t("Học phí minh bạch")}</span>
          <i />
          <span>{t("Báo cáo theo chi nhánh")}</span>
          <i />
          <span>{t("Thông báo đúng người")}</span>
          <i />
        </div>
      </div>
    </section>
  );
}

function WorkspacePreview() {
  const { t } = useI18n(marketingMessages);
  const modules = [
    { icon: "team" as const, label: "Lớp học" },
    { icon: "book" as const, label: "Điểm danh" },
    { icon: "fileDone" as const, label: "Học phí" },
  ];

  return (
    <div className={styles.previewWrap} aria-hidden="true">
      <div className={styles.previewTopbar}>
        <span className={styles.previewDots}>
          <i />
          <i />
          <i />
        </span>
        <span>{t("DX LMS · Không gian tổ chức")}</span>
        <span className={styles.previewAvatar}>DX</span>
      </div>
      <div className={styles.previewBody}>
        <aside className={styles.previewSidebar}>
          <span>DX</span>
          <i className={styles.previewNavActive}>
            <MarketingIcon name="dashboard" />
          </i>
          <i>
            <MarketingIcon name="team" />
          </i>
          <i>
            <MarketingIcon name="book" />
          </i>
          <i>
            <MarketingIcon name="fileDone" />
          </i>
        </aside>
        <div className={styles.previewContent}>
          <small>{t("TỔNG QUAN")}</small>
          <strong>{t("Không gian đào tạo")}</strong>
          <div className={styles.previewCards}>
            {modules.map((module) => (
              <span key={module.label}>
                <MarketingIcon name={module.icon} />
                <b>{t(module.label)}</b>
                <i>{t("Đang vận hành")}</i>
              </span>
            ))}
          </div>
          <div className={styles.previewRows}>
            <span>
              <i />
              <b>{t("Lịch học theo từng lớp")}</b>
            </span>
            <span>
              <i />
              <b>{t("Phụ huynh theo đúng học viên")}</b>
            </span>
            <span>
              <i />
              <b>{t("Phạm vi theo từng chi nhánh")}</b>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
