// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackLanguageSwitcher, FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";
import { FeedbackProvider } from "@/components/feedback/feedback-provider";
import AssessmentReportsPage from "./page";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), role: "TENANT_ADMIN", listError: false, assessmentTotal: 110 }));
vi.mock("@/lib/api", async (original) => ({ ...await original<typeof import("@/lib/api")>(), apiFetch: mocks.apiFetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/providers/app-providers", () => ({ useAuth: () => ({
  token: "tenant-token",
  user: { sub: "manager", role: mocks.role, tenantId: "tenant-1", membershipId: "membership-1" },
  organization: { _id: "tenant-1" },
  effectiveAccess: { state: "ACTIVE", readOnly: false, modules: ["COURSES", "ENROLLMENTS", "ASSESSMENTS"] },
}) }));
vi.mock("antd", async () => ({
  ...(await import("@/test-utils/lightweight-antd")).lightweightAntd,
  Select: ({ "aria-label": label, onChange, options = [], value, showSearch }: {
    "aria-label"?: string;
    onChange: (value: string | undefined) => void;
    options?: Array<{ value: string; label: string }>;
    value?: string;
    showSearch?: boolean;
  }) => <select aria-label={label} data-searchable={Boolean(showSearch)} value={value ?? ""} onChange={(event) => onChange(event.target.value || undefined)}>
    <option value="" />{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>,
}));

function renderPage(locale: "vi" | "en" = "vi") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={client}><FeedbackLocaleProvider initialLocale={locale}>
    <FeedbackLanguageSwitcher /><FeedbackProvider><AssessmentReportsPage /></FeedbackProvider>
  </FeedbackLocaleProvider></QueryClientProvider>);
}
const reportCalls = () => mocks.apiFetch.mock.calls.filter(([path]) => String(path).startsWith("/assessment-attempts?"));

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  mocks.role = "TENANT_ADMIN";
  mocks.listError = false;
  mocks.assessmentTotal = 110;
  mocks.apiFetch.mockReset();
  mocks.apiFetch.mockImplementation((path: string) => {
    const params = new URLSearchParams(path.split("?")[1]);
    const page = Number(params.get("page") ?? 1);
    const limit = Number(params.get("limit") ?? 20);
    if (path === "/courses") return Promise.resolve([{ _id: "course-1", title: "Khóa Một" }]);
    if (path.startsWith("/assessments?")) return Promise.resolve({
      page, limit, total: mocks.assessmentTotal,
      items: Array.from({ length: Math.max(0, Math.min(limit, mocks.assessmentTotal - (page - 1) * limit)) }, (_, index) => ({
        _id: `assessment-${(page - 1) * limit + index + 1}`,
        title: `Bài kiểm tra ${(page - 1) * limit + index + 1}`,
      })),
    });
    if (path.startsWith("/assessment-attempts?")) {
      if (mocks.listError) return Promise.reject(new Error("private backend failure"));
      return Promise.resolve({ page, limit, total: 61, items: [{
        _id: "attempt-1", assessmentId: params.get("assessmentId") ?? "assessment-101", assessmentTitle: "Tên phiên bản đã công bố", courseId: "course-1",
        learner: { fullName: "Nguyễn Lan", email: "lan@example.test" }, attemptNumber: 1, status: "SUBMITTED",
        score: 8, maxScore: 10, percentage: 80, passed: true, startedAt: "2026-09-04T00:00:00.000Z",
      }] });
    }
    return Promise.reject(new Error(`Unexpected path ${path}`));
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("assessment report list controls", () => {
  it("requests the chosen page size, trims explicit search and clears all filters without losing size", async () => {
    renderPage("en");
    await screen.findByText("Nguyễn Lan");
    const report = screen.getByRole("region", { name: "Assessment attempts" });
    fireEvent.click(within(report).getByRole("button", { name: "Trang sau" }));
    await waitFor(() => expect(reportCalls().at(-1)?.[0]).toContain("page=2"));
    fireEvent.change(within(report).getByLabelText("Rows per page"), { target: { value: "50" } });
    await waitFor(() => expect(reportCalls().at(-1)?.[0]).toBe("/assessment-attempts?limit=50&page=1"));
    const input = screen.getByLabelText("Find learners by name or email");
    const count = reportCalls().length;
    fireEvent.change(input, { target: { value: " Lan " } });
    expect(reportCalls()).toHaveLength(count);
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(reportCalls().at(-1)?.[0]).toBe("/assessment-attempts?limit=50&page=1&search=Lan"));
    fireEvent.change(screen.getByLabelText("Filter by course"), { target: { value: "course-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(reportCalls().at(-1)?.[0]).toBe("/assessment-attempts?limit=50&page=1"));
    expect((input as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    expect(screen.getByLabelText("Tìm học viên theo tên hoặc email")).toBe(input);
    expect(within(report).getByLabelText("Số dòng mỗi trang")).toHaveProperty("value", "50");
  });

  it("makes assessments beyond the first 100 reachable and retains the selected label across picker pages", async () => {
    renderPage();
    await screen.findByText("Nguyễn Lan");
    const picker = screen.getByLabelText("Lọc theo bài kiểm tra") as HTMLSelectElement;
    expect(picker.getAttribute("data-searchable")).toBe("false");
    for (let page = 2; page <= 6; page += 1) {
      fireEvent.click(within(await screen.findByRole("navigation", { name: "Phân trang bài kiểm tra" })).getByRole("button", { name: "Trang sau" }));
      await screen.findByRole("option", { name: `Bài kiểm tra ${(page - 1) * 20 + 1}` });
    }
    fireEvent.change(picker, { target: { value: "assessment-101" } });
    await waitFor(() => expect(reportCalls().at(-1)?.[0]).toContain("assessmentId=assessment-101"));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Phân trang bài kiểm tra" })).getByRole("button", { name: "Trang trước" }));
    await screen.findByRole("option", { name: "Bài kiểm tra 81" });
    expect(picker.value).toBe("assessment-101");
    expect(picker.selectedOptions[0].textContent).toBe("Bài kiểm tra 101");
    fireEvent.change(screen.getByLabelText("Lọc theo khóa học"), { target: { value: "course-1" } });
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith("/assessments?courseId=course-1&limit=20&page=1", { token: "tenant-token" }));
    expect(picker.value).toBe("");
  });

  it("uses the authorized report title independently of the directory page and without translating user content", async () => {
    renderPage("en");
    await screen.findByText("Nguyễn Lan");
    const report = screen.getByRole("region", { name: "Assessment attempts" });
    expect(within(report).getByText("Tên phiên bản đã công bố")).toBeTruthy();
    expect(within(report).queryByText("assessment-101")).toBeNull();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Assessment pages" })).getByRole("button", { name: "Trang sau" }));
    await screen.findByRole("option", { name: "Bài kiểm tra 21" });
    expect(within(report).getByText("Tên phiên bản đã công bố")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    expect(within(report).getByText("Tên phiên bản đã công bố")).toBeTruthy();
    expect(mocks.apiFetch.mock.calls.some(([path]) => /\/assessments\/[^?]+/.test(String(path)))).toBe(false);
  });

  it("clamps a picker page when a completed server response has fewer pages", async () => {
    renderPage();
    await screen.findByText("Nguyễn Lan");
    mocks.assessmentTotal = 15;
    fireEvent.click(within(screen.getByRole("navigation", { name: "Phân trang bài kiểm tra" })).getByRole("button", { name: "Trang sau" }));
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith("/assessments?limit=20&page=2", { token: "tenant-token" }));
    await waitFor(() => expect(mocks.apiFetch.mock.calls.filter(([path]) => String(path).startsWith("/assessments?")).at(-1)?.[0]).toBe("/assessments?limit=20&page=1"));
    expect(await screen.findByRole("option", { name: "Bài kiểm tra 1" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("navigation", { name: "Phân trang bài kiểm tra" })).toBeNull());
  });

  it("keeps retry and filters available after a list error without rendering stale results", async () => {
    mocks.listError = true;
    renderPage();
    await screen.findByText("Không tải được lượt làm");
    expect(screen.queryByText("private backend failure")).toBeNull();
    expect(screen.queryByText("Chưa có lượt làm phù hợp bộ lọc")).toBeNull();
    expect(screen.getByLabelText("Tìm học viên theo tên hoặc email")).toBeTruthy();
    mocks.listError = false;
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Nguyễn Lan")).toBeTruthy();
  });

  it("does not fetch manager data for a learner", async () => {
    mocks.role = "LEARNER";
    renderPage();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});
