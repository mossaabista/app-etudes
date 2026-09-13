"use client";

import { useActionState } from "react";
import { updateLabStatus } from "@/server/actions/lab-actions";

export function LabActions({ labId, currentStatus }: { labId: string; currentStatus: string }) {
  const [, action, pending] = useActionState(updateLabStatus, null);

  if (currentStatus === "Completed" || currentStatus === "Submitted") {
    return (
      <form action={action}>
        <input type="hidden" name="labId" value={labId} />
        <input type="hidden" name="status" value="Upcoming" />
        <button type="submit" disabled={pending} className="text-xs text-slate-400 hover:text-slate-600">
          Réouvrir
        </button>
      </form>
    );
  }

  return (
    <div className="flex gap-1">
      <form action={action}>
        <input type="hidden" name="labId" value={labId} />
        <input type="hidden" name="status" value="Submitted" />
        <button type="submit" disabled={pending} className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
          Soumis
        </button>
      </form>
      <form action={action}>
        <input type="hidden" name="labId" value={labId} />
        <input type="hidden" name="status" value="Completed" />
        <button type="submit" disabled={pending} className="rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100">
          Fait
        </button>
      </form>
    </div>
  );
}
