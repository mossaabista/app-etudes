import { requireUser } from "@/server/auth/current-user";
import { listDocuments } from "@/server/documents";
import { llmEnabled } from "@/server/llm";
import { PageHeader } from "@/components/ui/PageHeader";
import { DocumentsWorkspace } from "@/components/documents/DocumentsWorkspace";
import { getMessages } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getMessages()).nav.documents };
}

export default async function DocumentsPage() {
  const user = await requireUser();
  const [docs, t] = await Promise.all([listDocuments(user.id), getMessages()]);
  return (
    <div className="area-enter mx-auto max-w-4xl">
      <PageHeader title={t.nav.documents} description={t.workspace.docs.intro} />
      <DocumentsWorkspace initial={docs} ai={llmEnabled()} />
    </div>
  );
}
