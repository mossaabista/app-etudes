// Shared artwork for the generated app icons, so the home-screen icon and the
// manifest icon can never drift apart. Rendered by Satori via next/og, which
// supports only a subset of CSS — every container needs an explicit display.
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
        background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
        color: "#f8fafc",
        fontSize: size * 0.56,
        fontWeight: 700,
        lineHeight: 1,
        // Centring the glyph box puts the accent in the middle and leaves the E
        // reading high, so nudge the whole thing down to balance it by eye.
        paddingTop: size * 0.05,
      }}
    >
      É
    </div>
  );
}
