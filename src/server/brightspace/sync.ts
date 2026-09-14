import { prisma } from "@/lib/db";
import { parseIcs, type IcsEvent } from "@/lib/ics";

// The server fetches whatever URL lands here, so restrict it to real LMS hosts.
// A bare IP or internal hostname can never match a suffix, which keeps this from
// becoming an open proxy into the private network.
const ALLOWED_HOST_SUFFIXES = ["brightspace.com", "desire2learn.com", "uottawa.ca"];

const MAX_FEED_BYTES = 5_000_000;
const FETCH_TIMEOUT_MS = 20_000;

// The feed carries every course shell the student has ever been enrolled in — uOttawa's
// goes back to 2017 — and old shells reuse the same course codes as the current term.
// Anything this far in the past belongs to a previous offering.
const STALE_AFTER_DAYS = 30;

// D2L appends a status marker to every summary. Only some of them are deadlines:
// "disponible" is when an item opens, which is not something to track as due.
// The missing space in "fin de ladisponibilité" is a real D2L line-folding bug.
const DEADLINE_MARKER = /\s*[–\-−]\s*(?:à\s*échéance|échéance|dû|due|fin de la\s*disponibilit\S*)\s*$/i;
const AVAILABILITY_MARKER = /\s*[–\-−]\s*(?:disponible|available)\s*$/i;

export type SyncAction = "create" | "update" | "unchanged" | "skip";

export interface SyncItem {
  uid: string;
  title: string;
  type: string;
  dueDate: string | null;
  courseCode: string | null;
  action: SyncAction;
  reason?: string;
  changes?: string[];
}

export interface SyncPlan {
  items: SyncItem[];
  counts: Record<SyncAction, number>;
  totalEvents: number;
  applied: boolean;
}

export function normalizeFeedUrl(input: string): { url: string } | { error: string } {
  let raw = input.trim();
  if (!raw) return { error: "Entre l'URL du flux de calendrier." };
  if (raw.toLowerCase().startsWith("webcal://")) raw = `https://${raw.slice(9)}`;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { error: "URL invalide." };
  }

  if (parsed.protocol !== "https:") {
    return { error: "L'URL doit commencer par https:// ou webcal://" };
  }

  const host = parsed.hostname.toLowerCase();
  const allowed = ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
  if (!allowed) {
    return { error: `Domaine non autorisé : ${host}. Attendu : un hôte Brightspace (ex. uottawa.brightspace.com).` };
  }

  return { url: parsed.toString() };
}

async function fetchFeed(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "text/calendar, text/plain, */*" },
  });

  if (!res.ok) {
    throw new Error(`Brightspace a répondu ${res.status}. Le lien est peut-être expiré — regénère-le dans le calendrier.`);
  }

  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > MAX_FEED_BYTES) throw new Error("Le flux est trop volumineux.");

  const body = await res.text();
  if (body.length > MAX_FEED_BYTES) throw new Error("Le flux est trop volumineux.");
  if (!body.includes("BEGIN:VCALENDAR")) {
    throw new Error("Ce lien ne renvoie pas un calendrier iCal. Copie le lien depuis Calendrier → S'abonner dans Brightspace.");
  }

  return body;
}

export async function runSync(userId: string, options: { apply: boolean }): Promise<SyncPlan> {
  const source = await prisma.syncSource.findUnique({
    where: { userId_provider: { userId, provider: "brightspace" } },
  });
  if (!source) throw new Error("Aucun flux Brightspace configuré.");

  let plan: SyncPlan;
  try {
    const body = await fetchFeed(source.feedUrl);
    const events = parseIcs(body);
    plan = await buildPlan(userId, events, options.apply);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Échec de la synchronisation.";
    await prisma.syncSource.update({
      where: { id: source.id },
      data: { lastStatus: "error", lastMessage: message, lastSyncedAt: new Date() },
    });
    throw error;
  }

  if (options.apply) {
    await prisma.syncSource.update({
      where: { id: source.id },
      data: {
        lastStatus: "ok",
        lastMessage: `${plan.counts.create} ajoutés, ${plan.counts.update} mis à jour`,
        lastSyncedAt: new Date(),
      },
    });
  }

  return plan;
}

async function buildPlan(userId: string, events: IcsEvent[], apply: boolean): Promise<SyncPlan> {
  const courses = await prisma.course.findMany({
    where: { userId },
    select: { id: true, code: true, name: true },
  });
  const findCourse = createCourseMatcher(courses);
  const staleBefore = new Date(Date.now() - STALE_AFTER_DAYS * 86_400_000);

  const existing = await prisma.assessment.findMany({
    where: { userId, externalUid: { not: null } },
    select: { id: true, externalUid: true, title: true, dueDate: true },
  });
  const byUid = new Map(existing.map((a) => [a.externalUid as string, a]));

  const items: SyncItem[] = [];
  const counts: Record<SyncAction, number> = { create: 0, update: 0, unchanged: 0, skip: 0 };

  for (const event of events) {
    const course = findCourse(event);
    const summary = event.summary || "Sans titre";
    const title = cleanTitle(summary.replace(DEADLINE_MARKER, "").trim() || summary, course);
    const due = event.end ?? event.start;
    const item: SyncItem = {
      uid: event.uid,
      title,
      type: inferType(summary),
      dueDate: due ? due.toISOString() : null,
      courseCode: course?.code ?? null,
      action: "skip",
    };

    if (event.recurring) {
      item.reason = "Événement récurrent (bloc d'horaire, pas une échéance)";
    } else if (!due) {
      item.reason = "Aucune date";
    } else if (AVAILABILITY_MARKER.test(summary)) {
      item.reason = "Ouverture de disponibilité, pas une échéance";
    } else if (due < staleBefore) {
      item.reason = "Trimestre passé";
    } else if (!course) {
      item.reason = "Cours non reconnu — vérifie le code ou le nom du cours dans l'app";
    } else {
      const match = byUid.get(event.uid);
      if (!match) {
        item.action = "create";
        if (apply) {
          await prisma.assessment.create({
            data: {
              userId,
              courseId: course.id,
              title,
              type: item.type,
              dueDate: due,
              status: "Upcoming",
              source: "brightspace",
              externalUid: event.uid,
              externalUrl: event.url ?? null,
            },
          });
        }
      } else {
        const changes: string[] = [];
        if (match.title !== title) changes.push(`titre : « ${match.title} » → « ${title} »`);
        if (match.dueDate?.getTime() !== due.getTime()) {
          changes.push(`date : ${formatDate(match.dueDate)} → ${formatDate(due)}`);
        }

        if (changes.length === 0) {
          item.action = "unchanged";
        } else {
          item.action = "update";
          item.changes = changes;
          if (apply) {
            // Only the fields Brightspace owns. Weight, grade, status and notes stay
            // whatever the user set them to.
            await prisma.assessment.update({
              where: { id: match.id },
              data: { title, dueDate: due, externalUrl: event.url ?? null },
            });
          }
        }
      }
    }

    counts[item.action]++;
    items.push(item);
  }

  items.sort((a, b) => {
    const rank: Record<SyncAction, number> = { create: 0, update: 1, skip: 2, unchanged: 3 };
    if (rank[a.action] !== rank[b.action]) return rank[a.action] - rank[b.action];
    return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
  });

  return { items, counts, totalEvents: events.length, applied: apply };
}

function createCourseMatcher<T extends { code: string; name: string }>(courses: T[]) {
  // Longest key first, so MCG4366 wins over any shorter code that is a substring of it.
  const byCode = courses
    .map((course) => ({ course, key: normalizeKey(course.code) }))
    .sort((a, b) => b.key.length - a.key.length);

  // Some uOttawa shells carry no course code at all — CHM1711 shows up only as
  // "Principes de chimie, automne 2026" — so fall back to the course name. The length
  // floor keeps a short name from matching half the feed.
  const byName = courses
    .map((course) => ({ course, key: normalizeKey(course.name) }))
    .filter((entry) => entry.key.length >= 10)
    .sort((a, b) => b.key.length - a.key.length);

  return (event: IcsEvent): T | null => {
    const haystack = normalizeKey(
      [event.location, event.summary, event.description, event.url].filter(Boolean).join(" ")
    );
    const hit =
      byCode.find((entry) => haystack.includes(entry.key)) ??
      byName.find((entry) => haystack.includes(entry.key));
    return hit?.course ?? null;
  };
}

// Accents are folded away so "Génie de la conception" matches whatever encoding the feed uses.
function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function cleanTitle(summary: string, course: { code: string; name: string } | null): string {
  if (!course) return summary;
  const segments = summary.split(" - ");
  if (segments.length < 2) return summary;

  const codeKey = normalizeKey(course.code);
  const nameKey = normalizeKey(course.name);
  const kept = segments.filter((segment, index) => {
    if (index === 0) return true;
    const key = normalizeKey(segment);
    return !key.includes(codeKey) && !(nameKey.length > 4 && key.includes(nameKey));
  });

  return kept.join(" - ").trim() || summary;
}

function inferType(summary: string): string {
  const text = summary.toLowerCase();
  if (/\b(final|midterm|mi-session|exam|examen|test)\b/.test(text)) return "Exam";
  if (/\b(quiz|questionnaire)\b/.test(text)) return "Quiz";
  if (/\b(lab|laboratoire|pré-?lab|pre-?lab)\b/.test(text)) return "Lab";
  if (/\b(project|projet)\b/.test(text)) return "Project";
  if (/\b(presentation|présentation|exposé)\b/.test(text)) return "Presentation";
  return "Assignment";
}

function formatDate(date: Date | null): string {
  if (!date) return "aucune";
  return date.toISOString().slice(0, 16).replace("T", " ");
}
