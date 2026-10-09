import crypto from "node:crypto";

/**
 * Work the assistant prepared but did not do, waiting for the user's yes. It travels to
 * the browser and back as a signed token, so nothing needs storing, and so the browser
 * can neither change what was proposed nor confirm it for someone else. Confirming still
 * goes through every server check, as if the request had just been made.
 */

const TTL_MS = 10 * 60 * 1000;

export type PendingWork =
  | { kind: "plan"; actions: unknown[]; reply: string; page: string; opId: string }
  | { kind: "rules"; text: string; only: { kind: "event" | "task"; id: string }[]; opId: string };

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is missing.");
  return s;
};
const sign = (body: string) => crypto.createHmac("sha256", `pending:${secret()}`).update(body).digest("base64url");

export function sealPending(userId: string, work: PendingWork, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ u: userId, exp: now + TTL_MS, w: work })).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** The work, if the token is intact, this user's, and recent; otherwise why not. */
export function openPending(userId: string, token: string, now = Date.now()): { work: PendingWork } | { error: string } {
  const [body, sig] = String(token).split(".");
  if (!body || !sig) return { error: "Demande de confirmation invalide." };
  const expected = sign(body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return { error: "Demande de confirmation invalide." };
  let parsed: { u?: string; exp?: number; w?: PendingWork };
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { error: "Demande de confirmation invalide." };
  }
  if (parsed.u !== userId || !parsed.w) return { error: "Demande de confirmation invalide." };
  if (!parsed.exp || now > parsed.exp) return { error: "Cette proposition a expiré : redemande-la." };
  return { work: parsed.w };
}

export const newOpId = () => crypto.randomUUID();
