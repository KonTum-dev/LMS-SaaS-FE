// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { marketingBlogPosts, marketingFeatures } from "@/lib/marketing-content";
import Home, { metadata } from "./page";

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class {
    disconnect() {}
    observe() {}
    unobserve() {}
  });
});

afterEach(cleanup);
afterAll(() => vi.unstubAllGlobals());

describe("DX LMS marketing v2", () => {
  it("render đúng shell, hero trung tâm và toàn bộ nhịp nội dung chính", () => {
    const { container } = render(<Home />);

    expect(container.querySelector("[data-marketing-header]")).toBeTruthy();
    expect(screen.getByRole("main").getAttribute("id")).toBe("noi-dung-chinh");
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: /Một nền tảng cho mọi lớp học/i })).toBeTruthy();

    const sectionHeadings = [...container.querySelectorAll("main section h2")].map((heading) => heading.textContent);
    expect(sectionHeadings).toEqual(expect.arrayContaining([
      "Một LMS mạnh mẽ nhưng không làm công việc trở nên nặng nề",
      "Từ đăng ký đến lớp học đầu tiên",
      "Gọn cho hôm nay. Vững cho ngày mai.",
      "Kết nối các mảnh ghép thật sự có trong hệ thống",
      "Bắt đầu miễn phí, mở rộng theo đúng nhu cầu",
      "Mọi điều cần biết trước khi bắt đầu",
    ]));
  });

  it("dùng navbar nổi với đủ route marketing và CTA thật", () => {
    render(<Home />);
    const desktopNav = screen.getByRole("navigation", { name: "Điều hướng chính" });
    for (const [label, href] of [
      ["Trang chủ", "/"],
      ["Tính năng", "/features"],
      ["Về DX LMS", "/about-us"],
      ["Gói dịch vụ", "/pricing"],
      ["Bài viết", "/blog"],
    ]) {
      expect(within(desktopNav).getByRole("link", { name: label }).getAttribute("href")).toBe(href);
    }
    expect(screen.getAllByRole("link", { name: "Dùng thử miễn phí" }).every((link) => link.getAttribute("href") === "/register")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Đăng nhập" }).every((link) => link.getAttribute("href") === "/login")).toBe(true);
  });

  it("có dashboard code-native, logo chính thức và marquee lặp liền mạch", () => {
    const { container } = render(<Home />);
    const heroVisual = container.querySelector<HTMLElement>("[data-hero-visual]");
    expect(heroVisual).toBeTruthy();
    const mark = heroVisual!.querySelector<HTMLImageElement>('img[src*="dolphinx-dolphin-mark-192.webp"]');
    expect(mark).toBeTruthy();
    expect(mark!.getAttribute("src")).toContain("dolphinx-dolphin-mark-192.webp");
    expect(screen.getByText("DX LMS · Workspace trung tâm")).toBeTruthy();
    expect(screen.getByText("Điểm danh nhanh")).toBeTruthy();
    const marquee = screen.getByLabelText("Các năng lực chính");
    expect(within(marquee).getAllByText("Khóa học")).toHaveLength(2);
  });

  it("không bịa giá hoặc testimonial khách hàng", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Dùng thử 14 ngày" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Center" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Enterprise" })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d[\d.]*\s*(?:₫|VNĐ|đ\/tháng)/i);
    expect(screen.getByRole("group", { name: "Chọn vai trò để xem luồng công việc" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Điều hành nhiều cơ sở trong một workspace" })).toBeTruthy();
  });

  it("workbench vai trò có tương tác và pricing không dùng toggle giả", () => {
    render(<Home />);
    const roleGroup = screen.getByRole("group", { name: "Chọn vai trò để xem luồng công việc" });
    fireEvent.click(within(roleGroup).getByRole("button", { name: "Giảng viên" }));
    expect(screen.getByRole("heading", { name: "Đi từ lịch dạy đến hoàn tất buổi học" })).toBeTruthy();
    expect(screen.getByText("28/30 học viên")).toBeTruthy();

    const pricingNote = screen.getByRole("note", { name: "Thông tin dùng thử và báo giá" });
    expect(within(pricingNote).getByText("14 ngày dùng thử miễn phí")).toBeTruthy();
    expect(within(pricingNote).getByText("Báo giá theo cấu hình thực tế")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Theo năm" })).toBeNull();
  });

  it("newsletter chỉ dẫn đến các kênh đang hoạt động", () => {
    render(<Home />);
    const heading = screen.getByRole("heading", { name: "Nhận hướng dẫn vận hành LMS hữu ích" });
    const newsletter = heading.closest("section")!;
    expect(within(newsletter).queryByRole("textbox")).toBeNull();
    expect(within(newsletter).getByRole("link", { name: "Xem bài viết" }).getAttribute("href")).toBe("/blog");
    expect(within(newsletter).getByRole("link", { name: "Tạo workspace" }).getAttribute("href")).toBe("/register");
  });

  it("content và asset blog nhất quán", () => {
    expect(marketingFeatures).toHaveLength(9);
    expect(marketingBlogPosts).toHaveLength(10);
    for (const post of marketingBlogPosts) {
      expect(post.hero.endsWith(".webp")).toBe(true);
      expect(existsSync(resolve(process.cwd(), "public", post.hero.slice(1)))).toBe(true);
    }
  });

  it("giữ metadata, motion, responsive và palette DX", () => {
    const pageSource = readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8");
    const shellSource = readFileSync(resolve(process.cwd(), "components/marketing/site.tsx"), "utf8");
    const motionSource = readFileSync(resolve(process.cwd(), "components/marketing/marketing-motion.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "app/marketing-v2.module.css"), "utf8");

    expect(metadata.title).toBe("DX LMS — Từ một lớp học đến chuỗi trung tâm");
    expect(pageSource).not.toContain('"use client"');
    expect(shellSource).toContain("<MarketingMotion />");
    expect(motionSource).toContain("IntersectionObserver");
    expect(motionSource).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("--m-primary: #0068d9");
    expect(css).toContain("--m-cyan: #12bfe2");
    expect(css).toContain("border-radius: 999px");
    expect(css).toContain("@media (max-width: 809px)");
    expect(css).toContain("@media (max-width: 560px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@keyframes marquee");
  });
});
