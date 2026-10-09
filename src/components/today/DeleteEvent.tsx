"use client";

import { useI18n } from "@/i18n/client";
import { useTransition } from "react";
import { X } from "lucide-react";
import { deleteEvent } from "@/server/actions/event.actions";

export function DeleteEvent({ id }: { id: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();

  return (
    <button
      onClick={() => start(() => void deleteEvent(id))}
      disabled={pending}
      aria-label={t.today.deleteEvent}
      className="focus-ring rounded-full p-1 text-[var(--ink-faint)] transition-colors hover:text-[#ffb3a3] disabled:opacity-40"
    >
      <X size={13} />
    </button>
  );
}
