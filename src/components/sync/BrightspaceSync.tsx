"use client";

import { useActionState } from "react";
import { CalendarCheck2, CheckCircle2, Link2, Loader2, Mail, Unplug } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt, INTL } from "@/i18n/config";
import { saveFeedUrl, previewSync, applySync, removeFeed, type SyncState } from "@/server/actions/sync.actions";
import type { SyncAction, SyncItem } from "@/server/brightspace/sync";

export interface SourceInfo {
  maskedUrl: string;
  lastSyncedAt: string | null;
  lastStatus: string | null;
  lastMessage: string | null;
}

const TONE: Record<SyncAction, string> = {
  create: "text-[#86d6a4] border-[rgba(134,214,164,0.35)]",
  update: "text-[#f0cd79] border-[rgba(240,205,121,0.35)]",
  unchanged: "text-[var(--ink-faint)] border-[rgba(255,220,148,0.14)]",
  skip: "text-[var(--ink-faint)] border-[rgba(255,220,148,0.14)]",
};

const field = "glass-pill focus-ring mt-1.5 block w-full px-4 py-2.5 text-sm text-[var(--ink)]";

/** Brightspace and the calendars still to come, in words a student understands. */
export function BrightspaceSync({ source, autoSync }: { source: SourceInfo | null; autoSync: boolean }) {
  const { t, locale } = useI18n();
  const c = t.connections;
  const [saveState, save, saving] = useActionState<SyncState, FormData>(saveFeedUrl, null);
  const [previewState, preview, previewing] = useActionState<SyncState, FormData>(previewSync, null);
  const [applyState, apply, applying] = useActionState<SyncState, FormData>(applySync, null);

  const plan = applyState?.plan ?? previewState?.plan;
  const error = saveState?.error ?? previewState?.error ?? applyState?.error;
  const success = saveState?.success ?? applyState?.success;
  const canApply = Boolean(plan && !plan.applied && plan.counts.create + plan.counts.update > 0);
  const when = (iso: string) => new Date(iso).toLocaleString(INTL[locale], { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="rounded-xl bg-[rgba(220,60,40,0.18)] px-4 py-3 text-sm text-[#ffd9cf]">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-[rgba(60,160,100,0.16)] px-4 py-3 text-sm text-[#cdf3da]">
          <CheckCircle2 size={15} /> {success}
        </p>
      )}

      <section className="glass-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 basis-60 items-start gap-3">
            <span className="pilot-orb h-11 w-11 shrink-0" aria-hidden>
              <CalendarCheck2 size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--ink)]">{c.brightspace}</h2>
              <p className="text-xs leading-5 text-[var(--ink-dim)]">{c.brightspaceWhy}</p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold ${source ? (source.lastStatus === "error" ? "border-[rgba(255,179,163,0.4)] text-[#ffb3a3]" : "border-[rgba(134,214,164,0.35)] text-[#86d6a4]") : "border-[rgba(255,220,148,0.14)] text-[var(--ink-faint)]"}`}>
            {source ? c.connected : c.notConnected}
          </span>
        </div>

        {source ? (
          <div className="mt-4 space-y-3">
            <div className="tile px-4 py-3 text-xs leading-5 text-[var(--ink-dim)]">
              <p className="flex items-center gap-1.5 text-[var(--ink)]">
                <Link2 size={13} /> {c.linkSaved}
              </p>
              <p>{source.lastSyncedAt ? fmt(c.lastSync, { when: when(source.lastSyncedAt) }) : c.neverSynced}</p>
              {source.lastStatus === "error" && <p className="text-[#ffb3a3]">{c.unreachable}</p>}
              <p>{autoSync ? c.autoOn : c.autoOff}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={preview}>
                <button type="submit" disabled={previewing || applying} className="mod-chip focus-ring">
                  {previewing && <Loader2 size={13} className="animate-spin" />} {previewing ? c.previewing : c.preview}
                </button>
              </form>
              {canApply && (
                <form action={apply}>
                  <button type="submit" disabled={applying} className="mod-chip mod-chip-gold focus-ring">
                    {applying && <Loader2 size={13} className="animate-spin" />} {applying ? c.applying : fmt(c.apply, { n: plan!.counts.create + plan!.counts.update })}
                  </button>
                </form>
              )}
              <form action={removeFeed} className="ml-auto">
                <button type="submit" className="mod-chip focus-ring text-[var(--ink-faint)]">
                  <Unplug size={13} /> {c.remove}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <form action={save} className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-[var(--ink-dim)]">
              {c.linkLabel}
              <input name="feedUrl" type="url" required inputMode="url" autoComplete="off" placeholder="https://…brightspace.com/…" className={field} />
            </label>
            <button type="submit" disabled={saving} className="mod-chip mod-chip-gold focus-ring">
              {saving && <Loader2 size={13} className="animate-spin" />} {saving ? c.connecting : c.connect}
            </button>
          </form>
        )}
      </section>

      {plan && (
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-[var(--ink)]">{plan.applied ? c.appliedTitle : c.previewTitle}</h2>
          <p className="text-xs text-[var(--ink-dim)]">{fmt(c.inFeed, { n: plan.totalEvents })}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(["create", "update", "unchanged", "skip"] as const)
              .filter((a) => plan.counts[a] > 0)
              .map((a) => (
                <span key={a} className={`rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold ${TONE[a]}`}>
                  {plan.counts[a]} {c.actions[a]}
                </span>
              ))}
          </div>
          {plan.items.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ink-dim)]">{c.empty}</p>
          ) : (
            <ul className="mt-3 divide-y divide-[rgba(255,220,148,0.08)]">
              {plan.items.map((item) => (
                <PlanRow key={item.uid} item={item} label={c.actions[item.action]} when={when} />
              ))}
            </ul>
          )}
        </section>
      )}

      {!source && (
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-[var(--ink)]">{c.howTitle}</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-[var(--ink-dim)]">
            <li>{c.how1}</li>
            <li>{c.how2}</li>
            <li>{c.how3}</li>
            <li>{c.how4}</li>
          </ol>
          <p className="mt-3 text-xs leading-5 text-[var(--ink-faint)]">{c.privacy}</p>
        </section>
      )}

      <section className="glass-card p-5">
        <ul className="space-y-3">
          {[
            { name: c.soonGoogle, icon: CalendarCheck2 },
            { name: c.soonOutlook, icon: CalendarCheck2 },
            { name: c.soonEmail, icon: Mail },
          ].map(({ name, icon: Icon }) => (
            <li key={name} className="flex items-center gap-3">
              <Icon size={16} className="shrink-0 text-[var(--ink-faint)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--ink)]">{name}</p>
                <p className="text-xs text-[var(--ink-faint)]">{c.soonNote}</p>
              </div>
              <span className="shrink-0 rounded-full border border-[rgba(255,220,148,0.14)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--ink-faint)]">{t.common.soon}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PlanRow({ item, label, when }: { item: SyncItem; label: string; when: (iso: string) => string }) {
  const muted = item.action === "skip" || item.action === "unchanged";
  return (
    <li className={`flex items-start gap-3 py-3 ${muted ? "opacity-60" : ""}`}>
      <span className={`mt-0.5 w-24 shrink-0 rounded-full border px-2 py-0.5 text-center text-[0.7rem] font-semibold ${TONE[item.action]}`}>{label}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--ink)]">{item.title}</p>
        <p className="mt-0.5 text-xs text-[var(--ink-dim)]">
          {[item.courseCode, item.dueDate ? when(item.dueDate) : null].filter(Boolean).join(" · ")}
        </p>
        {item.reason && <p className="mt-1 text-xs text-[#f0cd79]">{item.reason}</p>}
        {item.changes?.map((change) => (
          <p key={change} className="mt-1 text-xs text-[var(--ink-dim)]">
            {change}
          </p>
        ))}
      </div>
    </li>
  );
}
