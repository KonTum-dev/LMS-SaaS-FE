import { cookies } from "next/headers";
import { cache } from "react";
import { LOCALE_COOKIE, resolveLocale } from "./locale";
import { createTranslator, type UiDictionary } from "./translate";

export const getServerLocale = cache(async () => resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value));
export async function getServerI18n(dictionary?: UiDictionary) {
  const locale = await getServerLocale();
  return { locale, t: createTranslator(locale, dictionary) };
}
