"use client";

import { useActionState } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import {
  saveFeedUrl,
  previewSync,
  applySync,
  removeFeed,
  type SyncState,
} from "@/server/actions/sync.actions";
import type { SyncAction, SyncItem } from "@/server/brightspace/sync";

export interface SourceInfo {
  maskedUrl: string;
  lastSyncedAt: string | null;
  lastStatus: string | null;
  lastMessage: string | null;
}

const ACTION_LABEL: Record<SyncAction, string> = {
  create: "Nouveau",
  update: "Modifié",
  unchanged: "Inchangé",
  skip: "Ignoré",
};

const ACTION_TONE: Record<SyncAction, BadgeTone> = {
  create: "green",
  update: "amber",
  unchanged: "neutral",
  skip: "neutral",
};

export function BrightspaceSync({ source, autoSync }: { source: SourceInfo | null; autoSync: boolean }) {
  const [saveState, save, saving] = useActionState<SyncState, FormData>(saveFeedUrl, null);
  const [previewState, preview, previewing] = useActionState<SyncState, FormData>(previewSync, null);
  const [applyState, apply, applying] = useActionState<SyncState, FormData>(applySync, null);

  const plan = applyState?.plan ?? previewState?.plan;
  const error = saveState?.error ?? previewState?.error ?? applyState?.error;
  const success = saveState?.success ?? applyState?.success;
  const canApply = Boolean(plan && !plan.applied && plan.counts.create + plan.counts.update > 0);

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
      )}

      <Card>
        <CardHeader
          title="Flux de calendrier Brightspace"
          subtitle={source ? "Connecté" : "Pas encore connecté"}
        />
        <CardBody>
          {source ? (
            <div className="space-y-4">
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <p className="font-mono text-xs break-all text-slate-600">{source.maskedUrl}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {source.lastSyncedAt
                    ? `Dernière synchro : ${formatDate(source.lastSyncedAt)}`
                    : "Jamais synchronisé"}
                  {source.lastStatus === "error" && source.lastMessage && (
                    <span className="text-red-600"> — {source.lastMessage}</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {autoSync
                    ? "Synchronisation automatique chaque nuit vers 2 h (heure d'Ottawa)."
                    : "Synchronisation automatique inactive : la variable CRON_SECRET n'est pas définie dans cet environnement."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <form action={preview}>
                  <Button type="submit" variant="secondary" disabled={previewing || applying}>
                    {previewing ? "Lecture du flux…" : "Aperçu"}
                  </Button>
                </form>
                {canApply && (
                  <form action={apply}>
                    <Button type="submit" disabled={applying}>
                      {applying ? "Application…" : `Appliquer (${plan!.counts.create + plan!.counts.update})`}
                    </Button>
                  </form>
                )}
                <form action={removeFeed} className="ml-auto">
                  <Button type="submit" variant="ghost" size="sm">
                    Retirer le lien
                  </Button>
                </form>
              </div>
            </div>
          ) : (
            <form action={save} className="space-y-4">
              <Field label="URL du flux iCal" htmlFor="feedUrl">
                <Input
                  id="feedUrl"
                  name="feedUrl"
                  type="url"
                  required
                  placeholder="https://uottawa.brightspace.com/d2l/le/calendar/feed/user/feed.ics?token=…"
                />
              </Field>
              <Button type="submit" disabled={saving}>
                {saving ? "Enregistrement…" : "Connecter"}
              </Button>
            </form>
          )}
        </CardBody>
      </Card>

      {plan && (
        <Card>
          <CardHeader
            title={plan.applied ? "Synchronisation appliquée" : "Aperçu — rien n'a encore été écrit"}
            subtitle={`${plan.totalEvents} événement(s) dans le flux`}
            action={
              <div className="flex gap-1.5">
                {(["create", "update", "unchanged", "skip"] as const)
                  .filter((a) => plan.counts[a] > 0)
                  .map((a) => (
                    <Badge key={a} tone={ACTION_TONE[a]}>
                      {plan.counts[a]} {ACTION_LABEL[a].toLowerCase()}
                    </Badge>
                  ))}
              </div>
            }
          />
          <CardBody className="p-0">
            {plan.items.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Le flux ne contient aucun événement.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {plan.items.map((item) => (
                  <PlanRow key={item.uid} item={item} />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Où trouver ce lien dans Brightspace" />
        <CardBody>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
            <li>Ouvre Brightspace, puis l&apos;outil <strong>Calendrier</strong>.</li>
            <li>
              Clique sur <strong>S&apos;abonner</strong> (en haut à droite). Si le bouton est absent, va dans{" "}
              <strong>Paramètres</strong> et active <em>Activer l&apos;abonnement au calendrier</em>.
            </li>
            <li>
              Choisis <strong>Tous les calendriers</strong> pour couvrir tous tes cours d&apos;un coup.
            </li>
            <li>Copie l&apos;URL affichée et colle-la ci-dessus.</li>
          </ol>
          <p className="mt-4 text-xs text-slate-500">
            Ce lien contient un jeton personnel — il est stocké côté serveur et n&apos;est jamais réaffiché en entier.
            Le flux ne donne que les dates. Les pondérations, infos de labo et coordonnées des profs viennent des plans
            de cours.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function PlanRow({ item }: { item: SyncItem }) {
  const muted = item.action === "skip" || item.action === "unchanged";

  return (
    <li className={`flex items-start gap-3 px-5 py-3 ${muted ? "opacity-60" : ""}`}>
      <div className="w-20 shrink-0 pt-0.5">
        <Badge tone={ACTION_TONE[item.action]}>{ACTION_LABEL[item.action]}</Badge>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{item.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {item.courseCode ?? "—"} · {item.type}
          {item.dueDate && ` · ${formatDate(item.dueDate)}`}
        </p>
        {item.reason && <p className="mt-1 text-xs text-amber-700">{item.reason}</p>}
        {item.changes?.map((change) => (
          <p key={change} className="mt-1 text-xs text-slate-600">
            {change}
          </p>
        ))}
      </div>
    </li>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" });
}
