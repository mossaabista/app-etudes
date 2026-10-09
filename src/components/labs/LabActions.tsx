"use client";

import { useActionState } from "react";
import { updateLabStatus } from "@/server/actions/lab-actions";
import { useI18n } from "@/i18n/client";

export function LabActions({ labId, currentStatus }: { labId: string; currentStatus: string }) {
  const [state, action, pending] = useActionState(updateLabStatus, null);
  const { t } = useI18n();
  const a = t.academics;
  const error = state && "error" in state ? <p role="alert" className="mt-1 text-xs text-[#ffd9cf]">{state.error}</p> : null;

  if (currentStatus === "Completed" || currentStatus === "Submitted") {
    return (
      <form action={action}>
        <input type="hidden" name="labId" value={labId} />
        <input type="hidden" name="status" value="Upcoming" />
        <button type="submit" disabled={pending} className="focus-ring text-xs text-[var(--ink-faint)] hover:text-[var(--ink)]">
          {a.labReopen}
        </button>
        {error}
      </form>
    );
  }

  return (
    <div>
      <div className="flex gap-1">
        <form action={action}>
          <input type="hidden" name="labId" value={labId} />
          <input type="hidden" name="status" value="Submitted" />
          <button type="submit" disabled={pending} className="mod-chip focus-ring">
            {a.labSubmitted}
          </button>
        </form>
        <form action={action}>
          <input type="hidden" name="labId" value={labId} />
          <input type="hidden" name="status" value="Completed" />
          <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
            {a.labDone}
          </button>
        </form>
      </div>
      {error}
    </div>
  );
}
