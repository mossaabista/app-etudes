// Shared artwork for the generated app icons, so the home-screen icon and the
// manifest icon can never drift apart. Rendered by Satori via next/og, which
// supports only a subset of CSS — flexbox only, every container needs an explicit
// display, and there are no filters or pseudo-elements.
// No rounded corners here: iOS and Android apply their own mask.
export function AppIconArt({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#080b10",
        // Off-centre highlight so the ground reads as lit rather than flat black.
        backgroundImage:
          "radial-gradient(circle at 30% 22%, #2a3346 0%, #141a25 45%, #080b10 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          color: "#e6d6ae",
          fontSize: size * 0.54,
          fontWeight: 700,
          lineHeight: 1,
          // The accent adds mass above the E and the rule adds it below, so only a
          // small nudge is needed to sit the pair on the optical centre.
          marginTop: size * 0.02,
        }}
      >
        É
      </div>
      <div
        style={{
          width: size * 0.3,
          height: Math.max(1, size * 0.026),
          // Close enough to read as the letter's base rule rather than a stray mark.
          marginTop: size * 0.035,
          borderRadius: size,
          backgroundImage:
            "linear-gradient(90deg, rgba(201,177,132,0) 0%, #cfb98d 25%, #cfb98d 75%, rgba(201,177,132,0) 100%)",
        }}
      />
    </div>
  );
}
