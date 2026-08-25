import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NovaLMS", template: "%s | NovaLMS" },
  description: "Nền tảng quản lý đào tạo dành cho trung tâm và trường học",
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
