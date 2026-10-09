"use server";

import { revalidatePath } from "next/cache";
import { extractText, getDocumentProxy } from "unpdf";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { toISODate, wallTimeToUtc } from "@/lib/dates";
import { parseSyllabus, type FoundAssessment, type FoundSlot, type ParsedSyllabus } from "@/lib/syllabus-parse";
import { parseSyllabusWithClaude } from "@/server/syllabus-ai";

const MAX_BYTES = 4 * 1024 * 1024;

/** Read a syllabus PDF and return what was found, for the student to review. Nothing is saved. */
export async function analyzeSyllabusAction(form: FormData): Promise<{ error: string } | { fileName: string; parsed: ParsedSyllabus; pages: number; excerpt: string }> {
  await requireUser();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choisis un fichier PDF." };
  if (!file.name.toLowerCase().endsWith(".pdf")) return { error: "Seuls les PDF sont acceptés." };
  if (file.size > MAX_BYTES) return { error: "Fichier trop lourd (4 Mo maximum)." };
  try {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const content = Array.isArray(text) ? text.join("\n") : text;
    if (content.trim().length < 40) return { error: "Ce PDF ne contient pas de texte lisible (c'est peut-être une image scannée)." };
    const today = toISODate(new Date());
    const parsed = (await parseSyllabusWithClaude(content, today)) ?? parseSyllabus(content, today);
    return { fileName: file.name, parsed, pages: totalPages, excerpt: content.slice(0, 12000) };
  } catch {
    return { error: "Impossible de lire ce PDF." };
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
  assessments: FoundAssessment[];
  schedule: FoundSlot[];
}) {
  const user = await requireUser();
  let courseId = input.courseId;
  if (courseId) {
    const own = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
    if (!own) return { error: "Cours introuvable." };
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
  const known = new Set(existing.map((a) => `${a.title.toLowerCase()}|${a.dueDate ? toISODate(a.dueDate) : ""}`));
  let added = 0;
  for (const a of input.assessments.slice(0, 80)) {
    const title = a.title.trim().slice(0, 200);
    if (!title || known.has(`${title.toLowerCase()}|${a.date ?? ""}`)) continue;
    let dueDate: Date | null = null;
    if (a.date) {
      const [y, m, d] = a.date.split("-").map(Number);
      const [hh, mm] = (a.time ?? "23:59").split(":").map(Number);
      dueDate = wallTimeToUtc([y, m, d, hh, mm, 0]);
    }
    await prisma.assessment.create({
      data: { userId: user.id, courseId, title, type: a.type, weight: a.weight, dueDate, status: "Upcoming", source: "syllabus" },
    });
    known.add(`${title.toLowerCase()}|${a.date ?? ""}`);
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
