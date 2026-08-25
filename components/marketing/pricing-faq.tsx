import Link from "next/link";
import styles from "@/app/marketing.module.css";
import { MarketingIcon } from "./marketing-icon";

const plans = [
  {
    name: "Pilot",
    label: "Khởi đầu có trọng tâm",
    description: "Dành cho trung tâm muốn đánh giá DX LMS với phạm vi vận hành đã xác định.",
    features: ["Thiết lập một workspace tổ chức", "Người dùng, khóa học, ghi danh và bài tập", "Vai trò và module theo phạm vi pilot"],
  },
  {
    name: "Vận hành",
    label: "Dùng lâu dài theo tổ chức",
    description: "Dành cho trung tâm đã sẵn sàng đưa các quy trình đào tạo cốt lõi lên một workspace chung.",
    features: ["Đầy đủ module Web hiện có", "Dashboard và phân quyền theo vai trò", "Tùy biến tên, logo, màu sắc và module"],
  },
];

const questions = [
  { question: "DX LMS phù hợp với ai?", answer: "DX LMS được định hướng cho các trung tâm đào tạo nhỏ và vừa cần quản lý người dùng, khóa học, ghi danh và bài tập trên một nền tảng chung." },
  { question: "Nền tảng hiện có những module nào?", answer: "Phiên bản Web hiện có quản lý tổ chức, người dùng, khóa học, ghi danh, bài tập, dashboard, phân quyền theo vai trò và tùy biến tenant." },
  { question: "Mỗi trung tâm có workspace riêng không?", answer: "Có. DX LMS hoạt động theo mô hình multi-tenant: mỗi tổ chức có ngữ cảnh workspace, thương hiệu và module được cấu hình riêng." },
  { question: "DX LMS kiểm soát quyền truy cập thế nào?", answer: "Người dùng đăng nhập vào workspace và giao diện hiển thị chức năng dựa trên vai trò cùng các module được bật cho tổ chức." },
  { question: "Có thể xem giá và dùng thử ngay không?", answer: "Các gói hiện được báo giá theo phạm vi triển khai, vì vậy mức giá được hiển thị là “Liên hệ”. Trang này không cam kết trial hoặc SLA khi chưa có thỏa thuận cụ thể." },
];

export function PricingSection() {
  return (
    <section className={`${styles.section} ${styles.pricingSection}`} id="bang-gia" aria-labelledby="pricing-title">
      <div className={styles.container}>
        <div className={styles.pricingIntro}>
          <span className={styles.eyebrowDark}>Gói triển khai</span>
          <h2 id="pricing-title">Phạm vi rõ trước. Chi phí rõ sau.</h2>
          <p>DX LMS chưa công bố giá số. Gói phù hợp được xác định theo cách tổ chức muốn thử nghiệm hoặc vận hành.</p>
        </div>
        <div className={styles.pricingGrid}>
          {plans.map((plan, index) => (
            <article className={`${styles.planCard} ${index === 1 ? styles.planFeatured : ""}`} key={plan.name}>
              {index === 1 && <span className={styles.planBadge}>Phạm vi đầy đủ hơn</span>}
              <span className={styles.planLabel}>{plan.label}</span>
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              <div className={styles.price}>Liên hệ <small>theo phạm vi</small></div>
              <ul>
                {plan.features.map((feature) => <li key={feature}><MarketingIcon name="check" />{feature}</li>)}
              </ul>
              <a className={index === 1 ? styles.primaryButton : styles.secondaryButton} href="#trien-khai">
                Xem cách triển khai <MarketingIcon name="arrowRight" />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section className={styles.section} id="faq" aria-labelledby="faq-title">
      <div className={styles.container}>
        <div className={styles.faqGrid}>
          <div className={styles.faqIntro}>
            <span className={styles.eyebrowDark}>Câu hỏi thường gặp</span>
            <h2 id="faq-title">Thông tin thẳng vào điều cần biết.</h2>
            <p>Không thấy câu trả lời bạn cần? Đăng nhập nếu tổ chức của bạn đã có tài khoản DX LMS.</p>
            <Link href="/login">Đi tới trang đăng nhập <MarketingIcon name="arrowRight" /></Link>
          </div>
          <div className={styles.faqList}>
            {questions.map((item, index) => (
              <details key={item.question} open={index === 0}>
                <summary><span>{item.question}</span><i aria-hidden="true">+</i></summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
