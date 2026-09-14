import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { BrightspaceSync, type SourceInfo } from "@/components/sync/BrightspaceSync";

export default async function SyncPage() {
  const user = await requireUser();
  const source = await prisma.syncSource.findUnique({
    where: { userId_provider: { userId: user.id, provider: "brightspace" } },
  });

  const info: SourceInfo | null = source
    ? {
        maskedUrl: maskFeedUrl(source.feedUrl),
        lastSyncedAt: source.lastSyncedAt?.toISOString() ?? null,
        lastStatus: source.lastStatus,
        lastMessage: source.lastMessage,
      }
    : null;

  return (
    <>
      <PageHeader
        title="Synchronisation"
        description="Importe tes échéances depuis Brightspace, sans les saisir à la main."
      />
      <BrightspaceSync source={info} autoSync={Boolean(process.env.CRON_SECRET)} />
    </>
  );
}

// The query string carries the personal feed token, so it never reaches the client.
function maskFeedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}${parsed.search ? "?…" : ""}`;
  } catch {
    return "lien enregistré";
  }
}
