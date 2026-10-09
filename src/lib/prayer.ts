/**
 * Prayer times from the sun's position, after the formulas used by PrayTimes.org
 * (Hamid Zarrabi-Zadeh): solar declination and equation of time, then the hour angle at
 * which the sun reaches each prayer's depression angle. Times are worked out in UTC and
 * formatted in whatever time zone is asked for, so daylight saving needs no special case.
 */

export interface Method {
  key: string;
  label: string;
  fajr: number;
  /** Isha as a depression angle, or as minutes after Maghrib. */
  isha: number | { minutes: number };
}

export const METHODS: Method[] = [
  { key: "ISNA", label: "ISNA (Amérique du Nord)", fajr: 15, isha: 15 },
  { key: "MWL", label: "Ligue islamique mondiale", fajr: 18, isha: 17 },
  { key: "UOIF", label: "UOIF (France)", fajr: 12, isha: 12 },
  { key: "Egypt", label: "Autorité égyptienne", fajr: 19.5, isha: 17.5 },
  { key: "Makkah", label: "Umm al-Qura (La Mecque)", fajr: 18.5, isha: { minutes: 90 } },
  { key: "Karachi", label: "Université de Karachi", fajr: 18, isha: 18 },
];

export const PRAYERS = [
  { key: "fajr", label: "Fajr" },
  { key: "sunrise", label: "Lever du soleil" },
  { key: "dhuhr", label: "Dhuhr" },
  { key: "asr", label: "Asr" },
  { key: "maghrib", label: "Maghrib" },
  { key: "isha", label: "Isha" },
] as const;

export type PrayerKey = (typeof PRAYERS)[number]["key"];

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const sin = (d: number) => Math.sin(rad(d));
const cos = (d: number) => Math.cos(rad(d));
const tan = (d: number) => Math.tan(rad(d));
const arcsin = (x: number) => deg(Math.asin(x));
const arccos = (x: number) => deg(Math.acos(x));
const arctan2 = (y: number, x: number) => deg(Math.atan2(y, x));
const arccot = (x: number) => deg(Math.atan(1 / x));
const fix = (a: number, b: number) => {
  const r = a - b * Math.floor(a / b);
  return r < 0 ? r + b : r;
};

function julian(y: number, m: number, d: number) {
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function sun(jd: number) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * sin(g) + 0.02 * sin(2 * g), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = arctan2(cos(e) * sin(L), cos(L)) / 15;
  return { decl: arcsin(sin(e) * sin(L)), eqt: q / 15 - fix(RA, 24) };
}

/**
 * Times (as UTC hours on the given date) for a place. `asr` is the shadow factor: 1 for
 * the majority schools, 2 for Hanafi.
 */
export function prayerTimes(day: string, lat: number, lng: number, method: Method, asr: 1 | 2 = 1): Record<PrayerKey, number> {
  const [y, m, d] = day.split("-").map(Number);
  const jd = julian(y, m, d) - lng / (15 * 24);

  const midDay = (t: number) => fix(12 - sun(jd + t).eqt, 24);
  const angleTime = (angle: number, t: number, before: boolean) => {
    const decl = sun(jd + t).decl;
    const T = arccos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
    return midDay(t) + (before ? -T : T);
  };
  const asrTime = (t: number) => {
    const decl = sun(jd + t).decl;
    return angleTime(-arccot(asr + tan(Math.abs(lat - decl))), t, false);
  };

  // Two passes: the second starts each prayer from the first pass's estimate.
  let t: Record<PrayerKey, number> = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
  for (let pass = 0; pass < 2; pass++) {
    const h = (k: PrayerKey) => t[k] / 24;
    t = {
      fajr: angleTime(method.fajr, h("fajr"), true),
      sunrise: angleTime(0.833, h("sunrise"), true),
      dhuhr: midDay(h("dhuhr")),
      asr: asrTime(h("asr")),
      maghrib: angleTime(0.833, h("maghrib"), false),
      isha: typeof method.isha === "number" ? angleTime(method.isha, h("isha"), false) : 0,
    };
    if (typeof method.isha !== "number") t.isha = t.maghrib + method.isha.minutes / 60;
  }

  // High latitudes: when the sun never gets low enough, fall back to a seventh of the night.
  const night = 24 - (t.maghrib - t.sunrise);
  if (!Number.isFinite(t.fajr)) t.fajr = t.sunrise - night / 7;
  if (!Number.isFinite(t.isha)) t.isha = t.maghrib + night / 7;

  // Local solar hours to UTC hours.
  const shift = -lng / 15;
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v + shift])) as Record<PrayerKey, number>;
}

/** A UTC-hour time on a date, as a Date. */
export function atUtcHour(day: string, h: number) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + Math.round(h * 3600) * 1000);
}

/** Bearing from north, clockwise, towards the Kaaba. */
export function qibla(lat: number, lng: number) {
  const kLat = 21.4225;
  const kLng = 39.8262;
  const b = arctan2(sin(kLng - lng), cos(lat) * tan(kLat) - sin(lat) * cos(kLng - lng));
  return fix(b, 360);
}

export function compass(deg: number) {
  const names = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"];
  return names[Math.round(deg / 45) % 8];
}
