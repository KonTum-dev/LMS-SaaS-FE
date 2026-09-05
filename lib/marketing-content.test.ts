import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getMarketingBlogPost,
  marketingBenefits,
  marketingBlogPosts,
  marketingBlogSlugs,
  marketingCapabilityMetrics,
  marketingFaqItems,
  marketingFeatures,
  marketingFooterContent,
  marketingNavigation,
  marketingOnboardingSteps,
  marketingPricingTiers,
} from "./marketing-content";

describe("static marketing content", () => {
  it("defines real navigation and footer destinations", () => {
    expect(marketingNavigation.items.map((item) => item.href)).toEqual([
      "/features",
      "/pricing",
      "/blog",
    ]);
    expect(marketingNavigation.entryCta).toEqual({ href: "/dashboard", label: "Vào LMS" });

    const footerLinks: Array<{ href: string; label: string }> = [];
    for (const group of marketingFooterContent.groups) {
      footerLinks.push(...group.links);
    }
    expect(footerLinks).toEqual(
      expect.arrayContaining([
        { href: "/contact-us", label: "Liên hệ" },
        { href: "/terms-of-use", label: "Điều khoản sử dụng" },
        { href: "/privacy-policy", label: "Chính sách riêng tư" },
      ]),
    );
    expect(marketingFooterContent.tagline).toContain("khóa học");
  });

  it("maps nine product features to implemented routes and LMS modules", () => {
    expect(marketingFeatures).toHaveLength(9);
    expect(
      marketingFeatures.map(({ capability, href }) => [capability, href]),
    ).toEqual([
      ["COURSES", "/courses"],
      ["COHORTS", "/cohorts"],
      ["ASSIGNMENTS", "/assignments"],
      ["ASSESSMENTS", "/assessments"],
      ["GUARDIANS", "/guardians"],
      ["TUITION", "/tuition"],
      ["ORGANIZATION_STRUCTURE", "/organization"],
      ["REPORTS", "/reports"],
      ["COMMUNICATIONS", "/communications"],
    ]);
    expect(new Set(marketingFeatures.map((feature) => feature.id)).size).toBe(
      9,
    );
    marketingFeatures.forEach((feature) => {
      expect(feature.title.length).toBeGreaterThan(5);
      expect(feature.description.length).toBeGreaterThan(40);
    });
  });

  it("keeps onboarding, benefits, and metrics capability-led", () => {
    expect(marketingOnboardingSteps).toHaveLength(3);
    expect(marketingOnboardingSteps.map((item) => item.step)).toEqual([
      1, 2, 3,
    ]);
    expect(marketingOnboardingSteps[0]).toMatchObject({
      href: "/register",
      step: 1,
    });
    expect(marketingBenefits).toHaveLength(4);
    expect(marketingCapabilityMetrics.map((metric) => metric.value)).toEqual([
      "5 vai trò",
      "12 mô-đun",
      "Đa workspace",
      "Theo chi nhánh",
    ]);

    const claims = JSON.stringify(marketingCapabilityMetrics);
    expect(claims).not.toMatch(
      /trusted by|khách hàng|học viên đã đăng ký|\d+%/i,
    );
  });

  it("publishes the approved trial, Center, Business, and Enterprise pricing", () => {
    expect(marketingPricingTiers.map((tier) => tier.id)).toEqual([
      "trial",
      "center",
      "business",
      "enterprise",
    ]);
    expect(marketingPricingTiers.map((tier) => tier.name)).toEqual([
      "Dùng thử 30 ngày",
      "Center",
      "Business",
      "Enterprise",
    ]);
    expect(marketingPricingTiers[0]).toMatchObject({
      cta: { href: "/register" },
      priceLabel: "Miễn phí trong 30 ngày",
      trialDays: 30,
    });
    expect(marketingPricingTiers[1].cta).toEqual({
      href: "/register",
      label: "Dùng thử gói Center",
    });
    expect(marketingPricingTiers[2].cta).toEqual({
      href: "/register",
      label: "Dùng thử rồi nâng cấp",
    });
    expect(marketingPricingTiers[3]).toMatchObject({
      cta: {
        href: "/contact-us",
        label: "Trao đổi nhu cầu",
      },
      description: expect.stringContaining("chưa mở tự phục vụ"),
      features: expect.arrayContaining([
        "Hạn mức kích hoạt đồng thời trên 5.000 học viên",
        "Chưa mở đăng ký và nâng cấp tự phục vụ",
      ]),
      priceLabel: "Theo phương án triển khai",
    });
    expect(marketingPricingTiers[1]).toMatchObject({
      priceLabel: "299.000đ / tháng",
      priceVnd: { monthly: 299000, yearly: 2990000 },
      features: expect.arrayContaining([
        "Hạn mức kích hoạt đồng thời 1.000 học viên",
      ]),
    });
    expect(marketingPricingTiers[2]).toMatchObject({
      priceLabel: "799.000đ / tháng",
      priceVnd: { monthly: 799000, yearly: 7990000 },
      features: expect.arrayContaining([
        "Hạn mức kích hoạt đồng thời 5.000 học viên",
      ]),
    });
    expect(marketingPricingTiers[3].audience).toContain("trên 5.000");
    expect(marketingPricingTiers.filter((tier) => tier.id !== "enterprise").every((tier) => tier.cta.href === "/register")).toBe(true);

    const pricingCopy = JSON.stringify(marketingPricingTiers);
    expect(pricingCopy).not.toMatch(/MANA|API|tên miền tùy chỉnh/i);
  });

  it("answers eight distinct product, trial, and quota questions", () => {
    expect(marketingFaqItems).toHaveLength(8);
    expect(new Set(marketingFaqItems.map((item) => item.id)).size).toBe(8);
    expect(marketingFaqItems[0].answer).toContain("Workspace mới được kích hoạt dùng thử 30 ngày");
    expect(marketingFaqItems.find((item) => item.id === "active-learners")?.answer).toMatch(
      /ACTIVE.*LEARNER.*không phải số lượt đăng nhập/i,
    );
    expect(
      marketingFaqItems.some((item) => item.answer.includes("chỉ đọc")),
    ).toBe(true);
    marketingFaqItems.forEach((item) => {
      expect(item.question.endsWith("?")).toBe(true);
      expect(item.answer.length).toBeGreaterThan(50);
    });
  });

  it("provides ten complete Vietnamese blog posts for the generated artwork", () => {
    expect(marketingBlogPosts).toHaveLength(10);
    expect(marketingBlogPosts.map((post) => post.slug)).toEqual(
      marketingBlogSlugs,
    );
    expect(new Set(marketingBlogPosts.map((post) => post.slug)).size).toBe(10);
    expect(marketingBlogPosts.map((post) => post.hero)).toEqual([
      "/marketing/blog/learning-path-v2.webp",
      "/marketing/blog/blended-class-v2.webp",
      "/marketing/blog/teaching-workflow-v2.webp",
      "/marketing/blog/trends-insights.webp",
      "/marketing/blog/short-lessons.webp",
      "/marketing/blog/learning-on-the-go.webp",
      "/marketing/blog/blended-learning.webp",
      "/marketing/blog/gamified-motivation.webp",
      "/marketing/blog/learning-metrics.webp",
      "/marketing/blog/beyond-the-screen.webp",
    ]);

    for (const post of marketingBlogPosts) {
      expect(post.title.length).toBeGreaterThan(20);
      expect(post.excerpt.length).toBeGreaterThan(60);
      expect(post.category.length).toBeGreaterThan(5);
      expect(post.readingTime).toMatch(/^\d+ phút đọc$/);
      expect(post.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(`${post.publishedAt}T00:00:00Z`))).toBe(
        false,
      );
      expect(post.hero).toMatch(/^\/marketing\/blog\/[a-z0-9-]+\.webp$/);
      expect(
        existsSync(resolve(process.cwd(), "public", post.hero.slice(1))),
      ).toBe(true);
      expect(post.sections.length).toBeGreaterThanOrEqual(3);
      expect(post.sections.length).toBeLessThanOrEqual(5);
      post.sections.forEach((section) => {
        expect(section.heading.length).toBeGreaterThan(10);
        expect(section.paragraphs.length).toBeGreaterThan(0);
        section.paragraphs.forEach((paragraph) => {
          expect(paragraph.length).toBeGreaterThan(60);
        });
      });
      expect(getMarketingBlogPost(post.slug)).toBe(post);
    }

    expect(getMarketingBlogPost("khong-ton-tai")).toBeUndefined();
  });
});
