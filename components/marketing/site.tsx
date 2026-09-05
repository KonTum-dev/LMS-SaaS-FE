"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { FeedbackLanguageSwitcher } from "@/components/feedback/feedback-locale";
import { marketingMessages } from "@/lib/i18n/marketing-messages";
import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { ArrowRightOutlined } from "@ant-design/icons";
import styles from "@/app/marketing-v2.module.css";
import { DxBrandLockup } from "@/components/brand/dx-brand-lockup";
import {
  marketingFaqItems,
  marketingFooterContent,
  marketingNavigation,
  marketingPricingTiers,
  type MarketingBlogPost,
} from "@/lib/marketing-content";
import { MarketingMotion } from "./marketing-motion";
import { ArticleCover } from "./article-cover";
import { EducationHeroScene } from "./education-hero-scene";
import { MarketingVisual, type MarketingVisualKind } from "./marketing-visuals";
import { PricingSelector, TestimonialCarousel } from "./site-interactions";

export function MarketingShell({
  children,
  includeNewsletter = true,
}: {
  children: ReactNode;
  includeNewsletter?: boolean;
}) {
  const { t } = useI18n(marketingMessages);
  return (
    <div className={styles.page} data-marketing-page id="top">
      <MarketingMotion />
      <a className={styles.skipLink} href="#noi-dung-chinh">
        {t("Chuyển đến nội dung chính")}
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
  const { t } = useI18n(marketingMessages);
  return (
    <div className={styles.headerWrap}>
      <header className={styles.header} data-marketing-header>
        <Link
          className={styles.logo}
          href="/"
          aria-label={t("DX LMS — Trang chủ")}
        >
          <DxBrandLockup className={styles.headerBrand} />
        </Link>
        <nav className={styles.nav} aria-label={t("Điều hướng chính")}>
          {marketingNavigation.items.map((item) => (
            <Link className={styles.navLink} href={item.href} key={item.href}>
              {t(item.label)}
            </Link>
          ))}
        </nav>
        <FeedbackLanguageSwitcher />
        <div className={styles.headerActions}>
          <Link
            className={styles.headerCta}
            href={marketingNavigation.entryCta.href}
          >
            {t(marketingNavigation.entryCta.label)}
          </Link>
        </div>
        <details
          className={styles.mobileMenu}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary aria-label={t("Mở menu")}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 7h14M5 12h14M5 17h14" />
            </svg>
          </summary>
          <nav
            className={styles.mobileMenuPanel}
            aria-label={t("Điều hướng di động")}
          >
            {marketingNavigation.items.map((item) => (
              <Link
                href={item.href}
                key={item.href}
                onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
              >
                {t(item.label)}
              </Link>
            ))}
          </nav>
        </details>
      </header>
    </div>
  );
}

export function MarketingFooter() {
  const { t } = useI18n(marketingMessages);
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerGrid}`}>
        <div className={styles.footerBrand}>
          <DxBrandLockup
            subtitle={t("Một sản phẩm của DolphinX Studio")}
          />
          <p>{t(marketingFooterContent.tagline)}</p>
        </div>
        {marketingFooterContent.groups.map((group) => (
          <nav
            className={styles.footerGroup}
            aria-label={t(group.title)}
            key={group.title}
          >
            <h3>{t(group.title)}</h3>
            {group.links.map((link) => (
              <Link href={link.href} key={link.href}>
                {t(link.label)}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className={`${styles.container} ${styles.footerBottom}`}>
        <span>
          © {new Date().getFullYear()}{" "}
          {t("DolphinX Studio. Bảo lưu mọi quyền.")}
        </span>
      </div>
    </footer>
  );
}

export function HomeHero() {
  const { t } = useI18n(marketingMessages);
  return (
    <>
      <section className={styles.hero} aria-labelledby="home-hero-title">
        <div className={`${styles.container} ${styles.heroLayout}`}>
          <div className={styles.heroCopy} data-reveal>
            <h1 id="home-hero-title">
              {t("Quản lý lớp học.")}
              <strong>
                {t("Nhẹ việc mỗi ngày.")}
              </strong>
            </h1>
            <p className={styles.heroLead}>
              {t(
                "Khóa học, học viên và học phí trong cùng một nơi. Để bạn dành nhiều thời gian hơn cho việc dạy và học.",
              )}
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.button} href="/register">
                {t("Bắt đầu miễn phí")}{" "}
                <ArrowRightOutlined aria-hidden />
              </Link>
              <Link className={styles.buttonGhost} href="/features">
                {t("Khám phá tính năng")}
              </Link>
            </div>
            <p className={styles.trialNote}>{t("Dùng thử 30 ngày · Không cần thẻ thanh toán")}</p>
          </div>
          <EducationHeroScene
            alt={t("Giáo viên hướng dẫn hai học sinh học cùng sách và máy tính")}
          />
        </div>
      </section>
    </>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  copy,
  align = "center",
  id,
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  align?: "center" | "left";
  id?: string;
}) {
  const { t } = useI18n(marketingMessages);
  return (
    <div
      className={
        align === "left" ? styles.sectionHeaderLeft : styles.sectionHeader
      }
      data-reveal
    >
      {eyebrow ? <span className={styles.eyebrow}>{t(eyebrow)}</span> : null}
      <h2 id={id}>{t(title)}</h2>
      {copy ? <p className={styles.sectionLead}>{t(copy)}</p> : null}
    </div>
  );
}

export function PageIntro({ title, lead }: { title: string; lead: string }) {
  const { t } = useI18n(marketingMessages);
  return <section className={styles.pageIntro}>
    <div className={styles.container}>
      <h1>{t(title)}</h1>
      <p>{t(lead)}</p>
    </div>
  </section>;
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
  const { t } = useI18n(marketingMessages);
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
      <div
        className={`${styles.container} ${styles.pageHeroInner} ${visualContent ? "" : styles.pageHeroInnerSolo}`}
      >
        <div className={styles.pageHeroCopy} data-reveal>
          <span className={styles.badge}>
            <i aria-hidden="true" className={styles.badgeDot} />
            {t(eyebrow)}
          </span>
          <h1>
            {t(line)}
            <strong className={styles.gradientText}> {t(strong)}</strong>
          </h1>
          <p className={styles.pageHeroLead}>{t(lead)}</p>
          <div className={`${styles.heroActions} ${styles.heroActionsStart}`}>
            <Link className={styles.button} href={primaryHref}>
              {t(primaryLabel)}
              <span className={styles.buttonIcon}>→</span>
            </Link>
            {secondaryHref && secondaryLabel ? (
              <Link className={styles.buttonSecondary} href={secondaryHref}>
                {t(secondaryLabel)}
              </Link>
            ) : null}
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

export function PricingSection({ compact = false, pageHeading = false }: { compact?: boolean; pageHeading?: boolean }) {
  const { t } = useI18n(marketingMessages);
  return (
    <section
      className={`${styles.section} ${pageHeading ? styles.pricingPage : ""}`}
      aria-labelledby="pricing-title"
    >
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          {pageHeading ? <h1 id="pricing-title">{t("Gói phù hợp với trung tâm của bạn.")}</h1> : <h2 id="pricing-title">{t("Gói phù hợp với trung tâm của bạn.")}</h2>}
          <p className={styles.sectionLead}>{t("Dùng thử 30 ngày. Nâng cấp khi bạn sẵn sàng.")}</p>
        </div>
        <PricingSelector tiers={marketingPricingTiers} />
        {!compact ? <details className={styles.pricingDetails}>
          <summary>{t("Cách tính học viên và so sánh chi tiết")}</summary>
          <p>{t("Mỗi học viên có tài khoản đang hoạt động trong tổ chức được tính vào hạn mức. Không tính theo số lượt đăng nhập.")}</p>
          <ComparisonTable />
        </details> : null}
      </div>
    </section>
  );
}

function ComparisonTable() {
  const { t } = useI18n(marketingMessages);
  const rows = [
    [
      "Giá theo tháng",
      "Miễn phí 30 ngày",
      "299.000đ",
      "799.000đ",
      "Theo phương án triển khai",
    ],
    ["Giá theo năm", "—", "2.990.000đ", "7.990.000đ", "Theo phương án"],
    [
      "Hạn mức kích hoạt đồng thời",
      "1.000 học viên",
      "1.000 học viên",
      "5.000 học viên",
      "Trên 5.000",
    ],
    ["Thông tin thẻ khi đăng ký", "Không cần", "—", "—", "—"],
    ["Khóa học & lớp học", "Có", "Có", "Có", "Theo phương án"],
    ["Cơ cấu đơn vị", "Có", "Có", "Có", "Theo phương án"],
  ];
  return (
    <div
      aria-label={t("Bảng so sánh các gói dịch vụ")}
      className={styles.comparison}
      data-reveal
      role="region"
      tabIndex={0}
    >
      <table>
        <caption className={styles.visuallyHidden}>
          {t("So sánh quyền lợi và hạn mức các gói DX LMS")}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t("Khả năng")}</th>
            <th scope="col">{t("Dùng thử")}</th>
            <th scope="col">Center</th>
            <th scope="col">Business</th>
            <th scope="col">Enterprise</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              <th scope="row">{t(row[0])}</th>
              {row.slice(1).map((cell, index) => (
                <td className={styles.checkCell} key={`${row[0]}-${index + 1}`}>
                  {t(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FaqSection() {
  const { t } = useI18n(marketingMessages);
  return (
    <section className={styles.section} aria-labelledby="faq-title">
      <div className={`${styles.container} ${styles.faqLayout}`}>
        <div className={styles.faqAside} data-reveal>
          <h2 id="faq-title">{t("Bạn cần biết thêm?")}</h2>
        </div>
        <div className={styles.faqList} data-reveal>
          {marketingFaqItems.map((item) => (
            <details
              className={styles.faqItem}
              key={item.id}
            >
              <summary>{t(item.question)}</summary>
              <p className={styles.faqAnswer}>{t(item.answer)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Testimonials() {
  const { t } = useI18n(marketingMessages);
  return (
    <section className={styles.section} aria-labelledby="testimonial-title">
      <div className={styles.container}>
        <SectionHeading
          eyebrow={t("Thiết kế xoay quanh vai trò")}
          title={t("Một hệ thống, bốn góc nhìn công việc")}
          copy={t(
            "Chọn một vai trò để xem mạch công việc, tín hiệu cần theo dõi và kết quả mà họ nhận được trong DX LMS.",
          )}
          id="testimonial-title"
        />
        <TestimonialCarousel />
      </div>
    </section>
  );
}

export function BlogCard({
  post,
  priority = false,
}: {
  post: MarketingBlogPost;
  priority?: boolean;
}) {
  const { t } = useI18n(marketingMessages);
  return (
    <article
      className={styles.blogCard}
      data-priority={priority || undefined}
      data-reveal
    >
      <Link
        href={`/blog/${post.slug}`}
        aria-label={t("Đọc {title}", { title: t(post.title) })}
      >
        <div className={styles.blogImageWrap}>
          <ArticleCover post={post} />
        </div>
        <div className={styles.blogBody}>
          <div className={styles.blogMeta}>
            <span>{t(post.category)}</span>
            <span>{t(post.readingTime)}</span>
          </div>
          <h3>{t(post.title)}</h3>
        </div>
      </Link>
    </article>
  );
}

function Newsletter() {
  const { t } = useI18n(marketingMessages);
  return (
    <section
      className={styles.newsletterSection}
      aria-labelledby="newsletter-title"
    >
      <div className={styles.container}>
        <div className={styles.newsletter} data-reveal>
          <div className={styles.newsletterContent}>
            <h2 id="newsletter-title">
              {t("Sẵn sàng cho lớp học đầu tiên?")}
            </h2>
            <p>
              {t(
                "Tạo không gian của bạn và bắt đầu dùng thử trong vài phút.",
              )}
            </p>
            <div className={styles.newsletterActions}>
              <Link className={styles.button} href="/register">
                {t("Bắt đầu miễn phí")} <ArrowRightOutlined aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
