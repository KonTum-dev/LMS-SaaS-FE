import Link from "next/link";
import styles from "@/app/marketing.module.css";
import { MarketingIcon } from "./marketing-icon";
import { SectionMascot } from "./section-mascot";

type PlanBase = {
  name: string;
  headingId: string;
  label: string;
  description: string;
  features: readonly string[];
  cta: string;
  scale: string;
  scaleNote: string;
  href: "/register" | "#lien-he";
};

type Plan = PlanBase;

const plans = [
  {
    name: "Lớp một giáo viên",
    headingId: "pricing-plan-lop-hoc-them",
    label: "Bắt đầu gọn",
    description:
      "Một cô hoặc thầy tự quản lý lớp mà không phải thiết lập cơ cấu trung tâm.",
    scale: "Một không gian",
    scaleNote: "Mở lớp và vận hành ngay",
    features: [
      "Lớp, lịch học và điểm danh",
      "Học viên, phụ huynh và học phí",
      "Khóa học, bài tập và kiểm tra",
    ],
    cta: "Bắt đầu dùng thử",
    href: "/register",
  },
  {
    name: "Trung tâm nhỏ",
    headingId: "pricing-plan-trung-tam",
    label: "Cùng một cơ sở",
    description:
      "Chủ trung tâm phối hợp với nhiều giáo viên và xử lý danh sách học viên lớn hơn.",
    scale: "Một cơ sở",
    scaleNote: "Đội ngũ cùng vận hành",
    features: [
      "Vai trò quản trị và giảng viên",
      "Nhập thành viên hàng loạt từ CSV",
      "Thông báo theo lớp và đối tượng",
    ],
    cta: "Trao đổi cấu hình",
    href: "#lien-he",
  },
  {
    name: "Trung tâm lớn",
    headingId: "pricing-plan-trung-tam-lon",
    label: "Phân công rõ ràng",
    description:
      "Nhiều bộ phận cùng làm việc nhưng mỗi quản lý chỉ thao tác trong phạm vi được giao.",
    scale: "Nhiều phòng ban",
    scaleNote: "Phân quyền có chiều sâu",
    features: [
      "Cây đơn vị và quyền theo phạm vi",
      "Quota người học và năng lực sử dụng",
      "Báo cáo lớp, điểm danh và học phí",
    ],
    cta: "Thiết kế mô hình",
    href: "#lien-he",
  },
  {
    name: "Chuỗi trung tâm",
    headingId: "pricing-plan-chuoi-trung-tam",
    label: "Nhiều chi nhánh",
    description:
      "Trụ sở theo dõi toàn hệ thống, còn từng chi nhánh vận hành trong đúng phạm vi được giao.",
    scale: "Một tổ chức",
    scaleNote: "Nhiều chi nhánh liên thông",
    features: [
      "Trụ sở, chi nhánh và đơn vị con",
      "Quản lý theo nhánh và nhánh con",
      "Báo cáo hợp nhất hoặc lọc từng nhánh",
    ],
    cta: "Trao đổi kiến trúc",
    href: "#lien-he",
  },
] satisfies readonly Plan[];

export function PricingSection() {
  return (
    <section
      className={`${styles.section} ${styles.pricingSection}`}
      id="quy-mo"
      aria-labelledby="pricing-title"
      data-section="pricing"
    >
      <div className={`${styles.container} ${styles.mascotContainer}`}>
        <div className={styles.pricingIntro} data-reveal>
          <span className={styles.sectionLabel}>Phù hợp theo quy mô</span>
          <h2 id="pricing-title">Một nền tảng, bốn cách vận hành.</h2>
          <p>
            Không ép lớp nhỏ dùng quy trình của doanh nghiệp. Không để trung
            tâm lớn phải ghép nhiều công cụ rời rạc. Mỗi workspace mới
            được hệ thống kích hoạt dùng thử tự động ngay sau khi khởi tạo.
          </p>
        </div>
        <SectionMascot variant="pricing" />
        <div className={styles.pricingGrid}>
          {plans.map((plan) => (
            <article
              className={styles.planCard}
              aria-labelledby={plan.headingId}
              data-reveal
              key={plan.name}
            >
              <span className={styles.planLabel}>{plan.label}</span>
              <h3 id={plan.headingId}>{plan.name}</h3>
              <p className={styles.planDescription}>{plan.description}</p>
              <div className={styles.planPrice}>
                <p><strong>{plan.scale}</strong></p>
                <small>{plan.scaleNote}</small>
              </div>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}><MarketingIcon name="check" />{feature}</li>
                ))}
              </ul>
              {plan.href === "/register" ? (
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
