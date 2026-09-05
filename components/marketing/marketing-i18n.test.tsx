// @vitest-environment jsdom

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";
import { AuthWorkspaceVisual } from "@/components/brand/auth-workspace-visual";
import { authMessages } from "@/lib/i18n/auth-messages";
import { marketingMessages } from "@/lib/i18n/marketing-messages";
import { contactMessages } from "@/lib/i18n/contact-messages";
import { marketingBlogPosts } from "@/lib/marketing-content";
import Home, { generateMetadata as homeMetadata } from "@/app/page";
import AboutPage from "@/app/about-us/page";
import FeaturesPage from "@/app/features/page";
import PricingPage, { generateMetadata as pricingMetadata } from "@/app/pricing/page";
import ContactPage from "@/app/contact-us/page";
import BlogPage from "@/app/blog/page";
import BlogPostPage, {
  generateMetadata as articleMetadata,
} from "@/app/blog/[slug]/page";
import PrivacyPage from "@/app/privacy-policy/page";
import TermsPage from "@/app/terms-of-use/page";
import { BlogExplorer } from "./site-interactions";
import { MarketingHero } from "./marketing-hero";
import { MarketingHeader as LegacyHeader } from "./marketing-header";
import {
  MarketingFooter as LegacyFooter,
  ContactCta,
  FinalCta,
} from "./marketing-footer";
import {
  AboutSection,
  MotivationSection,
  ServicesSection,
} from "./marketing-sections";
import { PricingSection as LegacyPricing } from "./pricing-faq";
import { NotFoundMarketingPage } from "./not-found-page";

const mocks = vi.hoisted(() => ({ locale: "en" as "en" | "vi" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: mocks.locale }) }),
}));

beforeEach(() => {
  mocks.locale = "en";
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function inEnglish(children: ReactNode) {
  return render(
    <FeedbackLocaleProvider initialLocale="en">
      {children}
    </FeedbackLocaleProvider>,
  );
}

function expectEnglishContent(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const text: string[] = [];
  while (walker.nextNode()) {
    if (
      !walker.currentNode.parentElement?.closest('[lang="vi"], style, script')
    )
      text.push(walker.currentNode.textContent ?? "");
  }
  for (const element of container.querySelectorAll(
    "[aria-label], [alt], [placeholder], [title]",
  )) {
    for (const attribute of ["aria-label", "alt", "placeholder", "title"])
      text.push(element.getAttribute(attribute) ?? "");
  }
  const rendered = text.join(" ");
  const untranslated = Object.entries({ ...marketingMessages, ...contactMessages })
    .filter(
      ([source, english]) =>
        source !== english &&
        /[À-ỹđĐ]/.test(source) &&
        rendered.includes(source),
    )
    .map(([source]) => source);
  expect(untranslated).toEqual([]);
}

describe("marketing application localization", () => {
  it("localizes concise home content, feature tabs, and interactive pricing", () => {
    const { container } = inEnglish(<Home />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Manage your classes.",
    );
    expect(
      within(screen.getByRole("navigation", { name: "Main navigation" }))
        .getByRole("link", { name: "Pricing" })
        .getAttribute("href"),
    ).toBe("/pricing");
    expect(screen.getByRole("group", { name: "Language" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "English", pressed: true })).toBeTruthy();
    const header = screen.getByRole("banner");
    expect(within(header).getAllByRole("link", { name: "Open LMS" })).toHaveLength(1);
    expect(within(header).getByRole("link", { name: "Open LMS" }).getAttribute("href")).toBe("/dashboard");
    expect(header.querySelector('a[href="/login"], a[href="/register"]')).toBeNull();
    expect(screen.getByRole("heading", { name: "Center" })).toBeTruthy();
    expect(screen.getByText("VND 299,000")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yearly" }));
    expect(screen.getByText("VND 2,990,000")).toBeTruthy();
    expect(screen.getByText("VND 7,990,000")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Yearly", pressed: true })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(screen.getByText("VND 299,000")).toBeTruthy();
    for (const tab of screen.getAllByRole("tab")) {
      fireEvent.click(tab);
      expectEnglishContent(container);
    }
    expect(screen.queryByRole("group", { name: "Choose a role to explore its workflow" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "30-day free trial" })).toBeNull();
  });

  it("advertises a 30-day trial and preserves it when switching languages", () => {
    const { container } = inEnglish(<Home />);
    expect(screen.getByText("30-day free trial · No payment card needed")).toBeTruthy();
    expect(screen.getByText("Try it for 30 days. Upgrade when you're ready.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    expect(screen.getByText("Dùng thử 30 ngày · Không cần thẻ thanh toán")).toBeTruthy();
    expect(screen.getByText("Dùng thử 30 ngày. Nâng cấp khi bạn sẵn sàng.")).toBeTruthy();
    expect(container.textContent).not.toMatch(/14(?:-day| days| ngày)/i);
  });

  it.each([
    ["en", "30-day trial"],
    ["vi", "30 ngày dùng thử"],
  ] as const)("keeps registration trial copy consistent in %s", (locale, label) => {
    const { container } = render(
      <FeedbackLocaleProvider initialLocale={locale}>
        <AuthWorkspaceVisual variant="register" />
      </FeedbackLocaleProvider>,
    );
    expect(screen.getByText(label)).toBeTruthy();
    expect(container.textContent).not.toMatch(/14(?:-day| days| ngày)/i);
  });

  it("switches public copy back to Vietnamese without changing destination URLs", () => {
    const { container } = inEnglish(<Home />);
    const heroVisuals = container.querySelectorAll<HTMLElement>("[data-hero-visual]");
    expect(heroVisuals).toHaveLength(1);
    const learningScene = within(heroVisuals[0]).getByRole("img", {
      name: "A teacher guides two students learning with books and a laptop",
    });
    const sceneSource = learningScene.getAttribute("src");
    expect(decodeURIComponent(sceneSource!)).toContain("/marketing/illustrations/learning-together-v2.png");
    const articleCta = screen.getByRole("region", { name: "Ready for your first class?" });
    expect(within(articleCta).getByText("Create your workspace and start your trial in minutes.")).toBeTruthy();
    expect(within(articleCta).getByRole("link", { name: "Get started free" }).getAttribute("href")).toBe("/register");
    expect(within(articleCta).getAllByRole("link")).toHaveLength(1);
    expect(articleCta.querySelector("form, input")).toBeNull();
    expect(within(articleCta).queryByText("Product updates")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Quản lý lớp học.",
    );
    expect(within(heroVisuals[0]).getByRole("img", {
      name: "Giáo viên hướng dẫn hai học sinh học cùng sách và máy tính",
    })).toBe(learningScene);
    expect(learningScene.getAttribute("src")).toBe(sceneSource);
    expect(within(heroVisuals[0]).getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Center" })).toBeTruthy();
    expect(
      within(screen.getByRole("navigation", { name: "Điều hướng chính" }))
        .getByRole("link", { name: "Bài viết" })
        .getAttribute("href"),
    ).toBe("/blog");
    expect(container.querySelector('a[href="/en/blog"]')).toBeNull();
    const vietnameseCta = screen.getByRole("region", { name: "Sẵn sàng cho lớp học đầu tiên?" });
    expect(within(vietnameseCta).getByText("Tạo không gian của bạn và bắt đầu dùng thử trong vài phút.")).toBeTruthy();
    expect(within(vietnameseCta).getByRole("link", { name: "Bắt đầu miễn phí" }).getAttribute("href")).toBe("/register");
    expect(vietnameseCta.querySelector("form, input")).toBeNull();
  });

  it.each([
    ["about", AboutPage],
    ["features", FeaturesPage],
    ["pricing", PricingPage],
    ["contact", ContactPage],
    ["blog", BlogPage],
    ["privacy", PrivacyPage],
    ["terms", TermsPage],
  ] as const)(
    "localizes the %s route and its accessibility copy",
    async (_name, Page) => {
      const { container } = inEnglish(await Page());
      expectEnglishContent(container);
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    },
  );

  it("searches translated article text while keeping category identity stable", () => {
    const { container } = inEnglish(
      <BlogExplorer posts={marketingBlogPosts} />,
    );
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search articles" }),
      { target: { value: "purposeful play" } },
    );
    expect(
      screen.getByRole("heading", {
        name: "Build learning motivation through purposeful play",
      }),
    ).toBeTruthy();
    expect(screen.getByText("1 article")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter articles by category" }), { target: { value: "Động lực học tập" } });
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
    expectEnglishContent(container);
  });

  it.each(marketingBlogPosts.map((post) => [post.slug, post] as const))(
    "translates the full article and metadata for %s",
    async (slug, post) => {
      const props = {
        params: Promise.resolve({ slug }),
      } as PageProps<"/blog/[slug]">;
      const { container } = inEnglish(await BlogPostPage(props));
      expectEnglishContent(container);
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
        marketingMessages[post.title],
      );
      expect(screen.getByText(/Published on/).textContent).toBe(
        `Published on ${new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${post.publishedAt}T00:00:00Z`))}`,
      );
      const metadata = await articleMetadata(props);
      expect(metadata.title).toBe(marketingMessages[post.title]);
      expect(metadata.description).toBe(marketingMessages[post.excerpt]);
    },
  );

  it("uses the same saved locale for server metadata", async () => {
    const englishHome = await homeMetadata();
    expect(englishHome.title).toBe(
      "DX LMS — From one class to a network of centers",
    );
    expect(englishHome.openGraph?.description).toContain("30-day trial");
    expect((await pricingMetadata()).description).toContain("30 days");
    mocks.locale = "vi";
    const vietnameseHome = await homeMetadata();
    expect(vietnameseHome.title).toBe(
      "DX LMS — Từ một lớp học đến chuỗi trung tâm",
    );
    expect(vietnameseHome.openGraph?.description).toContain("30 ngày");
    expect((await pricingMetadata()).description).toContain("30 ngày");
  });

  it("also localizes retained marketing presentations and not-found content", () => {
    const { container } = inEnglish(
      <>
        <LegacyHeader />
        <MarketingHero />
        <AboutSection />
        <MotivationSection />
        <ServicesSection />
        <LegacyPricing />
        <ContactCta />
        <FinalCta />
        <LegacyFooter />
        <NotFoundMarketingPage />
      </>,
    );
    expectEnglishContent(container);
  });
});

describe("marketing static-copy inventory", () => {
  it("does not retain the superseded 14-day offer in marketing or auth translations", () => {
    expect(JSON.stringify({ ...marketingMessages, ...authMessages })).not.toMatch(
      /14(?:-day| days| ngày)/i,
    );
  });

  it("has reviewed translations for all Vietnamese strings in owned marketing sources", () => {
    const directories = [
      "components/marketing",
      ...[
        "about-us",
        "features",
        "pricing",
        "contact-us",
        "blog",
        "privacy-policy",
        "terms-of-use",
        "404",
      ].map((route) => `app/${route}`),
    ];
    const files = [
      "app/page.tsx",
      "app/not-found.tsx",
      "lib/marketing-content.ts",
      ...directories.flatMap((directory) =>
        readdirSync(directory, { recursive: true })
          .filter(
            (entry) =>
              typeof entry === "string" &&
              /\.tsx$/.test(entry) &&
              !entry.includes(".test."),
          )
          .map((entry) => path.join(directory, String(entry))),
      ),
    ];
    const missing: string[] = [];
    const rawJsx: string[] = [];
    const literalNames = new Set([
      "DX",
      "LMS",
      "DX LMS",
      "DX English Center",
      "AN",
      "Center",
      "Business",
      "Enterprise",
      "MongoDB",
      "REST API",
      "JWT",
      "Nginx",
      "© 2026 DX LMS · DolphinX Studio",
    ]);
    let inspected = 0;
    for (const file of files) {
      const activeCatalog = file === "components/marketing/contact-draft.tsx"
        || file === "app/contact-us/page.tsx" ? contactMessages : marketingMessages;
      const source = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      function visit(node: ts.Node) {
        const text = ts.isStringLiteralLike(node)
          ? node.text
          : ts.isJsxText(node)
            ? node.text.replace(/\s+/g, " ").trim()
            : "";
        if (/[À-ỹđĐ]/.test(text)) {
          inspected++;
          if (!Object.hasOwn(activeCatalog, text))
            missing.push(`${file}: ${text}`);
        }
        if (
          ts.isJsxText(node) &&
          /[A-Za-zÀ-ỹđĐ]/.test(text) &&
          !literalNames.has(text)
        )
          rawJsx.push(`${file}: ${text}`);
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    // The simplified pages deliberately remove redundant copy; all remaining
    // source strings must still resolve in the catalog that their view uses.
    expect(inspected).toBeGreaterThan(800);
    expect(missing).toEqual([]);
    expect(rawJsx).toEqual([]);
  });
});
