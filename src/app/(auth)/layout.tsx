import Link from "next/link";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { BrandMark } from "@/components/layout/BrandMark";
import { BRAND } from "@/lib/brand";
import { getLocale, getMessages } from "@/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getMessages();
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="glass-backdrop" aria-hidden />
      <LanguageToggle className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top,0px))]" />
      <div className="area-enter w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/bienvenue" className="mx-auto mb-4 flex w-fit justify-center" aria-label={t.auth.discover}>
            <BrandMark size={56} />
          </Link>
          <h1 className="text-2xl font-semibold tracking-[0.12em] text-on-gold">{BRAND.name.toUpperCase()}</h1>
          <p className="mt-1.5 text-sm text-[var(--ink-dim)]">{BRAND.tagline[locale]}</p>
        </div>
        {children}
        <p className="mt-6 text-center text-xs">
          <Link href="/bienvenue" className="text-on-gold underline-offset-4 hover:underline">
            {t.auth.discover}
          </Link>
        </p>
      </div>
    </div>
  );
}
