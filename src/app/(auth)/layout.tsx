import Link from "next/link";
import { BrandMark } from "@/components/layout/BrandMark";
import { BRAND } from "@/lib/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="glass-backdrop" aria-hidden />
      <div className="area-enter w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/bienvenue" className="mx-auto mb-4 flex w-fit justify-center" aria-label="Découvrir Aurum">
            <BrandMark size={56} />
          </Link>
          <h1 className="text-2xl font-semibold tracking-[0.12em] text-on-gold">{BRAND.name.toUpperCase()}</h1>
          <p className="mt-1.5 text-sm text-[var(--ink-dim)]">{BRAND.tagline}</p>
        </div>
        {children}
        <p className="mt-6 text-center text-xs">
          <Link href="/bienvenue" className="text-on-gold underline-offset-4 hover:underline">
            Découvrir Aurum →
          </Link>
        </p>
      </div>
    </div>
  );
}
