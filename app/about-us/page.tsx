import { getServerI18n } from "@/lib/i18n/server";
import { marketingMessages } from "@/lib/i18n/marketing-messages";
import type { Metadata } from "next";
import styles from "@/app/marketing-v2.module.css";
import { MarketingShell, PageIntro } from "@/components/marketing/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n(marketingMessages);
  return {
    title: t("Về DX LMS"),
    description: t("Câu chuyện và nguyên tắc thiết kế của nền tảng quản lý đào tạo đa tổ chức DX LMS."),
  };
}

const principles = [
  ["Nhẹ khi bắt đầu", "Không ép lớp nhỏ dựng cây tổ chức hay quy trình phức tạp trước khi thật sự cần."],
  ["Rõ khi mở rộng", "Thêm chi nhánh và phân công trách nhiệm khi trung tâm phát triển."],
  ["Dữ liệu có ngữ cảnh", "Mọi con số luôn đi kèm nguồn, phạm vi và thời điểm để người vận hành biết chính xác mình đang nhìn điều gì."],
] as const;

export default async function AboutPage() {
  const { t } = await getServerI18n(marketingMessages);
  return (
    <MarketingShell>
      <PageIntro title={t("Để việc dạy và học ở vị trí trung tâm.")} lead={t("DX LMS là sản phẩm của DolphinX Studio, kết nối khóa học, lớp học và vận hành trong một không gian chung.")} />
      <section className={styles.contentSection} aria-labelledby="about-principles-title">
        <div className={styles.container}>
          <h2 className={styles.visuallyHidden} id="about-principles-title">{t("Nguyên tắc thiết kế")}</h2>
          <div className={styles.aboutPrinciples}>
            {principles.map(([title, copy]) => <article key={title}>
              <h3>{t(title)}</h3><p>{t(copy)}</p>
            </article>)}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
