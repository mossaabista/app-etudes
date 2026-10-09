"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, FolderPlus, Info, Undo2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { applyWorkspaceAction, previewWorkspaceAction } from "@/server/actions/workspace.actions";
import { undoCommandAction, type Undo } from "@/server/actions/capture.actions";
import { TEMPLATES, type TemplateId, type WorkspacePlan } from "@/lib/workspaces";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { plural } from "@/i18n/ns/workspace";

const newOpId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

type Done = { message: string; undo: Undo | null; href: string; partial: boolean; opId: string; undone?: string };

/**
 * "Créer un espace": pick a template, see exactly what it would create, reuse and leave
 * out for you, then create it — and undo it in one tap if it is not what you wanted.
 */
export function WorkspaceCreator() {
  const router = useRouter();
  const { t: i18n, locale } = useI18n();
  const w = i18n.workspace.space;
  const tplText = (id: TemplateId) => w.templates[id];
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<TemplateId>("projet");
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<WorkspacePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();
  const t = TEMPLATES.find((x) => x.id === template)!;

  const reset = () => {
    setPlan(null);
    setError(null);
    setDone(null);
  };
  const preview = () =>
    start(async () => {
      setError(null);
      const r = await previewWorkspaceAction(template, name);
      if ("error" in r) {
        setPlan(null);
        setError(r.error);
      } else setPlan(r.plan);
    });
  const create = () =>
    start(async () => {
      const opId = newOpId();
      const r = await applyWorkspaceAction(template, name, opId);
      if ("error" in r) return setError(r.error);
      setDone({ ...r, opId });
      setPlan(null);
      router.refresh();
    });
  const undo = () =>
    start(async () => {
      if (!done?.undo) return;
      const { missed } = await undoCommandAction(done.undo, done.opId);
      setDone({ ...done, undo: null, undone: missed ? plural(locale, missed, w.partialOne, w.partialMany) : w.undone });
      router.refresh();
    });

  const willCreate = plan
    ? [
        ...plan.areas.map(({ area, isNew }) =>
          isNew
            ? fmt(w.newSector, { name: area.label, subs: area.subs.map((s) => s.label).join(", ") || w.emptyWord })
            : fmt(w.inSector, { name: area.label, subs: area.subs.map((s) => s.label).join(", ") })
        ),
        ...(plan.project ? [fmt(w.project, { title: plan.project.title, list: plan.project.milestones.join(", ") })] : []),
        ...plan.tasks.map((x) => fmt(w.task, { title: x.title })),
      ]
    : [];

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="mod-chip mod-chip-gold focus-ring"
      >
        <FolderPlus size={13} /> {w.create}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={w.create}>
        {done ? (
          <div className="space-y-4">
            <p className="flex gap-2 text-sm text-[var(--ink)]" role="status">
              {done.partial ? <Info size={16} className="mt-0.5 shrink-0 text-[#ffb3a3]" /> : <Check size={16} className="mt-0.5 shrink-0 text-[#f0cd79]" />}
              <span>{done.undone ?? done.message}</span>
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              {done.undo && (
                <button type="button" onClick={undo} disabled={pending} className="mod-chip focus-ring">
                  <Undo2 size={13} /> {i18n.common.undo}
                </button>
              )}
              {!done.undone && (
                <Link href={done.href} onClick={() => setOpen(false)} className="mod-chip mod-chip-gold focus-ring">
                  {w.open}
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-[var(--ink-dim)]">{w.forWhat}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {TEMPLATES.map((x) => (
                  <label key={x.id} className="tile flex cursor-pointer flex-col gap-1 px-3.5 py-2.5 has-[:checked]:ring-2 has-[:checked]:ring-[#e8bf63]">
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="workspace-template"
                        checked={template === x.id}
                        onChange={() => {
                          setTemplate(x.id);
                          setPlan(null);
                          setError(null);
                        }}
                        className="h-4 w-4 accent-[#e8bf63]"
                      />
                      <span className="text-sm font-semibold text-[var(--ink)]">{tplText(x.id).label}</span>
                    </span>
                    <span className="text-xs leading-5 text-[var(--ink-dim)]">{tplText(x.id).pitch}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {t.needsName && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--ink-dim)]">{w.projectName}</span>
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setPlan(null);
                  }}
                  placeholder={w.namePlaceholder}
                  className="w-full rounded-xl border border-[rgba(255,220,148,0.18)] bg-[rgba(20,12,3,0.4)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[#e8bf63]"
                />
              </label>
            )}

            {error && (
              <p role="alert" className="rounded-xl bg-[rgba(220,60,40,0.18)] px-3 py-2 text-sm text-[#ffd9cf]">
                {error}
              </p>
            )}

            {plan && (
              <div className="space-y-3 rounded-2xl border border-[rgba(255,220,148,0.12)] p-3.5 text-sm">
                <Section title={w.willCreate} items={willCreate} empty={w.nothingNew} />
                <Section title={w.why} items={plan.why} />
                <Section title={w.reused} items={plan.reused} />
                <Section title={w.skipped} items={plan.skipped} />
                <Section title={w.toKnow} items={plan.notes} />
                <p className="text-[0.7rem] text-[var(--ink-faint)]">{fmt(w.previewNote, { name: tplText(t.id).label })}</p>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={preview} disabled={pending || (t.needsName && !name.trim())} className="mod-chip focus-ring">
                {pending && !plan ? "…" : w.preview}
              </button>
              <button type="button" onClick={create} disabled={pending || !plan || willCreate.length === 0} className="mod-chip mod-chip-gold focus-ring">
                {pending && plan ? w.creating : w.confirm}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function Section({ title, items, empty }: { title: string; items: string[]; empty?: string }) {
  if (!items.length && !empty) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-[var(--ink-dim)]">{title}</p>
      {items.length ? (
        <ul className="space-y-0.5">
          {items.map((x, i) => (
            <li key={i} className="flex gap-2 text-[var(--ink)]">
              <span aria-hidden className="text-[var(--ink-faint)]">•</span>
              <span className="min-w-0 flex-1">{x}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--ink-dim)]">{empty}</p>
      )}
    </div>
  );
}
