// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { marketingBlogPosts, marketingFeatures } from "@/lib/marketing-content";
import Home, { generateMetadata } from "./page";
import { PricingSection } from "@/components/marketing/site";
import PricingPage from "./pricing/page";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { disconnect() {} observe() {} unobserve() {} });
});
afterEach(cleanup);
afterAll(() => vi.unstubAllGlobals());

describe("DX LMS simplified marketing", () => {
  it("presents one clear offer and four useful sections in order", () => {
    const { container } = render(<Home />);
    expect(screen.getByRole("main").id).toBe("noi-dung-chinh");
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Quản lý lớp học.");
    expect([...container.querySelectorAll("main section h2")].map(h => h.textContent)).toEqual([
      "Đủ công cụ. Gọn công việc.",
      "Bắt đầu trong 3 bước",
      "Gói phù hợp với trung tâm của bạn.",
      "Góc học tập & vận hành",
    ]);
    expect(container.querySelector('main [aria-label="Các năng lực chính"]')).toBeNull();
    expect(screen.queryByText("Một lớp kỹ thuật phục vụ toàn bộ luồng")).toBeNull();
  });

  it("keeps three public destinations and one genuine workspace entry in the header", () => {
    render(<Home />);
    const nav = screen.getByRole("navigation", { name: "Điều hướng chính" });
    expect(within(nav).getAllByRole("link").map(a => a.getAttribute("href"))).toEqual(["/features", "/pricing", "/blog"]);
    const header = screen.getByRole("banner");
    expect(within(header).getAllByRole("link", { name: "Vào LMS" })).toHaveLength(1);
    expect(within(header).getByRole("link", { name: "Vào LMS" }).getAttribute("href")).toBe("/dashboard");
    expect(header.querySelector('a[href="/login"], a[href="/register"]')).toBeNull();
    expect(within(header).getByRole("link", { name: "DX LMS — Trang chủ" }).getAttribute("href")).toBe("/");
  });

  it("closes the mobile menu on navigation and Escape and restores keyboard focus", () => {
    render(<Home />);
    const menu = screen.getByRole("banner").querySelector("details")!;
    const summary = menu.querySelector("summary")!;
    menu.open = true;
    const featuresLink = within(menu).getByRole("link", { name: "Tính năng" });
    featuresLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(featuresLink);
    expect(menu.open).toBe(false);
    menu.open = true;
    fireEvent.keyDown(within(menu).getByRole("link", { name: "Bài viết" }), { key: "Escape" });
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });

  it("uses one accessible learning scene and preserves the official brand", () => {
    const { container } = render(<Home />);
    const visual = container.querySelector<HTMLElement>("[data-hero-visual]")!;
    expect(within(visual).getAllByRole("img")).toHaveLength(1);
    const scene = within(visual).getByRole("img", { name: "Giáo viên hướng dẫn hai học sinh học cùng sách và máy tính" });
    expect(decodeURIComponent(scene.getAttribute("src")!)).toContain("learning-together-v2.png");
    expect(visual.querySelectorAll('span[aria-hidden="true"] img')).toHaveLength(3);
    for (const landmark of [screen.getByRole("banner"), screen.getByRole("contentinfo")]) {
      expect(landmark.querySelector('img[src*="dolphinx-dolphin-mark-192.webp"]')).toBeTruthy();
    }
  });

  it("shows three paid plans with working monthly/yearly prices, not a duplicate trial card", () => {
    render(<Home />);
    expect(screen.queryByRole("heading", { name: "Dùng thử 30 ngày" })).toBeNull();
    for (const name of ["Center", "Business", "Enterprise"]) expect(screen.getByRole("heading", { name })).toBeTruthy();
    expect(screen.getByText("299.000đ")).toBeTruthy();
    expect(screen.getByText("799.000đ")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Theo năm" }));
    expect(screen.getByRole("button", { name: "Theo năm", pressed: true })).toBeTruthy();
    expect(screen.getByText("2.990.000đ")).toBeTruthy();
    expect(screen.getByText("7.990.000đ")).toBeTruthy();
    expect(screen.queryByText("299.000đ")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Theo tháng" }));
    expect(screen.getByText("299.000đ")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Chọn vai trò để xem luồng công việc" })).toBeNull();
  });

  it("preserves trial entry and only opens detailed plan comparison on request", () => {
    const { container } = render(<PricingSection />);
    expect(screen.getByRole("link", { name: "Dùng thử gói Center" }).getAttribute("href")).toBe("/register");
    expect(screen.getByRole("link", { name: "Dùng thử rồi nâng cấp" }).getAttribute("href")).toBe("/register");
    expect(screen.getByRole("link", { name: "Trao đổi nhu cầu" }).getAttribute("href")).toBe("/contact-us");
    const detail = container.querySelector("details")!;
    expect(detail.open).toBe(false);
    // jsdom exposes descendants of closed details; browser QA checks visibility.
    expect(detail.querySelector("table")).toBeTruthy();
    fireEvent.click(screen.getByText("Cách tính học viên và so sánh chi tiết"));
    expect(detail.open).toBe(true);
    const comparison = screen.getByRole("table", { name: "So sánh quyền lợi và hạn mức các gói DX LMS" });
    expect(within(comparison).getAllByRole("columnheader")).toHaveLength(5);
    expect(within(comparison).getAllByRole("rowheader")).toHaveLength(6);
    expect(screen.getByRole("region", { name: "Bảng so sánh các gói dịch vụ" }).getAttribute("tabindex")).toBe("0");
  });

  it("starts the pricing page with the actual plan selector and an unambiguous trial note", async () => {
    render(await PricingPage());
    const section = screen.getByRole("heading", { level: 1 }).closest("section")!;
    expect(within(section).getByRole("heading", { name: "Center" })).toBeTruthy();
    expect(within(section).getByText("Dùng thử với hạn mức Center · Không cần thẻ thanh toán")).toBeTruthy();
    expect(screen.getAllByRole("heading", { name: "Gói phù hợp với trung tâm của bạn." })).toHaveLength(1);
  });

  it("ends with a single start action and no unused subscription form", () => {
    render(<Home />);
    const cta = screen.getByRole("region", { name: "Sẵn sàng cho lớp học đầu tiên?" });
    expect(within(cta).getAllByRole("link")).toHaveLength(1);
    expect(within(cta).getByRole("link", { name: "Bắt đầu miễn phí" }).getAttribute("href")).toBe("/register");
    expect(cta.querySelector("form, input, img")).toBeNull();
  });

  it("keeps all editorial content and actual local artwork", () => {
    expect(marketingFeatures).toHaveLength(9);
    expect(marketingBlogPosts).toHaveLength(10);
    for (const post of marketingBlogPosts) expect(existsSync(resolve(process.cwd(), "public", post.hero.slice(1)))).toBe(true);
    expect(new Set(marketingBlogPosts.slice(0, 3).map(p => p.hero)).size).toBe(3);
  });

  it("retains server metadata, reduced motion, focus styles and responsive breakpoints", async () => {
    const source = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
    expect((await generateMetadata()).title).toBe("DX LMS — Từ một lớp học đến chuỗi trung tâm");
    expect(source("app/page.tsx")).not.toContain('"use client"');
    expect(source("components/marketing/marketing-motion.tsx")).toContain("prefers-reduced-motion: reduce");
    const css = source("app/marketing-v2.module.css");
    expect(css).toContain("--m-primary: #0068d9");
    expect(css).toContain(".comparison:focus-visible");
    expect(css).toContain("@media (max-width: 809px)");
    expect(css).toContain("@media (max-width: 560px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
