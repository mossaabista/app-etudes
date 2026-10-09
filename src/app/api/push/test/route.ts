import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/server/auth/session";
import { buildDailyDigest } from "@/server/notifications/digest";
import { sendToUser } from "@/server/notifications/push";

export const runtime = "nodejs";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Send the real digest so the test shows exactly what the morning push will say.
  // On an empty day there is no digest, so fall back to a placeholder rather than
  // leaving the user unsure whether anything was delivered.
  const digest = (await buildDailyDigest(userId)) ?? {
    title: "OROM",
    body: "Rien de prévu aujourd'hui. Les notifications fonctionnent.",
    url: "/today",
  };

  try {
    const result = await sendToUser(userId, { ...digest, tag: "test" });
    if (result.sent === 0) {
      return NextResponse.json(
        {
          error:
            result.removed > 0
              ? "L'abonnement de cet appareil n'est plus valide. Réactive les notifications."
              : "Aucun appareil abonné sur ce compte.",
          // Returned even on failure so it is clear what would have been sent.
          preview: digest,
          ...result,
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, preview: digest, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Envoi échoué." },
      { status: 500 }
    );
  }
}
