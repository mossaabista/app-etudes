import { fr } from "@/i18n/messages/fr";
import { en } from "@/i18n/messages/en";
import { NAMESPACES } from "@/i18n/ns";
import type { Locale } from "@/i18n/config";
import type { Shape } from "@/i18n/ns/define";

type Spaces = typeof NAMESPACES;
type Core = Shape<typeof fr>;
/** Same shape in every language: a missing English string is a type error. */
export type Messages = Core & { [K in keyof Spaces]: Spaces[K] extends { fr: infer F } ? F : never };

function build(locale: Locale, core: Core): Messages {
  const out: Record<string, unknown> = { ...core };
  for (const [name, ns] of Object.entries(NAMESPACES)) out[name] = (ns as unknown as Record<Locale, unknown>)[locale];
  return out as Messages;
}

const ALL: Record<Locale, Messages> = { fr: build("fr", fr), en: build("en", en) };
export const messagesFor = (locale: Locale): Messages => ALL[locale] ?? ALL.fr;
export { fr as frCore };
