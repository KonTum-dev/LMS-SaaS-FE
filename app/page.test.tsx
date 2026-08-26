// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Home, { metadata } from "./page";

afterEach(cleanup);

describe("DX LMS digital-agency landing", () => {
  it("giữ đúng nhịp Hero → About → Motivation → Services → CTA → Contact", () => {
    const { container } = render(<Home />);
    const sections = [...container.querySelectorAll<HTMLElement>("main [data-section]")]
      .map((section) => section.dataset.section);

    expect(sections).toEqual(["hero", "about", "motivation", "services", "cta", "contact"]);
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
    expect(screen.queryByText(/Liên hệ theo phạm vi|trial|dùng thử|hello@example|\+62/i)).toBeNull();
    expect(screen.queryByText(/điểm danh|học phí|phụ huynh|zalo|crm|đa chi nhánh/i)).toBeNull();
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
    fireEvent.click(within(mobileNav).getByRole("link", { name: "Năng lực" }));
    expect(mobileMenu!.open).toBe(false);
    expect(document.activeElement).toBe(container.querySelector("#nang-luc"));

    const hero = container.querySelector<HTMLElement>('[data-section="hero"]');
    fireEvent.click(within(hero!).getByRole("link", { name: "Khám phá DX LMS" }));
    expect(document.activeElement).toBe(container.querySelector("#gioi-thieu"));

    const footer = screen.getByRole("contentinfo");
    fireEvent.click(within(footer).getByRole("link", { name: "Giá trị" }));
    expect(document.activeElement).toBe(container.querySelector("#gia-tri"));
  });

  it("giữ mascot, dashboard và metadata DX LMS trong Server Component", () => {
    render(<Home />);

    const mascot = screen.getByRole("img", { name: "Mascot cá heo 3D của DX LMS" });
    expect(mascot.getAttribute("src")).toContain("dx-lms-dolphin-mascot.png");
    expect(mascot.getAttribute("width")).toBe("1230");
    expect(mascot.getAttribute("height")).toBe("1278");
    expect(mascot.getAttribute("sizes")).toContain("(max-width: 360px) 34vw");
    expect(screen.getByText("DX LMS · Workspace tổ chức")).toBeTruthy();

    expect(metadata.title).toBe("DX LMS — Một workspace rõ ràng cho vận hành đào tạo");
    expect(metadata.description).toContain("workspace riêng của từng tổ chức");
    expect(readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8")).not.toContain('"use client"');
  });

  it("có visual responsive, focus, overflow và reduced-motion từ 360 đến 1440px", () => {
    const css = readFileSync(resolve(process.cwd(), "app/marketing.module.css"), "utf8");
    const header = readFileSync(resolve(process.cwd(), "components/marketing/marketing-header.tsx"), "utf8");

    expect(css).toContain("min-height: max(720px, 100svh)");
    expect(css).toContain("border-radius: 999px");
    expect(css).toContain("overflow-x: clip");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("scroll-margin-top");
    expect(css).toContain("@media (max-width: 1050px)");
    expect(css).toContain("@media (max-width: 768px)");
    expect(css).toContain("@media (max-width: 390px)");
    expect(css).toContain("@media (max-width: 360px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".footerWave");
    expect(css).toMatch(/\.compactButton\s*{[^}]*background: var\(--marketing-blue-deep\)/);
    expect(css).toMatch(/\.primaryButton\s*{[^}]*background: var\(--marketing-blue-deep\)/);
    expect(css).toMatch(/\.servicesSection\s*{[^}]*background: var\(--marketing-blue-deep\)/);
    expect(css).toMatch(/\.sectionLabelLight\s*{[^}]*background: rgba\(3, 30, 65, \.72\)/);
    expect(css).toMatch(/\.scrollCue\s*{[^}]*color: var\(--marketing-muted\)/);
    expect(css).toMatch(/\.mobileMenu nav a:last-child\s*{[^}]*background: var\(--marketing-blue-deep\)/);
    expect(css).toMatch(/\.kickerMark\s*{[^}]*background: var\(--marketing-blue-deep\)/);
    expect(css).toContain("animation-duration: .01ms !important");
    expect(css).toContain("animation-iteration-count: 1 !important");
    expect(css).not.toMatch(/font-size: [789]px/);
    expect(header).toContain("<details");
    expect(header).toContain("<summary");
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
