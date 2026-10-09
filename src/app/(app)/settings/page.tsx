import { Download } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getProfile } from "@/server/profile";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { BrandMark } from "@/components/layout/BrandMark";
import { LogoutButton } from "@/components/settings/LogoutButton";
import { PushNotifications } from "@/components/settings/PushNotifications";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { AssistantSettings } from "@/components/settings/AssistantSettings";
import { BRAND } from "@/lib/brand";

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  return (
    <div className="area-enter mx-auto max-w-4xl">
      <PageHeader title="Réglages" description="Ton profil, ton écran du jour, tes notifications et tes données." />

      <div className="space-y-5">
        <Card>
          <CardBody className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#ffe9a0] to-[#c9952f] text-lg font-bold text-[#2a1a05] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_6px_16px_rgba(30,15,0,0.4)]">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-[var(--ink)]">{user.name}</p>
              <p className="truncate text-xs text-[var(--ink-dim)]">{user.email}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Profil et écran du jour" subtitle="Ce que l'app met en avant pour toi" />
          <CardBody>
            <ProfileSettings current={profile} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Assistant" subtitle="Le micro et le + doré, sur toutes les pages" />
          <CardBody>
            <AssistantSettings enabled={!!process.env.ANTHROPIC_API_KEY} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Notifications" subtitle="Résumé quotidien" />
          <CardBody>
            {vapidPublicKey ? (
              <PushNotifications vapidPublicKey={vapidPublicKey} />
            ) : (
              <p className="text-sm text-[var(--ink-dim)]">Notifications indisponibles : la clé publique VAPID n&apos;est pas définie dans cet environnement.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Tes données" subtitle="Elles t'appartiennent" />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-md text-xs leading-5 text-[var(--ink-dim)]">
                Télécharge tout ce que contient ton compte — cours, évaluations, tâches, agenda et suivis — dans un fichier JSON lisible.
              </p>
              <a href="/api/export" download className="mod-chip focus-ring">
                <Download size={13} /> Exporter
              </a>
            </div>
            <div className="border-t border-[rgba(255,220,148,0.1)] pt-4">
              <LogoutButton />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4">
            <BrandMark size={40} />
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-[var(--ink)]">{BRAND.name.toUpperCase()}</p>
              <p className="text-xs text-[var(--ink-dim)]">{BRAND.tagline} · Version 1.0</p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
