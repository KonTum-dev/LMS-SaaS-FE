import Link from "next/link";
import styles from "@/app/marketing.module.css";
import { MarketingIcon } from "./marketing-icon";

type PlanBase = {
  name: string;
  headingId: string;
  label: string;
  description: string;
  features: readonly string[];
  cta: string;
  featured: boolean;
};

type PricedPlan = PlanBase & {
  kind: "priced";
  monthlyPrice: string;
  yearlyPrice: string;
  href: "/login";
};

type ContactPlan = PlanBase & {
  kind: "contact";
  href: "#lien-he";
};

type Plan = PricedPlan | ContactPlan;

const plans = [
  {
    kind: "priced",
    name: "Lớp học thêm",
    headingId: "pricing-plan-lop-hoc-them",
    label: "Gói khởi đầu",
    description:
      "Mức khởi đầu công khai để đưa hoạt động đào tạo vào một workspace DX LMS rõ ràng.",
    monthlyPrice: "199.000đ",
    yearlyPrice: "1.990.000đ/năm",
    features: [
      "Người dùng, khóa học và ghi danh",
      "Bài tập và dashboard",
      "Tùy biến tenant",
    ],
    cta: "Bắt đầu với gói này",
    href: "/login",
    featured: true,
  },
  {
    kind: "contact",
    name: "Trung tâm",
    headingId: "pricing-plan-trung-tam",
    label: "Theo phạm vi vận hành",
    description:
      "Cùng xác định phạm vi phù hợp với cách trung tâm đang tổ chức và vận hành đào tạo.",
    features: [
      "Người dùng, khóa học và ghi danh",
      "Bài tập và dashboard",
      "Tùy biến tenant theo phạm vi",
    ],
    cta: "Trao đổi phạm vi",
    href: "#lien-he",
    featured: false,
  },
  {
    kind: "contact",
    name: "Trường học",
    headingId: "pricing-plan-truong-hoc",
    label: "Theo phạm vi tổ chức",
    description:
      "Cùng làm rõ nhu cầu và phạm vi triển khai trước khi xác định chi phí phù hợp cho trường học.",
    features: [
      "Người dùng, khóa học và ghi danh",
      "Bài tập và dashboard",
      "Tùy biến tenant theo phạm vi",
    ],
    cta: "Liên hệ trao đổi",
    href: "#lien-he",
    featured: false,
  },
] satisfies readonly Plan[];

export function PricingSection() {
  return (
    <section
      className={`${styles.section} ${styles.pricingSection}`}
      id="bang-gia"
      aria-labelledby="pricing-title"
      data-section="pricing"
    >
      <div className={styles.container}>
        <div className={styles.pricingIntro}>
          <span className={styles.sectionLabel}>Bảng giá DX LMS</span>
          <h2 id="pricing-title">Bắt đầu rõ ràng. Mở rộng theo nhu cầu.</h2>
          <p>
            Lớp học thêm có thể bắt đầu với mức giá công khai. Trung tâm và
            trường học được xác định chi phí theo phạm vi thực tế.
          </p>
        </div>
        <div className={styles.pricingGrid}>
          {plans.map((plan) => (
            <article
              className={`${styles.planCard} ${plan.featured ? styles.planFeatured : ""}`}
              aria-labelledby={plan.headingId}
              key={plan.name}
            >
              {plan.featured && <span className={styles.planBadge}>Giá công khai</span>}
              <span className={styles.planLabel}>{plan.label}</span>
              <h3 id={plan.headingId}>{plan.name}</h3>
              <p className={styles.planDescription}>{plan.description}</p>
              {plan.kind === "priced" ? (
                <div className={styles.planPrice}>
                  <p><strong>{plan.monthlyPrice}</strong><span>/tháng</span></p>
                  <small>hoặc {plan.yearlyPrice}</small>
                </div>
              ) : (
                <div className={styles.planPrice}>
                  <p><strong>Liên hệ</strong></p>
                  <small>Chi phí theo phạm vi</small>
                </div>
              )}
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}><MarketingIcon name="check" />{feature}</li>
                ))}
              </ul>
              {plan.kind === "priced" ? (
                <Link className={styles.primaryButton} href={plan.href}>
                  {plan.cta} <MarketingIcon name="arrowRight" />
                </Link>
              ) : (
                <a className={styles.secondaryButton} href={plan.href}>
                  {plan.cta} <MarketingIcon name="arrowRight" />
                </a>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
