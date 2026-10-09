import type { Visual } from "@/lib/task-areas";

/** A section's object, as the cut-out render: used by the folder burst. */
export function VisualObject({ visual, className = "" }: { visual: Visual; className?: string }) {
  return (
    // A plain img: a pre-cut local render, which next/image would add nothing to.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={visual.src} alt="" draggable={false} className={`object-img ${className}`} />
  );
}
