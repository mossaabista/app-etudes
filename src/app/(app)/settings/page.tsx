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
import { AutonomySettings } from "@/components/settings/AutonomySettings";
import { getAutonomy } from "@/server/autonomy";
import { AgentHistory } from "@/components/settings/AgentHistory";
import { historyRows } from "@/server/agent-log";
import { NavSettings } from "@/components/settings/NavSettings";
import { PlanningSettings } from "@/components/settings/PlanningSettings";
import { getPlanningPrefs } from "@/server/planning-prefs";
import { OPTIONAL_MODULES, moduleState } from "@/lib/nav";
import { getLayout } from "@/server/layout";
import { prisma } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { APP_TIMEZONE } from "@/lib/dates";

export default async function SettingsPage() {
  const user = await requireUser();
  const [profile, autonomy, actions, courses, projects, layout, planning] = await Promise.all([
    getProfile(user.id),
    getAutonomy(user.id),
    historyRows(user.id),
    prisma.course.count({ where: { userId: user.id } }),
    prisma.project.count({ where: { userId: user.id } }),
    getLayout(user.id),
    getPlanningPrefs(user.id),
  ]);
  const prefs = profile?.nav ?? { shown: [], hidden: [] };
  const navCtx = { roles: profile?.roles ?? ["etudiant" as const], prefs, counts: { courses, projects }, areas: layout.areas.map((a) => a.key) };
  const modules = OPTIONAL_MODULES.map((m) => {
    const st = moduleState(m, navCtx);
    return { key: m.key, label: m.label, desc: m.desc, ...st, forced: prefs.shown.includes(m.key) || prefs.hidden.includes(m.key), blocked: !!m.needsArea && !navCtx.areas.includes(m.needsArea) };
  });
  const when = new Intl.DateTimeFormat("fr-CA", { timeZone: APP_TIMEZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const history = actions?.map(({ createdAt, ...a }) => ({ ...a, when: when.format(createdAt) })) ?? null;
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
            <ProfileSettings key={`${profile?.type}:${profile?.roles.join(",")}:${profile?.cards.join(",")}`} current={profile} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Menu" subtitle="Les modules de ta navigation" />
          <CardBody>
            <NavSettings modules={modules} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Planification" subtitle="Les limites du Pilote et des plans de révision" />
          <CardBody>
            <PlanningSettings current={planning} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Assistant" subtitle="Le micro et le + doré, sur toutes les pages" />
          <CardBody>
            <AssistantSettings enabled={!!process.env.ANTHROPIC_API_KEY} />
            <div className="mt-5 border-t border-[rgba(255,220,148,0.1)] pt-4">
              <AutonomySettings current={autonomy} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Ce que l'assistant a changé" subtitle="Ses dernières modifications, annulables pendant 24 h" />
          <CardBody>
            <AgentHistory rows={history} />
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
