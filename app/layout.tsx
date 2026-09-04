import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/be-vietnam-pro/900.css";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";
import "./lms-theme.css";

export const metadata: Metadata = {
  title: { default: "DX LMS", template: "%s | DX LMS" },
  description: "Nền tảng quản lý đào tạo đa tổ chức dành cho trung tâm đào tạo",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" data-scroll-behavior="smooth">
      <body>
        <AntdRegistry>
          <AppProviders>{children}</AppProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
