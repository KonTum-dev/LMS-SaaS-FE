import type { Metadata } from "next";
import { FaqSection, MarketingShell, PageHero, PricingSection } from "@/components/marketing/site";

export const metadata: Metadata = {
  title: "Gói dịch vụ",
  description: "Dùng thử DX LMS 14 ngày và chọn cấu hình Center hoặc Enterprise theo nhu cầu thực tế.",
};

export default function PricingPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Bắt đầu không rào cản"
        line="Dùng thử không rào cản."
        strong="Mở rộng theo nhu cầu thực tế."
        lead="Dùng thử 14 ngày không cần thẻ. Khi sẵn sàng, DX LMS cùng bạn xác định mô-đun, hạn mức và chu kỳ thanh toán phù hợp."
        visual="pricing"
        primaryHref="/register"
        primaryLabel="Dùng thử 14 ngày"
        secondaryHref="/contact-us"
        secondaryLabel="Trao đổi nhu cầu"
      />
      <PricingSection />
      <FaqSection />
    </MarketingShell>
  );
}
