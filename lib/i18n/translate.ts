import { isKnownFeedbackText, translateFeedbackText } from "@/lib/feedback-catalog";
import { commonMessages } from "./common-messages";
import { intlLocale, type Locale } from "./locale";

export type UiDictionary = Readonly<Record<string, string>>;
export type UiMessages = UiDictionary;
export type TranslationValues = Readonly<Record<string, string | number>>;
export type Translator = (source: string, values?: TranslationValues) => string;
export type Translate = Translator;
const EMPTY_DICTIONARY: UiDictionary = Object.freeze({});
const reverseDictionaries = new WeakMap<UiDictionary, Map<string, string>>();

/** Only call for application-owned UI copy, never a user-supplied name/content. */
export function createTranslator(locale: Locale, dictionary: UiDictionary = EMPTY_DICTIONARY): Translator {
  let reverse = reverseDictionaries.get(dictionary);
  if (!reverse) { reverse = new Map([...Object.entries(commonMessages), ...Object.entries(dictionary)].map(([source, translated]) => [translated, source])); reverseDictionaries.set(dictionary, reverse); }
  return (source, values) => {
    const translated = locale === "vi" ? (Object.hasOwn(dictionary, source) || Object.hasOwn(commonMessages, source) ? source : reverse.get(source) ?? (!/[À-ỹĐđ]/u.test(source) && isKnownFeedbackText(source) ? translateFeedbackText(source, locale) : source))
      : Object.hasOwn(dictionary, source) ? dictionary[source]
        : Object.hasOwn(commonMessages, source) ? commonMessages[source]
          : isKnownFeedbackText(source) ? translateFeedbackText(source, locale) : source;
    // Values are substituted once; user data containing braces is not reprocessed.
    return values ? translated.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (token, key: string) =>
      Object.hasOwn(values, key) ? String(values[key]) : token) : translated;
  };
}

export function translateUi(source: string, locale: Locale, dictionary?: UiDictionary, values?: TranslationValues): string {
  return createTranslator(locale, dictionary)(source, values);
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();
export function formatNumber(value: number, locale: Locale, options: Intl.NumberFormatOptions = {}): string {
  if (!Number.isFinite(value)) return "—";
  const key = JSON.stringify([locale, options]);
  let formatter = numberFormats.get(key);
  if (!formatter) { formatter = new Intl.NumberFormat(intlLocale(locale), options); if (numberFormats.size >= 64) numberFormats.clear(); numberFormats.set(key, formatter); }
  return formatter.format(value);
}
export function formatCurrency(value: number, locale: Locale, currency = "VND", options: Intl.NumberFormatOptions = {}): string {
  return formatNumber(value, locale, { style: "currency", currency, ...options });
}
export function formatDate(value: string | number | Date | null | undefined, locale: Locale, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  if (value === null || value === undefined || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  const resolvedOptions = { timeZone: "Asia/Ho_Chi_Minh", ...options };
  const key = JSON.stringify([locale, resolvedOptions]);
  let formatter = dateFormats.get(key);
  if (!formatter) { formatter = new Intl.DateTimeFormat(intlLocale(locale), resolvedOptions); if (dateFormats.size >= 64) dateFormats.clear(); dateFormats.set(key, formatter); }
  return formatter.format(date);
}
