import Image from "next/image";
import Link from "next/link";
import styles from "@/app/marketing.module.css";
import { MarketingIcon } from "./marketing-icon";

export function MarketingHero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title" data-section="hero">
      <div className={styles.heroBackdrop} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={`${styles.container} ${styles.heroInner}`}>
        <div className={styles.heroCopy} data-reveal>
          <span className={styles.heroKicker}>
            <span className={styles.kickerMark} aria-hidden="true"><i /></span>
            Từ một lớp học đến chuỗi trung tâm
          </span>
          <h1 id="hero-title">
            <span className={styles.headlineLine}>Một hệ thống cho mọi</span>{" "}
            <span className={styles.headlineGradient}>quy mô đào tạo.</span>
          </h1>
          <p>
            Một giáo viên có thể mở lớp và điểm danh ngay. Khi trung tâm lớn
            lên, DX LMS mở rộng cùng bạn với học phí, phụ huynh, đội ngũ và
            phân quyền theo từng chi nhánh.
          </p>
          <div className={styles.heroActionRail}>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/register">
                Tạo workspace dùng thử <MarketingIcon name="arrowRight" />
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
          <div className={styles.heroProof} aria-label="Điểm nổi bật của DX LMS">
            <span><MarketingIcon name="checkCircle" /> Lớp &amp; điểm danh</span>
            <span><MarketingIcon name="checkCircle" /> Học phí &amp; phụ huynh</span>
            <span><MarketingIcon name="checkCircle" /> Phân quyền chi nhánh</span>
          </div>
        </div>

        <div className={styles.heroVisual} data-hero-visual data-reveal>
          <div className={styles.visualGrid} aria-hidden="true" />
          <div className={styles.visualGlow} aria-hidden="true" />
          <div className={styles.mosaicSquare} aria-hidden="true">
            <strong>01</strong>
            <span>không gian chung</span>
          </div>
          <figure className={styles.dolphinFigure}>
            <Image
              className={styles.dolphinImage}
              src="/graphics/dx-lms-dolphin-mascot.png"
              alt="Mascot cá heo 3D của DX LMS"
              width={1230}
              height={1278}
              preload
              sizes="(max-width: 360px) 42vw, (max-width: 768px) 38vw, (max-width: 1050px) 28vw, 310px"
            />
            <figcaption><i aria-hidden="true" /> DolphinX · Linh vật DX LMS</figcaption>
          </figure>
          <div className={styles.mosaicPill} aria-hidden="true">
            <MarketingIcon name="checkCircle" />
            <span><small>Hệ thống</small><strong>Sẵn sàng sử dụng</strong></span>
          </div>
          <WorkspacePreview />
          <div className={styles.mosaicDot} aria-hidden="true" />
          <span className={`${styles.orbitTag} ${styles.orbitTagOne}`} aria-hidden="true">Khóa học</span>
          <span className={`${styles.orbitTag} ${styles.orbitTagTwo}`} aria-hidden="true">Ghi danh</span>
        </div>
      </div>
      <div className={styles.heroMarquee} aria-hidden="true">
        <div>
          <span>Lớp học linh hoạt</span><i />
          <span>Điểm danh theo buổi</span><i />
          <span>Học phí minh bạch</span><i />
          <span>Báo cáo theo chi nhánh</span><i />
          <span>Thông báo đúng người</span><i />
          <span>Lớp học linh hoạt</span><i />
          <span>Điểm danh theo buổi</span><i />
          <span>Học phí minh bạch</span><i />
          <span>Báo cáo theo chi nhánh</span><i />
          <span>Thông báo đúng người</span><i />
        </div>
      </div>
    </section>
  );
}

function WorkspacePreview() {
  const modules = [
    { icon: "team" as const, label: "Lớp học" },
    { icon: "book" as const, label: "Điểm danh" },
    { icon: "fileDone" as const, label: "Học phí" },
  ];

  return (
    <div className={styles.previewWrap} aria-hidden="true">
      <div className={styles.previewTopbar}>
        <span className={styles.previewDots}><i /><i /><i /></span>
        <span>DX LMS · Không gian tổ chức</span>
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
          <strong>Không gian đào tạo</strong>
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
            <span><i /><b>Lịch học theo từng lớp</b></span>
            <span><i /><b>Phụ huynh theo đúng học viên</b></span>
            <span><i /><b>Phạm vi theo từng chi nhánh</b></span>
          </div>
        </div>
      </div>
    </div>
  );
}
