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
    expect(screen.getByRole("heading", { level: 1, name: /Một hệ thống cho mọi quy mô đào tạo/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Bắt đầu gọn. Mở rộng mà không phải đổi hệ thống." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Việc hôm nay đơn giản. Quy mô ngày mai vẫn kiểm soát được." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Đủ cho lớp học. Có chiều sâu cho trung tâm." })).toBeTruthy();
  });

  it("mô tả đúng tám năng lực đã triển khai và không chứa nội dung agency giả", () => {
    const { container } = render(<Home />);
    const services = container.querySelector<HTMLElement>("#nang-luc");

    expect(services).toBeTruthy();
    const cards = within(services!).getAllByRole("article");
    expect(cards).toHaveLength(8);
    expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual([
      "Lớp học & lịch học",
      "Điểm danh theo buổi",
      "Học viên & phụ huynh",
      "Học phí & thu tiền",
      "Cơ cấu nhiều chi nhánh",
      "Phân quyền theo phạm vi",
      "Báo cáo vận hành",
      "Thông báo & nhập dữ liệu",
    ]);

    expect(screen.queryByText(/digital marketing|ui\/ux design|cloud solutions|e-commerce|machine learning/i)).toBeNull();
    expect(screen.queryByText(/testimonial|khách hàng nói|tăng \d+%|giảm \d+%/i)).toBeNull();
    expect(screen.queryByText(/hello@example|\+62|zalo|crm/i)).toBeNull();
    expect(within(services!).getByText("Điểm danh theo buổi")).toBeTruthy();
    expect(within(services!).getByText("Cơ cấu nhiều chi nhánh")).toBeTruthy();
  });

  it("hiển thị đủ bốn mô hình vận hành, không tự đặt giá và có CTA thật", () => {
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
      expect(cards).toHaveLength(4);
      expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual([
        "Lớp một giáo viên",
        "Trung tâm nhỏ",
        "Trung tâm lớn",
        "Chuỗi trung tâm",
      ]);
      expect(within(pricing!).getByRole("article", { name: "Lớp một giáo viên" })).toBe(cards[0]);
      expect(within(pricing!).getByRole("article", { name: "Trung tâm nhỏ" })).toBe(cards[1]);
      expect(within(pricing!).getByRole("article", { name: "Trung tâm lớn" })).toBe(cards[2]);
      expect(within(pricing!).getByRole("article", { name: "Chuỗi trung tâm" })).toBe(cards[3]);

      cards.forEach((card) => expect(card.textContent).not.toMatch(/\d[\d.]*đ/i));
      expect(within(cards[0]).getByRole("link", { name: /Vào hệ thống/i }).getAttribute("href")).toBe("/login");
      expect(within(cards[1]).getByRole("link", { name: /Trao đổi cấu hình/i }).getAttribute("href")).toBe("#lien-he");
      expect(within(cards[2]).getByRole("link", { name: /Thiết kế mô hình/i }).getAttribute("href")).toBe("#lien-he");
      expect(within(cards[3]).getByRole("link", { name: /Trao đổi kiến trúc/i }).getAttribute("href")).toBe("#lien-he");
      expect(
        within(pricing!).getByText(
          /Mỗi workspace mới.*dùng thử tự động/i,
        ),
      ).toBeTruthy();
      expect(pricing!.querySelector('a[href="/register"]')).toBeNull();
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

    const loginLinks = screen.getAllByRole("link", { name: /hệ thống|đăng nhập/i });
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
    fireEvent.click(within(mobileNav).getByRole("link", { name: "Quy mô" }));
    expect(mobileMenu!.open).toBe(false);
    expect(document.activeElement).toBe(container.querySelector("#quy-mo"));

    const hero = container.querySelector<HTMLElement>('[data-section="hero"]');
    fireEvent.click(within(hero!).getByRole("link", { name: "Khám phá DX LMS" }));
    expect(document.activeElement).toBe(container.querySelector("#gioi-thieu"));

    const footer = screen.getByRole("contentinfo");
    fireEvent.click(within(footer).getByRole("link", { name: "Quy mô" }));
    expect(document.activeElement).toBe(container.querySelector("#quy-mo"));

    const desktopNav = screen.getByRole("navigation", { name: "Điều hướng chính" });
    expect(within(desktopNav).getByRole("link", { name: "Quy mô" }).getAttribute("href")).toBe("#quy-mo");
  });

  it("giữ mascot, dashboard và metadata DX LMS trong Server Component", () => {
    render(<Home />);

    const mascot = screen.getByRole("img", { name: "Mascot cá heo 3D của DX LMS" });
    expect(mascot.getAttribute("src")).toContain("dx-lms-dolphin-mascot.png");
    expect(mascot.getAttribute("width")).toBe("1230");
    expect(mascot.getAttribute("height")).toBe("1278");
    expect(mascot.getAttribute("sizes")).toContain("(max-width: 360px) 42vw");
    expect(mascot.getAttribute("sizes")).toContain("(max-width: 1050px) 28vw");
    expect(screen.getByText("DX LMS · Không gian tổ chức")).toBeTruthy();

    expect(metadata.title).toBe("DX LMS — Từ một lớp học đến chuỗi trung tâm");
    expect(metadata.description).toContain("nhiều chi nhánh");
    expect(readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8")).not.toContain('"use client"');
  });

  it("phân bổ sáu mascot trang trí riêng cho sáu section sau hero", () => {
    const { container } = render(<Home />);
    const variants = [...container.querySelectorAll<HTMLElement>("[data-section-mascot]")]
      .map((mascot) => mascot.dataset.sectionMascot);

    expect(variants).toEqual(["about", "motivation", "services", "pricing", "cta", "contact"]);

    for (const variant of variants) {
      expect(existsSync(resolve(
        process.cwd(),
        `public/graphics/dx-lms-dolphin-${variant}.png`,
      ))).toBe(true);
    }
  });

  it("desktop 1440px có header kính 72px, hero hai cột lớn và mosaic DX LMS", () => {
    const css = readFileSync(resolve(process.cwd(), "app/marketing.module.css"), "utf8");
    const hero = readFileSync(resolve(process.cwd(), "components/marketing/marketing-hero.tsx"), "utf8");

    expect(css).toContain("--marketing-blue: #0068d9");
    expect(css).toContain("--marketing-cyan: #12bfe2");
    expect(css).toContain("--marketing-ink: #062347");
    expect(css).toMatch(/\.header\s*{[^}]*height: 72px/);
    expect(css).toMatch(/\.heroInner\s*{[^}]*grid-template-columns: minmax\(0, \.9fr\) minmax\(540px, 1\.1fr\)/);
    expect(css).toMatch(/\.heroCopy h1\s*{[^}]*font-size: clamp\(2\.3rem, 2\.8vw, 2\.75rem\)/);
    expect(css).toMatch(/\.sectionLead h2,[\s\S]*?font-size: clamp\(1\.7rem, 1\.9vw, 2rem\)/);
    expect(css).toContain("@media (min-width: 1440px)");
    expect(css).toMatch(/@media \(min-width: 1440px\)[\s\S]*?\.heroCopy h1\s*{ font-size: 2\.75rem; }/);
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
    expect(css).toMatch(/@media \(max-width: 1050px\)[\s\S]*?\.heroVisual\s*{ height: 510px; }/);
    expect(css).toMatch(/\.valueGrid\s*{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/\.serviceGrid\s*{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/\.pricingGrid\s*{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/@media \(max-width: 1050px\)[\s\S]*?\.pricingGrid\s*{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  });

  it("mobile 360–768px xếp hero dọc, CTA đủ rộng và không tạo overflow ngang", () => {
    const css = readFileSync(resolve(process.cwd(), "app/marketing.module.css"), "utf8");

    expect(css).toContain("overflow-x: clip");
    expect(css).toContain("@media (max-width: 768px)");
    expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.heroInner\s*{[^}]*flex-direction: column/);
    expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.pricingGrid\s*{ grid-template-columns: 1fr; }/);
    expect(css).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.heroActions > a\s*{ width: 100%; }/);
    expect(css).toContain("@media (max-width: 360px)");
    expect(css).toMatch(/@media \(max-width: 360px\)[\s\S]*?\.heroCopy h1\s*{[^}]*font-size: 1\.82rem/);
    expect(css).toMatch(/\.planCard\s*{[^}]*min-width: 0/);
    expect(css).toMatch(/\.planCard > :where\(a\)\s*{[^}]*width: 100%/);
  });

  it("scope Be Vietnam Pro cho landing, giữ focus và dừng motion khi được yêu cầu", () => {
    const css = readFileSync(resolve(process.cwd(), "app/marketing.module.css"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8");
    const layout = readFileSync(resolve(process.cwd(), "app/layout.tsx"), "utf8");
    const header = readFileSync(resolve(process.cwd(), "components/marketing/marketing-header.tsx"), "utf8");
    const motion = readFileSync(resolve(process.cwd(), "components/marketing/marketing-motion.tsx"), "utf8");
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));

    for (const weight of [400, 500, 600, 700, 900]) {
      expect(layout).toContain(`@fontsource/be-vietnam-pro/${weight}.css`);
    }
    expect(layout).toContain('data-scroll-behavior="smooth"');
    expect(packageJson.dependencies["@fontsource/be-vietnam-pro"]).toBeTruthy();
    expect(existsSync(resolve(process.cwd(), "node_modules/@fontsource/be-vietnam-pro/LICENSE"))).toBe(true);
    expect(css).toContain('font-family: "Be Vietnam Pro"');
    expect(css).toContain("font-synthesis: none");
    const fontWeights = [...new Set(
      [...css.matchAll(/font-weight:\s*(\d+)/g)].map((match) => Number(match[1])),
    )].sort((a, b) => a - b);
    expect(fontWeights).toEqual([400, 500, 600, 700, 900]);
    expect(css).toContain("border-radius: 999px");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("scroll-margin-top");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: .01ms !important");
    expect(css).toContain("animation-iteration-count: 1 !important");
    expect(css).toContain("transition-duration: .01ms !important");
    expect(header).toContain("<details");
    expect(header).toContain("<summary");
    expect(page).toContain("<MarketingMotion />");
    expect(motion).toContain("IntersectionObserver");
    expect(motion).toContain("prefers-reduced-motion: reduce");
  });

  it("dùng hệ màu đại dương nhưng tiết chế lưới, glow và chuyển động trang trí", () => {
    const css = readFileSync(resolve(process.cwd(), "app/marketing.module.css"), "utf8");
    const footer = readFileSync(resolve(process.cwd(), "components/marketing/marketing-footer.tsx"), "utf8");

    expect(css).toContain(".headlineGradient");
    expect(css).toContain("linear-gradient(100deg, #0a3f88");
    expect(css).toContain("@keyframes marketingDolphinFloat");
    expect(css).toContain("@keyframes marketingMarquee");
    expect(css).toMatch(/\.heroMarquee\s*{ display: none; }/);
    expect(css).toMatch(/\.servicesSection::before\s*{[\s\S]*?display: none;/);
    expect(css).toMatch(/\.sectionMascot img\s*{[\s\S]*?animation: none;/);
    expect(css).toContain("background: #f6fafc");
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
