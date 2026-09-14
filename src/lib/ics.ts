import { APP_TIMEZONE, wallTimeToUtc, type WallTime } from "./dates";

export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  start: Date | null;
  end: Date | null;
  allDay: boolean;
  recurring: boolean;
}

export function parseIcs(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: Record<string, { value: string; params: Record<string, string> }> | null = null;

  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) {
        const event = toEvent(current);
        if (event) events.push(event);
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const prop = splitProperty(line);
    if (!prop) continue;
    const [name, ...paramParts] = splitParams(prop.head);
    const params: Record<string, string> = {};
    for (const part of paramParts) {
      const eq = part.indexOf("=");
      if (eq > 0) {
        params[part.slice(0, eq).toUpperCase()] = stripQuotes(part.slice(eq + 1));
      }
    }
    current[name.toUpperCase()] = { value: prop.value, params };
  }

  return events;
}

function toEvent(props: Record<string, { value: string; params: Record<string, string> }>): IcsEvent | null {
  const uid = props.UID?.value?.trim();
  if (!uid) return null;

  const dtStart = props.DTSTART ? parseIcsDate(props.DTSTART.value, props.DTSTART.params) : null;
  const dtEnd = props.DTEND ? parseIcsDate(props.DTEND.value, props.DTEND.params) : null;

  return {
    uid,
    summary: unescapeText(props.SUMMARY?.value ?? "").trim(),
    description: props.DESCRIPTION ? unescapeText(props.DESCRIPTION.value).trim() : undefined,
    location: props.LOCATION ? unescapeText(props.LOCATION.value).trim() : undefined,
    url: props.URL?.value?.trim() || undefined,
    start: dtStart?.date ?? null,
    end: dtEnd?.date ?? null,
    allDay: dtStart?.allDay ?? false,
    recurring: Boolean(props.RRULE),
  };
}

function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of raw) {
    if (lines.length > 0 && (line.startsWith(" ") || line.startsWith("\t"))) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line.trimEnd());
    }
  }
  return lines;
}

function splitProperty(line: string): { head: string; value: string } | null {
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ":" && !inQuotes) return { head: line.slice(0, i), value: line.slice(i + 1) };
  }
  return null;
}

function splitParams(head: string): string[] {
  const parts: string[] = [];
  let buffer = "";
  let inQuotes = false;
  for (const ch of head) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      buffer += ch;
    } else if (ch === ";" && !inQuotes) {
      parts.push(buffer);
      buffer = "";
    } else {
      buffer += ch;
    }
  }
  parts.push(buffer);
  return parts;
}

function stripQuotes(value: string): string {
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}

function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, ch: string) => (ch === "n" || ch === "N" ? "\n" : ch));
}

function parseIcsDate(value: string, params: Record<string, string>): { date: Date | null; allDay: boolean } {
  const raw = value.trim();

  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(raw);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return { date: new Date(Date.UTC(+y, +m - 1, +d)), allDay: true };
  }

  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(raw);
  if (!dateTime) return { date: null, allDay: false };

  const [, y, mo, d, h, mi, s, zulu] = dateTime;
  const wall: WallTime = [+y, +mo, +d, +h, +mi, +s];

  if (zulu) {
    return { date: new Date(Date.UTC(wall[0], wall[1] - 1, wall[2], wall[3], wall[4], wall[5])), allDay: false };
  }
  return { date: wallTimeToUtc(wall, params.TZID || APP_TIMEZONE), allDay: false };
}
