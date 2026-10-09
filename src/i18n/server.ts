import { cache } from "react";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, fromAcceptLanguage, isLocale, type Locale } from "@/i18n/config";
import { messagesFor, type Messages } from "@/i18n/messages";

/** The language for this request: the user's choice (cookie), else the browser's. */
export const getLocale = cache(async (): Promise<Locale> => {
  try {
    const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(chosen)) return chosen;
    return fromAcceptLanguage((await headers()).get("accept-language"));
  } catch {
    return DEFAULT_LOCALE;
  }
});

export async function getMessages(): Promise<Messages> {
  return messagesFor(await getLocale());
}
