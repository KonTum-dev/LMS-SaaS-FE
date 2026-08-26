import type { Metadata } from "next";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import {
  ContactCta,
  FinalCta,
  MarketingFooter,
} from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import {
  AboutSection,
  MotivationSection,
  ServicesSection,
} from "@/components/marketing/marketing-sections";
import styles from "./marketing.module.css";

export const metadata: Metadata = {
  title: "DX LMS — Một workspace rõ ràng cho vận hành đào tạo",
  description:
    "DX LMS kết nối người dùng, khóa học, ghi danh, bài tập và dashboard trong workspace riêng của từng tổ chức.",
};

export default function Home() {
  return (
    <div className={styles.marketingPage} id="top">
      <MarketingHeader />
      <main id="noi-dung-chinh" tabIndex={-1}>
        <MarketingHero />
        <AboutSection />
        <MotivationSection />
        <ServicesSection />
        <FinalCta />
        <ContactCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
