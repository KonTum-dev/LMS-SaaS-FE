"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { marketingMessages } from "@/lib/i18n/marketing-messages";
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
import {
  BlogCard,
  PricingSection,
  SectionHeading,
} from "./site";

export function FeatureOverview() {
  const { t } = useI18n(marketingMessages);
  return (
    <section
      className={styles.section}
      aria-labelledby="feature-overview-title"
    >
      <div className={styles.container}>
        <SectionHeading
          title={t("Đủ công cụ. Gọn công việc.")}
          copy={t(
            "Chọn nhóm công việc để khám phá cách DX LMS hỗ trợ bạn.",
          )}
          id="feature-overview-title"
        />
        <FeatureExplorer compact />
      </div>
    </section>
  );
}

export function GettingStartedSteps() {
  const { t } = useI18n(marketingMessages);
  return (
    <section
      className={`${styles.section} ${styles.sectionTint}`}
      aria-labelledby="steps-title"
    >
      <div className={styles.container}>
        <SectionHeading
          title={t("Bắt đầu trong 3 bước")}
          id="steps-title"
        />
        <div className={styles.steps}>
          {marketingOnboardingSteps.map((step) => (
            <article className={styles.stepCard} data-reveal key={step.id}>
              <span className={styles.stepNumber}>0{step.step}</span>
              <h3>{t(step.title)}</h3>
              <p>{t(step.description)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Benefits() {
  const { t } = useI18n(marketingMessages);
  return (
    <section
      className={`${styles.section} ${styles.sectionDark}`}
      aria-labelledby="benefits-title"
    >
      <div className={styles.container}>
        <SectionHeading
          eyebrow={t("Giá trị vận hành")}
          title={t("Gọn cho hôm nay. Vững cho ngày mai.")}
          copy={t(
            "DX LMS giữ một nguồn dữ liệu nhưng tạo đúng góc nhìn cho mỗi người tham gia quá trình đào tạo.",
          )}
          id="benefits-title"
        />
        <div className={styles.benefitGrid}>
          {marketingBenefits.map((benefit, index) => (
            <article
              className={styles.benefitCard}
              data-reveal
              key={benefit.id}
            >
              <span className={styles.benefitIcon}>
                {
                  [
                    <MarketingIcon key="secure" name="safety" />,
                    <MarketingIcon key="team" name="team" />,
                    <MarketingIcon key="scale" name="apartment" />,
                    <MarketingIcon key="report" name="barChart" />,
                  ][index]
                }
              </span>
              <h3>{t(benefit.title)}</h3>
              <p>{t(benefit.description)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProductStory() {
  const { t } = useI18n(marketingMessages);
  return (
    <section className={styles.section} aria-labelledby="story-title">
      <div className={styles.container}>
        <div className={styles.split}>
          <div className={styles.mediaCard} data-reveal>
            <MarketingVisual kind="about" />
          </div>
          <div className={styles.splitCopy} data-reveal>
            <span className={styles.eyebrow}>
              {t("Cánh cửa tới vận hành thông minh")}
            </span>
            <h2 id="story-title">{t("Mở rộng mà không phải thay hệ thống")}</h2>
            <p>
              {t(
                "Một giáo viên có thể dùng DX LMS cho lớp riêng. Khi tổ chức lớn lên, cùng dữ liệu đó có thể được tổ chức theo phòng ban, chi nhánh và phạm vi quản trị.",
              )}
            </p>
            <ul className={styles.checkList}>
              <li>
                {t("Không bắt buộc dựng cơ cấu phức tạp khi mới bắt đầu")}
              </li>
              <li>{t("Phân quyền theo vai trò, mô-đun và đơn vị")}</li>
              <li>{t("Trạng thái thuê bao và quyền ghi được thể hiện rõ")}</li>
            </ul>
            <Link className={styles.button} href="/about-us">
              {t("Tìm hiểu DX LMS")}{" "}
              <span className={styles.buttonIcon}>→</span>
            </Link>
          </div>
        </div>
        <div className={styles.metrics} data-reveal>
          {marketingCapabilityMetrics.map((metric) => (
            <div className={styles.metric} key={metric.id}>
              <strong>{t(metric.value)}</strong>
              <span>{t(metric.label)}</span>
              <p>{t(metric.description)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Integrations() {
  const { t } = useI18n(marketingMessages);
  return (
    <section
      className={`${styles.section} ${styles.sectionTint}`}
      aria-labelledby="integration-title"
    >
      <div className={styles.container}>
        <SectionHeading
          eyebrow={t("Sẵn sàng tích hợp")}
          title={t("Kết nối các mảnh ghép thật sự có trong hệ thống")}
          copy={t(
            "Từ xác thực, thanh toán đến nhập dữ liệu và webhook — tất cả đều đi qua lớp bảo mật, tenant và trạng thái rõ ràng.",
          )}
          id="integration-title"
        />
        <div data-reveal>
          <EcosystemFlow />
        </div>
      </div>
    </section>
  );
}

export function LatestInsights() {
  const { t } = useI18n(marketingMessages);
  return (
    <section className={`${styles.section} ${styles.insightsSection}`} aria-labelledby="insights-title">
      <div className={styles.container}>
        <SectionHeading
          title={t("Góc học tập & vận hành")}
          id="insights-title"
          align="left"
        />
        <div className={styles.blogGrid}>
          {marketingBlogPosts.slice(0, 3).map((post, index) => (
            <BlogCard post={post} priority={index === 0} key={post.slug} />
          ))}
        </div>
        <div className={styles.heroActions}>
          <Link className={styles.buttonSecondary} href="/blog">
            {t("Xem tất cả bài viết")}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function HomeSections() {
  return (
    <>
      <FeatureOverview />
      <GettingStartedSteps />
      <PricingSection compact />
      <LatestInsights />
    </>
  );
}
