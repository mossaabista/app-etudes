import { requireUser } from "@/server/auth/current-user";
import { listDocuments } from "@/server/documents";
import { llmEnabled } from "@/server/llm";
import { PageHeader } from "@/components/ui/PageHeader";
import { DocumentsWorkspace } from "@/components/documents/DocumentsWorkspace";

export const metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const user = await requireUser();
  const docs = await listDocuments(user.id);
  return (
    <div className="area-enter mx-auto max-w-4xl">
      <PageHeader title="Documents" description="Tes fichiers, leurs résumés, et des réponses qui disent d'où elles viennent." />
      <DocumentsWorkspace initial={docs} ai={llmEnabled()} />
    </div>
  );
}
