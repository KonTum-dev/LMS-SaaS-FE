import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DX LMS", template: "%s | DX LMS" },
  description: "Nền tảng quản lý đào tạo multi-tenant dành cho trung tâm đào tạo",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi">
      <body>
        <AntdRegistry>
          <AppProviders>{children}</AppProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
