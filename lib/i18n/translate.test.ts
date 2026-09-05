import { describe, expect, it } from "vitest";
import { authMessages } from "./auth-messages";
import { commonMessages } from "./common-messages";
import { learningMessages } from "./learning-messages";
import { marketingMessages } from "./marketing-messages";
import { operationsMessages } from "./operations-messages";
import { workspacePolishMessages } from "./workspace-polish-messages";
import { accountPolishMessages } from "./account-polish-messages";
import { learningPolishMessages, operationsPolishMessages } from "./learning-polish-messages";
import { createTranslator, formatCurrency, formatDate, formatNumber } from "./translate";
import { resolveLocale } from "./locale";

const catalogs = { authMessages, commonMessages, learningMessages, marketingMessages, operationsMessages, workspacePolishMessages, accountPolishMessages, learningPolishMessages, operationsPolishMessages };
const placeholders = (value: string) => [...value.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map((match) => match[1]).sort();

describe("UI translations", () => {
  it.each(Object.entries(catalogs))("preserves source copy and all placeholders in %s", (_, catalog) => {
    for (const [source, english] of Object.entries(catalog)) {
      expect(source.trim(), source).not.toBe("");
      expect(english.trim(), source).not.toBe("");
      expect(placeholders(english), source).toEqual(placeholders(source));
      expect(createTranslator("vi", catalog)(source), source).toBe(source);
      expect(createTranslator("en", catalog)(source), source).toBe(english);
    }
  });
  it("falls back safely and does not read prototype properties", () => {
    const t = createTranslator("en", authMessages);
    expect(t("constructor")).toBe("constructor");
    expect(t("__proto__")).toBe("__proto__");
    expect(t("Unknown UI key")).toBe("Unknown UI key");
    expect(t("Đã tạo gói thuê bao")).toBe("Subscription plan created");
  });
  it("substitutes values once without translating names, IDs or data", () => {
    const t = createTranslator("en", authMessages);
    expect(t("Tham gia {name}", { name: "Trung tâm {name} <script>" })).toBe("Join Trung tâm {name} <script>");
    expect(t("Tham gia {name}")).toBe("Join {name}");
    expect(t("{year}-{id}", { year: 2026, id: 1234 })).toBe("2026-1234");
    expect(t("{name}", Object.create({ name: "inherited" }))).toBe("{name}");
  });
  it("prefers source keys when an English translation collides with a source", () => {
    const dictionary = { Center: "Center plan", "Trung tâm": "Center" };
    expect(createTranslator("vi", dictionary)("Center")).toBe("Center");
    expect(createTranslator("vi", authMessages)("Welcome back")).toBe("Chào mừng trở lại");
  });
  it("uses locale-specific numbers and currency without changing values", () => {
    expect(formatNumber(1234.5, "vi")).toBe("1.234,5");
    expect(formatNumber(1234.5, "en")).toBe("1,234.5");
    expect(formatCurrency(299000, "en")).toBe(new Intl.NumberFormat("en-US", { style: "currency", currency: "VND" }).format(299000));
    expect(formatCurrency(299000, "vi")).toBe(new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(299000));
    expect(formatNumber(NaN, "en")).toBe("—");
    expect(formatNumber(Infinity, "vi")).toBe("—");
  });
  it("uses one deterministic timezone across server and browser", () => {
    const date = "2026-09-04T20:00:00Z";
    expect(formatDate(date, "en")).toBe("Sep 5, 2026");
    expect(formatDate(date, "en", { timeZone: "UTC", dateStyle: "medium" })).toBe("Sep 4, 2026");
    expect(formatDate("not-a-date", "vi")).toBe("—");
    expect(formatDate(null, "en")).toBe("—");
    expect(formatDate("", "en")).toBe("—");
  });
  it("accepts only supported locale values", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("vi")).toBe("vi");
    expect(resolveLocale("en-US")).toBe("vi");
    expect(resolveLocale(undefined)).toBe("vi");
  });
});
