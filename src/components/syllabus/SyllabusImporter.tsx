"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, ChevronDown, FileUp, Loader2, Sparkles, X } from "lucide-react";
import { analyzeSyllabusAction, importSyllabusAction } from "@/server/actions/syllabus.actions";
import type { FoundAssessment, FoundSlot } from "@/lib/syllabus-parse";
import { reviewAssessments, type Confidence, type ReviewedAssessment } from "@/lib/syllabus-review";
import { toISODate } from "@/lib/dates";
import { CheckBox, field } from "@/components/modules/kit";
import { labelIn } from "@/lib/labels";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";

const TYPES: FoundAssessment["type"][] = ["Exam", "Quiz", "Lab", "Project", "Assignment", "Presentation"];
const CONFIDENCE: Record<Confidence, { key: "confHigh" | "confMedium" | "confLow"; color: string }> = {
  high: { key: "confHigh", color: "#7fe0b0" },
  medium: { key: "confMedium", color: "#f0cd79" },
  low: { key: "confLow", color: "#ffb3a3" },
};
type Course = { id: string; code: string; name: string; assessments: { title: string; date: string | null }[] };
const ACCEPT = ".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp";
const accepted = (name: string) => /\.(pdf|docx|png|jpe?g|webp)$/i.test(name);

/** Plural form: French counts 0 and 1 as singular, English only 1. */
const plural = (n: number, locale: "fr" | "en") => (locale === "fr" ? n > 1 : n !== 1);

interface Draft {
  id: string;
  fileName: string;
  status: "reading" | "ready" | "error" | "importing" | "imported";
  error?: string;
  excerpt: string;
  pageTexts: string[];
  paged: boolean;
  readBy: string;
  warnings: string[];
  topics: string[];
  courseId: string;
  course: { code: string; name: string; professor: string; email: string; term: string };
  rows: ReviewedAssessment[];
  slots: (FoundSlot & { on: boolean })[];
  result?: { courseId: string; added: number; slotsAdded: number };
  open: boolean;
}

/**
 * Drop every syllabus of the session at once. Each is read (by the assistant when a key is
 * set, by rules otherwise), shown for a quick check, and imported — course folder,
 * assessments with dates and weights, weekly timetable and chapters — in one tap.
 */
export function SyllabusImporter({ courses }: { courses: Course[] }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { t } = useI18n();
  const k = t.academics;

  const patch = (id: string, p: Partial<Draft> | ((d: Draft) => Partial<Draft>)) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...(typeof p === "function" ? p(d) : p) } : d)));

  const analyze = async (files: File[]) => {
    const fresh = files
      .filter((f) => accepted(f.name))
      .slice(0, 12)
      .map((f) => ({ file: f, id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 6)}` }));
    setDrafts((ds) => [
      ...ds,
      ...fresh.map(({ file, id }) => ({
        id,
        fileName: file.name,
        status: "reading" as const,
        excerpt: "",
        pageTexts: [],
        paged: true,
        readBy: "",
        warnings: [],
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
        pageTexts: res.pageTexts,
        paged: res.paged,
        readBy: res.readBy,
        warnings: res.warnings,
        topics: p.topics ?? [],
        courseId: match?.id ?? "",
        course: { code: p.code ?? "", name: p.name ?? "", professor: p.professor ?? "", email: p.email ?? "", term: p.term ?? "" },
        rows: review(p.assessments, res.pageTexts, match?.id ?? "", res.paged),
        // Anything uncertain opens the review straight away.
        open: res.warnings.length > 0 || review(p.assessments, res.pageTexts, match?.id ?? "", res.paged).some((r) => r.confidence !== "high"),
        slots: p.schedule.map((s) => ({ ...s, on: true })),
      });
    }
  };

  function review(items: FoundAssessment[], pageTexts: string[], courseId: string, paged: boolean) {
    return reviewAssessments({ items, pages: pageTexts, paged, existing: courses.find((c) => c.id === courseId)?.assessments ?? [], today: toISODate(new Date()) });
  }

  const importOne = async (d: Draft) => {
    patch(d.id, { status: "importing" });
    const res = await importSyllabusAction({
      courseId: d.courseId || null,
      course: { code: d.course.code, name: d.course.name, professor: d.course.professor || null, email: d.course.email || null, term: d.course.term || null },
      fileName: d.fileName,
      topics: d.topics,
      excerpt: d.excerpt,
      assessments: d.rows.filter((r) => r.on).map((r) => ({ title: r.title, type: r.type, date: r.date, time: r.time, weight: r.weight, line: r.line, source: r.source })),
      schedule: d.slots.filter((s) => s.on).map((s) => ({ day: s.day, start: s.start, end: s.end, type: s.type, room: s.room })),
    });
    if ("error" in res) return patch(d.id, { status: "error", error: res.error ?? k.importFailed });
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
            <h2 className="text-base font-semibold text-[var(--ink)]">{k.dropTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--ink-dim)]">{k.dropBody}</p>
          </div>
          <input
            ref={input}
            type="file"
            multiple
            accept={ACCEPT}
            aria-label={k.chooseFilesAria}
            className="hidden"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              void analyze(files);
            }}
          />
          <button type="button" onClick={() => input.current?.click()} className="mod-chip mod-chip-gold focus-ring shrink-0 px-5 py-3 text-sm">
            <Sparkles size={15} /> {k.chooseFiles}
          </button>
        </div>
      </section>

      {ready.length > 1 && (
        <div className="flex justify-end">
          <button type="button" onClick={() => void importAll()} className="mod-chip mod-chip-gold focus-ring px-6 py-3 text-sm">
            {fmt(k.importAll, { n: ready.length })} <ArrowRight size={15} />
          </button>
        </div>
      )}

      {drafts.map((d) => (
        <DraftCard
          key={d.id}
          d={d}
          courses={courses}
          rereview={(courseId) => patch(d.id, (x) => ({ courseId, rows: review(x.rows, x.pageTexts, courseId, x.paged) }))}
          patch={(p) => patch(d.id, p)} onImport={() => void importOne(d)} onRemove={() => setDrafts((ds) => ds.filter((x) => x.id !== d.id))} />
      ))}
    </div>
  );
}

function DraftCard({
  d,
  courses,
  rereview,
  patch,
  onImport,
  onRemove,
}: {
  d: Draft;
  courses: Course[];
  rereview: (courseId: string) => void;
  patch: (p: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => void;
  onImport: () => void;
  onRemove: () => void;
}) {
  const setRow = (i: number, p: Partial<ReviewedAssessment>) => patch((x) => ({ rows: x.rows.map((r, j) => (j === i ? { ...r, ...p } : r)) }));
  const total = d.rows.filter((r) => r.on).reduce((s, r) => s + (r.weight ?? 0), 0);
  const name = d.courseId ? courses.find((c) => c.id === d.courseId)?.code : d.course.code || d.fileName;
  const { t, locale } = useI18n();
  const k = t.academics;

  return (
    <section className="glass-card p-5">
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(240,205,121,0.12)] text-[#f0cd79]">
          {d.status === "reading" || d.status === "importing" ? <Loader2 size={16} className="animate-spin" /> : d.status === "imported" ? <Check size={16} /> : <FileUp size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">
            {d.status === "reading" ? fmt(k.readingFile, { file: d.fileName }) : `${name}${d.course.name && !d.courseId ? ` — ${d.course.name}` : ""}`}
          </p>
          <p className="truncate text-xs text-[var(--ink-dim)]">
            {d.status === "error"
              ? d.error
              : d.status === "imported"
                ? fmt(k.importedSummary, {
                    a: fmt(plural(d.result!.added, locale) ? k.wAssessmentMany : k.wAssessmentOne, { n: d.result!.added }),
                    s: fmt(plural(d.result!.slotsAdded, locale) ? k.wSlotMany : k.wSlotOne, { n: d.result!.slotsAdded }),
                  })
                : d.status === "reading"
                  ? k.readingHint
                  : fmt(k.readySummary, {
                      n: d.rows.length,
                      c: d.rows.filter((r) => r.confidence !== "high").length,
                      s: d.slots.length,
                      t: d.topics.length,
                      kind: d.courseId ? k.existingCourse : k.newCourse,
                      by: d.readBy,
                    })}
          </p>
        </div>
        {d.status === "ready" && (
          <>
            <button type="button" onClick={() => patch({ open: !d.open })} aria-expanded={d.open} className="mod-chip focus-ring">
              {k.review} <ChevronDown size={13} className={d.open ? "rotate-180" : ""} />
            </button>
            <button type="button" onClick={onImport} disabled={!d.courseId && !d.course.code.trim()} className="mod-chip mod-chip-gold focus-ring">
              {k.import} <ArrowRight size={13} />
            </button>
          </>
        )}
        {d.status === "imported" && (
          <Link href={`/courses/${d.result!.courseId}`} className="mod-chip focus-ring">
            {k.viewCourse} <ArrowRight size={13} />
          </Link>
        )}
        {(d.status === "ready" || d.status === "error") && (
          <button type="button" onClick={onRemove} aria-label={k.remove} className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
            <X size={15} />
          </button>
        )}
      </header>

      {d.status === "ready" && d.warnings.length > 0 && (
        <ul className="mt-3 space-y-1" role="status">
          {d.warnings.map((w) => (
            <li key={w} className="flex gap-2 text-xs leading-5 text-[#ffd9a8]">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden /> {w}
            </li>
          ))}
        </ul>
      )}

      {d.status === "ready" && d.open && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <select value={d.courseId} onChange={(e) => rereview(e.target.value)} aria-label={k.course} className={`${field} w-64 cursor-pointer appearance-none`}>
              <option value="">{k.createNewCourse}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            {!d.courseId && (
              <>
                <input value={d.course.code} onChange={(e) => patch((x) => ({ course: { ...x.course, code: e.target.value } }))} placeholder={k.codePh} aria-label={k.code} className={`${field} w-32`} />
                <input value={d.course.name} onChange={(e) => patch((x) => ({ course: { ...x.course, name: e.target.value } }))} placeholder={k.name} aria-label={k.name} className={`${field} flex-1 basis-48`} />
                <input value={d.course.professor} onChange={(e) => patch((x) => ({ course: { ...x.course, professor: e.target.value } }))} placeholder={k.professor} aria-label={k.professor} className={`${field} w-48`} />
              </>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--ink-dim)]">
              {fmt(k.totalLine, { n: total })}
              {total && Math.abs(total - 100) > 1 ? k.totalWarn : ""}
            </p>
            <ul className="space-y-2">
              {d.rows.map((r, i) => (
                <li key={i} className={`tile flex flex-wrap items-center gap-2 px-3 py-2.5 ${r.on ? "" : "opacity-45"}`}>
                  <CheckBox checked={r.on} label={k.import} onChange={() => setRow(i, { on: !r.on })} />
                  <input value={r.title} onChange={(e) => setRow(i, { title: e.target.value })} aria-label={k.title} className={`${field} min-w-0 flex-1 basis-48`} />
                  <select value={r.type} onChange={(e) => setRow(i, { type: e.target.value as FoundAssessment["type"] })} aria-label={k.type} className={`${field} w-36 cursor-pointer appearance-none`}>
                    {TYPES.map((x) => (
                      <option key={x} value={x}>
                        {labelIn(x, locale)}
                      </option>
                    ))}
                  </select>
                  <input type="date" value={r.date ?? ""} onChange={(e) => setRow(i, { date: e.target.value || null })} aria-label={k.colDate} className={`${field} w-36`} />
                  <input type="time" value={r.time ?? ""} onChange={(e) => setRow(i, { time: e.target.value || null })} aria-label={k.time} className={`${field} w-24`} />
                  <input
                    type="number"
                    step="0.5"
                    value={r.weight ?? ""}
                    onChange={(e) => setRow(i, { weight: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="%"
                    aria-label={k.weight}
                    className={`${field} w-20`}
                  />
                  <span className="basis-full text-[0.7rem] leading-5 text-[var(--ink-dim)]">
                    <span className="mr-2 inline-flex items-center gap-1 font-semibold" style={{ color: CONFIDENCE[r.confidence].color }}>
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: CONFIDENCE[r.confidence].color }} />
                      {k[CONFIDENCE[r.confidence].key]}
                    </span>
                    {r.source ? `${r.source.page ? fmt(k.page, { n: r.source.page }) : ""}${fmt(k.quote, { text: r.source.excerpt.slice(0, 120) })}` : k.unknownSource}
                    {r.flags.length > 0 && <span className="block text-[var(--ink-faint)]">{r.flags.join(" ")}</span>}
                  </span>
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
                  {labelIn(s.day, locale)} {s.start}–{s.end} · {s.type === "Lab" ? k.slotLab : s.type === "Tutorial" ? k.slotTutorial : k.slotLecture}
                  {s.room ? ` · ${s.room}` : ""}
                </button>
              ))}
            </div>
          )}

          {d.topics.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-[var(--ink-dim)]">{k.chaptersFound}</p>
              <ol className="list-decimal space-y-0.5 pl-5 text-xs text-[var(--ink-dim)]">
                {d.topics.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
