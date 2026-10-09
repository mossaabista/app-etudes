"use server";

import { revalidatePath } from "next/cache";
import { extractText, getDocumentProxy } from "unpdf";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { toISODate, wallTimeToUtc } from "@/lib/dates";
import { parseSyllabus, type FoundAssessment, type FoundSlot, type ParsedSyllabus } from "@/lib/syllabus-parse";
import { parseSyllabusFileWithClaude, parseSyllabusWithClaude, syllabusAiEnabled, type SyllabusFile } from "@/server/syllabus-ai";
import { docxText } from "@/server/docx";
import { sourceNote, suspiciousLines, titleKey } from "@/lib/syllabus-review";
import { getMessages } from "@/i18n/server";
import { fmt } from "@/i18n/config";

const MAX_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES: Record<string, SyllabusFile["mediaType"]> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

export type AnalyzedSyllabus = {
  fileName: string;
  parsed: ParsedSyllabus;
  pages: number;
  /** The document's text, page by page: what each date is traced back to. */
  pageTexts: string[];
  excerpt: string;
  /** Whether pageTexts are real pages (PDF, scan) rather than one block of text (Word, photo). */
  paged: boolean;
  /** How it was read, in words, and anything the student should know about it. */
  readBy: string;
  warnings: string[];
};

/**
 * Read a syllabus — PDF with text, Word document, scanned PDF or photo — and return what
 * was found, for the student to review. Nothing is saved.
 */
export async function analyzeSyllabusAction(form: FormData): Promise<{ error: string } | AnalyzedSyllabus> {
  await requireUser();
  const k = (await getMessages()).academics;
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: k.errPickFile };
  if (file.size > MAX_BYTES) return { error: k.errTooBig };
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const today = toISODate(new Date());
  const buf = Buffer.from(await file.arrayBuffer());
  const warnings: string[] = [];

  try {
    let pageTexts: string[] = [];
    let readBy = "";
    let parsed: ParsedSyllabus | null = null;

    if (ext === "pdf") {
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: false });
      pageTexts = (Array.isArray(text) ? text : [text]).map(String);
      readBy = k.byPdf;
    } else if (ext === "docx") {
      const text = docxText(buf);
      if (text == null) return { error: k.errDocx };
      pageTexts = [text];
      readBy = k.byWord;
    } else if (IMAGE_TYPES[ext]) {
      if (!syllabusAiEnabled()) return { error: k.errPhotoUnavailable };
      const r = await parseSyllabusFileWithClaude({ mediaType: IMAGE_TYPES[ext], base64: buf.toString("base64") }, today);
      if (!r) return { error: k.errPhotoFailed };
      parsed = r.parsed;
      pageTexts = r.pages;
      readBy = k.byPhoto;
      warnings.push(k.warnPhoto);
    } else {
      return { error: k.errFormats };
    }

    const content = pageTexts.join("\n");
    if (!parsed && content.trim().length < 40) {
      // A scanned PDF: no text layer. Claude can read the page images.
      if (ext === "pdf" && syllabusAiEnabled()) {
        const r = await parseSyllabusFileWithClaude({ mediaType: "application/pdf", base64: buf.toString("base64") }, today);
        if (!r) return { error: k.errScanFailed };
        parsed = r.parsed;
        pageTexts = r.pages;
        readBy = k.byScan;
        warnings.push(k.warnScan);
      } else {
        return { error: k.errNoText };
      }
    }

    if (!parsed) {
      const ai = await parseSyllabusWithClaude(content, today);
      parsed = ai ?? parseSyllabus(content, today);
      readBy += ai ? k.byAi : k.byRules;
    }

    const suspicious = suspiciousLines(pageTexts);
    if (suspicious.length)
      warnings.push(fmt(suspicious.length > 1 ? k.warnSuspiciousMany : k.warnSuspiciousOne, { n: suspicious.length, text: suspicious[0].slice(0, 80) }));
    const total = parsed.assessments.reduce((n, a) => n + (a.weight ?? 0), 0);
    if (parsed.assessments.length && total && Math.abs(total - 100) > 1) warnings.push(fmt(k.warnWeights, { n: total }));

    return { fileName: file.name, parsed, paged: ext === "pdf", pages: pageTexts.length, pageTexts: pageTexts.map((p) => p.slice(0, 20000)).slice(0, 60), excerpt: pageTexts.join("\n").slice(0, 12000), readBy, warnings };
  } catch {
    return { error: k.errRead };
  }
}

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f97316", "#8b5cf6", "#14b8a6", "#ec4899", "#eab308"];

/**
 * Save the reviewed result: the course (created if needed), its assessments and its weekly
 * schedule. Rows already present (same title and date, or same weekly slot) are skipped,
 * so importing twice is harmless.
 */
export async function importSyllabusAction(input: {
  courseId: string | null;
  course: { code: string; name: string; professor: string | null; email?: string | null; term?: string | null };
  fileName: string;
  topics?: string[];
  excerpt?: string;
  assessments: (FoundAssessment & { source?: { page: number | null; excerpt: string } | null })[];
  schedule: FoundSlot[];
}) {
  const user = await requireUser();
  let courseId = input.courseId;
  if (courseId) {
    const own = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
    if (!own) return { error: (await getMessages()).academics.syllabusCourseNotFound };
  } else {
    const code = input.course.code.trim().slice(0, 20) || "COURS";
    const count = await prisma.course.count({ where: { userId: user.id } });
    const created = await prisma.course.create({
      data: {
        userId: user.id,
        code,
        name: input.course.name.trim().slice(0, 120) || code,
        professor: input.course.professor?.slice(0, 80) || null,
        email: input.course.email?.slice(0, 120) || null,
        term: input.course.term?.slice(0, 40) || null,
        color: COLORS[count % COLORS.length],
      },
    });
    courseId = created.id;
  }

  const existing = await prisma.assessment.findMany({ where: { userId: user.id, courseId }, select: { title: true, dueDate: true } });
  // Same title (case, accents and spacing aside) and same day: already there, skipped.
  const known = new Set(existing.map((a) => `${titleKey(a.title)}|${a.dueDate ? toISODate(a.dueDate) : ""}`));
  let added = 0;
  for (const a of input.assessments.slice(0, 80)) {
    const title = a.title.trim().slice(0, 200);
    if (!title || known.has(`${titleKey(title)}|${a.date ?? ""}`)) continue;
    let dueDate: Date | null = null;
    if (a.date) {
      const [y, m, d] = a.date.split("-").map(Number);
      const [hh, mm] = (a.time ?? "23:59").split(":").map(Number);
      dueDate = wallTimeToUtc([y, m, d, hh, mm, 0]);
    }
    await prisma.assessment.create({
      data: {
        userId: user.id,
        courseId,
        title,
        type: a.type,
        weight: a.weight,
        dueDate,
        status: "Upcoming",
        source: "syllabus",
        // Where the date came from, so it can always be checked against the document.
        notes: sourceNote(input.fileName, a.source ?? null),
      },
    });
    known.add(`${titleKey(title)}|${a.date ?? ""}`);
    added++;
  }

  const slots = await prisma.courseSchedule.findMany({ where: { courseId }, select: { day: true, startTime: true } });
  let slotsAdded = 0;
  for (const s of input.schedule.slice(0, 12)) {
    if (slots.some((x) => x.day === s.day && x.startTime === s.start)) continue;
    await prisma.courseSchedule.create({ data: { courseId, type: s.type, day: s.day, startTime: s.start, endTime: s.end, room: s.room } });
    slotsAdded++;
  }

  await prisma.syllabus.create({
    data: {
      userId: user.id,
      courseId,
      fileName: input.fileName.slice(0, 200),
      fileUrl: "",
      parsed: true,
      rawData: JSON.parse(JSON.stringify({ assessments: input.assessments, schedule: input.schedule, topics: input.topics ?? [], text: (input.excerpt ?? "").slice(0, 12000) })),
    },
  });

  revalidatePath("/", "layout");
  return { ok: true, courseId, added, slotsAdded };
}
