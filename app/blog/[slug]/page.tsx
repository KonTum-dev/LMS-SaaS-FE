import type { Metadata } from "next";
import { notFound } from "next/navigation";
import styles from "@/app/marketing-v2.module.css";
import { ArticleCover } from "@/components/marketing/article-cover";
import { BlogCard, MarketingShell, SectionHeading } from "@/components/marketing/site";
import { getMarketingBlogPost, marketingBlogPosts, marketingBlogSlugs } from "@/lib/marketing-content";

export const dynamicParams = false;

export function generateStaticParams() {
  return marketingBlogSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = getMarketingBlogPost(slug);
  if (!post) return { title: "Không tìm thấy bài viết" };
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt, images: ["/marketing/og/dx-lms-og.svg"] },
  };
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = getMarketingBlogPost(slug);
  if (!post) notFound();
  const related = marketingBlogPosts.filter((item) => item.slug !== post.slug).slice(0, 3);

  return (
    <MarketingShell>
      <header className={`${styles.pageHero} ${styles.articleHero}`}>
        <div className={`${styles.container} ${styles.heroCopy}`} data-reveal>
          <span className={styles.badge}><i className={styles.badgeDot} />{post.category} · {post.readingTime}</span>
          <h1>{post.title}</h1>
          <p className={styles.pageHeroLead}>{post.excerpt}</p>
          <div className={styles.proofRow}><span>Đăng ngày {new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(new Date(`${post.publishedAt}T00:00:00Z`))}</span></div>
        </div>
      </header>
      <div className={styles.articleCover}><ArticleCover large post={post} /></div>
      <article className={styles.article}>
        <p className={styles.articleCallout}>Tóm tắt: {post.excerpt}</p>
        {post.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.points ? <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}
          </section>
        ))}
      </article>
      <section className={`${styles.section} ${styles.sectionTint}`} aria-labelledby="related-title">
        <div className={styles.container}>
          <SectionHeading eyebrow="Đọc tiếp" title="Các góc nhìn liên quan" id="related-title" />
          <div className={styles.relatedGrid}>{related.map((item) => <BlogCard post={item} key={item.slug} />)}</div>
        </div>
      </section>
    </MarketingShell>
  );
}
