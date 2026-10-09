"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { applyWorkspace, planWorkspace } from "@/server/workspaces";
import { claim, findOp, settle } from "@/server/agent-log";
import { templateOf, type TemplateId, type WorkspacePlan } from "@/lib/workspaces";
import type { Undo } from "@/server/actions/capture.actions";

const OP_ID = /^[\w-]{8,64}$/;

/** What a template would build for this user, without saving anything. */
export async function previewWorkspaceAction(template: string, name: string): Promise<{ plan: WorkspacePlan } | { error: string }> {
  const user = await requireUser();
  const t = templateOf(template);
  if (!t) return { error: "Modèle d'espace inconnu." };
  const plan = await planWorkspace(user.id, t.id as TemplateId, String(name ?? "").slice(0, 80));
  return "error" in plan ? plan : { plan };
}

/**
 * Build it. The plan is computed again here from fresh data, never taken from the browser.
 * One id per click: the same submission runs once.
 */
export async function applyWorkspaceAction(
  template: string,
  name: string,
  opId?: string
): Promise<{ ok: true; message: string; undo: Undo | null; href: string; partial: boolean } | { error: string }> {
  const user = await requireUser();
  const t = templateOf(template);
  if (!t) return { error: "Modèle d'espace inconnu." };
  const id = opId && OP_ID.test(opId) ? opId : null;
  if (id && (await claim(user.id, id, "workspace")) === "duplicate") {
    const first = await findOp(user.id, id);
    return { error: first?.status === "running" ? "Cet espace est déjà en cours de création." : `Déjà fait : ${first?.summary ?? ""}` };
  }
  const r = await applyWorkspace(user.id, t.id as TemplateId, String(name ?? "").slice(0, 80));
  const undo: Undo | null = "error" in r || !r.undos.length ? null : r.undos.length === 1 ? r.undos[0] : { t: "many", list: r.undos };
  if (id) await settle(user.id, id, { changed: !!undo, partial: !("error" in r) && r.partial, summary: "error" in r ? "" : r.message, undo });
  if ("error" in r) return r;
  revalidatePath("/", "layout");
  return { ok: true, message: r.message, undo, href: r.href, partial: r.partial };
}
