"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { allow } from "@/server/rate-limit";
import { undoCommandAction } from "@/server/actions/capture.actions";
import { deleteWorkflow, listRuns, markRunUndone, runWorkflow, saveWorkflow, setWorkflowEnabled, type RunOutcome } from "@/server/workflows";

const OP_ID = /^[\w-]{8,64}$/;
const refresh = () => revalidatePath("/", "layout");

export async function saveWorkflowAction(raw: unknown, id?: string) {
  const user = await requireUser();
  const r = await saveWorkflow(user.id, raw, id ? String(id) : undefined);
  revalidatePath("/workflows");
  return r;
}

export async function toggleWorkflowAction(id: string, enabled: boolean) {
  const user = await requireUser();
  const ok = await setWorkflowEnabled(user.id, String(id), !!enabled);
  revalidatePath("/workflows");
  return ok ? { ok: true as const } : { error: "Automatisation introuvable." };
}

export async function deleteWorkflowAction(id: string) {
  const user = await requireUser();
  const ok = await deleteWorkflow(user.id, String(id));
  revalidatePath("/workflows");
  return ok ? { ok: true as const } : { error: "Automatisation introuvable." };
}

/** Run now. The request id makes a double click run it once. */
export async function runWorkflowAction(id: string, opId: string, confirmed = false): Promise<RunOutcome> {
  const user = await requireUser();
  if (!OP_ID.test(String(opId))) return { error: "Requête invalide." };
  if (!allow(user.id, "command")) return { error: "Trop de demandes d'un coup : réessaie dans une minute." };
  const r = await runWorkflow(user.id, String(id), { trigger: "manual", key: `op:${opId}`, confirmed: !!confirmed });
  refresh();
  return r;
}

/** Take back what a run changed (what has not been changed since). */
export async function undoRunAction(runId: string) {
  const user = await requireUser();
  const run = (await listRuns(user.id, 60)).find((r) => r.id === String(runId));
  if (!run?.undo || run.undone) return { error: "Rien à annuler pour cette exécution." };
  const { missed } = await undoCommandAction(run.undo);
  await markRunUndone(user.id, run.id);
  refresh();
  return { ok: true as const, missed };
}
