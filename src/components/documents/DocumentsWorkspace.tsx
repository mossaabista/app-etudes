"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, ListChecks, Loader2, MessageSquareText, Sparkles, Trash2, Upload } from "lucide-react";
import { askDocumentsAction, deleteDocumentAction, summarizeDocumentAction, tasksFromDocumentAction, uploadDocumentAction } from "@/server/actions/documents.actions";
import type { Answer, DocMeta, Summary } from "@/server/documents";

const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`);
const day = (iso: string) => new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short" }).format(new Date(iso));

/**
 * Documents: add files, read their summary and the things they ask you to do, and ask
 * questions answered from them with the page each answer comes from.
 */
export function DocumentsWorkspace({ initial, ai }: { initial: DocMeta[]; ai: boolean }) {
  const router = useRouter();
  const [docs, setDocs] = useState(initial);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [asking, startAsk] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const upload = async (files: File[]) => {
    setUploading(true);
    setStatus(null);
    const errors: string[] = [];
    for (const f of files.slice(0, 10)) {
      const form = new FormData();
      form.set("file", f);
      const r = await uploadDocumentAction(form);
      if ("error" in r) errors.push(`${f.name} : ${r.error}`);
      else setDocs((d) => [r, ...d]);
    }
    setUploading(false);
    setStatus(errors.length ? { text: errors.join(" "), error: true } : { text: `${files.length} document${files.length > 1 ? "s" : ""} ajouté${files.length > 1 ? "s" : ""}.` });
    router.refresh();
  };

  const ask = () =>
    startAsk(async () => {
      const r = await askDocumentsAction(question);
      if ("error" in r) return setStatus({ text: r.error, error: true });
      setAnswer(r);
    });

  return (
    <div className="space-y-5">
      <section className="glass-card flex flex-wrap items-center gap-4 p-5">
        <span className="pilot-orb h-12 w-12 shrink-0" aria-hidden>
          <Upload size={18} />
        </span>
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Ajoute tes documents</h2>
          <p className="text-xs leading-5 text-[var(--ink-dim)]">PDF avec du texte, Word (.docx), texte (.txt, .md, .csv) — 4 Mo au plus. Ils restent privés et servent seulement à te répondre.</p>
        </div>
        <input
          ref={input}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,.csv"
          aria-label="Choisir des documents"
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length) void upload(files);
          }}
        />
        <button type="button" disabled={uploading} onClick={() => input.current?.click()} className="mod-chip mod-chip-gold focus-ring">
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} {uploading ? "Lecture…" : "Choisir des fichiers"}
        </button>
      </section>

      {status && (
        <p role={status.error ? "alert" : "status"} className={`text-sm ${status.error ? "text-[#ffb3a3]" : "text-[var(--ink-dim)]"}`}>
          {status.text}
        </p>
      )}

      <section className="glass-card p-5" aria-labelledby="ask-title">
        <h2 id="ask-title" className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
          <MessageSquareText size={15} className="text-[#f0cd79]" /> Pose une question à tes documents
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (question.trim()) ask();
          }}
          className="mt-3 flex flex-wrap gap-2"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="ex. Quelle est la pondération de l'examen final ?"
            aria-label="Ta question"
            className="min-w-0 flex-1 basis-64 rounded-xl border border-[rgba(255,220,148,0.18)] bg-[rgba(20,12,3,0.4)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[#e8bf63]"
          />
          <button type="submit" disabled={asking || !question.trim() || !docs.length} className="mod-chip mod-chip-gold focus-ring">
            {asking ? "Recherche…" : "Demander"}
          </button>
        </form>
        {!ai && <p className="mt-2 text-xs text-[var(--ink-faint)]">Sans l&apos;assistant intelligent, je te montre les passages les plus pertinents, sans les reformuler.</p>}
        {answer && (
          <div className="mt-4 space-y-3" role="status">
            <p className={`text-sm leading-6 ${answer.missing ? "text-[#ffd9a8]" : "text-[var(--ink)]"}`}>{answer.answer}</p>
            {answer.sources.length > 0 && (
              <ol className="space-y-2">
                {answer.sources.map((s) => (
                  <li key={s.ref} className="tile px-3.5 py-2.5">
                    <p className="text-xs font-semibold text-[#f0cd79]">
                      [{s.ref}] {s.docName}
                      {s.page ? `, p. ${s.page}` : ""}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--ink-dim)]">« {s.text.length > 320 ? `${s.text.slice(0, 320)}…` : s.text} »</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="docs-title">
        <h2 id="docs-title" className="mb-2 text-sm font-semibold text-on-gold">
          Mes documents ({docs.length})
        </h2>
        {docs.length === 0 ? (
          <p className="glass-card p-5 text-sm text-[var(--ink-dim)]">Aucun document pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <DocRow key={d.id} d={d} ai={ai} onDeleted={() => {
                  setDocs((x) => x.filter((y) => y.id !== d.id));
                  // An answer that cited the deleted document no longer has its source.
                  setAnswer((a) => (a?.sources.some((s) => s.docId === d.id) ? null : a));
                }} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DocRow({ d, ai, onDeleted }: { d: DocMeta; ai: boolean; onDeleted: () => void }) {
  const [summary, setSummary] = useState<Summary | null>(d.summary);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const summarize = () =>
    start(async () => {
      const r = await summarizeDocumentAction(d.id);
      if ("error" in r) return setNote(r.error);
      setSummary(r);
      setOpen(true);
    });
  const makeTasks = () =>
    start(async () => {
      const r = await tasksFromDocumentAction(picked);
      setNote("error" in r ? (r.error ?? "Erreur.") : `${r.count} tâche${r.count > 1 ? "s" : ""} créée${r.count > 1 ? "s" : ""} (à ranger dans Secteurs).`);
      if ("ok" in r) setPicked([]);
    });

  return (
    <li className="glass-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <FileText size={16} className="shrink-0 text-[#f0cd79]" aria-hidden />
        <div className="min-w-0 flex-1 basis-48">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">{d.name}</p>
          <p className="text-xs text-[var(--ink-dim)]">
            {d.type} · {d.paged ? `${d.pages} page${d.pages > 1 ? "s" : ""} · ` : ""}
            {size(d.size)} · ajouté le {day(d.createdAt)}
          </p>
        </div>
        <button type="button" onClick={() => (summary ? setOpen((o) => !o) : summarize())} disabled={pending} aria-expanded={open} className="mod-chip focus-ring">
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {summary ? (open ? "Masquer" : "Résumé") : "Résumer"}
        </button>
        {confirmDelete ? (
          <span className="flex items-center gap-2 text-xs text-[var(--ink-dim)]">
            Supprimer définitivement ?
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  const r = await deleteDocumentAction(d.id);
                  if ("ok" in r) onDeleted();
                  else setNote(r.error);
                })
              }
              className="mod-chip focus-ring text-[#ffb3a3]"
            >
              Oui
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="mod-chip focus-ring">
              Non
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} aria-label={`Supprimer ${d.name}`} className="focus-ring rounded p-1.5 text-[var(--ink-faint)] hover:text-[#ffb3a3]">
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {open && summary && (
        <div className="mt-3 space-y-3 border-t border-[rgba(255,220,148,0.1)] pt-3">
          <p className="text-xs text-[var(--ink-faint)]">{summary.by === "ai" ? "Résumé écrit par l'assistant à partir du document." : ai ? "Extrait automatique." : "Extrait automatique (premières phrases et lignes qui demandent une action), sans reformulation : l'assistant intelligent n'est pas activé."}</p>
          <p className="text-sm leading-6 text-[var(--ink)]">{summary.text}</p>
          {summary.dates.length > 0 && <p className="text-xs text-[var(--ink-dim)]">Dates mentionnées : {summary.dates.join(" · ")}</p>}
          {summary.actions.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-dim)]">
                <ListChecks size={13} /> Actions demandées
              </p>
              <ul className="space-y-1">
                {summary.actions.map((a) => (
                  <li key={a}>
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--ink)]">
                      <input type="checkbox" checked={picked.includes(a)} onChange={() => setPicked((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]))} className="mt-1 h-4 w-4 accent-[#e8bf63]" />
                      {a}
                    </label>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={makeTasks} disabled={pending || !picked.length} className="mod-chip mod-chip-gold focus-ring mt-2">
                Créer {picked.length || ""} tâche{picked.length > 1 ? "s" : ""}
              </button>
            </div>
          )}
        </div>
      )}
      {note && (
        <p role="status" className="mt-2 text-xs text-[var(--ink-dim)]">
          {note}
        </p>
      )}
    </li>
  );
}
