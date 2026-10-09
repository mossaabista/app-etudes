import { Bell, CreditCard, HelpCircle, LayoutGrid, Link2, Shield, Sparkles, UserRound, type LucideIcon } from "lucide-react";

/** The settings, one page each, in the order a customer looks for them. */
export const SETTINGS_SECTIONS: { key: "profil" | "jarvis" | "affichage" | "notifications" | "connexions" | "abonnement" | "donnees" | "aide"; icon: LucideIcon }[] = [
  { key: "profil", icon: UserRound },
  { key: "jarvis", icon: Sparkles },
  { key: "affichage", icon: LayoutGrid },
  { key: "notifications", icon: Bell },
  { key: "connexions", icon: Link2 },
  { key: "abonnement", icon: CreditCard },
  { key: "donnees", icon: Shield },
  { key: "aide", icon: HelpCircle },
];

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["key"];
export const isSettingsSection = (v: string): v is SettingsSection => SETTINGS_SECTIONS.some((s) => s.key === v);
