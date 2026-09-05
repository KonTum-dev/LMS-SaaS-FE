import { getServerI18n } from "@/lib/i18n/server";
import { marketingMessages } from "@/lib/i18n/marketing-messages";
import type { Metadata } from "next";
import {
  FaqSection,
  MarketingShell,
  PricingSection,
} from "@/components/marketing/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n(marketingMessages);
  return {
    title: t("Gói dịch vụ"),
    description: t(
      "Dùng thử DX LMS 30 ngày và chọn gói Center, Business hoặc Enterprise theo số học viên đang hoạt động.",
    ),
  };
}

export default async function PricingPage() {
  return (
    <MarketingShell>
      <PricingSection pageHeading />
      <FaqSection />
    </MarketingShell>
  );
}
