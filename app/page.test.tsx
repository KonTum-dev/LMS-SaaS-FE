// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import styles from "./marketing.module.css";
import Home, { metadata } from "./page";

afterEach(cleanup);

describe("DX LMS landing theo ngôn ngữ hình học", () => {
  it("giữ đúng nhịp Hero → About → Motivation → Services → Pricing → CTA → Contact", () => {
    const { container } = render(<Home />);
    const sections = [...container.querySelectorAll<HTMLElement>("main [data-section]")]
      .map((section) => section.dataset.section);

    expect(sections).toEqual(["hero", "about", "motivation", "services", "pricing", "cta", "contact"]);
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("main").getAttribute("id")).toBe("noi-dung-chinh");
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: /Một nơi để vận hành đào tạo rõ ràng hơn/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Gọn để bắt đầu. Rõ để cùng vận hành." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Bớt phân mảnh. Thêm một nhịp làm việc chung." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Những module Web tạo nên DX LMS." })).toBeTruthy();
  });

  it("chỉ mô tả sáu module Web đang tồn tại và không chứa nội dung agency giả", () => {
    const { container } = render(<Home />);
    const services = container.querySelector<HTMLElement>("#nang-luc");

    expect(services).toBeTruthy();
    const cards = within(services!).getAllByRole("article");
    expect(cards).toHaveLength(6);
    expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual([
      "Người dùng",
      "Khóa học",
      "Ghi danh",
      "Bài tập",
      "Dashboard",
      "Tùy biến tenant",
    ]);

    expect(screen.queryByText(/digital marketing|ui\/ux design|cloud solutions|e-commerce|machine learning/i)).toBeNull();
    expect(screen.queryByText(/testimonial|khách hàng nói|tăng \d+%|giảm \d+%/i)).toBeNull();
    expect(screen.queryByText(/trial|dùng thử|hello@example|\+62/i)).toBeNull();
    expect(screen.queryByText(/điểm danh|học phí|phụ huynh|zalo|crm|đa chi nhánh/i)).toBeNull();
  });

  it("hiển thị ba hướng mua với giá khởi đầu và CTA thật", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    try {
      const { container } = render(<Home />);
      const services = container.querySelector<HTMLElement>('[data-section="services"]');
      const pricing = container.querySelector<HTMLElement>('[data-section="pricing"]');
      const finalCta = container.querySelector<HTMLElement>('[data-section="cta"]');

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(pricing).toBeTruthy();
      expect(services!.nextElementSibling).toBe(pricing);
      expect(pricing!.nextElementSibling).toBe(finalCta);
      expect(pricing!.querySelector(`.${styles.pricingGrid}`)).toBeTruthy();

      const cards = within(pricing!).getAllByRole("article");
      expect(cards).toHaveLength(3);
      expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual([
        "Lớp học thêm",
        "Trung tâm",
        "Trường học",
      ]);
      expect(within(pricing!).getByRole("article", { name: "Lớp học thêm" })).toBe(cards[0]);
      expect(within(pricing!).getByRole("article", { name: "Trung tâm" })).toBe(cards[1]);
      expect(within(pricing!).getByRole("article", { name: "Trường học" })).toBe(cards[2]);

      expect(within(cards[0]).getByText("199.000đ")).toBeTruthy();
      expect(within(cards[0]).getByText("hoặc 1.990.000đ/năm")).toBeTruthy();
      expect(within(cards[0]).getByRole("link", { name: /Bắt đầu với gói này/i }).getAttribute("href")).toBe("/login");

      for (const card of cards.slice(1)) {
        expect(within(card).getByText("Liên hệ")).toBeTruthy();
        expect(within(card).getByText("Chi phí theo phạm vi")).toBeTruthy();
        expect(card.textContent).not.toMatch(/\d[\d.]*đ/i);
      }
      expect(within(cards[1]).getByRole("link", { name: /Trao đổi phạm vi/i }).getAttribute("href")).toBe("#lien-he");
      expect(within(cards[2]).getByRole("link", { name: /Liên hệ trao đổi/i }).getAttribute("href")).toBe("#lien-he");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("dùng anchor thật, CTA /login và menu native hoạt động bằng bàn phím", () => {
    const { container } = render(<Home />);
    const anchorLinks = [...container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];

    expect(anchorLinks.length).toBeGreaterThan(0);
    anchorLinks.forEach((link) => {
      expect(container.querySelector(link.getAttribute("href")!)).toBeTruthy();
    });

    const loginLinks = screen.getAllByRole("link", { name: /workspace|đăng nhập/i });
    expect(loginLinks.length).toBeGreaterThanOrEqual(5);
    loginLinks.forEach((link) => expect(link.getAttribute("href")).toBe("/login"));

    const skipLink = screen.getByRole("link", { name: "Bỏ qua điều hướng" });
    fireEvent.click(skipLink);
    expect(document.activeElement).toBe(screen.getByRole("main"));

    const mobileMenu = container.querySelector<HTMLDetailsElement>("header details");
    const menuSummary = screen.getByLabelText("Menu điều hướng");
    expect(mobileMenu).toBeTruthy();
    menuSummary.focus();
    expect(document.activeElement).toBe(menuSummary);
    fireEvent.click(menuSummary);
    expect(mobileMenu!.open).toBe(true);

    const mobileNav = within(mobileMenu!).getByRole("navigation", {
      name: "Điều hướng trên thiết bị di động",
    });
    fireEvent.click(within(mobileNav).getByRole("link", { name: "Bảng giá" }));
    expect(mobileMenu!.open).toBe(false);
    expect(document.activeElement).toBe(container.querySelector("#bang-gia"));

    const hero = container.querySelector<HTMLElement>('[data-section="hero"]');
    fireEvent.click(within(hero!).getByRole("link", { name: "Khám phá DX LMS" }));
    expect(document.activeElement).toBe(container.querySelector("#gioi-thieu"));

    const footer = screen.getByRole("contentinfo");
    fireEvent.click(within(footer).getByRole("link", { name: "Bảng giá" }));
    expect(document.activeElement).toBe(container.querySelector("#bang-gia"));

    const desktopNav = screen.getByRole("navigation", { name: "Điều hướng chính" });
    expect(within(desktopNav).getByRole("link", { name: "Bảng giá" }).getAttribute("href")).toBe("#bang-gia");
  });

  it("giữ mascot, dashboard và metadata DX LMS trong Server Component", () => {
    render(<Home />);

    const mascot = screen.getByRole("img", { name: "Mascot cá heo 3D của DX LMS" });
    expect(mascot.getAttribute("src")).toContain("dx-lms-dolphin-mascot.png");
    expect(mascot.getAttribute("width")).toBe("1230");
    expect(mascot.getAttribute("height")).toBe("1278");
    expect(mascot.getAttribute("sizes")).toContain("(max-width: 360px) 42vw");
    expect(mascot.getAttribute("sizes")).toContain("(max-width: 1050px) 28vw");
    expect(screen.getByText("DX LMS · Workspace tổ chức")).toBeTruthy();

    expect(metadata.title).toBe("DX LMS — Một workspace rõ ràng cho vận hành đào tạo");
    expect(metadata.description).toContain("workspace riêng của từng tổ chức");
    expect(readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8")).not.toContain('"use client"');
  });

  it("desktop 1440px có header 64px, hero hai cột 64px và mosaic DX LMS", () => {
    const css = readFileSync(resolve(process.cwd(), "app/marketing.module.css"), "utf8");
    const hero = readFileSync(resolve(process.cwd(), "components/marketing/marketing-hero.tsx"), "utf8");

    expect(css).toContain("--marketing-blue: #0068ff");
    expect(css).toContain("--marketing-ink: #141415");
    expect(css).toMatch(/\.header\s*{[^}]*height: 64px/);
    expect(css).toMatch(/\.heroInner\s*{[^}]*grid-template-columns: minmax\(0, \.88fr\) minmax\(540px, 1\.12fr\)/);
    expect(css).toMatch(/\.heroCopy h1\s*{[^}]*font-size: clamp\(3\.4rem, 4\.45vw, 4rem\)/);
    expect(css).toContain("@media (min-width: 1440px)");
    expect(css).toMatch(/@media \(min-width: 1440px\)[\s\S]*?\.heroCopy h1\s*{ font-size: 4rem; }/);
    expect(hero).toContain("styles.heroVisual");
    expect(hero).toContain("styles.mosaicSquare");
    expect(hero).toContain("styles.mosaicPill");
    expect(hero).toContain("styles.mosaicDot");
    expect(hero).toContain("<WorkspacePreview />");
  });

  it("tablet 769–1050px co hero và card theo grid trước khi tràn", () => {
    const css = readFileSync(resolve(process.cwd(), "app/marketing.module.css"), "utf8");

    expect(css).toContain("@media (max-width: 1050px)");
    expect(css).toMatch(/@media \(max-width: 1050px\)[\s\S]*?\.heroInner\s*{[^}]*grid-template-columns: minmax\(0, \.92fr\) minmax\(360px, 1\.08fr\)/);
    expect(css).toMatch(/@media \(max-width: 1050px\)[\s\S]*?\.heroVisual\s*{ height: 500px; }/);
    expect(css).toMatch(/\.valueGrid\s*{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/\.serviceGrid\s*{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  });

  it("mobile 360–768px xếp hero dọc, CTA đủ rộng và không tạo overflow ngang", () => {
    const css = readFileSync(resolve(process.cwd(), "app/marketing.module.css"), "utf8");

    expect(css).toContain("overflow-x: clip");
    expect(css).toContain("@media (max-width: 768px)");
    expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.heroInner\s*{[^}]*flex-direction: column/);
    expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.pricingGrid\s*{ grid-template-columns: 1fr; }/);
    expect(css).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.heroActions > a\s*{ width: 100%; }/);
    expect(css).toContain("@media (max-width: 360px)");
    expect(css).toMatch(/@media \(max-width: 360px\)[\s\S]*?\.heroCopy h1\s*{[^}]*font-size: 2\.5rem/);
    expect(css).toMatch(/\.planCard\s*{[^}]*min-width: 0/);
    expect(css).toMatch(/\.planCard > :where\(a\)\s*{[^}]*width: 100%/);
  });

  it("scope Be Vietnam Pro cho landing, giữ focus và dừng motion khi được yêu cầu", () => {
    const css = readFileSync(resolve(process.cwd(), "app/marketing.module.css"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8");
    const header = readFileSync(resolve(process.cwd(), "components/marketing/marketing-header.tsx"), "utf8");
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));

    for (const weight of [400, 500, 700, 900]) {
      expect(page).toContain(`@fontsource/be-vietnam-pro/${weight}.css`);
    }
    expect(packageJson.dependencies["@fontsource/be-vietnam-pro"]).toBeTruthy();
    expect(existsSync(resolve(process.cwd(), "node_modules/@fontsource/be-vietnam-pro/LICENSE"))).toBe(true);
    expect(css).toContain('font-family: "Be Vietnam Pro"');
    expect(css).toContain("font-synthesis: none");
    const fontWeights = [...new Set(
      [...css.matchAll(/font-weight:\s*(\d+)/g)].map((match) => Number(match[1])),
    )].sort((a, b) => a - b);
    expect(fontWeights).toEqual([400, 500, 700, 900]);
    expect(css).toContain("border-radius: 999px");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("scroll-margin-top");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: .01ms !important");
    expect(css).toContain("animation-iteration-count: 1 !important");
    expect(css).toContain("transition-duration: .01ms !important");
    expect(header).toContain("<details");
    expect(header).toContain("<summary");
  });

  it("xen kẽ bề mặt trắng–navy–kem và kết thúc bằng footer xanh đặc", () => {
    const css = readFileSync(resolve(process.cwd(), "app/marketing.module.css"), "utf8");
    const footer = readFileSync(resolve(process.cwd(), "components/marketing/marketing-footer.tsx"), "utf8");

    expect(css).toMatch(/\.hero\s*{[^}]*background: var\(--marketing-white\)/);
    expect(css).toMatch(/\.motivationSection\s*{[^}]*background: var\(--marketing-cream\)/);
    expect(css).toMatch(/\.servicesSection\s*{[^}]*background: var\(--marketing-navy\)/);
    expect(css).toMatch(/\.pricingSection\s*{[^}]*background: var\(--marketing-cream\)/);
    expect(css).toMatch(/\.footer\s*{[^}]*background: var\(--marketing-blue\)/);
    expect(css).not.toContain("linear-gradient");
    expect(footer).not.toContain("footerWave");
  });

  it("tiếp tục dùng icon PNG dẫn xuất từ mascot", () => {
    const icon = readFileSync(resolve(process.cwd(), "app/icon.png"));

    expect(icon.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(icon.readUInt32BE(16)).toBe(192);
    expect(icon.readUInt32BE(20)).toBe(192);
    expect(icon.byteLength).toBeGreaterThan(10_000);
    expect(existsSync(resolve(process.cwd(), "public/graphics/dx-lms-dolphin-mascot.png"))).toBe(true);
  });
});
