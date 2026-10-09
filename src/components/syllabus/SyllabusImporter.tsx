"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, FileUp, Loader2, Sparkles, X } from "lucide-react";
import { analyzeSyllabusAction, importSyllabusAction } from "@/server/actions/syllabus.actions";
import type { FoundAssessment, FoundSlot } from "@/lib/syllabus-parse";
import { CheckBox, field } from "@/components/modules/kit";

const TYPE_LABEL: Record<FoundAssessment["type"], string> = {
  Exam: "Examen",
  Quiz: "Quiz",
  Lab: "Laboratoire",
  Project: "Projet",
  Assignment: "Devoir",
  Presentation: "Présentation",
};
const DAY_LABEL: Record<string, string> = { Monday: "Lundi", Tuesday: "Mardi", Wednesday: "Mercredi", Thursday: "Jeudi", Friday: "Vendredi", Saturday: "Samedi", Sunday: "Dimanche" };

interface Draft {
  id: string;
  fileName: string;
  status: "reading" | "ready" | "error" | "importing" | "imported";
  error?: string;
  excerpt: string;
  topics: string[];
  courseId: string;
  course: { code: string; name: string; professor: string; email: string; term: string };
  rows: (FoundAssessment & { on: boolean })[];
  slots: (FoundSlot & { on: boolean })[];
  result?: { courseId: string; added: number; slotsAdded: number };
  open: boolean;
}

/**
 * Drop every syllabus of the session at once. Each is read (by the assistant when a key is
 * set, by rules otherwise), shown for a quick check, and imported — course folder,
 * assessments with dates and weights, weekly timetable and chapters — in one tap.
 */
export function SyllabusImporter({ courses }: { courses: { id: string; code: string; name: string }[] }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const patch = (id: string, p: Partial<Draft> | ((d: Draft) => Partial<Draft>)) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...(typeof p === "function" ? p(d) : p) } : d)));

  const analyze = async (files: File[]) => {
    const fresh = files
      .filter((f) => f.name.toLowerCase().endsWith(".pdf"))
      .slice(0, 12)
      .map((f) => ({ file: f, id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 6)}` }));
    setDrafts((ds) => [
      ...ds,
      ...fresh.map(({ file, id }) => ({
        id,
        fileName: file.name,
        status: "reading" as const,
        excerpt: "",
        topics: [],
        courseId: "",
        course: { code: "", name: "", professor: "", email: "", term: "" },
        rows: [],
        slots: [],
        open: false,
      })),
    ]);
    // One at a time: a dozen PDFs in parallel would hit the server limit.
    for (const { file, id } of fresh) {
      const form = new FormData();
      form.set("file", file);
      const res = await analyzeSyllabusAction(form);
      if ("error" in res) {
        patch(id, { status: "error", error: res.error });
        continue;
      }
      const p = res.parsed;
      const match = courses.find((c) => p.code && c.code.replace(/\s/g, "").toUpperCase().startsWith(p.code));
      patch(id, {
        status: "ready",
        excerpt: res.excerpt,
        topics: p.topics ?? [],
        courseId: match?.id ?? "",
        course: { code: p.code ?? "", name: p.name ?? "", professor: p.professor ?? "", email: p.email ?? "", term: p.term ?? "" },
        rows: p.assessments.map((a) => ({ ...a, on: true })),
        slots: p.schedule.map((s) => ({ ...s, on: true })),
      });
    }
  };

  const importOne = async (d: Draft) => {
    patch(d.id, { status: "importing" });
    const res = await importSyllabusAction({
      courseId: d.courseId || null,
      course: { code: d.course.code, name: d.course.name, professor: d.course.professor || null, email: d.course.email || null, term: d.course.term || null },
      fileName: d.fileName,
      topics: d.topics,
      excerpt: d.excerpt,
      assessments: d.rows.filter((r) => r.on).map((r) => ({ title: r.title, type: r.type, date: r.date, time: r.time, weight: r.weight, line: r.line })),
      schedule: d.slots.filter((s) => s.on).map((s) => ({ day: s.day, start: s.start, end: s.end, type: s.type, room: s.room })),
    });
    if ("error" in res) return patch(d.id, { status: "error", error: res.error ?? "Import impossible." });
    patch(d.id, { status: "imported", result: { courseId: res.courseId!, added: res.added!, slotsAdded: res.slotsAdded! }, open: false });
  };

  const ready = drafts.filter((d) => d.status === "ready" && (d.courseId || d.course.code.trim()));
  const importAll = async () => {
    for (const d of ready) await importOne(d);
  };

  return (
    <div className="space-y-4">
      <section
        className={`glass-card p-6 transition-shadow ${dragging ? "ring-2 ring-[#f0cd79]" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void analyze([...e.dataTransfer.files]);
        }}
      >
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <span className="pilot-orb h-14 w-14 shrink-0">
            <FileUp size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-[var(--ink)]">Dépose tous tes syllabus</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--ink-dim)]">
              Un ou douze PDF, glissés ici ou choisis. Chaque cours obtient son dossier, ses évaluations datées et pondérées, son horaire et ses chapitres — que le plan de révision
              utilisera.
            </p>
          </div>
          <input
            ref={input}
            type="file"
            multiple
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              void analyze(files);
            }}
          />
          <button type="button" onClick={() => input.current?.click()} className="mod-chip mod-chip-gold focus-ring shrink-0 px-5 py-3 text-sm">
            <Sparkles size={15} /> Choisir des PDF
          </button>
        </div>
      </section>

      {ready.length > 1 && (
        <div className="flex justify-end">
          <button type="button" onClick={() => void importAll()} className="mod-chip mod-chip-gold focus-ring px-6 py-3 text-sm">
            Tout importer ({ready.length}) <ArrowRight size={15} />
          </button>
        </div>
      )}

      {drafts.map((d) => (
        <DraftCard key={d.id} d={d} courses={courses} patch={(p) => patch(d.id, p)} onImport={() => void importOne(d)} onRemove={() => setDrafts((ds) => ds.filter((x) => x.id !== d.id))} />
      ))}
    </div>
  );
}

function DraftCard({
  d,
  courses,
  patch,
  onImport,
  onRemove,
}: {
  d: Draft;
  courses: { id: string; code: string; name: string }[];
  patch: (p: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => void;
  onImport: () => void;
  onRemove: () => void;
}) {
  const setRow = (i: number, p: Partial<FoundAssessment & { on: boolean }>) => patch((x) => ({ rows: x.rows.map((r, j) => (j === i ? { ...r, ...p } : r)) }));
  const total = d.rows.filter((r) => r.on).reduce((s, r) => s + (r.weight ?? 0), 0);
  const name = d.courseId ? courses.find((c) => c.id === d.courseId)?.code : d.course.code || d.fileName;

  return (
    <section className="glass-card p-5">
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(240,205,121,0.12)] text-[#f0cd79]">
          {d.status === "reading" || d.status === "importing" ? <Loader2 size={16} className="animate-spin" /> : d.status === "imported" ? <Check size={16} /> : <FileUp size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">
            {d.status === "reading" ? `Lecture de ${d.fileName}…` : `${name}${d.course.name && !d.courseId ? ` — ${d.course.name}` : ""}`}
          </p>
          <p className="truncate text-xs text-[var(--ink-dim)]">
            {d.status === "error"
              ? d.error
              : d.status === "imported"
                ? `${d.result!.added} évaluation${d.result!.added > 1 ? "s" : ""} et ${d.result!.slotsAdded} créneau${d.result!.slotsAdded > 1 ? "x" : ""} importés`
                : d.status === "reading"
                  ? "Cours, évaluations, horaire et chapitres…"
                  : `${d.rows.length} évaluations · ${d.slots.length} créneaux · ${d.topics.length} chapitres · ${d.courseId ? "cours existant" : "nouveau cours"}`}
          </p>
        </div>
        {d.status === "ready" && (
          <>
            <button type="button" onClick={() => patch({ open: !d.open })} aria-expanded={d.open} className="mod-chip focus-ring">
              Vérifier <ChevronDown size={13} className={d.open ? "rotate-180" : ""} />
            </button>
            <button type="button" onClick={onImport} disabled={!d.courseId && !d.course.code.trim()} className="mod-chip mod-chip-gold focus-ring">
              Importer <ArrowRight size={13} />
            </button>
          </>
        )}
        {d.status === "imported" && (
          <Link href={`/courses/${d.result!.courseId}`} className="mod-chip focus-ring">
            Voir le cours <ArrowRight size={13} />
          </Link>
        )}
        {(d.status === "ready" || d.status === "error") && (
          <button type="button" onClick={onRemove} aria-label="Retirer" className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
            <X size={15} />
          </button>
        )}
      </header>

      {d.status === "ready" && d.open && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <select value={d.courseId} onChange={(e) => patch({ courseId: e.target.value })} aria-label="Cours" className={`${field} w-64 cursor-pointer appearance-none`}>
              <option value="">Créer un nouveau cours</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            {!d.courseId && (
              <>
                <input value={d.course.code} onChange={(e) => patch((x) => ({ course: { ...x.course, code: e.target.value } }))} placeholder="Code" aria-label="Code du cours" className={`${field} w-32`} />
                <input value={d.course.name} onChange={(e) => patch((x) => ({ course: { ...x.course, name: e.target.value } }))} placeholder="Nom du cours" aria-label="Nom du cours" className={`${field} flex-1 basis-48`} />
                <input value={d.course.professor} onChange={(e) => patch((x) => ({ course: { ...x.course, professor: e.target.value } }))} placeholder="Professeur" aria-label="Professeur" className={`${field} w-48`} />
              </>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--ink-dim)]">
              Évaluations · total {total} %{total && Math.abs(total - 100) > 1 ? " (vérifie : le total devrait faire 100 %)" : ""}
            </p>
            <ul className="space-y-2">
              {d.rows.map((r, i) => (
                <li key={i} className={`tile flex flex-wrap items-center gap-2 px-3 py-2.5 ${r.on ? "" : "opacity-45"}`}>
                  <CheckBox checked={r.on} label="Importer" onChange={() => setRow(i, { on: !r.on })} />
                  <input value={r.title} onChange={(e) => setRow(i, { title: e.target.value })} aria-label="Titre" className={`${field} min-w-0 flex-1 basis-48`} />
                  <select value={r.type} onChange={(e) => setRow(i, { type: e.target.value as FoundAssessment["type"] })} aria-label="Type" className={`${field} w-36 cursor-pointer appearance-none`}>
                    {Object.entries(TYPE_LABEL).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <input type="date" value={r.date ?? ""} onChange={(e) => setRow(i, { date: e.target.value || null })} aria-label="Date" className={`${field} w-36`} />
                  <input type="time" value={r.time ?? ""} onChange={(e) => setRow(i, { time: e.target.value || null })} aria-label="Heure" className={`${field} w-24`} />
                  <input
                    type="number"
                    step="0.5"
                    value={r.weight ?? ""}
                    onChange={(e) => setRow(i, { weight: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="%"
                    aria-label="Pondération"
                    className={`${field} w-20`}
                  />
                </li>
              ))}
            </ul>
          </div>

          {d.slots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {d.slots.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => patch((x) => ({ slots: x.slots.map((y, j) => (j === i ? { ...y, on: !y.on } : y)) }))}
                  className={`mod-chip focus-ring ${s.on ? "" : "opacity-45 line-through"}`}
                >
                  {DAY_LABEL[s.day]} {s.start}–{s.end} · {s.type === "Lab" ? "Labo" : s.type === "Tutorial" ? "DGD" : "Cours"}
                  {s.room ? ` · ${s.room}` : ""}
                </button>
              ))}
            </div>
          )}

          {d.topics.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-[var(--ink-dim)]">Chapitres repérés</p>
              <ol className="list-decimal space-y-0.5 pl-5 text-xs text-[var(--ink-dim)]">
                {d.topics.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
