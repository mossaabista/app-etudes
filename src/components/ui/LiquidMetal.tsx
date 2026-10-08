/**
 * The layers of a liquid-metal control. Render inside an element that carries the `lm`
 * class, which supplies the circle, the clip and the dark base:
 *
 *   <Link className="lm h-11 w-11"><LiquidLayers><ChevronLeft /></LiquidLayers></Link>
 *
 * Split into layers rather than pseudo-elements because the effect needs four of them —
 * sweep, gloss, bead and rim — and an element only has two.
 */
export function LiquidLayers({
  children,
  bead = false,
}: {
  children?: React.ReactNode;
  /** The floating squircle from the reference. Leave off when an icon occupies the centre. */
  bead?: boolean;
}) {
  return (
    <>
      <span className="lm-field" aria-hidden />
      <span className="lm-gloss" aria-hidden />
      {bead && <span className="lm-bead" aria-hidden />}
      <span className="lm-rim" aria-hidden />
      <span className="lm-content">{children}</span>
    </>
  );
}
