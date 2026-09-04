import type { MetadataRoute } from "next";
import { marketingBlogSlugs } from "@/lib/marketing-content";

const baseUrl = "https://lms.dolphinx.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/features", "/about-us", "/pricing", "/blog", "/contact-us", "/terms-of-use", "/privacy-policy"];
  return [
    ...staticRoutes.map((route) => ({
      url: `${baseUrl}${route}`,
      changeFrequency: route === "" ? ("weekly" as const) : ("monthly" as const),
      priority: route === "" ? 1 : route === "/features" || route === "/pricing" ? 0.8 : 0.6,
    })),
    ...marketingBlogSlugs.map((slug) => ({
      url: `${baseUrl}/blog/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
