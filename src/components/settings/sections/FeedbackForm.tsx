"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Send } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { sendFeedbackAction } from "@/server/actions/settings.actions";

export function FeedbackForm() {
  const { t } = useI18n();
  const s = t.settings;
  const page = usePathname();
  const [text, setText] = useState("");
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await sendFeedbackAction(text, page);
          if ("error" in r) setNote({ text: r.error ?? "", error: true });
          else {
            setText("");
            setNote({ text: s.feedbackThanks });
          }
        });
      }}
      className="space-y-2"
    >
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={4000} placeholder={s.feedbackPh} aria-label={s.feedbackTitle} className="glass-pill focus-ring block w-full rounded-2xl px-4 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)]" />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
          <Send size={13} /> {s.feedbackSend}
        </button>
        {note && (
          <span role="status" className={`text-xs ${note.error ? "text-[#ffb3a3]" : "text-[#86d6a4]"}`}>
            {note.text}
          </span>
        )}
      </div>
    </form>
  );
}
