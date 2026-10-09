"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { timeZones } from "@/lib/time-zones";
import { fmt } from "@/i18n/config";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { saveAccountAction } from "@/server/actions/settings.actions";

const field = "glass-pill focus-ring mt-1.5 block w-full px-4 py-2.5 text-sm text-[var(--ink)]";
const label = "block text-xs font-medium text-[var(--ink-dim)]";

/** Square, 160 px, JPEG: small enough to live in the settings row. */
async function toAvatar(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = ko;
      i.src = url;
    });
    const size = 160;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const side = Math.min(img.width, img.height);
    canvas.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AccountForm({ initial }: { initial: { name: string; email: string; avatar: string | null; timeZone: string; city: string | null; country: string | null } }) {
  const { t } = useI18n();
  const s = t.settings;
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [avatar, setAvatar] = useState(initial.avatar);
  const [tz, setTz] = useState(initial.timeZone);
  const [city, setCity] = useState(initial.city ?? "");
  const [country, setCountry] = useState(initial.country ?? "");
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const zones = timeZones();
  const deviceZone = typeof window === "undefined" ? "" : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const save = () =>
    start(async () => {
      await saveAccountAction({ name, avatar, timeZone: tz, city: city.trim() || null, country: country.trim() || null });
      setNote({ text: t.common.saved });
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#ffe9a0] to-[#c9952f] text-[#2a1a05]">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local data URL, not a remote image
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xl font-bold">{(name || "?").charAt(0).toUpperCase()}</span>
          )}
        </span>
        <div className="flex flex-wrap gap-2">
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label={s.changePhoto}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setAvatar(await toAvatar(f));
              } catch {
                setNote({ text: s.photoTooBig, error: true });
              }
            }}
          />
          <button type="button" onClick={() => file.current?.click()} className="mod-chip focus-ring">
            <Camera size={13} /> {s.changePhoto}
          </button>
          {avatar && (
            <button type="button" onClick={() => setAvatar(null)} className="mod-chip focus-ring text-[var(--ink-faint)]">
              {s.removePhoto}
            </button>
          )}
        </div>
      </div>
      <label className={label}>
        {s.name}
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" className={field} />
        <span className="mt-1 block text-[0.7rem] text-[var(--ink-faint)]">{initial.email}</span>
      </label>
      <div>
        <span className={label}>{s.language}</span>
        <LanguageToggle className="mt-1.5" />
      </div>
      <label className={label}>
        {s.timeZone}
        {zones.length ? (
          <select value={tz} onChange={(e) => setTz(e.target.value)} className={`${field} cursor-pointer`}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        ) : (
          <input value={tz} onChange={(e) => setTz(e.target.value)} className={field} />
        )}
        {deviceZone && deviceZone !== tz && (
          <button type="button" onClick={() => setTz(deviceZone)} className="mt-1.5 text-xs font-semibold text-[#f0cd79] hover:underline">
            {fmt(s.detectZone, { tz: deviceZone.replace(/_/g, " ") })}
          </button>
        )}
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          {s.city}
          <input value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" className={field} />
        </label>
        <label className={label}>
          {s.country}
          <input value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="country-name" className={field} />
        </label>
      </div>
      <p className="text-xs text-[var(--ink-faint)]">{s.cityWhy}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="mod-chip mod-chip-gold focus-ring">
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {t.common.save}
        </button>
        {note && (
          <span role="status" className={`text-xs ${note.error ? "text-[#ffb3a3]" : "text-[#86d6a4]"}`}>
            {note.text}
          </span>
        )}
      </div>
    </div>
  );
}
