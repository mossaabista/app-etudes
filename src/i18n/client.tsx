"use client";

import { createContext, useContext } from "react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { messagesFor } from "@/i18n/messages";

const I18n = createContext<{ locale: Locale; t: Messages }>({ locale: "fr", t: messagesFor("fr") });

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: React.ReactNode }) {
  return <I18n.Provider value={{ locale, t: messages }}>{children}</I18n.Provider>;
}

/** The current language and its strings, in any client component. */
export const useI18n = () => useContext(I18n);
