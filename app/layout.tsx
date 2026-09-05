import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import "@fontsource-variable/manrope";
import { AppProviders } from "@/components/providers/app-providers";
import { LocaleRouteRefresh } from "@/components/i18n/locale-route-refresh";
import { getServerLocale } from "@/lib/i18n/server";
import "./globals.css";
import "./lms-theme.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return {
  metadataBase: new URL("https://lms.dolphinxstudio.com"),
  title: { default: "DX LMS", template: "%s | DX LMS" },
  description: locale === "en" ? "A multi-organization learning management platform for training centers" : "Nền tảng quản lý đào tạo đa tổ chức dành cho trung tâm đào tạo",
};
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getServerLocale();
  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body>
        <AntdRegistry>
          <AppProviders initialLocale={locale}><LocaleRouteRefresh serverLocale={locale} />{children}</AppProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
