import Link from "next/link";
import styles from "@/app/marketing-v2.module.css";
import {
  marketingBenefits,
  marketingBlogPosts,
  marketingCapabilityMetrics,
  marketingOnboardingSteps,
} from "@/lib/marketing-content";
import { EcosystemFlow } from "./ecosystem-flow";
import { FeatureExplorer } from "./feature-explorer";
import { MarketingIcon } from "./marketing-icon";
import { MarketingVisual } from "./marketing-visuals";
import { BlogCard, FaqSection, PricingSection, SectionHeading, Testimonials } from "./site";

export function FeatureOverview() {
  return (
    <section className={styles.section} aria-labelledby="feature-overview-title">
      <div className={styles.container}>
        <SectionHeading
          eyebrow="Thông minh · Gọn · Có chiều sâu"
          title="Một LMS mạnh mẽ nhưng không làm công việc trở nên nặng nề"
          copy="Bắt đầu từ những luồng dùng mỗi ngày và mở rộng thành hệ thống quản trị đa tổ chức khi bạn cần."
          id="feature-overview-title"
        />
        <FeatureExplorer compact />
        <div className={styles.heroActions}>
          <Link className={styles.buttonSecondary} href="/features">Xem toàn bộ tính năng</Link>
        </div>
      </div>
    </section>
  );
}

export function GettingStartedSteps() {
  return (
    <section className={`${styles.section} ${styles.sectionTint}`} aria-labelledby="steps-title">
      <div className={styles.container}>
        <SectionHeading
          eyebrow="Bắt đầu trong 3 bước"
          title="Từ đăng ký đến lớp học đầu tiên"
          copy="Mỗi workspace mới nhận kỳ dùng thử một lần; không cần nhập thông tin thanh toán."
          id="steps-title"
        />
        <div className={styles.steps}>
          {marketingOnboardingSteps.map((step, index) => (
            <article className={styles.stepCard} data-reveal key={step.id}>
              <span className={styles.stepNumber}>0{step.step}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <Link className={styles.buttonGhost} href={step.href}>Xem bước này →</Link>
              {index < marketingOnboardingSteps.length - 1 ? <i className={styles.stepLine} aria-hidden="true" /> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Benefits() {
  return (
    <section className={`${styles.section} ${styles.sectionDark}`} aria-labelledby="benefits-title">
      <div className={styles.container}>
        <SectionHeading
          eyebrow="Giá trị vận hành"
          title="Gọn cho hôm nay. Vững cho ngày mai."
          copy="DX LMS giữ một nguồn dữ liệu nhưng tạo đúng góc nhìn cho mỗi người tham gia quá trình đào tạo."
          id="benefits-title"
        />
        <div className={styles.benefitGrid}>
          {marketingBenefits.map((benefit, index) => (
            <article className={styles.benefitCard} data-reveal key={benefit.id}>
              <span className={styles.benefitIcon}>
                {[
                  <MarketingIcon key="secure" name="safety" />,
                  <MarketingIcon key="team" name="team" />,
                  <MarketingIcon key="scale" name="apartment" />,
                  <MarketingIcon key="report" name="barChart" />,
                ][index]}
              </span>
              <h3>{benefit.title}</h3>
              <p>{benefit.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProductStory() {
  return (
    <section className={styles.section} aria-labelledby="story-title">
      <div className={styles.container}>
        <div className={styles.split}>
          <div className={styles.mediaCard} data-reveal>
            <MarketingVisual kind="about" />
          </div>
          <div className={styles.splitCopy} data-reveal>
            <span className={styles.eyebrow}>Cánh cửa tới vận hành thông minh</span>
            <h2 id="story-title">Mở rộng mà không phải thay hệ thống</h2>
            <p>Một giáo viên có thể dùng DX LMS cho lớp riêng. Khi tổ chức lớn lên, cùng dữ liệu đó có thể được tổ chức theo phòng ban, chi nhánh và phạm vi quản trị.</p>
            <ul className={styles.checkList}>
              <li>Không bắt buộc dựng cơ cấu phức tạp khi mới bắt đầu</li>
              <li>Phân quyền theo vai trò, mô-đun và đơn vị</li>
              <li>Trạng thái thuê bao và quyền ghi được thể hiện rõ</li>
            </ul>
            <Link className={styles.button} href="/about-us">Tìm hiểu DX LMS <span className={styles.buttonIcon}>→</span></Link>
          </div>
        </div>
        <div className={styles.metrics} data-reveal>
          {marketingCapabilityMetrics.map((metric) => (
            <div className={styles.metric} key={metric.id}>
              <strong>{metric.value}</strong><span>{metric.label}</span><p>{metric.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Integrations() {
  return (
    <section className={`${styles.section} ${styles.sectionTint}`} aria-labelledby="integration-title">
      <div className={styles.container}>
        <SectionHeading
          eyebrow="Sẵn sàng tích hợp"
          title="Kết nối các mảnh ghép thật sự có trong hệ thống"
          copy="Từ xác thực, thanh toán đến nhập dữ liệu và webhook — tất cả đều đi qua lớp bảo mật, tenant và trạng thái rõ ràng."
          id="integration-title"
        />
        <div data-reveal><EcosystemFlow /></div>
      </div>
    </section>
  );
}

export function LatestInsights() {
  return (
    <section className={styles.section} aria-labelledby="insights-title">
      <div className={styles.container}>
        <SectionHeading
          eyebrow="Góc vận hành & học tập"
          title="Ý tưởng để tổ chức đào tạo tốt hơn"
          copy="Nội dung nguyên bản về thiết kế bài học, dữ liệu vận hành và cách đưa công nghệ vào đúng điểm cần thiết."
          id="insights-title"
        />
        <div className={styles.blogGrid}>
          {marketingBlogPosts.slice(0, 3).map((post, index) => <BlogCard post={post} priority={index === 0} key={post.slug} />)}
        </div>
        <div className={styles.heroActions}><Link className={styles.buttonSecondary} href="/blog">Xem tất cả bài viết</Link></div>
      </div>
    </section>
  );
}

export function HomeSections() {
  return (
    <>
      <FeatureOverview />
      <GettingStartedSteps />
      <Benefits />
      <ProductStory />
      <Integrations />
      <Testimonials />
      <PricingSection compact />
      <FaqSection />
      <LatestInsights />
    </>
  );
}
