import type { Metadata } from "next";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import { FinalCta, MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import {
  CapabilitiesSection,
  ProblemSection,
  RolesSection,
  RolloutSection,
  TrustSection,
} from "@/components/marketing/marketing-sections";
import { FaqSection, PricingSection } from "@/components/marketing/pricing-faq";
import styles from "./marketing.module.css";

export const metadata: Metadata = {
  title: "DX LMS — Nền tảng LMS cho trung tâm đào tạo",
  description: "DX LMS giúp trung tâm đào tạo nhỏ và vừa quản lý người dùng, khóa học, ghi danh, bài tập và phân quyền trong một workspace riêng.",
};

export default function Home() {
  return (
    <div className={styles.marketingPage} id="top">
      <MarketingHeader />
      <main id="noi-dung-chinh" tabIndex={-1}>
        <MarketingHero />
        <ProblemSection />
        <CapabilitiesSection />
        <RolesSection />
        <TrustSection />
        <RolloutSection />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
