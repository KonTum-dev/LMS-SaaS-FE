import { getServerI18n } from "@/lib/i18n/server";
import { marketingMessages } from "@/lib/i18n/marketing-messages";
import type { Metadata } from "next";
import styles from "@/app/marketing-v2.module.css";
import { BlogExplorer } from "@/components/marketing/site-interactions";
import {
  MarketingShell,
  PageIntro,
} from "@/components/marketing/site";
import { marketingBlogPosts } from "@/lib/marketing-content";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n(marketingMessages);
  return {
    title: t("Bài viết"),
    description: t(
      "Kiến thức nguyên bản về LMS, thiết kế học tập, quản trị trung tâm và công nghệ giáo dục.",
    ),
  };
}

export default async function BlogPage() {
  const { t } = await getServerI18n(marketingMessages);
  return (
    <MarketingShell>
      <PageIntro
        title={t("Góc học tập & vận hành")}
        lead={t(
          "Các bài viết thực hành về cách thiết kế nội dung, theo dõi dữ liệu và xây một hệ thống học tập dễ vận hành.",
        )}
      />
      <section
        className={styles.contentSection}
        id="danh-sach-bai-viet"
        aria-label={t("Bài viết")}
      >
        <div className={styles.container}>
          <BlogExplorer posts={marketingBlogPosts} />
        </div>
      </section>
    </MarketingShell>
  );
}
