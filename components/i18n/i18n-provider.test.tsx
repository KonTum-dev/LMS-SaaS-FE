// @vitest-environment jsdom
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackLanguageSwitcher, FeedbackLocaleProvider, FEEDBACK_LOCALE_STORAGE_KEY } from "@/components/feedback/feedback-locale";
import { authMessages } from "@/lib/i18n/auth-messages";
import { useI18n } from "./i18n-provider";
import { LocaleRouteRefresh } from "./locale-route-refresh";

const refresh = vi.hoisted(() => vi.fn());
const router = { refresh };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
function Form() {
  const { t } = useI18n(authMessages);
  const [name, setName] = useState("");
  return <><FeedbackLanguageSwitcher /><h1>{t("Chào mừng trở lại")}</h1><input aria-label="draft" value={name} onChange={(event) => setName(event.target.value)} /></>;
}
beforeEach(() => {
  const stored = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) });
  document.cookie = "dx-lms-locale=; Max-Age=0; Path=/";
  refresh.mockClear();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("global UI locale", () => {
  it("renders the server-selected language before effects", () => {
    const html = renderToString(<FeedbackLocaleProvider initialLocale="en"><Form /></FeedbackLocaleProvider>);
    expect(html).toContain("Welcome back");
    expect(html).toContain('aria-label="Language"');
  });
  it("switches live, persists the preference and keeps form values", () => {
    const Surface = ({ serverLocale }: { serverLocale: "vi" | "en" }) => <FeedbackLocaleProvider initialLocale="vi"><LocaleRouteRefresh serverLocale={serverLocale} /><Form /></FeedbackLocaleProvider>;
    const view = render(<Surface serverLocale="vi" />);
    fireEvent.change(screen.getByLabelText("draft"), { target: { value: "Nguyễn An {name}" } });
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("heading").textContent).toBe("Welcome back");
    expect((screen.getByLabelText("draft") as HTMLInputElement).value).toBe("Nguyễn An {name}");
    expect(document.cookie).toContain("dx-lms-locale=en");
    expect(localStorage.getItem(FEEDBACK_LOCALE_STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(refresh).toHaveBeenCalledTimes(1);
    view.rerender(<Surface serverLocale="en" />);
    expect(refresh).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    expect(document.documentElement.lang).toBe("vi");
    expect(screen.getByRole("heading").textContent).toBe("Chào mừng trở lại");
    expect((screen.getByLabelText("draft") as HTMLInputElement).value).toBe("Nguyễn An {name}");
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it("migrates the existing toast preference and responds to cross-tab changes", () => {
    localStorage.setItem(FEEDBACK_LOCALE_STORAGE_KEY, "en");
    render(<FeedbackLocaleProvider><LocaleRouteRefresh serverLocale="vi" /><Form /></FeedbackLocaleProvider>);
    expect(screen.getByRole("heading").textContent).toBe("Welcome back");
    expect(document.cookie).toContain("dx-lms-locale=en");
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: FEEDBACK_LOCALE_STORAGE_KEY, newValue: "vi" })));
    expect(screen.getByRole("heading").textContent).toBe("Chào mừng trở lại");
    expect(document.cookie).toContain("dx-lms-locale=vi");
  });
});
