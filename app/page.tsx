import type { Metadata } from "next";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import {
  ContactCta,
  FinalCta,
  MarketingFooter,
} from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingMotion } from "@/components/marketing/marketing-motion";
import {
  AboutSection,
  MotivationSection,
  ServicesSection,
} from "@/components/marketing/marketing-sections";
import { PricingSection } from "@/components/marketing/pricing-faq";
import styles from "./marketing.module.css";

export const metadata: Metadata = {
  title: "DX LMS — Từ một lớp học đến chuỗi trung tâm",
  description:
    "DX LMS giúp giáo viên và trung tâm quản lý lớp học, điểm danh, phụ huynh, học phí, đội ngũ và nhiều chi nhánh trong một hệ thống.",
};

export default function Home() {
  return (
    <div className={styles.marketingPage} data-marketing-page id="top">
      <MarketingMotion />
      <MarketingHeader />
      <main id="noi-dung-chinh" tabIndex={-1}>
        <MarketingHero />
        <AboutSection />
        <MotivationSection />
        <ServicesSection />
        <PricingSection />
        <FinalCta />
        <ContactCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
