// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FEEDBACK_LOCALE_STORAGE_KEY,
  FeedbackLanguageSwitcher,
  FeedbackLocaleProvider,
  isFeedbackLocale,
  useFeedbackLocale,
} from "./feedback-locale";

function Consumer() {
  const { locale, setLocale } = useFeedbackLocale();
  return (
    <>
      <output data-testid="current-locale">{locale}</output>
      <button onClick={() => setLocale("xx" as "en")}>Invalid locale</button>
      <FeedbackLanguageSwitcher />
    </>
  );
}

function Surface() {
  return (
    <FeedbackLocaleProvider>
      <Consumer />
    </FeedbackLocaleProvider>
  );
}

beforeEach(() => {
  // Node's storage global can shadow jsdom's implementation. Keep this browser
  // preference test independent from Node's optional persistent storage file.
  const values = new Map<string, string>();
  const storage: Storage = {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
  vi.stubGlobal("localStorage", storage);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function changeFromAnotherTab(key: string | null, newValue: string | null) {
  act(() => {
    window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
  });
}

describe("feedback locale", () => {
  it("defaults to Vietnamese with an accessible language label", () => {
    render(<Surface />);
    expect(screen.getByTestId("current-locale").textContent).toBe("vi");
    const languages = screen.getByRole("group", { name: "Ngôn ngữ" });
    expect(within(languages).getAllByRole("button")).toHaveLength(2);
    expect(within(languages).getByRole("button", { name: "Tiếng Việt", pressed: true }).textContent?.trim()).toBe("VI");
    expect(within(languages).getByRole("button", { name: "English", pressed: false }).textContent?.trim()).toBe("EN");
    expect(
      screen.getByRole("button", { name: "Tiếng Việt" }).getAttribute("lang"),
    ).toBe("vi");
    expect(
      screen.getByRole("button", { name: "English" }).getAttribute("lang"),
    ).toBe("en");
    expect(localStorage.getItem(FEEDBACK_LOCALE_STORAGE_KEY)).toBeNull();
  });

  it("persists an English selection and changes its accessible label", () => {
    render(<Surface />);
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByTestId("current-locale").textContent).toBe("en");
    expect(screen.getByRole("group", { name: "Language" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "English", pressed: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tiếng Việt", pressed: false })).toBeTruthy();
    expect(localStorage.getItem(FEEDBACK_LOCALE_STORAGE_KEY)).toBe("en");
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    expect(
      screen.getByRole("group", { name: "Ngôn ngữ" }),
    ).toBeTruthy();
    expect(localStorage.getItem(FEEDBACK_LOCALE_STORAGE_KEY)).toBe("vi");
  });

  it("adds distinct decorative flags without changing accessible language names", () => {
    render(<Surface />);
    const languages = screen.getByRole("group", { name: "Ngôn ngữ" });
    const vietnamese = within(languages).getByRole("button", {
      name: "Tiếng Việt",
      pressed: true,
    });
    const english = within(languages).getByRole("button", {
      name: "English",
      pressed: false,
    });
    const vietnameseFlag = vietnamese.querySelector("svg");
    const englishFlag = english.querySelector("svg");

    for (const button of [vietnamese, english]) {
      expect(button.querySelectorAll("svg")).toHaveLength(1);
      const flag = button.querySelector("svg");
      expect(flag?.getAttribute("aria-hidden")).toBe("true");
      expect(flag?.getAttribute("focusable")).toBe("false");
      expect(flag?.hasAttribute("tabindex")).toBe(false);
      expect(button.getAttribute("type")).toBe("button");
    }
    expect(vietnamese.textContent?.trim()).toBe("VI");
    expect(english.textContent?.trim()).toBe("EN");
    expect(vietnameseFlag?.innerHTML).not.toBe(englishFlag?.innerHTML);
    expect(within(languages).queryAllByRole("img")).toHaveLength(0);
  });

  it("switches and persists the language when the decorative flags are clicked", () => {
    render(<Surface />);
    for (const [name, locale, groupLabel] of [
      ["English", "en", "Language"],
      ["Tiếng Việt", "vi", "Ngôn ngữ"],
    ] as const) {
      const button = screen.getByRole("button", { name });
      const flag = button.querySelector("svg");
      if (!flag) throw new Error(`Missing decorative flag for ${name}`);

      fireEvent.click(flag);
      expect(screen.getByTestId("current-locale").textContent).toBe(locale);
      expect(localStorage.getItem(FEEDBACK_LOCALE_STORAGE_KEY)).toBe(locale);
      expect(screen.getByRole("group", { name: groupLabel })).toBeTruthy();
      expect(screen.getByRole("button", { name, pressed: true })).toBe(button);
    }
  });

  it("restores a saved language after the provider remounts", () => {
    const first = render(<Surface />);
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    first.unmount();
    render(<Surface />);
    expect(screen.getByTestId("current-locale").textContent).toBe("en");
    expect(screen.getByRole("button", { name: "English", pressed: true })).toBeTruthy();
  });

  it("uses focusable native buttons without submitting an enclosing form", () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<FeedbackLocaleProvider><form onSubmit={submit}><FeedbackLanguageSwitcher /></form></FeedbackLocaleProvider>);
    const english = screen.getByRole("button", { name: "English" });
    const vietnamese = screen.getByRole("button", { name: "Tiếng Việt" });
    expect(english.getAttribute("type")).toBe("button");
    expect(vietnamese.getAttribute("type")).toBe("button");
    expect(english.tabIndex).toBe(0);
    expect(vietnamese.tabIndex).toBe(0);
    english.focus();
    fireEvent.click(english);
    expect(document.activeElement).toBe(english);
    expect(english.getAttribute("aria-pressed")).toBe("true");
    expect(vietnamese.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(vietnamese);
    expect(vietnamese.getAttribute("aria-pressed")).toBe("true");
    expect(submit).not.toHaveBeenCalled();
  });

  it("keeps server rendering deterministic even with an English browser preference", () => {
    localStorage.setItem(FEEDBACK_LOCALE_STORAGE_KEY, "en");
    const html = renderToString(<Surface />);
    expect(html).toContain('aria-label="Ngôn ngữ"');
    expect(html).toContain('data-testid="current-locale">vi</output>');
    render(<Surface />);
    expect(screen.getByTestId("current-locale").textContent).toBe("en");
  });

  it.each([
    "",
    "fr",
    "EN",
    "null",
    '{"locale":"en"}',
    "<script>alert(1)</script>",
  ])("ignores an unsupported stored preference: %s", (value) => {
    localStorage.setItem(FEEDBACK_LOCALE_STORAGE_KEY, value);
    render(<Surface />);
    expect(screen.getByTestId("current-locale").textContent).toBe("vi");
    expect(
      screen.getByRole("group", { name: "Ngôn ngữ" }),
    ).toBeTruthy();
  });

  it("continues to switch in memory if browser storage is blocked", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    render(<Surface />);
    expect(screen.getByTestId("current-locale").textContent).toBe("vi");
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByTestId("current-locale").textContent).toBe("en");
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    expect(screen.getByTestId("current-locale").textContent).toBe("vi");
  });

  it("rejects unsupported values passed through the context setter", () => {
    render(<Surface />);
    fireEvent.click(screen.getByRole("button", { name: "Invalid locale" }));
    expect(screen.getByTestId("current-locale").textContent).toBe("vi");
    expect(localStorage.getItem(FEEDBACK_LOCALE_STORAGE_KEY)).toBeNull();
  });

  it("applies valid cross-tab changes and resets when the preference is removed", () => {
    render(<Surface />);
    changeFromAnotherTab(FEEDBACK_LOCALE_STORAGE_KEY, "en");
    expect(
      screen.getByRole("group", { name: "Language" }),
    ).toBeTruthy();
    changeFromAnotherTab(FEEDBACK_LOCALE_STORAGE_KEY, "vi");
    expect(screen.getByTestId("current-locale").textContent).toBe("vi");
    changeFromAnotherTab(FEEDBACK_LOCALE_STORAGE_KEY, "en");
    changeFromAnotherTab(FEEDBACK_LOCALE_STORAGE_KEY, null);
    expect(screen.getByTestId("current-locale").textContent).toBe("vi");
  });

  it("ignores unrelated or invalid cross-tab values", () => {
    render(<Surface />);
    changeFromAnotherTab(FEEDBACK_LOCALE_STORAGE_KEY, "en");
    changeFromAnotherTab("another-preference", "vi");
    changeFromAnotherTab(FEEDBACK_LOCALE_STORAGE_KEY, "fr");
    expect(screen.getByTestId("current-locale").textContent).toBe("en");
  });

  it("removes its cross-tab listener on unmount", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const surface = render(<Surface />);
    const listener = add.mock.calls.find(([event]) => event === "storage")?.[1];
    expect(listener).toBeTypeOf("function");
    surface.unmount();
    expect(remove).toHaveBeenCalledWith("storage", listener);
  });

  it("recognizes only the two supported language identifiers", () => {
    expect(isFeedbackLocale("vi")).toBe(true);
    expect(isFeedbackLocale("en")).toBe(true);
    for (const value of [null, undefined, false, 1, {}, "de", "EN"]) {
      expect(isFeedbackLocale(value)).toBe(false);
    }
  });
});
