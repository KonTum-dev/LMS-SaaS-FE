export type Locale = "vi" | "en";
export const LOCALE_COOKIE = "dx-lms-locale";
// Retain the preference from the earlier toast-only release.
export const LOCALE_STORAGE_KEY = "dx-lms-feedback-locale-v1";
export function isLocale(value: unknown): value is Locale { return value === "vi" || value === "en"; }
export function resolveLocale(value: unknown): Locale { return isLocale(value) ? value : "vi"; }
export function intlLocale(locale: Locale): string { return locale === "en" ? "en-US" : "vi-VN"; }
