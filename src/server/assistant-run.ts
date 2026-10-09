import { prisma } from "@/lib/db";
import { APP_TIMEZONE, fromISODate, toISODate, wallTimeToUtc } from "@/lib/dates";
import { addMinutes, minutesBetween } from "@/lib/command";
import { guessAisle } from "@/lib/grocery";
import { LIBRARY, LIBRARY_SUBS, PALETTE, sanitizeLayout, slug, type AreaSpec, type Layout, type SubSpec } from "@/lib/layout";
import { askAssistant, type AssistantAction, type Turn } from "@/server/assistant";
import { getLayout, saveLayout } from "@/server/layout";
import { PILOT_NOTE, planDay } from "@/server/pilot";
import { STUDY_PREFIX, planStudy } from "@/server/study";
import type { Undo } from "@/server/actions/capture.actions";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f97316", "#8b5cf6", "#14b8a6", "#ec4899", "#eab308"];

const atWall = (day: string, time: string) => {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return wallTimeToUtc([y, m, d, hh, mm, 0]);
};
const hhmm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

/** How an action reads in a sentence, to say which one could not be done. */
const VERBS: Record<AssistantAction["op"], string> = {
  create_event: "ajouter l'événement",
  create_task: "ajouter la tâche",
  move: "déplacer",
  delete: "supprimer",
  rename: "renommer",
  complete: "cocher",
  create_course: "créer le cours",
  add_area: "créer le secteur",
  remove_area: "retirer le secteur",
  rename_area: "renommer le secteur",
  add_section: "ajouter la section",
  remove_section: "retirer la section",
  rename_section: "renommer la section",
  log: "noter",
  plan_revision: "planifier les révisions",
  plan_day: "planifier la journée",
  navigate: "ouvrir la page",
};

export const describeAction = (a: AssistantAction) => {
  const name = a.title ?? a.label ?? a.name ?? a.code ?? a.area ?? "";
  return `${VERBS[a.op] ?? "faire une action"}${name ? ` « ${String(name).slice(0, 60)} »` : ""}`;
};

/** A reply that says something was done, when nothing was. */
const CLAIMS_DONE = /(^|[^\p{L}])(c['’]est (fait|noté)|j['’]ai (bien )?(ajouté|créé|supprimé|déplacé|décalé|noté|planifié|renommé|coché|retiré|annulé|mis))(?!\p{L})/iu;

export interface AssistantResult {
  message: string;
  undos: Undo[];
  navigate: string | null;
  /** Nothing was changed: a question was answered (shown and read in full). */
  answer: boolean;
  /** At least one action could not be done; the message names it. */
  partial: boolean;
}

/** Ask Claude and carry out what it decided. Null means "no assistant": use the rules. */
export async function runAssistant(userId: string, text: string, page: string, history: Turn[]): Promise<AssistantResult | null> {
  const r = await askAssistant(userId, text, page, history);
  if ("error" in r) return null;
  const { plan, ctx } = r;
  const today = toISODate(new Date());
  const undos: Undo[] = [];
  // What was actually done, in words: the confirmation when the model says nothing useful.
  const did: string[] = [];
  const dayWords = (iso: string) => new Intl.DateTimeFormat("fr-CA", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00Z`));
  const fr = (t: string) => t.replace(/^0/, "").replace(":00", " h").replace(":", " h ");
  // What could not be done, in words. Nothing is reported done unless the write came back.
  const failed: string[] = [];
  // Sector edits are saved together at the end: they only count once that save succeeds.
  const layoutDid: string[] = [];
  const layoutOps: string[] = [];
  let navigate: string | null = null;
  let layout: Layout | null = null;
  let layoutBefore: Layout | null = null;
  const editLayout = async () => {
    if (!layout) {
      layoutBefore = await getLayout(userId);
      layout = JSON.parse(JSON.stringify(layoutBefore)) as Layout;
    }
    return layout;
  };
  const findArea = (l: Layout, ref?: string) => {
    if (!ref) return undefined;
    const k = slug(ref);
    return l.areas.find((a) => a.key === ref || a.key === k || slug(a.label) === k || slug(a.front) === k);
  };
  const section = (key?: string) => {
    const [a, s] = (key ?? "").split(":");
    return a && s ? `${slug(a)}:${slug(s)}` : "travail:taches";
  };
  const subFrom = (spec: { library?: string | null; label?: string; image?: string | null; intro?: string; blocks?: unknown[] }, taken: Set<string>): SubSpec | null => {
    const lib = spec.library ? LIBRARY_SUBS.find((s) => s.id === spec.library) : undefined;
    if (lib) {
      const key = taken.has(lib.key) ? `${lib.area}-${lib.key}` : lib.key;
      return { key, label: spec.label?.trim() || lib.label, image: lib.image, lib: lib.id };
    }
    if (!spec.label?.trim()) return null;
    let key = slug(spec.label);
    while (taken.has(key)) key = `${key}-2`;
    return { key, label: spec.label.trim(), image: spec.image ?? "gears", custom: { intro: spec.intro ?? "", blocks: (spec.blocks ?? []) as never } };
  };

  const actions = (plan.actions as AssistantAction[]).filter((a) => a && typeof a === "object" && a.op in VERBS);
  if (actions.length > 30) failed.push(`${actions.length - 30} action(s) au-delà de la limite de 30`);
  for (const a of actions.slice(0, 30)) {
    // Set once the database (or the layout being edited) has really taken the change.
    let ok = false;
    try {
      switch (a.op) {
        case "create_event": {
          if (!a.title || !a.date || !DATE.test(a.date) || !a.start || !TIME.test(a.start)) break;
          const end = a.end && TIME.test(a.end) && a.end > a.start ? a.end : addMinutes(a.start, 60);
          const e = await prisma.calendarEvent.create({ data: { userId, title: a.title.slice(0, 200), type: `Area:${section(a.section)}`, date: fromISODate(a.date)!, startTime: a.start, endTime: end, allDay: false } });
          undos.push({ t: "delete-event", id: e.id });
          did.push(`« ${e.title} » ajouté ${dayWords(a.date)} à ${fr(a.start)}.`);
          ok = true;
          break;
        }
        case "create_task": {
          if (!a.title) break;
          const day = a.date && DATE.test(a.date) ? a.date : today;
          const t = await prisma.task.create({ data: { userId, title: a.title.slice(0, 200), category: section(a.section), dueDate: atWall(day, a.time && TIME.test(a.time) ? a.time : "23:59"), priority: "Medium", status: "ToDo" } });
          undos.push({ t: "delete-task", id: t.id });
          did.push(`« ${t.title} » ajouté à tes tâches${day !== today ? ` pour ${dayWords(day)}` : ""}.`);
          ok = true;
          break;
        }
        case "move":
        case "delete":
        case "rename":
        case "complete": {
          if (!a.id || !ctx.ids.has(a.id)) break;
          const [kind, id] = [a.id.slice(0, 1), a.id.slice(2)];
          if (kind === "e") {
            const e = await prisma.calendarEvent.findFirst({ where: { id, userId } });
            if (!e) break;
            if (a.op === "delete") {
              await prisma.calendarEvent.delete({ where: { id } });
              did.push(`« ${e.title} » supprimé.`);
              undos.push({ t: "restore-event", data: { title: e.title, type: e.type, date: toISODate(e.date), startTime: e.startTime, endTime: e.endTime, allDay: e.allDay, notes: e.notes, courseId: e.courseId } });
              ok = true;
            } else if (a.op === "rename" || a.op === "move") {
              const data: { title?: string; date?: Date; startTime?: string; endTime?: string } = {};
              if (a.op === "rename" && a.title) data.title = a.title.slice(0, 200);
              if (a.op === "move") {
                if (a.date && DATE.test(a.date)) data.date = fromISODate(a.date)!;
                if (a.start && TIME.test(a.start)) {
                  data.startTime = a.start;
                  data.endTime = addMinutes(a.start, e.startTime && e.endTime ? minutesBetween(e.startTime, e.endTime) : 60);
                }
              }
              if (!Object.keys(data).length) break;
              await prisma.calendarEvent.update({ where: { id }, data });
              ok = true;
              did.push(a.op === "rename" ? `« ${e.title} » renommé en « ${data.title} ».` : `« ${e.title} » déplacé${data.date ? ` au ${dayWords(a.date!)}` : ""}${data.startTime ? ` à ${fr(data.startTime)}` : ""}.`);
              undos.push({ t: "event-was", id, date: toISODate(e.date), startTime: e.startTime, endTime: e.endTime, title: e.title });
            }
          } else if (kind === "t") {
            const t = await prisma.task.findFirst({ where: { id, userId } });
            if (!t) break;
            if (a.op === "delete") {
              await prisma.task.delete({ where: { id } });
              did.push(`« ${t.title} » supprimé.`);
              ok = true;
              undos.push({ t: "restore-task", data: { title: t.title, description: t.description, category: t.category, dueDate: t.dueDate?.toISOString() ?? null, estimatedTime: t.estimatedTime, priority: t.priority, status: t.status, courseId: t.courseId, projectId: t.projectId } });
            } else if (a.op === "complete") {
              await prisma.task.update({ where: { id }, data: { status: "Done" } });
              undos.push({ t: "task-status", id, status: t.status });
              did.push(`« ${t.title} » coché.`);
              ok = true;
            } else if (a.op === "rename" && a.title) {
              await prisma.task.update({ where: { id }, data: { title: a.title.slice(0, 200) } });
              undos.push({ t: "task-was", id, dueDate: t.dueDate?.toISOString() ?? null, title: t.title });
              did.push(`« ${t.title} » renommé en « ${a.title.slice(0, 200)} ».`);
              ok = true;
            } else if (a.op === "move") {
              const day = a.date && DATE.test(a.date) ? a.date : t.dueDate ? toISODate(t.dueDate) : today;
              const time = a.start && TIME.test(a.start) ? a.start : t.dueDate ? hhmm(t.dueDate) : "23:59";
              await prisma.task.update({ where: { id }, data: { dueDate: atWall(day, time) } });
              undos.push({ t: "task-was", id, dueDate: t.dueDate?.toISOString() ?? null, title: t.title });
              did.push(`« ${t.title} » déplacé au ${dayWords(day)}${time !== "23:59" ? ` à ${fr(time)}` : ""}.`);
              ok = true;
            }
          }
          break;
        }
        case "create_course": {
          const code = (a.code ?? a.label ?? "").replace(/\s+/g, "").toUpperCase().slice(0, 20);
          if (!code) break;
          const exists = await prisma.course.findFirst({ where: { userId, code } });
          if (exists) {
            did.push(`Le dossier ${code} existe déjà.`);
            ok = true;
            break;
          }
          const count = await prisma.course.count({ where: { userId } });
          const c = await prisma.course.create({
            data: { userId, code, name: (a.name ?? a.title ?? code).slice(0, 120), professor: a.professor?.slice(0, 80) || null, color: a.color && /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : COLORS[count % COLORS.length] },
          });
          undos.push({ t: "delete-course", id: c.id });
          did.push(`Dossier ${c.code} créé.`);
          ok = true;
          break;
        }
        case "add_area": {
          const l = await editLayout();
          if (!a.label?.trim()) break;
          const lib = LIBRARY.find((x) => slug(x.label) === slug(a.label!) || x.key === slug(a.label!));
          if (findArea(l, a.label)) {
            did.push(`Le secteur ${a.label.trim()} existe déjà.`);
            ok = true;
            break;
          }
          const taken = new Set<string>();
          const subs = (a.sections ?? []).map((s) => subFrom(s, taken)).filter((s): s is SubSpec => !!s && (taken.add(s.key), true));
          const area: AreaSpec = lib && !subs.length
            ? lib
            : {
                key: slug(a.label),
                label: a.label.trim(),
                front: a.label.trim().split(/[\s&]/)[0].slice(0, 12),
                color: a.color && /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : PALETTE[l.areas.length % PALETTE.length],
                blurb: a.blurb ?? "",
                subs,
              };
          l.areas.push(area);
          layoutDid.push(`Secteur ${area.label} créé${area.subs.length ? ` avec ${area.subs.map((x) => x.label).join(", ")}` : ""}.`);
          layoutOps.push(describeAction(a));
          ok = true;
          break;
        }
        case "remove_area": {
          const l = await editLayout();
          const target = findArea(l, a.area ?? a.label);
          if (!target) break;
          l.areas = l.areas.filter((x) => x !== target);
          layoutDid.push(`Secteur ${target.label} masqué (rien n'est supprimé).`);
          layoutOps.push(describeAction(a));
          ok = true;
          break;
        }
        case "rename_area": {
          const l = await editLayout();
          const target = findArea(l, a.area);
          if (!target || !a.label?.trim()) break;
          layoutDid.push(`Secteur ${target.label} renommé en ${a.label.trim()}.`);
          target.label = a.label.trim();
          target.front = a.label.trim().split(/[\s&]/)[0].slice(0, 12);
          layoutOps.push(describeAction(a));
          ok = true;
          break;
        }
        case "add_section": {
          const l = await editLayout();
          let target = findArea(l, a.area);
          if (!target && a.area) {
            target = { key: slug(a.area), label: a.area, front: a.area.split(/[\s&]/)[0].slice(0, 12), color: PALETTE[l.areas.length % PALETTE.length], blurb: "", subs: [] };
            l.areas.push(target);
          }
          if (!target) break;
          const sub = subFrom({ library: a.library, label: a.label, image: a.image, intro: a.intro, blocks: a.blocks }, new Set(target.subs.map((s) => s.key)));
          if (!sub) break;
          target.subs.push(sub);
          layoutDid.push(`${sub.label} ajouté dans ${target.label}.`);
          layoutOps.push(describeAction(a));
          ok = true;
          break;
        }
        case "remove_section": {
          const l = await editLayout();
          const target = findArea(l, a.area);
          const k = slug(a.label ?? "");
          if (!target) break;
          const kept = target.subs.filter((s) => s.key !== a.label && s.key !== k && slug(s.label) !== k);
          if (kept.length === target.subs.length) break;
          target.subs = kept;
          layoutDid.push(`Section ${a.label} retirée de ${target.label}.`);
          layoutOps.push(describeAction(a));
          ok = true;
          break;
        }
        case "rename_section": {
          const l = await editLayout();
          const target = findArea(l, a.area);
          const sub = target?.subs.find((s) => s.key === a.id || slug(s.label) === slug(a.id ?? a.title ?? ""));
          if (!sub || !a.label?.trim()) break;
          layoutDid.push(`Section ${sub.label} renommée en ${a.label.trim()}.`);
          sub.label = a.label.trim();
          layoutOps.push(describeAction(a));
          ok = true;
          break;
        }
        case "log": {
          const u = await logRecord(userId, a, today);
          if (u) {
            undos.push(u);
            did.push("C'est noté.");
            ok = true;
          }
          break;
        }
        case "plan_revision": {
          const ids = (a.assessment_ids ?? []).filter((x) => ctx.assessmentIds.has(x));
          const p = await planStudy(userId, ids.length ? ids : "upcoming");
          if ("error" in p) break;
          let added = 0;
          const courseOf = new Map((await prisma.assessment.findMany({ where: { id: { in: p.targets.map((t) => t.id) }, userId }, select: { id: true, courseId: true, title: true } })).map((x) => [x.id, x]));
          for (const s of p.sessions.slice(0, 60)) {
            const t = courseOf.get(s.assessmentId);
            if (!t) continue;
            const e = await prisma.calendarEvent.create({
              data: { userId, courseId: t.courseId, title: `${STUDY_PREFIX}${t.title} — ${s.topic}`.slice(0, 200), type: "Area:travail:taches", date: fromISODate(s.date)!, startTime: s.start, endTime: s.end, allDay: false, notes: PILOT_NOTE },
            });
            undos.push({ t: "delete-event", id: e.id });
            added++;
          }
          if (!added) break;
          did.push(`${added} séance${added > 1 ? "s" : ""} de révision ajoutée${added > 1 ? "s" : ""} au calendrier.`);
          ok = true;
          break;
        }
        case "plan_day": {
          const day = a.date && DATE.test(a.date) ? a.date : today;
          const p = await planDay(userId, day);
          for (const b of p.blocks) {
            const e = await prisma.calendarEvent.create({ data: { userId, title: b.title.slice(0, 200), type: b.tag.startsWith("Area:") ? b.tag : "Area:travail:taches", date: fromISODate(day)!, startTime: b.start, endTime: b.end, allDay: false, notes: PILOT_NOTE } });
            undos.push({ t: "delete-event", id: e.id });
          }
          // An empty plan is an answer, not a failure: there was nothing to place.
          did.push(p.blocks.length ? `${p.blocks.length} bloc${p.blocks.length > 1 ? "s" : ""} planifié${p.blocks.length > 1 ? "s" : ""} ${dayWords(day)}.` : `Rien à planifier ${dayWords(day)}.`);
          ok = true;
          break;
        }
        case "navigate": {
          if (a.url && /^\/(today|calendar|courses|tasks|settings|syllabus|sync|assessments|labs)(\/[\w-]+){0,2}$/.test(a.url)) {
            navigate = a.url;
            ok = true;
          }
          break;
        }
      }
    } catch {
      // One bad action does not stop the others, but it is reported.
      ok = false;
    }
    if (!ok) failed.push(describeAction(a));
  }

  if (layout && layoutBefore && layoutOps.length) {
    const clean = sanitizeLayout(layout);
    try {
      if (!clean) throw new Error("invalid layout");
      if (JSON.stringify(clean) !== JSON.stringify(layoutBefore)) {
        await saveLayout(userId, clean);
        undos.push({ t: "layout-was", data: layoutBefore });
      }
      did.push(...layoutDid);
    } catch {
      failed.push(...layoutOps);
    }
  }

  return { ...receipt(plan.reply, actions.length, did, failed), undos, navigate };
}

/**
 * What the user is told. The model writes its reply before anything runs, so it is only
 * trusted when every action it asked for came back done; otherwise the message is built
 * from what really happened, failures included. A reply with no action behind it is an
 * answer, and may not claim that something was done.
 */
export function receipt(rawReply: string, asked: number, did: string[], failed: string[]): { message: string; answer: boolean; partial: boolean } {
  const reply = rawReply.trim();
  if (!asked && !failed.length) {
    if (!reply) return { message: "Je n'ai rien trouvé à faire.", answer: true, partial: false };
    return { message: CLAIMS_DONE.test(reply) ? `${reply} (Attention : aucune modification n'a été enregistrée.)` : reply, answer: true, partial: false };
  }
  if (failed.length) {
    const head = did.length ? `${did.join(" ")} ` : "Rien n'a été modifié. ";
    return { message: `${head}Je n'ai pas pu ${failed.join(" ; ")}.`, answer: false, partial: true };
  }
  const generic = !reply || /^(c'est fait|ok|voilà|fait)\.?!?$/i.test(reply);
  return { message: generic ? did.join(" ") || "C'est fait." : reply, answer: false, partial: false };
}

/** "J'ai couru 30 min", "j'ai bu deux verres": write the row the section would have written. */
async function logRecord(userId: string, a: AssistantAction, today: string): Promise<Undo | null> {
  const day = a.date && DATE.test(a.date) ? a.date : today;
  const date = atWall(day, "12:00");
  const v = typeof a.value === "number" && Number.isFinite(a.value) ? a.value : null;
  const create = async (module: string, kind: string, fields: { text?: string | null; value?: number | null; data?: object }) => {
    const row = await prisma.trackerEntry.create({ data: { userId, module, kind, date, text: fields.text ?? null, value: fields.value ?? null, data: (fields.data ?? undefined) as never } });
    return { t: "entry-delete", id: row.id } as Undo;
  };
  switch (a.record) {
    case "workout": {
      if (!v) return null;
      const name = a.title ?? "Séance";
      const strength = /muscu|force|renfo|haltère|gym|salle/i.test(name);
      const met = /course|courir|run|vélo|velo|natation|nager|hiit|cardio/i.test(name) ? 8 : strength ? 5 : 4;
      return create("sante:sport", "workout", { text: name, value: Math.round(v), data: { met, strength } });
    }
    case "water": {
      if (!v) return null;
      const row = await prisma.trackerEntry.findFirst({ where: { userId, module: "sante:nutrition", kind: "water", date } });
      if (row) {
        await prisma.trackerEntry.update({ where: { id: row.id }, data: { value: (row.value ?? 0) + Math.round(v) } });
        return { t: "entry-value", id: row.id, value: row.value ?? 0 };
      }
      return create("sante:nutrition", "water", { value: Math.round(v) });
    }
    case "meal":
      return a.title ? create("sante:nutrition", "meal", { text: a.title, value: v ? Math.round(v) : null, data: { slot: "Autre" } }) : null;
    case "weight":
      return v ? create("sante:corps", "weight", { value: Math.round(v * 10) / 10 }) : null;
    case "sleep":
      return v ? create("sante:sommeil", "sleep", { value: Math.round(v * 100) / 100, data: {} }) : null;
    case "expense":
    case "income":
      return v ? create("quotidien:finances", "tx", { text: a.title ?? (a.record === "income" ? "Revenu" : "Dépense"), value: Math.abs(v), data: { type: a.record === "income" ? "Revenu" : "Dépense", category: a.label ?? (a.record === "income" ? "Autre revenu" : "Alimentation") } }) : null;
    case "grocery": {
      const list: Undo[] = [];
      for (const item of (a.items ?? []).slice(0, 30)) {
        if (typeof item !== "string" || !item.trim()) continue;
        list.push(await create("quotidien:courses", "item", { text: item.trim().slice(0, 80), data: { aisle: guessAisle(item) } }));
      }
      return list.length ? { t: "many", list } : null;
    }
  }
  return null;
}
