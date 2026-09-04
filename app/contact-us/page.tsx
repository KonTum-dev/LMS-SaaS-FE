import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/app/marketing-v2.module.css";
import { ContactForm } from "@/components/marketing/site-interactions";
import { FaqSection, MarketingShell, PageHero } from "@/components/marketing/site";

export const metadata: Metadata = {
  title: "Liên hệ",
  description: "Mô tả nhu cầu triển khai DX LMS cho lớp học, trung tâm hoặc tổ chức nhiều chi nhánh.",
};

export default function ContactPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="DX LMS sẵn sàng lắng nghe"
        line="Bạn có câu hỏi?"
        strong="Hãy cùng làm rõ nhu cầu"
        lead="Cho chúng tôi biết quy mô lớp học, vai trò và những mô-đun bạn cần. DX LMS sẽ giúp bạn định hình một lộ trình triển khai vừa đủ."
        visual="contact"
        primaryHref="#form-lien-he"
        primaryLabel="Mô tả nhu cầu"
      />
      <section className={styles.section} id="form-lien-he" aria-labelledby="contact-title">
        <div className={`${styles.container} ${styles.contactGrid}`}>
          <aside className={styles.contactAside} data-reveal>
            <h2 id="contact-title">Bắt đầu cuộc trao đổi</h2>
            <p>Mô tả bối cảnh hiện tại, điều bạn muốn cải thiện và quy mô dự kiến. Mỗi thông tin giúp buổi trao đổi đi thẳng vào vấn đề cần giải quyết.</p>
            <div className={styles.contactSteps}>
              <span><i>01</i><strong>Tiếp nhận bối cảnh</strong><small>Quy mô, vai trò và luồng đang dùng</small></span>
              <span><i>02</i><strong>Demo theo tình huống</strong><small>Xem đúng màn hình liên quan</small></span>
              <span><i>03</i><strong>Đề xuất lộ trình</strong><small>Chọn mô-đun và cách khởi chạy</small></span>
            </div>
            <span className={styles.contactLine}>Muốn tự khám phá trước?</span>
            <p>Tạo workspace dùng thử đầy đủ trong 14 ngày, không cần thẻ thanh toán.</p>
            <Link className={styles.buttonSecondary} href="/register">Tạo workspace miễn phí</Link>
          </aside>
          <div data-reveal><ContactForm /></div>
        </div>
      </section>
      <FaqSection />
    </MarketingShell>
  );
}
