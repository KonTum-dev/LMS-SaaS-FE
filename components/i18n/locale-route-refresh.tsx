"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useFeedbackLocale } from "@/components/feedback/feedback-locale";
import type { Locale } from "@/lib/i18n/locale";

/** Re-renders server-owned copy without changing URLs, auth state or form values. */
export function LocaleRouteRefresh({ serverLocale }: { serverLocale: Locale }) {
  const { locale } = useFeedbackLocale();
  const router = useRouter();
  const requestedLocale = useRef<Locale | null>(null);
  const lastServerLocale = useRef(serverLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    // A delayed response to an earlier selection must not suppress correction
    // after the user has already switched back to another language.
    if (lastServerLocale.current !== serverLocale) {
      lastServerLocale.current = serverLocale;
      requestedLocale.current = null;
    }
    if (locale !== serverLocale && requestedLocale.current !== locale) {
      requestedLocale.current = locale;
      router.refresh();
    } else if (locale === serverLocale) {
      requestedLocale.current = null;
    }
  }, [locale, router, serverLocale]);
  return null;
}
