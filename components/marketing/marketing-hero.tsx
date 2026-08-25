import Image from "next/image";
import Link from "next/link";
import styles from "@/app/marketing.module.css";
import { MarketingIcon } from "./marketing-icon";

export function MarketingHero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.container}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>LMS cho trung tâm đào tạo nhỏ và vừa</span>
            <h1 id="hero-title">Vận hành đào tạo <span>rõ ràng trong một nơi.</span></h1>
            <p className={styles.heroLead}>
              DX LMS kết nối người dùng, khóa học, ghi danh, bài tập và dashboard trong một workspace riêng cho từng tổ chức.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="#san-pham">
                Khám phá nền tảng <MarketingIcon name="arrowRight" />
              </a>
              <Link className={styles.secondaryButton} href="/login">Đăng nhập DX LMS</Link>
            </div>
            <ul className={styles.heroChecklist} aria-label="Năng lực chính">
              <li><MarketingIcon name="checkCircle" /> Multi-tenant</li>
              <li><MarketingIcon name="checkCircle" /> Phân quyền theo vai trò</li>
              <li><MarketingIcon name="checkCircle" /> Tùy biến theo tổ chức</li>
            </ul>
          </div>

          <div className={styles.heroVisual}>
            <ProductPreview />
            <figure className={styles.dolphinFigure}>
              <Image
                className={styles.dolphinImage}
                src="/graphics/dx-lms-dolphin-mascot.png"
                alt="Mascot cá heo 3D của DX LMS"
                width={1230}
                height={1278}
                sizes="(max-width: 390px) 44vw, (max-width: 680px) 36vw, (max-width: 900px) 28vw, 300px"
              />
              <figcaption>Hệ sinh thái DolphinX Studio</figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductPreview() {
  return (
    <div className={styles.previewWrap}>
      <div className={styles.previewNote}><span aria-hidden="true" /> Dữ liệu minh họa</div>
      <div className={styles.preview} role="img" aria-label="Minh họa dashboard DX LMS với người dùng, khóa học và bài tập">
        <div className={styles.previewTopbar}>
          <span className={styles.previewDots} aria-hidden="true"><i /><i /><i /></span>
          <span className={styles.previewOrg}>Trung tâm Minh Anh</span>
          <span className={styles.previewAvatar}>MA</span>
        </div>
        <div className={styles.previewBody}>
          <aside className={styles.previewSidebar} aria-hidden="true">
            <span className={styles.previewLogo}>DX</span>
            <i className={styles.previewNavActive}><MarketingIcon name="dashboard" /></i>
            <i><MarketingIcon name="team" /></i>
            <i><MarketingIcon name="book" /></i>
            <i><MarketingIcon name="fileDone" /></i>
          </aside>
          <div className={styles.previewContent}>
            <div className={styles.previewHeading}>
              <div><small>Tổng quan</small><strong>Chào buổi sáng, cô An</strong></div>
              <span>Học kỳ hiện tại</span>
            </div>
            <div className={styles.previewStats}>
              <article><span>Học viên</span><strong>128</strong><small>Đang hoạt động</small></article>
              <article><span>Khóa học</span><strong>12</strong><small>Đang triển khai</small></article>
              <article><span>Bài tập</span><strong>36</strong><small>Trong workspace</small></article>
            </div>
            <div className={styles.previewLower}>
              <article className={styles.chartCard}>
                <div><strong>Ghi danh theo khóa</strong><span>8 tuần</span></div>
                <div className={styles.chart} aria-hidden="true">
                  {[36, 54, 43, 68, 58, 78, 66, 88].map((height, index) => (
                    <i key={index} style={{ height: `${height}%` }} />
                  ))}
                </div>
              </article>
              <article className={styles.activityCard}>
                <strong>Hoạt động gần đây</strong>
                <ul>
                  <li><span className={styles.activityCyan}>K</span><div><b>Khóa Toán 8</b><small>Cập nhật nội dung</small></div></li>
                  <li><span className={styles.activityBlue}>B</span><div><b>Bài tập tuần 4</b><small>Đã giao cho lớp</small></div></li>
                  <li><span className={styles.activityIndigo}>N</span><div><b>Người dùng mới</b><small>Đã thêm vào tổ chức</small></div></li>
                </ul>
              </article>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
