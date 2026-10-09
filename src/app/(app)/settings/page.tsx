import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getSettings } from "@/server/settings";
import { getMessages } from "@/i18n/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { SETTINGS_SECTIONS } from "@/lib/settings-sections";

export async function generateMetadata() {
  return { title: (await getMessages()).settings.title };
}

export default async function SettingsPage() {
  const user = await requireUser();
  const [t, settings] = await Promise.all([getMessages(), getSettings(user.id)]);
  return (
    <div className="area-enter mx-auto max-w-2xl">
      <PageHeader title={t.settings.title} description={t.settings.subtitle} />
      <Link href="/settings/profil" className="glass-card focus-ring mb-4 flex items-center gap-4 p-4">
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#ffe9a0] to-[#c9952f] text-[#2a1a05]">
          {settings.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local data URL
            <img src={settings.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-lg font-bold">{user.name.charAt(0).toUpperCase()}</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-[var(--ink)]">{user.name}</span>
          <span className="block truncate text-xs text-[var(--ink-dim)]">{user.email}</span>
        </span>
        <ChevronRight size={16} className="text-[var(--ink-faint)]" aria-hidden />
      </Link>
      <nav aria-label={t.settings.title} className="glass-card divide-y divide-[rgba(255,220,148,0.08)] overflow-hidden">
        {SETTINGS_SECTIONS.map(({ key, icon: Icon }) => (
          <Link key={key} href={`/settings/${key}`} className="focus-ring flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-[rgba(255,220,148,0.05)]">
            <Icon size={18} className="shrink-0 text-[#f0cd79]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-[var(--ink)]">{t.settings.sections[key].title}</span>
              <span className="block truncate text-xs text-[var(--ink-dim)]">{t.settings.sections[key].desc}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-[var(--ink-faint)]" aria-hidden />
          </Link>
        ))}
      </nav>
    </div>
  );
}
