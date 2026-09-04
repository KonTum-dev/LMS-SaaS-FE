import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/app/marketing-v2.module.css";
import { MarketingVisual } from "@/components/marketing/marketing-visuals";
import { MarketingShell, PageHero, SectionHeading, Testimonials } from "@/components/marketing/site";
import { marketingCapabilityMetrics } from "@/lib/marketing-content";

export const metadata: Metadata = {
  title: "Về DX LMS",
  description: "Câu chuyện và nguyên tắc thiết kế của nền tảng quản lý đào tạo đa tổ chức DX LMS.",
};

export default function AboutPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Xây cho giáo dục Việt Nam"
        line="Học, phát triển và"
        strong="vận hành bền vững cùng DX LMS"
        lead="Chúng tôi xây một nền tảng có thể bắt đầu đủ nhẹ cho lớp nhỏ và đủ chặt chẽ cho tổ chức nhiều chi nhánh."
        visual="about"
        primaryHref="/pricing"
        primaryLabel="Xem phương án triển khai"
      />
      <section className={styles.section} aria-labelledby="story-title">
        <div className={styles.container}>
          <SectionHeading
            eyebrow="Từ nhu cầu thật đến sản phẩm"
            title="Biến những mảnh vận hành rời rạc thành một dòng dữ liệu"
            copy="Lớp học, điểm danh, học phí và báo cáo không nên sống ở bốn hệ thống khác nhau."
            id="story-title"
          />
          <div className={styles.storyGrid}>
            <article className={`${styles.storyCard} ${styles.storyCardWide}`} data-reveal>
              <div className={styles.storyMedia}><MarketingVisual kind="features" /></div>
              <div className={styles.storyCopy}><h3>Một workspace, một ngữ cảnh chung</h3><p>DX LMS kết nối nội dung học, lớp triển khai, người tham gia và vận hành tài chính. Dữ liệu chỉ xuất hiện cho người có đúng vai trò và phạm vi.</p><Link className={styles.button} href="/features">Khám phá tính năng <span className={styles.buttonIcon}>→</span></Link></div>
            </article>
            <article className={styles.storyCard} data-reveal><h3>Nhẹ khi bắt đầu</h3><p>Không ép lớp nhỏ dựng cây tổ chức hay quy trình phức tạp trước khi thật sự cần.</p></article>
            <article className={styles.storyCard} data-reveal><h3>Rõ khi mở rộng</h3><p>Vai trò, tenant, mô-đun và chi nhánh được mô hình hóa riêng để kiểm soát đúng trách nhiệm.</p></article>
            <article className={styles.storyCard} data-reveal><h3>Trung thực về trạng thái</h3><p>Thao tác thành công, thất bại, đang chờ hay chỉ đọc đều phải được thông báo rõ ràng.</p></article>
            <article className={styles.storyCard} data-reveal><h3>Dữ liệu có ngữ cảnh</h3><p>Mọi con số luôn đi kèm nguồn, phạm vi và thời điểm để người vận hành biết chính xác mình đang nhìn điều gì.</p></article>
          </div>
          <div className={styles.metrics} data-reveal>
            {marketingCapabilityMetrics.map((metric) => <div className={styles.metric} key={metric.id}><strong>{metric.value}</strong><span>{metric.label}</span><p>{metric.description}</p></div>)}
          </div>
        </div>
      </section>
      <Testimonials />
    </MarketingShell>
  );
}
