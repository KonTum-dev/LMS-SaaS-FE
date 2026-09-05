import { getServerI18n } from "@/lib/i18n/server";
import { marketingMessages } from "@/lib/i18n/marketing-messages";
import type { Metadata } from "next";
import { HomeSections } from "@/components/marketing/home-sections";
import { HomeHero, MarketingShell } from "@/components/marketing/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n(marketingMessages);
  return {
    title: t("DX LMS — Từ một lớp học đến chuỗi trung tâm"),
    description: t(
      "DX LMS kết nối khóa học, lớp học, học viên, phụ huynh, học phí và báo cáo trong một workspace đa tổ chức.",
    ),
    openGraph: {
      title: t("DX LMS — Nền tảng quản lý đào tạo đa tổ chức"),
      description: t(
        "Bắt đầu miễn phí 30 ngày và mở rộng theo đúng quy mô trung tâm.",
      ),
      images: ["/marketing/og/dx-lms-og.svg"],
    },
  };
}

export default function Home() {
  return (
    <MarketingShell>
      <HomeHero />
      <HomeSections />
    </MarketingShell>
  );
}
