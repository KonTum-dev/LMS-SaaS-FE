import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import "@fontsource-variable/manrope";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";
import "./lms-theme.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://lms.dolphinx.com"),
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
