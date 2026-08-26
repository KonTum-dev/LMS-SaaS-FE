import Image from "next/image";
import Link from "next/link";
import styles from "@/app/marketing.module.css";
import { MarketingIcon } from "./marketing-icon";

export function MarketingHero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title" data-section="hero">
      <div className={`${styles.container} ${styles.heroInner}`}>
        <div className={styles.heroCopy}>
          <span className={styles.heroKicker}>
            <span className={styles.kickerMark} aria-hidden="true">DX</span>
            LMS cho trung tâm đào tạo
          </span>
          <h1 id="hero-title">
            Một nơi để vận hành đào tạo <span>rõ ràng hơn.</span>
          </h1>
          <p>
            DX LMS kết nối người dùng, khóa học, ghi danh, bài tập và dashboard
            trong workspace riêng của từng tổ chức.
          </p>
          <div className={styles.heroActionRail}>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/login">
                Vào workspace <MarketingIcon name="arrowRight" />
              </Link>
              <a className={styles.secondaryButton} href="#gioi-thieu">
                Khám phá DX LMS
              </a>
            </div>
            <a className={styles.scrollCue} href="#gioi-thieu">
              <span aria-hidden="true" />
              Xem thêm
            </a>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.mosaicSquare} aria-hidden="true"><span>DX</span></div>
          <figure className={styles.dolphinFigure}>
            <Image
              className={styles.dolphinImage}
              src="/graphics/dx-lms-dolphin-mascot.png"
              alt="Mascot cá heo 3D của DX LMS"
              width={1230}
              height={1278}
              sizes="(max-width: 360px) 42vw, (max-width: 768px) 38vw, (max-width: 1050px) 28vw, 310px"
            />
            <figcaption>DolphinX Studio</figcaption>
          </figure>
          <div className={styles.mosaicPill} aria-hidden="true" />
          <WorkspacePreview />
          <div className={styles.mosaicDot} aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

function WorkspacePreview() {
  const modules = [
    { icon: "team" as const, label: "Người dùng" },
    { icon: "book" as const, label: "Khóa học" },
    { icon: "fileDone" as const, label: "Bài tập" },
  ];

  return (
    <div className={styles.previewWrap} aria-hidden="true">
      <div className={styles.previewTopbar}>
        <span className={styles.previewDots}><i /><i /><i /></span>
        <span>DX LMS · Workspace tổ chức</span>
        <span className={styles.previewAvatar}>DX</span>
      </div>
      <div className={styles.previewBody}>
        <aside className={styles.previewSidebar}>
          <span>DX</span>
          <i className={styles.previewNavActive}><MarketingIcon name="dashboard" /></i>
          <i><MarketingIcon name="team" /></i>
          <i><MarketingIcon name="book" /></i>
          <i><MarketingIcon name="fileDone" /></i>
        </aside>
        <div className={styles.previewContent}>
          <small>TỔNG QUAN</small>
          <strong>Workspace đào tạo</strong>
          <div className={styles.previewCards}>
            {modules.map((module) => (
              <span key={module.label}>
                <MarketingIcon name={module.icon} />
                <b>{module.label}</b>
                <i>Đang vận hành</i>
              </span>
            ))}
          </div>
          <div className={styles.previewRows}>
            <span><i /><b>Ghi danh theo khóa học</b></span>
            <span><i /><b>Vai trò trong tổ chức</b></span>
            <span><i /><b>Tùy biến workspace</b></span>
          </div>
        </div>
      </div>
    </div>
  );
}
