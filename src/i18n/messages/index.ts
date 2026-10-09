import { fr } from "@/i18n/messages/fr";
import { en } from "@/i18n/messages/en";
import type { Locale } from "@/i18n/config";

/** Same shape in every language: a missing English string is a type error. */
type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
export type Messages = Shape<typeof fr>;

const ALL: Record<Locale, Messages> = { fr, en };
export const messagesFor = (locale: Locale): Messages => ALL[locale] ?? fr;
