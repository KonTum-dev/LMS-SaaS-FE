// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";
import { ContactDraft } from "./contact-draft";

const notices = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/feedback/feedback-provider", () => ({ useFeedback: () => ({ notification: notices }) }));
const NativeURL = URL;
const writeText = vi.fn<(text: string) => Promise<void>>();
const createObjectURL = vi.fn<(blob: Blob) => string>();
const revokeObjectURL = vi.fn();
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  writeText.mockResolvedValue(undefined);
  createObjectURL.mockReturnValue("blob:local-draft");
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  vi.stubGlobal("URL", Object.assign(class extends NativeURL {}, { createObjectURL, revokeObjectURL }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function openDraft(locale: "vi" | "en" = "vi") {
  const result = render(<FeedbackLocaleProvider initialLocale={locale}><ContactDraft /></FeedbackLocaleProvider>);
  const details = result.container.querySelector("details")!;
  expect(details.open).toBe(false);
  fireEvent.click(details.querySelector("summary")!);
  return result;
}

describe("ContactDraft", () => {
  it("is optional, has only three fields and explains that nothing is sent", () => {
    openDraft();
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
    expect(screen.getByText(/Bản nháp chỉ ở trang này/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Gửi/ })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires meaningful text but does not require organization or email", async () => {
    openDraft();
    fireEvent.change(screen.getByLabelText("Nội dung cần trao đổi"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Sao chép bản nháp" }));
    expect(await screen.findByText("Nhập nội dung trước khi sao chép hoặc tải về.")).toBeTruthy();
    expect(writeText).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Nội dung cần trao đổi"), { target: { value: "  Cần quản lý lớp học  " } });
    fireEvent.click(screen.getByRole("button", { name: "Sao chép bản nháp" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain("Nội dung:\nCần quản lý lớp học");
    expect(writeText.mock.calls[0][0]).not.toContain("Email:");
    expect(notices.error).not.toHaveBeenCalled();
  });

  it("holds loading, prevents duplicate actions, then announces the actual copy", async () => {
    let resolveCopy!: () => void;
    writeText.mockReturnValue(new Promise<void>((resolve) => { resolveCopy = resolve; }));
    openDraft();
    fireEvent.change(screen.getByLabelText("Nội dung cần trao đổi"), { target: { value: "Quản lý lớp và học phí" } });
    const copy = screen.getByRole("button", { name: "Sao chép bản nháp" });
    fireEvent.click(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(copy.className).toContain("ant-btn-loading");
    expect((screen.getByRole("button", { name: "Tải bản nháp (.txt)" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(copy);
    expect(writeText).toHaveBeenCalledTimes(1);
    await act(async () => resolveCopy());
    expect(notices.success.mock.calls[0][0].title.props.children).toBe("Đã sao chép bản nháp");
    expect(notices.success.mock.calls[0][0].description.props.children).toBe("Bản nháp chưa được gửi đến DX LMS.");
    expect(copy.className).not.toContain("ant-btn-loading");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it("keeps the input and offers a download fallback when clipboard access fails", async () => {
    writeText.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    openDraft();
    fireEvent.change(screen.getByLabelText("Nội dung cần trao đổi"), { target: { value: "Quản lý học viên" } });
    fireEvent.click(screen.getByRole("button", { name: "Sao chép bản nháp" }));
    await waitFor(() => expect(notices.error).toHaveBeenCalledTimes(1));
    expect(notices.error.mock.calls[0][0].description.props.children).toContain("Bạn có thể tải bản nháp");
    expect((screen.getByLabelText("Nội dung cần trao đổi") as HTMLTextAreaElement).value).toBe("Quản lý học viên");
    expect(notices.success).not.toHaveBeenCalled();
  });

  it("validates an optional email when supplied", async () => {
    openDraft();
    fireEvent.change(screen.getByLabelText("Nội dung cần trao đổi"), { target: { value: "Tìm hiểu DX LMS" } });
    fireEvent.change(screen.getByLabelText("Email (không bắt buộc)"), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Sao chép bản nháp" }));
    expect(await screen.findByText("Email chưa đúng định dạng.")).toBeTruthy();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("creates a local text download with the entered fields and releases the URL", async () => {
    const links: { href: string; filename: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { links.push({ href: this.href, filename: this.download }); });
    openDraft();
    fireEvent.change(screen.getByLabelText("Nội dung cần trao đổi"), { target: { value: "Cần lớp trực tuyến" } });
    fireEvent.change(screen.getByLabelText("Tổ chức (không bắt buộc)"), { target: { value: "Trung tâm Ánh Dương" } });
    fireEvent.change(screen.getByLabelText("Email (không bắt buộc)"), { target: { value: "hello@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Tải bản nháp (.txt)" }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("text/plain;charset=utf-8");
    const content = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob); });
    expect(content).toContain("Tổ chức: Trung tâm Ánh Dương");
    expect(content).toContain("Email: hello@example.com");
    expect(content).toContain("Cần lớp trực tuyến");
    expect(links).toEqual([{ href: "blob:local-draft", filename: "dx-lms-request-draft.txt" }]);
    expect(notices.success.mock.calls[0][0].title.props.children).toBe("Đã chuẩn bị tệp bản nháp");
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-draft"), { timeout: 1600 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it("reports download preparation failures without claiming success", async () => {
    createObjectURL.mockImplementation(() => { throw new Error("Unavailable"); });
    openDraft();
    fireEvent.change(screen.getByLabelText("Nội dung cần trao đổi"), { target: { value: "Tìm hiểu DX LMS" } });
    fireEvent.click(screen.getByRole("button", { name: "Tải bản nháp (.txt)" }));
    await waitFor(() => expect(notices.error).toHaveBeenCalledTimes(1));
    expect(notices.error.mock.calls[0][0].title.props.children).toBe("Không thể tạo tệp bản nháp");
    expect(notices.success).not.toHaveBeenCalled();
  });

  it("localizes the helper, exported text and success notice in English", async () => {
    openDraft("en");
    fireEvent.change(screen.getByLabelText("What would you like to discuss?"), { target: { value: "Course management" } });
    fireEvent.click(screen.getByRole("button", { name: "Copy draft" }));
    await waitFor(() => expect(notices.success).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain("DX LMS — Discussion draft");
    expect(writeText.mock.calls[0][0]).toContain("Your draft has not been sent to DX LMS.");
    expect(notices.success.mock.calls[0][0].title.props.children).toBe("Draft copied");
    expect(screen.getByLabelText("Organization (optional)")).toBeTruthy();
  });
});
