// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FeedbackLanguageSwitcher,
  FeedbackLocaleProvider,
} from "@/components/feedback/feedback-locale";
import type { Locale } from "@/lib/i18n/locale";
import { LocaleRouteRefresh } from "./locale-route-refresh";

const refresh = vi.hoisted(() => vi.fn());
const router = { refresh };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function Surface({ serverLocale }: { serverLocale: Locale }) {
  return (
    <FeedbackLocaleProvider initialLocale="vi">
      <LocaleRouteRefresh serverLocale={serverLocale} />
      <FeedbackLanguageSwitcher />
      <input aria-label="draft" defaultValue="Nguyễn An {name}" />
    </FeedbackLocaleProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  refresh.mockClear();
  document.documentElement.lang = "vi";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("locale route refresh ordering", () => {
  it("corrects a delayed English server response after a rapid VI → EN → VI switch", () => {
    const view = render(<Surface serverLocale="vi" />);
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    expect(document.documentElement.lang).toBe("vi");
    // The response for the earlier EN request arrives after the user switched back.
    view.rerender(<Surface serverLocale="en" />);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(document.documentElement.lang).toBe("vi");
    expect((screen.getByLabelText("draft") as HTMLInputElement).value).toBe("Nguyễn An {name}");
    view.rerender(<Surface serverLocale="vi" />);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does not loop when cookies are blocked and the server keeps returning Vietnamese", () => {
    vi.spyOn(document, "cookie", "set").mockImplementation(() => {
      throw new DOMException("Cookies blocked", "SecurityError");
    });
    const view = render(<Surface serverLocale="vi" />);
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    for (let response = 0; response < 3; response++) {
      view.rerender(<Surface serverLocale="vi" />);
    }
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("button", { name: "English", pressed: true })).toBeTruthy();
    expect((screen.getByLabelText("draft") as HTMLInputElement).value).toBe("Nguyễn An {name}");
  });
});
