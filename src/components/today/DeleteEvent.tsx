"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { deleteEvent } from "@/server/actions/event.actions";

export function DeleteEvent({ id }: { id: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      onClick={() => start(() => void deleteEvent(id))}
      disabled={pending}
      aria-label="Supprimer l'événement"
      className="focus-ring rounded-full p-1 text-slate-300 transition-colors hover:text-rose-500 disabled:opacity-40"
    >
      <X size={13} />
    </button>
  );
}
