// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArgsProps } from "antd/es/message/interface";
import { ApiError } from "@/lib/api";
import { describeFeedbackError } from "@/lib/feedback-errors";
import { translateFeedbackText } from "@/lib/feedback-catalog";
import { FeedbackLanguageSwitcher, FeedbackLocaleProvider } from "./feedback-locale";
import { FeedbackProvider, readableFeedbackText, useFeedback } from "./feedback-provider";

const mocks = vi.hoisted(() => ({
  open: vi.fn(), destroy: vi.fn(), notification: vi.fn(), rawError: vi.fn(),
}));
vi.mock("antd", () => ({
  App: { useApp: () => ({
    message: { open: mocks.open, destroy: mocks.destroy, error: mocks.rawError },
    notification: { open: mocks.notification, success: mocks.notification, error: mocks.notification, warning: mocks.notification, info: mocks.notification },
    modal: {},
  }) },
}));

let feedback: ReturnType<typeof useFeedback>;
function Harness() {
  const api = useFeedback();
  useLayoutEffect(() => { feedback = api; }, [api]);
  return <FeedbackLanguageSwitcher />;
}
function setup() {
  render(<FeedbackLocaleProvider><FeedbackProvider><Harness /></FeedbackProvider></FeedbackLocaleProvider>);
}
function lastArgs(): ArgsProps { return mocks.open.mock.lastCall![0]; }
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  vi.clearAllMocks();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("localized feedback provider", () => {
  it("shows full Vietnamese content, meaningful title, lang and accessible dismissal", () => {
    setup();
    feedback.message.success("Đã tạo gói thuê bao");
    const args = lastArgs();
    expect(args.duration).toBeGreaterThanOrEqual(6);
    expect(args.pauseOnHover).toBe(true);
    render(args.content);
    expect(screen.getByText("Đã tạo gói thuê bao")).toBeTruthy();
    expect(screen.getByRole("status").getAttribute("lang")).toBe("vi");
    fireEvent.click(screen.getByRole("button", { name: "Đóng thông báo" }));
    expect(mocks.destroy).toHaveBeenCalledWith(args.key);
  });

  it("switches the next toast into English and translates action-specific copy", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    feedback.message.success("Đã tạo gói thuê bao");
    render(lastArgs().content);
    expect(screen.getByText("Subscription plan created")).toBeTruthy();
    expect(screen.getByRole("status").getAttribute("lang")).toBe("en");
    expect(screen.getByRole("button", { name: "Dismiss notification" })).toBeTruthy();
  });

  it("keeps errors and warnings visible until dismissed", () => {
    setup();
    feedback.message.warning("Không có thay đổi để lưu.");
    expect(lastArgs().duration).toBe(0);
    feedback.reportError(new ApiError("database_secret", 409, "LAST_PLATFORM_ADMIN"));
    expect(lastArgs().duration).toBe(0);
    render(lastArgs().content);
    expect(screen.getByRole("alert").textContent).toContain("quản trị viên nền tảng");
    expect(screen.queryByText("database_secret")).toBeNull();
  });

  it("preserves a reviewed caller fallback for unknown server errors", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    feedback.reportError(new Error("private internal data"), "Không thể lưu bài tập");
    render(lastArgs().content);
    expect(screen.getByText("Could not save the assignment")).toBeTruthy();
    expect(screen.queryByText("private internal data")).toBeNull();
  });

  it("does not replace uncertain-write recovery guidance with a generic failure fallback", () => {
    setup();
    const error = new ApiError("secret", 500, "ACCOUNT_MUTATION_UNCERTAIN");
    feedback.reportError(error, "Không thể lưu bài tập");
    render(lastArgs().content);
    expect(screen.getByText(describeFeedbackError(error, "vi").message)).toBeTruthy();
  });

  it("uses independent default keys so identical notices retain their own callbacks, and preserves explicit keys", () => {
    setup();
    feedback.message.success("Đã tạo gói thuê bao");
    const firstKey = lastArgs().key;
    feedback.message.success("Đã tạo gói thuê bao");
    expect(lastArgs().key).not.toBe(firstKey);
    feedback.message.success({ content: "Đã tạo gói thuê bao", key: "save-plan" });
    expect(lastArgs().key).toBe("save-plan");
  });

  it("preserves explicit durations, close callbacks and Antd's promise/close return value", () => {
    setup();
    const close = Object.assign(vi.fn(), { then: vi.fn() });
    mocks.open.mockReturnValueOnce(close);
    const onClose = vi.fn();
    expect(feedback.message.success("Đã tạo gói thuê bao", 9, onClose)).toBe(close);
    expect(lastArgs()).toMatchObject({ duration: 9, onClose });
    feedback.message.success("Đã tạo gói thuê bao", onClose);
    expect(lastArgs().onClose).toBe(onClose);
    feedback.message.destroy("save-plan");
    expect(mocks.destroy).toHaveBeenCalledWith("save-plan");
  });

  it("localizes contact notification title, description and action while retaining options", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    const source = "Kênh liên hệ đang được hoàn thiện nên thông tin chưa được gửi hoặc lưu. Bạn có thể tạo workspace dùng thử ngay.";
    feedback.notification.warning({ title: "Chưa gửi được yêu cầu", description: source, duration: false, key: "contact", actions: <a href="/register">{feedback.text("Tạo workspace dùng thử")}</a> });
    const args = mocks.notification.mock.lastCall![0];
    expect(args).toMatchObject({ title: "Your request has not been sent", description: translateFeedbackText(source, "en"), duration: false, key: "contact" });
    render(args.actions);
    expect(screen.getByRole("link", { name: "Create a trial workspace" })).toBeTruthy();
  });

  it("formats errors without showing a toast when a persistent banner needs the same wording", () => {
    setup();
    const error = new ApiError("hidden", 403);
    expect(feedback.formatError(error)).toBe(describeFeedbackError(error, "vi").message);
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it.each([null, { message: "password=secret" }, "MongoServerError: private"])("never renders arbitrary response content (case %#)", (value) => {
    expect(readableFeedbackText(value, "en", "error")).not.toContain("secret");
    expect(readableFeedbackText(value, "en", "success")).toBe("The action is complete.");
    expect(readableFeedbackText(value, "en", "info")).toBe("There is an update. Please check the details on this page.");
  });

  it("does not render unreviewed React content", () => {
    expect(readableFeedbackText(<b>unreviewed</b>, "en", "success")).toBe("The action is complete.");
  });

  it("clears API messages explicitly when requested", () => {
    setup();
    act(() => feedback.message.destroy());
    expect(mocks.destroy).toHaveBeenCalledWith(undefined);
  });

  it("suppresses stale authenticated callbacks after a workspace change and settles their thenables", async () => {
    const surface = (epoch: string | null) => <FeedbackLocaleProvider><FeedbackProvider authorityEpoch={epoch}><Harness /></FeedbackProvider></FeedbackLocaleProvider>;
    const rendered = render(surface("user:tenant-a:1"));
    const previous = feedback;
    rendered.rerender(surface("user:tenant-b:2"));
    await expect(Promise.resolve(previous.message.success("Đã tạo gói thuê bao"))).resolves.toBe(true);
    previous.notification.warning({ title: "Chưa gửi được yêu cầu" });
    previous.message.destroy();
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.notification).not.toHaveBeenCalled();
    expect(mocks.destroy).not.toHaveBeenCalled();
    feedback.message.success("Đã tạo gói thuê bao");
    expect(mocks.open).toHaveBeenCalledTimes(1);
  });

  it("allows anonymous-to-authenticated sign-in confirmation", () => {
    const surface = (epoch: string | null) => <FeedbackLocaleProvider><FeedbackProvider authorityEpoch={epoch}><Harness /></FeedbackProvider></FeedbackLocaleProvider>;
    const rendered = render(surface(null));
    const anonymous = feedback;
    rendered.rerender(surface("user:tenant-a:1"));
    anonymous.message.success("Đăng nhập thành công");
    expect(mocks.open).toHaveBeenCalledTimes(1);
  });
});
