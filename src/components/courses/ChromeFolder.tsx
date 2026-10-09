const FRONT = "M28 54 Q28 34 50 34 H196 Q210 34 219 22 L226 13 Q233 4 247 4 H350 Q374 4 374 28 V244 Q374 266 352 266 H50 Q28 266 28 244 Z";

/**
 * A black chrome folder, drawn rather than imported so the course code can be struck into
 * its front face. Three planes: the back panel with its tab, a sheet in the course colour
 * tucked inside, and the front flap, which leans out of the screen and carries the
 * lettering. Each plane is its own layer so they can move apart in 3D on hover.
 */
export function ChromeFolder({
  id,
  code,
  name,
  color,
  inside,
}: {
  id: string;
  code: string;
  name: string;
  color: string;
  /** Whatever sits in the pocket, between the sheet and the flap (it springs out on opening). */
  inside?: React.ReactNode;
}) {
  // Gradient ids are document-wide, so each folder namespaces its own.
  const g = (k: string) => `${k}-${id}`;

  return (
    <div className="folder" style={{ "--c": color } as React.CSSProperties}>
      <svg className="folder-back" viewBox="0 0 400 340" aria-hidden>
        <defs>
          <linearGradient id={g("bf")} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor="#2b2e33" />
            <stop offset="0.28" stopColor="#0b0c0e" />
            <stop offset="1" stopColor="#030304" />
          </linearGradient>
          <linearGradient id={g("rim")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.18" stopColor="#8e949b" />
            <stop offset="0.4" stopColor="#1a1c1f" />
            <stop offset="0.62" stopColor="#d9dde1" />
            <stop offset="0.8" stopColor="#2a2d31" />
            <stop offset="1" stopColor="#b9bec4" />
          </linearGradient>
        </defs>
        <path
          d="M32 34 Q32 12 54 12 H146 Q160 12 169 24 L181 40 Q188 50 202 50 H346 Q368 50 368 72 V306 Q368 328 346 328 H54 Q32 328 32 306 Z"
          fill={`url(#${g("bf")})`}
          stroke={`url(#${g("rim")})`}
          strokeWidth="5"
        />
        {/* The groove where the back panel folds over: a soft lit ridge under the tab. */}
        <path d="M46 92 Q200 70 356 92" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="5" strokeLinecap="round" filter="blur(2px)" />
      </svg>

      <div className="folder-sheet" aria-hidden />
      {inside}

      <div className="folder-front">
        <svg viewBox="0 0 400 270" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={g("ff")} x1="0" y1="0" x2="0.5" y2="1">
              <stop offset="0" stopColor="#3a3e44" />
              <stop offset="0.22" stopColor="#141518" />
              <stop offset="0.7" stopColor="#060708" />
              <stop offset="1" stopColor="#1a1c20" />
            </linearGradient>
            <radialGradient id={g("sheen")} cx="0.82" cy="0.62" r="0.7">
              <stop offset="0" stopColor="rgba(255,255,255,0.22)" />
              <stop offset="1" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          <path
            d={FRONT}
            fill={`url(#${g("ff")})`}
            stroke={`url(#${g("rim")})`}
            strokeWidth="5"
          />
          <path d={FRONT} fill={`url(#${g("sheen")})`} />
          {/* Hairline of light just inside the rim, the second edge of a rolled lip. */}
          <path
            d="M38 56 Q38 44 52 44 H198 Q214 44 224 31 L231 22 Q237 14 248 14 H348 Q364 14 364 30"
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1.5"
          />
        </svg>

        <div className="folder-label">
          <span className="folder-code" data-text={code}>{code}</span>
          <span className="folder-name">{name}</span>
        </div>
      </div>
    </div>
  );
}
