// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import Home, { metadata } from "./page";

afterEach(cleanup);

describe("DX LMS marketing page", () => {
  it("phục vụ landing public với đủ landmark, năng lực và CTA đăng nhập", () => {
    render(<Home />);

    expect(screen.getByRole("banner")).toBeTruthy();
    const main = screen.getByRole("main");
    expect(main.getAttribute("id")).toBe("noi-dung-chinh");
    expect(main.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: /Vận hành đào tạo rõ ràng trong một nơi/i })).toBeTruthy();
    const problemSection = document.querySelector<HTMLElement>("#van-hanh");
    expect(problemSection).toBeTruthy();
    expect(within(problemSection!).getByRole("heading", { name: /Khi dữ liệu đào tạo rời rạc/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Đủ gọn để bắt đầu. Đủ rõ để cùng vận hành." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Mỗi vai trò thấy điều họ cần." })).toBeTruthy();
    expect(screen.getByText("Dữ liệu minh họa")).toBeTruthy();
    const mascot = screen.getByRole("img", { name: "Mascot cá heo 3D của DX LMS" });
    expect(mascot.getAttribute("src")).toContain("dx-lms-dolphin-mascot.png");
    expect(mascot.getAttribute("width")).toBe("1230");
    expect(mascot.getAttribute("height")).toBe("1278");
    expect(mascot.getAttribute("sizes")).toContain("(max-width: 390px) 44vw");
    const heroVisual = mascot.closest("figure")?.parentElement;
    expect(heroVisual).toBeTruthy();
    expect(within(heroVisual!).getByRole("img", { name: /Minh họa dashboard DX LMS/i })).toBeTruthy();
    expect(screen.getByText("Hệ sinh thái DolphinX Studio")).toBeTruthy();

    const loginLinks = screen.getAllByRole("link", { name: /Đăng nhập|Mở workspace/i });
    expect(loginLinks.length).toBeGreaterThanOrEqual(4);
    loginLinks.forEach((link) => expect(link.getAttribute("href")).toBe("/login"));
  });

  it("khai báo metadata trang chủ có tên DX LMS rõ ràng", () => {
    expect(metadata.title).toBe("DX LMS — Nền tảng LMS cho trung tâm đào tạo");
    expect(metadata.description).toContain("DX LMS giúp trung tâm đào tạo nhỏ và vừa");
  });

  it("giữ mọi điều hướng nội trang có đích thật và các điều khiển native dùng được bằng bàn phím", () => {
    const { container } = render(<Home />);
    const anchorLinks = [...container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];

    expect(anchorLinks.length).toBeGreaterThan(0);
    anchorLinks.forEach((link) => {
      expect(container.querySelector(link.getAttribute("href")!)).toBeTruthy();
    });

    const skipLink = screen.getByRole("link", { name: "Bỏ qua điều hướng" });
    fireEvent.click(skipLink);
    expect(document.activeElement).toBe(screen.getByRole("main"));

    const mobileMenu = container.querySelector<HTMLDetailsElement>("header details");
    const menuSummary = screen.getByLabelText("Menu điều hướng");
    expect(mobileMenu).toBeTruthy();
    expect(menuSummary).toBeTruthy();
    menuSummary.focus();
    expect(document.activeElement).toBe(menuSummary);
    fireEvent.click(menuSummary);
    expect(mobileMenu!.open).toBe(true);

    const mobileNav = within(mobileMenu!).getByRole("navigation", { name: "Điều hướng trên thiết bị di động" });
    fireEvent.click(within(mobileNav).getByRole("link", { name: "Sản phẩm" }));
    expect(mobileMenu!.open).toBe(false);
    expect(document.activeElement).toBe(container.querySelector("#san-pham"));

    const faq = screen.getByText("Nền tảng hiện có những module nào?").closest("summary");
    const faqDetails = faq?.closest("details");
    expect(faqDetails?.open).toBe(false);
    faq?.focus();
    expect(document.activeElement).toBe(faq);
    fireEvent.click(faq!);
    expect(faqDetails?.open).toBe(true);
  });

  it("chỉ hiển thị giá Liên hệ và không quảng bá năng lực ngoài phạm vi Web", () => {
    render(<Home />);

    for (const planName of ["Pilot", "Vận hành"]) {
      const plan = screen.getByRole("heading", { level: 3, name: planName }).closest("article");
      expect(plan).toBeTruthy();
      expect(within(plan!).getByText("Liên hệ")).toBeTruthy();
    }

    expect(screen.queryByText(/điểm danh|học phí|phụ huynh|zalo|crm|đa chi nhánh/i)).toBeNull();
    expect(screen.queryByText(/testimonial|khách hàng nói|tăng \d+%/i)).toBeNull();
  });

  it("có guard CSS cho 360px, focus, overflow và reduced motion", () => {
    const css = readFileSync(resolve(process.cwd(), "app/marketing.module.css"), "utf8");
    const hero = readFileSync(resolve(process.cwd(), "components/marketing/marketing-hero.tsx"), "utf8");

    expect(css).toContain("--marketing-navy: #061a35");
    expect(css).toContain("--marketing-blue: #176bff");
    expect(css).toContain("--marketing-cyan: #19cfe8");
    expect(css).toContain("linear-gradient(var(--marketing-grid) 1px, transparent 1px)");
    expect(css).not.toContain("--marketing-orange");
    expect(css).toContain("@media (max-width: 390px)");
    expect(css).toContain("overflow-x: clip");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("scroll-margin-top");
    expect(css).toContain(".dolphinFigure");
    expect(css).toContain(".dolphinImage");
    expect(css).toContain("@media (max-width: 1308px)");
    expect(css).toContain("color: rgba(255, 255, 255, .68)");
    expect(css).not.toMatch(/font-size: [789]px/);
    expect(hero).toContain("sizes=");
    expect(hero).not.toMatch(/\bpreload\b/);
  });

  it("dùng app icon PNG được dẫn xuất từ mascot thay cho favicon mặc định", () => {
    const icon = readFileSync(resolve(process.cwd(), "app/icon.png"));

    expect(icon.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(icon.readUInt32BE(16)).toBe(192);
    expect(icon.readUInt32BE(20)).toBe(192);
    expect(icon.byteLength).toBeGreaterThan(10_000);
    expect(existsSync(resolve(process.cwd(), "public/graphics/dx-lms-dolphin-mascot.png"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "app/favicon.ico"))).toBe(false);
  });
});
