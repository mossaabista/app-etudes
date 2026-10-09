"use client";

import { useActionState } from "react";
import Link from "next/link";

type Action = (prev: unknown, data: FormData) => Promise<{ error?: string } | undefined | null>;

/** Sign-in and sign-up share one card: the fields differ, the look does not. */
export function AuthForm({
  title,
  action,
  fields,
  submit,
  pendingLabel,
  footer,
}: {
  title: string;
  action: Action;
  fields: { name: string; label: string; type?: string; autoComplete?: string; minLength?: number }[];
  submit: string;
  pendingLabel: string;
  footer: { text: string; link: string; href: string };
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <div className="glass-card p-6">
      <h2 className="mb-5 text-base font-semibold text-[var(--ink)]">{title}</h2>
      <form action={formAction} className="space-y-4">
        {state?.error && <p className="rounded-xl bg-[rgba(220,60,40,0.18)] px-3 py-2 text-xs text-[#ffd9cf]">{state.error}</p>}
        {fields.map((f) => (
          <label key={f.name} className="block text-xs font-medium text-[var(--ink-dim)]">
            {f.label}
            <input
              name={f.name}
              type={f.type ?? "text"}
              required
              minLength={f.minLength}
              autoComplete={f.autoComplete}
              className="glass-pill focus-ring mt-1.5 block w-full px-4 py-2.5 text-sm text-[var(--ink)]"
            />
          </label>
        ))}
        <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring w-full justify-center py-3 text-sm">
          {pending ? pendingLabel : submit}
        </button>
      </form>
      <p className="mt-5 text-center text-xs text-[var(--ink-dim)]">
        {footer.text}{" "}
        <Link href={footer.href} className="font-semibold text-[#f0cd79] hover:underline">
          {footer.link}
        </Link>
      </p>
    </div>
  );
}
