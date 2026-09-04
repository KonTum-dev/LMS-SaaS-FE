import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import styles from "@/app/marketing-v2.module.css";
import { DxBrandLockup, DxBrandMark } from "@/components/brand/dx-brand-lockup";
import {
  marketingFaqItems,
  marketingFooterContent,
  marketingNavigation,
  marketingPricingTiers,
  type MarketingBlogPost,
} from "@/lib/marketing-content";
import { MarketingMotion } from "./marketing-motion";
import { ArticleCover } from "./article-cover";
import { MarketingVisual, type MarketingVisualKind } from "./marketing-visuals";
import {
  PricingSelector,
  TestimonialCarousel,
} from "./site-interactions";

export function MarketingShell({
  children,
  includeNewsletter = true,
}: {
  children: ReactNode;
  includeNewsletter?: boolean;
}) {
  return (
    <div className={styles.page} data-marketing-page id="top">
      <MarketingMotion />
      <a className={styles.skipLink} href="#noi-dung-chinh">
        Chuyển đến nội dung chính
      </a>
      <MarketingHeader />
      <main className={styles.main} id="noi-dung-chinh" tabIndex={-1}>
        {children}
      </main>
      {includeNewsletter ? <Newsletter /> : null}
      <MarketingFooter />
    </div>
  );
}

export function MarketingHeader() {
  return (
    <div className={styles.headerWrap}>
      <header className={styles.header} data-marketing-header>
        <Link className={styles.logo} href="/" aria-label="DX LMS — Trang chủ">
          <DxBrandLockup subtitle="Learning platform" />
        </Link>
        <nav className={styles.nav} aria-label="Điều hướng chính">
          {marketingNavigation.items.map((item) => (
            <Link className={styles.navLink} href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <Link className={styles.buttonGhost} href={marketingNavigation.secondaryCta.href}>
            {marketingNavigation.secondaryCta.label}
          </Link>
          <Link className={styles.headerCta} href={marketingNavigation.primaryCta.href}>
            {marketingNavigation.primaryCta.label}
          </Link>
        </div>
        <details className={styles.mobileMenu}>
          <summary aria-label="Mở menu">☰</summary>
          <nav className={styles.mobileMenuPanel} aria-label="Điều hướng di động">
            {marketingNavigation.items.map((item) => (
              <Link href={item.href} key={item.href}>{item.label}</Link>
            ))}
            <Link href="/login">Đăng nhập</Link>
            <Link href="/register">Dùng thử miễn phí</Link>
          </nav>
        </details>
      </header>
    </div>
  );
}

export function MarketingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerGrid}`}>
        <div className={styles.footerBrand}>
          <DxBrandLockup subtitle="by DolphinX Studio" variant="inverse" />
          <p>{marketingFooterContent.tagline}</p>
        </div>
        {marketingFooterContent.groups.map((group) => (
          <nav className={styles.footerGroup} aria-label={group.title} key={group.title}>
            <h3>{group.title}</h3>
            {group.links.map((link) => (
              <Link href={link.href} key={link.href}>{link.label}</Link>
            ))}
          </nav>
        ))}
      </div>
      <div className={`${styles.container} ${styles.footerBottom}`}>
        <span>© {new Date().getFullYear()} DolphinX Studio. Bảo lưu mọi quyền.</span>
        <span>{marketingFooterContent.note}</span>
      </div>
      <div className={styles.footerWord} aria-hidden="true">DX LMS</div>
    </footer>
  );
}

export function HomeHero() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="home-hero-title">
        <div className={`${styles.container} ${styles.heroCopy}`} data-reveal>
          <span className={styles.badge}>
            <i className={styles.badgeDot} aria-hidden="true" />
            Dùng thử đầy đủ trong 14 ngày
          </span>
          <h1 id="home-hero-title">
            Một nền tảng cho mọi lớp học.
            <strong className={styles.gradientText}>Lớn lên cùng trung tâm của bạn.</strong>
          </h1>
          <p className={styles.heroLead}>
            DX LMS kết nối khóa học, lớp, học viên, phụ huynh, học phí và báo cáo
            trong một workspace được phân quyền rõ ràng cho từng vai trò, từng chi nhánh.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.button} href="/register">
              Bắt đầu miễn phí <span className={styles.buttonIcon}>→</span>
            </Link>
            <Link className={styles.buttonSecondary} href="/features">Khám phá tính năng</Link>
          </div>
          <div className={styles.proofRow} aria-label="Cam kết dùng thử">
            <span className={styles.proofItem}><i className={styles.proofMark}>✓</i> Không cần thẻ thanh toán</span>
            <span className={styles.proofItem}><i className={styles.proofMark}>✓</i> Tự tạo workspace</span>
            <span className={styles.proofItem}><i className={styles.proofMark}>✓</i> Hủy bất cứ lúc nào</span>
          </div>
        </div>
        <HeroDashboard />
      </section>
      <CapabilityMarquee />
    </>
  );
}

function HeroDashboard() {
  return (
    <div className={styles.heroVisual} data-hero-visual data-reveal aria-label="Xem trước bảng điều khiển DX LMS">
      <div className={`${styles.floatingCard} ${styles.floatingOne}`} aria-hidden="true">
        <span className={styles.floatingIcon}>✓</span>
        <span><strong>Điểm danh nhanh</strong><small>Đúng lớp · đúng buổi</small></span>
      </div>
      <div className={`${styles.floatingCard} ${styles.floatingTwo}`} aria-hidden="true">
        <span className={styles.floatingIcon}>↗</span>
        <span><strong>Tiến độ rõ ràng</strong><small>Theo học viên &amp; khóa học</small></span>
      </div>
      <div className={`${styles.floatingCard} ${styles.floatingThree}`} aria-hidden="true">
        <span className={styles.floatingIcon}>₫</span>
        <span><strong>Học phí</strong><small>Đối soát theo trạng thái</small></span>
      </div>
      <div className={styles.dashboard}>
        <div className={styles.dashboardTop}>
          <span className={styles.windowDots}><i /><i /><i /></span>
          <span>DX LMS · Workspace trung tâm</span>
          <span>Quản trị viên</span>
        </div>
        <div className={styles.dashboardBody}>
          <aside className={styles.dashboardSide} aria-hidden="true">
            <strong><DxBrandMark /></strong><i /><i /><i /><i /><i />
          </aside>
          <div className={styles.dashboardContent}>
            <div className={styles.dashHeading}>
              <div><span>TỔNG QUAN HÔM NAY</span><strong>Xin chào, quản trị viên</strong></div>
              <span className={styles.dashFilter}>Toàn tổ chức</span>
            </div>
            <div className={styles.dashStats}>
              {[
                ["Lớp đang hoạt động", "12", "84%"],
                ["Học viên", "248", "66%"],
                ["Buổi học tuần này", "36", "92%"],
              ].map(([label, value, width]) => (
                <div className={styles.dashCard} key={label}>
                  <small>{label}</small><strong>{value}</strong>
                  <span className={styles.dashProgress}><i style={{ width }} /></span>
                </div>
              ))}
            </div>
            <div className={styles.dashGrid}>
              <div className={styles.dashChart}>
                <small>HOẠT ĐỘNG HỌC TẬP</small>
                <div className={styles.chartBars} aria-hidden="true">
                  {[42, 67, 53, 81, 62, 88, 74, 95].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
                </div>
              </div>
              <div className={styles.dashList}>
                <small>VIỆC CẦN LÀM</small>
                <span>Phê duyệt ghi danh</span>
                <span>Đối soát học phí</span>
                <span>Xem báo cáo tuần</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CapabilityMarquee() {
  const labels = ["Khóa học", "Lớp & điểm danh", "Bài tập", "Kiểm tra", "Phụ huynh", "Học phí", "Chi nhánh", "Báo cáo", "Thông báo"];
  const duplicated = [...labels, ...labels];
  return (
    <div className={styles.marquee} aria-label="Các năng lực chính">
      <div className={styles.marqueeTrack}>
        {duplicated.map((label, index) => (
          <span aria-hidden={index >= labels.length || undefined} className={styles.marqueeItem} key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  copy,
  align = "center",
  id,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  align?: "center" | "left";
  id?: string;
}) {
  return (
    <div className={align === "left" ? styles.sectionHeaderLeft : styles.sectionHeader} data-reveal>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h2 id={id}>{title}</h2>
      {copy ? <p className={styles.sectionLead}>{copy}</p> : null}
    </div>
  );
}

export function PageHero({
  eyebrow,
  line,
  strong,
  lead,
  primaryHref = "/register",
  primaryLabel = "Dùng thử miễn phí",
  secondaryHref,
  secondaryLabel,
  image,
  imageAlt = "",
  visual,
}: {
  eyebrow: string;
  line: string;
  strong: string;
  lead: string;
  image?: string;
  imageAlt?: string;
  visual?: MarketingVisualKind;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  const visualContent = image ? (
    <Image
      alt={imageAlt}
      height={900}
      preload
      sizes="(max-width: 809px) calc(100vw - 32px), 42vw"
      src={image}
      style={{ height: "auto" }}
      width={900}
    />
  ) : visual ? (
    <MarketingVisual kind={visual} />
  ) : null;

  return (
    <section className={styles.pageHero} data-visual={visual}>
      <div className={`${styles.container} ${styles.pageHeroInner} ${visualContent ? "" : styles.pageHeroInnerSolo}`}>
        <div className={styles.pageHeroCopy} data-reveal>
          <span className={styles.badge}><i aria-hidden="true" className={styles.badgeDot} />{eyebrow}</span>
          <h1>{line}<strong className={styles.gradientText}> {strong}</strong></h1>
          <p className={styles.pageHeroLead}>{lead}</p>
          <div className={`${styles.heroActions} ${styles.heroActionsStart}`}>
            <Link className={styles.button} href={primaryHref}>{primaryLabel}<span className={styles.buttonIcon}>→</span></Link>
            {secondaryHref && secondaryLabel ? <Link className={styles.buttonSecondary} href={secondaryHref}>{secondaryLabel}</Link> : null}
          </div>
        </div>
        {visualContent ? (
          <div className={styles.pageHeroVisual} data-reveal>
            {visualContent}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function PricingSection({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`${styles.section} ${styles.sectionTint}`} aria-labelledby="pricing-title">
      <div className={styles.container}>
        <SectionHeading
          eyebrow="Gói dịch vụ linh hoạt"
          title="Bắt đầu miễn phí, mở rộng theo đúng nhu cầu"
          copy="Không hiển thị một mức giá giả định. DX LMS cấu hình mô-đun và hạn mức theo quy mô vận hành thực tế của trung tâm."
          id="pricing-title"
        />
        <PricingSelector tiers={marketingPricingTiers} />
        {!compact ? <ComparisonTable /> : null}
      </div>
    </section>
  );
}

function ComparisonTable() {
  const rows = [
    ["Tạo workspace", "Có", "Có", "Có"],
    ["Khóa học & lớp học", "Theo gói trial", "Theo cấu hình", "Theo cấu hình"],
    ["Vai trò học tập", "Có", "Có", "Có"],
    ["Học phí & báo cáo", "Theo gói trial", "Tùy chọn", "Tùy chọn"],
    ["Cơ cấu chi nhánh", "Theo gói trial", "Tùy chọn", "Có"],
    ["Tư vấn triển khai", "Tài liệu", "Trao đổi", "Theo lộ trình"],
  ];
  return (
    <div className={styles.comparison} data-reveal>
      <table>
        <thead><tr><th>Khả năng</th><th>Dùng thử</th><th>Center</th><th>Enterprise</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>{row.map((cell, index) => <td className={index ? styles.checkCell : undefined} key={`${row[0]}-${index}`}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FaqSection() {
  return (
    <section className={styles.section} aria-labelledby="faq-title">
      <div className={`${styles.container} ${styles.faqLayout}`}>
        <div className={styles.faqAside} data-reveal>
          <span className={styles.eyebrow}>Câu hỏi thường gặp</span>
          <h2 id="faq-title">Mọi điều cần biết trước khi bắt đầu</h2>
          <p className={styles.sectionLead}>Thông tin dưới đây mô tả đúng luồng dùng thử, phân quyền và trạng thái dịch vụ hiện có.</p>
          <div className={styles.questionCard}>
            <strong>Vẫn còn câu hỏi?</strong>
            <p>Gửi nhu cầu vận hành của bạn để đội ngũ tư vấn phản hồi theo đúng bối cảnh trung tâm.</p>
            <Link className={styles.buttonSecondary} href="/contact-us">Liên hệ DX LMS</Link>
          </div>
        </div>
        <div className={styles.faqList} data-reveal>
          {marketingFaqItems.map((item, index) => (
            <details className={styles.faqItem} key={item.id} open={index === 0 ? true : undefined}>
              <summary>{item.question}</summary>
              <p className={styles.faqAnswer}>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Testimonials() {
  return (
    <section className={styles.section} aria-labelledby="testimonial-title">
      <div className={styles.container}>
        <SectionHeading
          eyebrow="Thiết kế xoay quanh vai trò"
          title="Một hệ thống, bốn góc nhìn công việc"
          copy="Chọn một vai trò để xem mạch công việc, tín hiệu cần theo dõi và kết quả mà họ nhận được trong DX LMS."
          id="testimonial-title"
        />
        <TestimonialCarousel />
      </div>
    </section>
  );
}

export function BlogCard({ post, priority = false }: { post: MarketingBlogPost; priority?: boolean }) {
  return (
    <article className={styles.blogCard} data-priority={priority || undefined} data-reveal>
      <Link href={`/blog/${post.slug}`} aria-label={`Đọc ${post.title}`}>
        <div className={styles.blogImageWrap}>
          <ArticleCover post={post} />
        </div>
        <div className={styles.blogBody}>
          <div className={styles.blogMeta}><span>{post.category}</span><span>{post.readingTime}</span></div>
          <h3>{post.title}</h3>
          <p>{post.excerpt}</p>
        </div>
      </Link>
    </article>
  );
}

function Newsletter() {
  return (
    <section className={styles.newsletterSection} aria-labelledby="newsletter-title">
      <div className={styles.container}>
        <div className={styles.newsletter} data-reveal>
          <span className={`${styles.newsletterArt} ${styles.newsletterArtLeft}`} aria-hidden="true" />
          <span className={`${styles.newsletterArt} ${styles.newsletterArtRight}`} aria-hidden="true" />
          <div className={styles.newsletterContent}>
            <span className={styles.eyebrow}>Cập nhật sản phẩm</span>
            <h2 id="newsletter-title">Nhận hướng dẫn vận hành LMS hữu ích</h2>
            <p>Khám phá bài viết mới hoặc tạo workspace dùng thử để nhận các cập nhật sản phẩm trực tiếp trong ứng dụng.</p>
            <div className={styles.newsletterActions}>
              <Link className={styles.button} href="/blog">Xem bài viết</Link>
              <Link className={styles.buttonSecondary} href="/register">Tạo workspace</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
