"use client";

import { useMemo } from "react";
import { useFeedbackLocale } from "@/components/feedback/feedback-locale";
import { createTranslator, formatCurrency, formatDate, formatNumber, type UiDictionary } from "@/lib/i18n/translate";

export function useI18n(dictionary?: UiDictionary) {
  const { locale, setLocale } = useFeedbackLocale();
  return useMemo(() => ({
    locale, setLocale, t: createTranslator(locale, dictionary),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => formatNumber(value, locale, options),
    formatCurrency: (value: number, currency = "VND", options?: Intl.NumberFormatOptions) => formatCurrency(value, locale, currency, options),
    formatDate: (value: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions) => formatDate(value, locale, options),
  }), [dictionary, locale, setLocale]);
}
