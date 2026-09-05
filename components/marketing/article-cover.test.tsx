// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FeedbackLanguageSwitcher,
  FeedbackLocaleProvider,
} from "@/components/feedback/feedback-locale";
import { marketingMessages } from "@/lib/i18n/marketing-messages";
import { marketingBlogPosts } from "@/lib/marketing-content";
import { ArticleCover } from "./article-cover";

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function originalSource(image: HTMLImageElement) {
  const source = new URL(image.getAttribute("src")!, "http://localhost");
  return source.searchParams.get("url") ?? source.pathname;
}

describe("article image covers", () => {
  it.each(marketingBlogPosts.map((post) => [post.slug, post] as const))(
    "renders the real lazy-loaded artwork for %s without a metric overlay",
    (_slug, post) => {
      const { container } = render(<ArticleCover post={post} />);
      const images = container.querySelectorAll("img");
      expect(images).toHaveLength(1);
      expect(originalSource(images[0])).toBe(post.hero);
      expect(existsSync(resolve(process.cwd(), "public", post.hero.slice(1)))).toBe(true);
      expect(images[0].getAttribute("loading")).toBe("lazy");
      expect(images[0].getAttribute("data-nimg")).toBe("fill");
      expect(images[0].getAttribute("sizes")).toContain("max-width: 560px");
      expect(images[0].getAttribute("sizes")).toContain("max-width: 809px");
      expect(images[0].getAttribute("sizes")).toContain("386px");
      expect(images[0].getAttribute("alt")).toBe("");
      expect(screen.queryByRole("img")).toBeNull();
      expect(container.querySelector('[data-size="card"]')).toBeTruthy();
      expect(container.textContent).toBe("");
      expect(container.querySelector("svg, strong, p, [data-tone]")).toBeNull();
      expect(container.querySelector('link[rel="preload"]')).toBeNull();
    },
  );

  it("uses three distinct image sources for the homepage articles", () => {
    const { container } = render(
      <>
        {marketingBlogPosts.slice(0, 3).map((post) => (
          <ArticleCover key={post.slug} post={post} />
        ))}
      </>,
    );
    const sources = [...container.querySelectorAll("img")].map(originalSource);
    expect(sources).toEqual(marketingBlogPosts.slice(0, 3).map((post) => post.hero));
    expect(new Set(sources).size).toBe(3);
  });

  it("keeps the same artwork in the large cover with localized alternative text", () => {
    const post = marketingBlogPosts[0];
    const { container } = render(
      <FeedbackLocaleProvider initialLocale="vi">
        <FeedbackLanguageSwitcher />
        <ArticleCover large post={post} />
      </FeedbackLocaleProvider>,
    );
    const image = screen.getByRole("img", { name: post.title }) as HTMLImageElement;
    expect(originalSource(image)).toBe(post.hero);
    expect(image.getAttribute("loading")).toBe("lazy");
    expect(image.getAttribute("sizes")).toContain("1020px");
    expect(image.closest('[data-size="large"]')).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("img", { name: marketingMessages[post.title] })).toBe(image);
    expect(originalSource(image)).toBe(post.hero);
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  it("reserves a stable 16:10 cover and limits hover motion to fine-pointer cards", () => {
    const css = readFileSync(
      resolve(process.cwd(), "components/marketing/article-cover.module.css"),
      "utf8",
    );
    expect(css).toMatch(/\.articleVisual\s*\{[^}]*position:\s*relative;[^}]*aspect-ratio:\s*16\s*\/\s*10;/);
    expect(css).toContain("object-fit: cover");
    expect(css).toContain("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    expect(css).toContain('.articleVisual[data-size="card"]:hover .image');
    expect(css).toContain("scale(1.025)");
    expect(css).not.toMatch(/min-height|articleFlow|articleVisualMain/);
  });
});
