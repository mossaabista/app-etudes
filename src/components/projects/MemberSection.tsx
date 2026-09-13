"use client";

import { useActionState } from "react";
import { addMemberAction, deleteMemberAction } from "@/server/actions/project.actions";
import { Field, Input } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";

type Member = { id: string; name: string; email: string | null; role: string | null };

export function MemberSection({ members, projectId }: { members: Member[]; projectId: string }) {
  const [state, formAction, pending] = useActionState(addMemberAction, null);

  return (
    <div>
      {members.length > 0 && (
        <ul className="mb-4 space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2">
              <Avatar name={m.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{m.name}</p>
                <p className="text-xs text-slate-500">{m.role ?? "Member"}{m.email ? ` · ${m.email}` : ""}</p>
              </div>
              <button onClick={() => deleteMemberAction(m.id, projectId)} className="text-xs text-slate-400 hover:text-red-500">✕</button>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="flex gap-2 items-end">
        <input type="hidden" name="projectId" value={projectId} />
        <div className="flex-1">
          <Field label="Name" htmlFor="memName">
            <Input id="memName" name="name" placeholder="John" required />
          </Field>
        </div>
        <div className="flex-1">
          <Field label="Role" htmlFor="memRole">
            <Input id="memRole" name="role" placeholder="Developer" />
          </Field>
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>Add</Button>
      </form>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
