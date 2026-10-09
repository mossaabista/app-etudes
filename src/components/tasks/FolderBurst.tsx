import { VisualObject } from "@/components/tasks/VisualObject";

// Where each object lands when the folder springs open, fanned above the pocket like the
// cards out of the wallet. Offsets are in cqw, a share of the folder's width, so the fan
// keeps its shape at any deck size.
const FAN = [
  { x: "-36cqw", y: "-24cqw", r: "-18deg", d: "0.16s" },
  { x: "-12cqw", y: "-40cqw", r: "-6deg", d: "0.22s" },
  { x: "13cqw", y: "-38cqw", r: "8deg", d: "0.19s" },
  { x: "37cqw", y: "-22cqw", r: "18deg", d: "0.25s" },
];

// The coins: small chrome beads thrown higher than the objects, arcing out and back.
const BEADS = [
  { x: "-26cqw", y: "-48cqw", s: "6%", d: "0.2s" },
  { x: "3cqw", y: "-56cqw", s: "4.5%", d: "0.27s" },
  { x: "28cqw", y: "-45cqw", s: "5.5%", d: "0.23s" },
];

/**
 * What springs out of a task folder as it opens: two more sheets, the area's own section
 * objects, and a few chrome beads. Hidden until the folder link carries data-opening.
 */
export function FolderBurst({ images }: { images: string[] }) {
  const objects = images.slice(0, FAN.length);

  return (
    <div className="burst" aria-hidden>
      <span className="burst-sheet burst-sheet-a" />
      <span className="burst-sheet burst-sheet-b" />
      {objects.map((src, i) => {
        const f = FAN[i];
        return (
          <span key={`${src}${i}`} className="burst-item" style={{ "--x": f.x, "--y": f.y, "--r": f.r, "--d": f.d } as React.CSSProperties}>
            <VisualObject visual={{ src }} className="burst-visual" />
          </span>
        );
      })}
      {BEADS.map((b, i) => (
        <span key={i} className="burst-bead" style={{ "--x": b.x, "--y": b.y, "--bs": b.s, "--d": b.d } as React.CSSProperties} />
      ))}
    </div>
  );
}
