import type { Metadata } from "next";
import Link from "next/link";
import { ContactDraft } from "@/components/marketing/contact-draft";
import { MarketingShell, PageIntro } from "@/components/marketing/site";
import styles from "@/components/marketing/contact-draft.module.css";
import { contactMessages } from "@/lib/i18n/contact-messages";
import { getServerI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n(contactMessages);
  return { title: t("Liên hệ"), description: t("Kênh tiếp nhận trực tuyến đang được chuẩn bị.") };
}

export default async function ContactPage() {
  const { t } = await getServerI18n(contactMessages);
  return (
    <MarketingShell>
      <PageIntro title={t("Liên hệ")} lead={t("Kênh tiếp nhận trực tuyến đang được chuẩn bị.")} />
      <section className={styles.section} aria-label={t("Liên hệ")}>
        <div className={styles.availability}>
          <p>{t("Hiện chưa thể gửi yêu cầu từ trang này. Bạn có thể khám phá tính năng hoặc tạo không gian dùng thử.")}</p>
          <div className={styles.links}>
            <Link href="/features">{t("Khám phá tính năng")}</Link>
            <Link href="/register">{t("Tạo không gian dùng thử")}</Link>
          </div>
        </div>
        <ContactDraft />
      </section>
    </MarketingShell>
  );
}
