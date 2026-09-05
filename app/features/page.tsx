import { getServerI18n } from "@/lib/i18n/server";
import { marketingMessages } from "@/lib/i18n/marketing-messages";
import type { Metadata } from "next";
import styles from "@/app/marketing-v2.module.css";
import { FeatureExplorer } from "@/components/marketing/feature-explorer";
import { MarketingShell, PageIntro } from "@/components/marketing/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n(marketingMessages);
  return {
    title: t("Tính năng"),
    description: t("Khám phá các mô-đun học tập, vận hành, báo cáo và quản trị đa chi nhánh của DX LMS."),
  };
}

export default async function FeaturesPage() {
  const { t } = await getServerI18n(marketingMessages);
  return (
    <MarketingShell>
      <PageIntro title={t("Đủ công cụ. Gọn công việc.")} lead={t("Chọn nhóm công việc để khám phá cách DX LMS hỗ trợ bạn.")} />
      <section className={styles.contentSection} aria-label={t("Tính năng")}>
        <div className={styles.container}><FeatureExplorer /></div>
      </section>
      <section className={`${styles.section} ${styles.sectionTint}`} aria-labelledby="role-access-title">
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 id="role-access-title">{t("Mỗi người thấy đúng phần việc")}</h2>
            <p className={styles.sectionLead}>{t("Quản trị viên quản lý tổ chức. Giáo viên phụ trách lớp học. Học viên và phụ huynh theo dõi thông tin được chia sẻ với mình.")}</p>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
