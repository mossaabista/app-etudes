import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/server/auth/session";

interface IncomingSubscription {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as IncomingSubscription | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : null;
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : null;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Abonnement incomplet." }, { status: 400 });
  }

  // The endpoint is unique per device install. Re-subscribing on the same device
  // returns the same endpoint, so upsert instead of piling up duplicates.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh, auth, label: labelFrom(request) },
    update: { userId, p256dh, auth, label: labelFrom(request) },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;

  // Scoped to this user so one account cannot delete another's subscription.
  // Without an endpoint, drop every device on the account.
  const where = endpoint ? { userId, endpoint } : { userId };
  await prisma.pushSubscription.deleteMany({ where });

  return NextResponse.json({ ok: true });
}

function labelFrom(request: Request): string | null {
  const ua = request.headers.get("user-agent") ?? "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iPhone";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh/i.test(ua)) return "Mac";
  return ua.slice(0, 60) || null;
}
