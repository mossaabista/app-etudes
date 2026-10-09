"use client";

import { useActionState } from "react";
import { X } from "lucide-react";
import { addMemberAction, deleteMemberAction } from "@/server/actions/project.actions";
import { Field, Input } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";

type Member = { id: string; name: string; email: string | null; role: string | null };

export function MemberSection({ members, projectId }: { members: Member[]; projectId: string }) {
  const [state, formAction, pending] = useActionState(addMemberAction, null);
  const { t } = useI18n();
  const w = t.workspace.projects;

  return (
    <div>
      {members.length > 0 && (
        <ul className="mb-4 space-y-2">
          {members.map((m) => (
            <li key={m.id} className="tile flex items-center gap-3 px-3 py-2">
              <Avatar name={m.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--ink)]">{m.name}</p>
                <p className="text-xs text-[var(--ink-dim)]">{m.role ?? w.member}{m.email ? ` · ${m.email}` : ""}</p>
              </div>
              <button
                type="button"
                onClick={() => deleteMemberAction(m.id, projectId)}
                aria-label={fmt(w.deleteNamed, { title: m.name })}
                className="focus-ring rounded-full p-1 text-[var(--ink-faint)] hover:text-[#ffb3a3]"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="flex items-end gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <div className="flex-1">
          <Field label={w.name} htmlFor="memName">
            <Input id="memName" name="name" placeholder={w.namePlaceholder} required />
          </Field>
        </div>
        <div className="flex-1">
          <Field label={w.role} htmlFor="memRole">
            <Input id="memRole" name="role" placeholder={w.rolePlaceholder} />
          </Field>
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>{w.add}</Button>
      </form>
      {state?.error && <p role="alert" className="mt-2 rounded-xl bg-[rgba(220,60,40,0.18)] px-3 py-2 text-xs text-[#ffd9cf]">{state.error}</p>}
    </div>
  );
}
