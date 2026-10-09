"use client";

import { useState } from "react";
import { deleteAccountAction } from "@/server/actions/account.actions";

const field = "w-full rounded-xl border border-[rgba(255,220,148,0.16)] bg-[rgba(20,14,6,0.55)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[rgba(255,179,163,0.5)]";

/** Delete the account: hidden behind a first click, then password and the word typed out. */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-[#ffb3a3] underline-offset-2 hover:underline">
        Supprimer mon compte…
      </button>
    );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await deleteAccountAction({ password, confirm });
          if (r && "error" in r) setError(r.error);
        } catch (err) {
          // The redirect after a successful deletion arrives as a thrown navigation.
          if (!(err instanceof Error && /NEXT_REDIRECT/.test(err.message))) setError("Je n'ai pas pu joindre le serveur : rien n'a été supprimé.");
          else throw err;
        }
        setBusy(false);
      }}
      className="space-y-2 rounded-xl border border-[rgba(255,179,163,0.3)] p-3"
    >
      <p className="text-xs leading-5 text-[var(--ink)]">
        Tout sera effacé définitivement : cours, tâches, agenda, documents, suivis, automatisations et mémoire de l&apos;assistant. Exporte tes données avant si tu veux en garder une copie. Cette action ne peut pas être annulée.
      </p>
      <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ton mot de passe" aria-label="Mot de passe" className={field} />
      <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Tape SUPPRIMER" aria-label="Confirmation" className={field} />
      {error && (
        <p role="alert" className="text-xs text-[#ffb3a3]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !password || confirm.trim() !== "SUPPRIMER"} className="mod-chip focus-ring text-[#ffb3a3]">
          {busy ? "Suppression…" : "Supprimer définitivement"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="mod-chip focus-ring">
          Garder mon compte
        </button>
      </div>
    </form>
  );
}
