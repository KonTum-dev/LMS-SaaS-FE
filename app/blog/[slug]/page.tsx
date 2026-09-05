import { getServerI18n } from "@/lib/i18n/server";
import { marketingMessages } from "@/lib/i18n/marketing-messages";
import { formatDate } from "@/lib/i18n/translate";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import styles from "@/app/marketing-v2.module.css";
import { ArticleCover } from "@/components/marketing/article-cover";
import {
  BlogCard,
  MarketingShell,
  SectionHeading,
} from "@/components/marketing/site";
import {
  getMarketingBlogPost,
  marketingBlogPosts,
  marketingBlogSlugs,
} from "@/lib/marketing-content";

export const dynamicParams = false;

export function generateStaticParams() {
  return marketingBlogSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { t, locale } = await getServerI18n(marketingMessages);
  const { slug } = await params;
  const post = getMarketingBlogPost(slug);
  if (!post) return { title: t("Không tìm thấy bài viết") };
  return {
    title: t(post.title),
    description: t(post.excerpt),
    openGraph: {
      title: t(post.title),
      description: t(post.excerpt),
      locale: locale === "vi" ? "vi_VN" : "en_US",
      images: ["/marketing/og/dx-lms-og.svg"],
    },
  };
}

export default async function BlogPostPage({
  params,
}: PageProps<"/blog/[slug]">) {
  const { t, locale } = await getServerI18n(marketingMessages);
  const { slug } = await params;
  const post = getMarketingBlogPost(slug);
  if (!post) notFound();
  const related = marketingBlogPosts
    .filter((item) => item.slug !== post.slug)
    .slice(0, 3);

  return (
    <MarketingShell>
      <header className={`${styles.pageHero} ${styles.articleHero}`}>
        <div className={`${styles.container} ${styles.heroCopy}`} data-reveal>
          <span className={styles.articleMeta}>
            {t(post.category)} · {t(post.readingTime)}
          </span>
          <h1>{t(post.title)}</h1>
          <p className={styles.pageHeroLead}>{t(post.excerpt)}</p>
          <div className={styles.proofRow}>
            <span>
              {t("Đăng ngày")}{" "}
              {formatDate(`${post.publishedAt}T00:00:00Z`, locale, {
                dateStyle: "long",
                timeZone: "UTC",
              })}
            </span>
          </div>
        </div>
      </header>
      <div className={styles.articleCover}>
        <ArticleCover large post={post} />
      </div>
      <article className={styles.article}>
        {post.sections.map((section) => (
          <section key={section.heading}>
            <h2>{t(section.heading)}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{t(paragraph)}</p>
            ))}
            {section.points ? (
              <ul>
                {section.points.map((point) => (
                  <li key={point}>{t(point)}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </article>
      <section
        className={`${styles.section} ${styles.sectionTint}`}
        aria-labelledby="related-title"
      >
        <div className={styles.container}>
          <SectionHeading
            title={t("Các góc nhìn liên quan")}
            id="related-title"
          />
          <div className={styles.relatedGrid}>
            {related.map((item) => (
              <BlogCard post={item} key={item.slug} />
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
