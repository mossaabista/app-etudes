// Shared artwork for the generated app icons, so the home-screen icon and the
// manifest icon can never drift apart. Rendered by Satori via next/og, which
// supports only a subset of CSS — flexbox only, every container needs an explicit
// display, and there are no filters or pseudo-elements. The mark is inline SVG so
// it stays a drawn logo rather than a typed character.
// Satori only resolves url(#id) when <defs> is written inline in the same <svg>;
// returning it from a component silently yields an invisible stroke.
// No rounded corners here: iOS and Android apply their own mask.
export function AppIconArt({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#080b10",
        // Off-centre highlight so the ground reads as lit rather than flat black.
        backgroundImage:
          "radial-gradient(circle at 30% 22%, #2a3346 0%, #141a25 45%, #080b10 100%)",
      }}
    >
      <svg width={size * 0.64} height={size * 0.64} viewBox="0 0 100 100" fill="none">
        <defs>
          <linearGradient id="gold" x1="12" y1="12" x2="88" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f6e9c8" />
            <stop offset="55%" stopColor="#d8c08d" />
            <stop offset="100%" stopColor="#a8894f" />
          </linearGradient>
        </defs>
        {/* Thin ring turns the monogram into a seal — the part that reads as a mark
            rather than a letter sitting on a background. */}
        <circle cx="50" cy="50" r="43" stroke="url(#gold)" strokeWidth="2.6" opacity="0.7" />
        {/* The "O" of OROM: a heavy ring around a small core. */}
        <circle cx="50" cy="50" r="24" stroke="url(#gold)" strokeWidth="9" />
        <circle cx="50" cy="50" r="7" fill="url(#gold)" />
      </svg>
    </div>
  );
}
