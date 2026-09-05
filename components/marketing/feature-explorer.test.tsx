// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureExplorer } from "./feature-explorer";

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("FeatureExplorer", () => {
  it("keeps four real work groups and reveals the matching preview", async () => {
    render(<FeatureExplorer compact />);
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("heading", { name: "Dạy học có lộ trình" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Xem tất cả tính năng" }).getAttribute("href")).toBe("/features");

    fireEvent.click(screen.getByRole("tab", { name: "Lớp học" }));
    expect(await screen.findByRole("heading", { name: "Theo sát từng buổi học" })).toBeTruthy();
    expect(screen.getByText("Nguyễn Minh Anh")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText("Dữ liệu minh họa")).toHaveLength(1));

    fireEvent.click(screen.getByRole("tab", { name: "Vận hành" }));
    expect(await screen.findByRole("heading", { name: "Nắm rõ việc cần xử lý" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Học phí đã thu: 78%" })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Tổ chức" }));
    expect(await screen.findByRole("heading", { name: "Quản lý rõ từng chi nhánh" })).toBeTruthy();
    expect(screen.getByText("Cơ sở Thủ Đức")).toBeTruthy();
  });

  it("shows concise capability details without a self-link on the full features page", () => {
    render(<FeatureExplorer />);
    expect(screen.getByText("Xây giáo trình theo chương, lưu nháp và công bố khi sẵn sàng.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Xem tất cả tính năng" })).toBeNull();
    expect(screen.getAllByText("Dữ liệu minh họa")).toHaveLength(1);
  });
});
