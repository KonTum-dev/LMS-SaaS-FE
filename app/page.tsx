import type { Metadata } from "next";
import { HomeSections } from "@/components/marketing/home-sections";
import { HomeHero, MarketingShell } from "@/components/marketing/site";

export const metadata: Metadata = {
  title: "DX LMS — Từ một lớp học đến chuỗi trung tâm",
  description:
    "DX LMS kết nối khóa học, lớp học, học viên, phụ huynh, học phí và báo cáo trong một workspace đa tổ chức.",
  openGraph: {
    title: "DX LMS — Nền tảng quản lý đào tạo đa tổ chức",
    description: "Bắt đầu miễn phí 14 ngày và mở rộng theo đúng quy mô trung tâm.",
    images: ["/marketing/og/dx-lms-og.svg"],
  },
};

export default function Home() {
  return (
    <MarketingShell>
      <HomeHero />
      <HomeSections />
    </MarketingShell>
  );
}
