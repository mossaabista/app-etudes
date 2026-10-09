import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, LayoutGrid, Workflow } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getProfile } from "@/server/profile";
import { getSettings } from "@/server/settings";
import { getAutonomy } from "@/server/autonomy";
import { historyRows } from "@/server/agent-log";
import { listFacts } from "@/server/memory";
import { getPlanningPrefs } from "@/server/planning-prefs";
import { getLayout } from "@/server/layout";
import { integrationStatus } from "@/server/integrations";
import { monthUsage } from "@/server/usage";
import { pushIsConfigured } from "@/server/notifications/push";
import { prisma } from "@/lib/db";
import { OPTIONAL_MODULES, moduleState } from "@/lib/nav";
import { CHARS_PER_MINUTE } from "@/lib/plans";
import { currentZone } from "@/lib/dates";
import { BRAND } from "@/lib/brand";
import { getLocale, getMessages } from "@/i18n/server";
import { fmt, INTL } from "@/i18n/config";
import { isSettingsSection, SETTINGS_SECTIONS } from "@/lib/settings-sections";
import { BrandMark } from "@/components/layout/BrandMark";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { NavSettings } from "@/components/settings/NavSettings";
import { PlanningSettings } from "@/components/settings/PlanningSettings";
import { AssistantSettings } from "@/components/settings/AssistantSettings";
import { AutonomySettings } from "@/components/settings/AutonomySettings";
import { MemorySettings } from "@/components/settings/MemorySettings";
import { AgentHistory } from "@/components/settings/AgentHistory";
import { PushNotifications } from "@/components/settings/PushNotifications";
import { Integrations } from "@/components/settings/Integrations";
import { LogoutButton } from "@/components/settings/LogoutButton";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { AccountForm } from "@/components/settings/sections/AccountForm";
import { JarvisPrefs } from "@/components/settings/sections/JarvisPrefs";
import { NotificationPrefs } from "@/components/settings/sections/NotificationPrefs";
import { FeedbackForm } from "@/components/settings/sections/FeedbackForm";
import pkg from "../../../../../package.json";

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const t = await getMessages();
  return { title: isSettingsSection(section) ? t.settings.sections[section].title : t.settings.title };
}

function Block({ title, desc, children }: { title?: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="glass-card p-5">
      {title && <h2 className="text-sm font-semibold text-[var(--ink)]">{title}</h2>}
      {desc && <p className="mt-0.5 text-xs leading-5 text-[var(--ink-dim)]">{desc}</p>}
      <div className={title || desc ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isSettingsSection(section)) notFound();
  const user = await requireUser();
  const [t, locale, settings] = await Promise.all([getMessages(), getLocale(), getSettings(user.id)]);
  const s = t.settings;
  const Icon = SETTINGS_SECTIONS.find((x) => x.key === section)!.icon;

  let body: React.ReactNode = null;

  if (section === "profil") {
    const profile = await getProfile(user.id);
    body = (
      <>
        <Block>
          <AccountForm initial={{ name: user.name, email: user.email, avatar: settings.avatar, timeZone: settings.timeZone, city: settings.city, country: settings.country }} />
        </Block>
        <Block title={s.profiles}>
          <ProfileSettings key={`${profile?.type}:${profile?.roles.join(",")}:${profile?.cards.join(",")}`} current={profile} />
          <Link href="/onboarding" className="mt-4 inline-flex text-xs font-semibold text-[#f0cd79] hover:underline">
            {s.redoOnboarding}
          </Link>
        </Block>
      </>
    );
  }

  if (section === "jarvis") {
    const [autonomy, actions, facts, planning] = await Promise.all([getAutonomy(user.id), historyRows(user.id), listFacts(user.id), getPlanningPrefs(user.id)]);
    const when = new Intl.DateTimeFormat(INTL[locale], { timeZone: currentZone(), weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const history = actions?.map(({ createdAt, ...a }) => ({ ...a, when: when.format(createdAt) })) ?? null;
    body = (
      <>
        <Block>
          <JarvisPrefs initial={settings.jarvis} />
        </Block>
        <Block title={s.deviceVoice}>
          <AssistantSettings enabled={!!process.env.ANTHROPIC_API_KEY} />
          <div className="mt-5 border-t border-[rgba(255,220,148,0.1)] pt-4">
            <AutonomySettings current={autonomy} />
          </div>
        </Block>
        <Block title={s.memoryTitle}>
          <MemorySettings facts={facts.map((f) => ({ id: f.id, text: f.text }))} />
        </Block>
        <Block title={s.historyTitle}>
          <AgentHistory rows={history} />
        </Block>
        <Block title={s.planningTitle}>
          <PlanningSettings current={planning} />
        </Block>
        <Block title={s.automationsTitle} desc={s.automationsText}>
          <Link href="/workflows" className="mod-chip mod-chip-gold focus-ring inline-flex">
            <Workflow size={13} /> {s.openAutomations}
          </Link>
        </Block>
      </>
    );
  }

  if (section === "affichage") {
    const [profile, courses, projects, layout, documents] = await Promise.all([
      getProfile(user.id),
      prisma.course.count({ where: { userId: user.id } }),
      prisma.project.count({ where: { userId: user.id } }),
      getLayout(user.id),
      prisma.trackerEntry.count({ where: { userId: user.id, module: "app:documents" } }),
    ]);
    const prefs = profile?.nav ?? { shown: [], hidden: [] };
    const navCtx = { roles: profile?.roles ?? ["etudiant" as const], prefs, counts: { courses, projects, documents }, areas: layout.areas.map((a) => a.key) };
    const modules = OPTIONAL_MODULES.map((m) => {
      const st = moduleState(m, navCtx);
      return { key: m.key, label: m.label, desc: m.desc, ...st, forced: prefs.shown.includes(m.key) || prefs.hidden.includes(m.key), blocked: !!m.needsArea && !navCtx.areas.includes(m.needsArea) };
    });
    body = (
      <>
        <Block title={s.menuTitle}>
          <NavSettings modules={modules} />
        </Block>
        <Block title={s.sectorsTitle} desc={s.sectorsText}>
          <Link href="/tasks" className="mod-chip focus-ring inline-flex">
            <LayoutGrid size={13} /> {s.openSectors}
          </Link>
        </Block>
      </>
    );
  }

  if (section === "notifications") {
    const layout = await getLayout(user.id);
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
    body = (
      <>
        <Block title={s.device}>{vapid && pushIsConfigured() ? <PushNotifications vapidPublicKey={vapid} /> : <p className="text-sm text-[var(--ink-dim)]">{s.noPushServer}</p>}</Block>
        <Block>
          <NotificationPrefs initial={settings.notifications} areas={layout.areas.map((a) => ({ key: a.key, label: a.label }))} />
        </Block>
      </>
    );
  }

  if (section === "connexions") {
    const items = await integrationStatus(user.id);
    body = (
      <>
        <Block title={t.connections.brightspace} desc={t.connections.brightspaceWhy}>
          <Link href="/sync" className="mod-chip mod-chip-gold focus-ring inline-flex">
            <ExternalLink size={13} /> {t.connections.title}
          </Link>
        </Block>
        <Block>
          <Integrations items={items} />
        </Block>
      </>
    );
  }

  if (section === "abonnement") {
    const u = await monthUsage(user.id);
    const pct = Math.min(100, Math.round((u.claudeUsd / Math.max(u.limits.claudeUsd, 0.0001)) * 100));
    const minutes = (chars: number) => Math.round(chars / CHARS_PER_MINUTE);
    body = (
      <>
        <Block title={s.plan}>
          <p className="text-lg font-semibold text-[#f0cd79]">{settings.plan === "pro" ? s.planPro : s.planFree}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--ink-dim)]">{settings.plan === "pro" ? s.planProText : s.planFreeText}</p>
          {settings.plan !== "pro" && <p className="mt-2 text-xs text-[var(--ink-faint)]">{s.upgradeSoon}</p>}
        </Block>
        <Block title={s.usageJarvis}>
          <p className="text-sm text-[var(--ink)]">{fmt(s.usageJarvisText, { requests: u.requests, pct })}</p>
          <div className="mod-meter mt-2" aria-hidden>
            <span style={{ width: `${pct}%`, background: "linear-gradient(90deg,#a6761f,#ffe9a0)" }} />
          </div>
          {u.claudeCapped && <p className="mt-2 text-xs text-[#ffd9a8]">{s.capped}</p>}
        </Block>
        <Block title={s.usageVoice}>
          <p className="text-sm text-[var(--ink)]">{u.limits.ttsChars > 0 ? fmt(s.usageVoiceText, { used: minutes(u.ttsChars), total: minutes(u.limits.ttsChars) }) : s.usageVoiceNone}</p>
          {u.voiceCapped && u.limits.ttsChars > 0 && <p className="mt-2 text-xs text-[#ffd9a8]">{s.voiceCapped}</p>}
        </Block>
      </>
    );
  }

  if (section === "donnees") {
    body = (
      <>
        <Block title={s.exportTitle} desc={s.exportText}>
          <a href="/api/export" download className="mod-chip focus-ring inline-flex">
            <Download size={13} /> {s.export}
          </a>
        </Block>
        <Block>
          <div className="flex flex-wrap gap-2">
            <Link href="/confidentialite" className="mod-chip focus-ring">
              {s.privacy}
            </Link>
            <Link href="/conditions" className="mod-chip focus-ring">
              {s.terms}
            </Link>
          </div>
          <div className="mt-4 border-t border-[rgba(255,220,148,0.1)] pt-4">
            <LogoutButton />
          </div>
          <div className="mt-4 border-t border-[rgba(255,220,148,0.1)] pt-4">
            <DeleteAccount />
          </div>
        </Block>
      </>
    );
  }

  if (section === "aide") {
    const faq = s.faq;
    body = (
      <>
        <Block title={s.faqTitle}>
          <div className="space-y-2">
            {([1, 2, 3, 4] as const).map((n) => (
              <details key={n} className="tile px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-[var(--ink)]">{faq[`q${n}`]}</summary>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-dim)]">{faq[`a${n}`]}</p>
              </details>
            ))}
          </div>
        </Block>
        <Block title={s.feedbackTitle}>
          <FeedbackForm />
        </Block>
        <Block>
          <div className="flex items-center gap-4">
            <BrandMark size={40} />
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-[var(--ink)]">{BRAND.name.toUpperCase()}</p>
              <p className="text-xs text-[var(--ink-dim)]">
                {BRAND.tagline[locale]} · {fmt(s.version, { v: pkg.version })}
              </p>
            </div>
          </div>
        </Block>
      </>
    );
  }

  return (
    <div className="area-enter mx-auto max-w-2xl">
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-on-gold hover:underline">
        <ArrowLeft size={13} /> {s.back}
      </Link>
      <h1 className="mb-5 flex items-center gap-2.5 text-xl font-semibold tracking-tight text-on-gold">
        <Icon size={20} aria-hidden /> {s.sections[section].title}
      </h1>
      <div className="space-y-4">{body}</div>
    </div>
  );
}
