"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LOCALE_COOKIE, LOCALE_STORAGE_KEY, isLocale, type Locale } from "@/lib/i18n/locale";

export type FeedbackLocale = Locale;
export const FEEDBACK_LOCALE_STORAGE_KEY = LOCALE_STORAGE_KEY;
export const isFeedbackLocale = isLocale;

function persistCookie(locale: Locale) {
  try { document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; } catch { /* In-memory selection remains available. */ }
}

const LocaleContext = createContext<{ locale: FeedbackLocale; setLocale: (locale: FeedbackLocale) => void }>({
  locale: "vi",
  setLocale: () => {},
});

export function FeedbackLocaleProvider({ children, initialLocale = "vi" }: { children: React.ReactNode; initialLocale?: Locale }) {
  // A deterministic server/first-client value avoids a hydration mismatch.
  const [locale, setCurrentLocale] = useState<FeedbackLocale>(initialLocale);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FEEDBACK_LOCALE_STORAGE_KEY);
      // The first client render must match SSR; hydrate this external browser preference only after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isFeedbackLocale(stored)) { setCurrentLocale(stored); persistCookie(stored); }
    } catch { /* Language selection still works without browser storage. */ }
    const receive = (event: StorageEvent) => {
      if (event.key === FEEDBACK_LOCALE_STORAGE_KEY || event.key === null) {
        if (isFeedbackLocale(event.newValue)) { setCurrentLocale(event.newValue); persistCookie(event.newValue); }
        else if (event.newValue === null) { setCurrentLocale("vi"); persistCookie("vi"); }
      }
    };
    window.addEventListener("storage", receive);
    return () => window.removeEventListener("storage", receive);
  }, []);
  const setLocale = useCallback((next: FeedbackLocale) => {
    if (!isFeedbackLocale(next)) return;
    setCurrentLocale(next);
    persistCookie(next);
    try { localStorage.setItem(FEEDBACK_LOCALE_STORAGE_KEY, next); } catch { /* Keep the preference in memory. */ }
  }, []);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useFeedbackLocale() { return useContext(LocaleContext); }

export function FeedbackLanguageSwitcher() {
  const { locale, setLocale } = useFeedbackLocale();
  return <div className="feedback-language-switcher" role="group" aria-label={locale === "vi" ? "Ngôn ngữ" : "Language"}>
    <button type="button" lang="vi" aria-label="Tiếng Việt" aria-pressed={locale === "vi"} onClick={() => setLocale("vi")}>
      <svg aria-hidden="true" focusable="false" className="feedback-language-flag" viewBox="0 0 60 40">
        <path fill="#da251d" d="M0 0h60v40H0z" />
        <path fill="#ffdf00" d="m30 9 2.47 7.6h7.99L34 21.3l2.47 7.6L30 24.2l-6.47 4.7L26 21.3l-6.46-4.7h7.99z" />
      </svg>
      <span>VI</span>
    </button>
    <button type="button" lang="en" aria-label="English" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>
      <svg aria-hidden="true" focusable="false" className="feedback-language-flag" viewBox="0 0 60 30">
        <path fill="#012169" d="M0 0h60v30H0z" />
        <path stroke="#fff" strokeWidth="6" d="m0 0 60 30M60 0 0 30" />
        <path fill="#c8102e" d="M0 0h4l26 13v2L0 0zm60 0v2L34 15h-4L60 0zm0 30h-4L30 17v-2l30 15zM0 30v-2l26-13h4L0 30z" />
        <path stroke="#fff" strokeWidth="10" d="M30 0v30M0 15h60" />
        <path stroke="#c8102e" strokeWidth="6" d="M30 0v30M0 15h60" />
      </svg>
      <span>EN</span>
    </button>
  </div>;
}
