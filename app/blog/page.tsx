import type { Metadata } from "next";
import styles from "@/app/marketing-v2.module.css";
import { BlogExplorer } from "@/components/marketing/site-interactions";
import { MarketingShell, PageHero, SectionHeading } from "@/components/marketing/site";
import { marketingBlogPosts } from "@/lib/marketing-content";

export const metadata: Metadata = {
  title: "Bài viết",
  description: "Kiến thức nguyên bản về LMS, thiết kế học tập, quản trị trung tâm và công nghệ giáo dục.",
};

export default function BlogPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Góc nhìn từ DX LMS"
        line="Cánh cửa tới kiến thức"
        strong="và đổi mới giáo dục"
        lead="Các bài viết thực hành về cách thiết kế nội dung, theo dõi dữ liệu và xây một hệ thống học tập dễ vận hành."
        visual="blog"
        primaryHref="#danh-sach-bai-viet"
        primaryLabel="Khám phá bài viết"
      />
      <section className={styles.section} id="danh-sach-bai-viet" aria-labelledby="blog-grid-title">
        <div className={styles.container}>
          <SectionHeading eyebrow="Kiến thức mới" title="Khám phá những góc nhìn đang được quan tâm" copy="Lọc theo chủ đề hoặc tìm nhanh bằng tiêu đề và mô tả." id="blog-grid-title" />
          <BlogExplorer posts={marketingBlogPosts} />
        </div>
      </section>
    </MarketingShell>
  );
}
