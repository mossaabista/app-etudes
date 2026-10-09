import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { getMessages } from "@/i18n/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { BrightspaceSync, type SourceInfo } from "@/components/sync/BrightspaceSync";

export async function generateMetadata() {
  return { title: (await getMessages()).connections.title };
}

export default async function SyncPage() {
  const user = await requireUser();
  const t = await getMessages();
  const source = await prisma.syncSource.findUnique({
    where: { userId_provider: { userId: user.id, provider: "brightspace" } },
  });

  const info: SourceInfo | null = source
    ? {
        maskedUrl: maskFeedUrl(source.feedUrl),
        lastSyncedAt: source.lastSyncedAt?.toISOString() ?? null,
        lastStatus: source.lastStatus,
        lastMessage: null,
      }
    : null;

  return (
    <>
      <PageHeader
        title={t.connections.title}
        description={t.connections.subtitle}
      />
      <BrightspaceSync source={info} autoSync={Boolean(process.env.CRON_SECRET)} />
    </>
  );
}

// The query string carries the personal feed token: only the host is ever sent to the browser.
function maskFeedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}${parsed.search ? "?…" : ""}`;
  } catch {
    return "lien enregistré";
  }
}
