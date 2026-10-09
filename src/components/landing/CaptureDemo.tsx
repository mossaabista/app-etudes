"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, Clock, Sparkles, Timer } from "lucide-react";
import { parseCapture, type Parsed } from "@/lib/capture";
import { areaByKey } from "@/lib/task-areas";

const PHRASES = [
  "muscu demain 18h pendant 1h",
  "appeler maman dimanche midi",
  "réviser le quiz de thermo jeudi 14h pendant 2h",
  "dentiste le 21 oct à 9h30",
  "courses ce soir 19h",
];

const TYPE_MS = 55;
const HOLD_TICKS = 64; // ≈ 3.5 s with the result on screen

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
}

function dayLabel(day: string, today: string) {
  const ms = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime();
  const diff = Math.round((ms(day) - ms(today)) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  const label = new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * The quick-capture input playing itself: a sentence is typed, the real parser reads it,
 * and the chips show what OROM understood — section, day, time and duration.
 */
export function CaptureDemo() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<(Parsed & { when: string }) | null>(null);
  const state = useRef({ phrase: 0, char: 0, hold: 0 });
  const today = useRef("");
  const read = (phrase: string) => {
    const p = parseCapture(phrase, today.current);
    return { ...p, when: dayLabel(p.day, today.current) };
  };

  useEffect(() => {
    today.current = todayISO();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => {
        setText(PHRASES[0]);
        setResult(read(PHRASES[0]));
      }, 0);
      return () => clearTimeout(t);
    }
    const id = setInterval(() => {
      const s = state.current;
      const phrase = PHRASES[s.phrase];
      if (s.char < phrase.length) {
        s.char++;
        setText(phrase.slice(0, s.char));
        if (s.char === phrase.length) setResult(read(phrase));
        return;
      }
      if (++s.hold < HOLD_TICKS) return;
      s.phrase = (s.phrase + 1) % PHRASES.length;
      s.char = 0;
      s.hold = 0;
      setText("");
      setResult(null);
    }, TYPE_MS);
    return () => clearInterval(id);
  }, []);

  const area = result ? areaByKey(result.area) : null;
  const sub = area?.subs.find((x) => x.key === result?.sub);

  return (
    <div className="ld-capture">
      <div className="ld-input">
        <Sparkles size={16} className="shrink-0 text-[#f0cd79]" />
        <span className="min-w-0 flex-1 truncate">
          {text}
          <span className="ld-caret" aria-hidden />
        </span>
        <kbd>⌘K</kbd>
      </div>

      <div className="ld-chips" aria-live="polite">
        {result && area && (
          <>
            <span className="ld-chip" style={{ "--i": 0 } as React.CSSProperties}>
              <i style={{ background: area.color }} />
              {area.front}
              {sub ? ` · ${sub.label}` : ""}
            </span>
            <span className="ld-chip" style={{ "--i": 1 } as React.CSSProperties}>
              <CalendarPlus size={13} /> {result.when}
            </span>
            {result.time && (
              <span className="ld-chip" style={{ "--i": 2 } as React.CSSProperties}>
                <Clock size={13} /> {result.time.replace(/^0/, "").replace(":00", " h").replace(":", " h ")}
              </span>
            )}
            {result.found.minutes && (
              <span className="ld-chip" style={{ "--i": 3 } as React.CSSProperties}>
                <Timer size={13} /> {result.minutes >= 60 ? `${Math.floor(result.minutes / 60)} h${result.minutes % 60 ? ` ${result.minutes % 60}` : ""}` : `${result.minutes} min`}
              </span>
            )}
          </>
        )}
      </div>

      <div className={`ld-landed ${result ? "is-on" : ""}`}>
        {result && area && (
          <>
            <span className="ld-landed-bar" style={{ background: area.color }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[var(--ink)]">{result.title}</span>
              <span className="block text-xs text-[var(--ink-dim)]">
                {result.time ? "Placé dans ton agenda" : "Ajouté à tes tâches"} · {area.label}
              </span>
            </span>
            <span className="ld-landed-ok">✓</span>
          </>
        )}
      </div>
    </div>
  );
}
